from __future__ import annotations

import math
from typing import Any

import geopandas as gpd
import mapbox_vector_tile
import mercantile
from shapely.geometry import box, mapping, shape
from shapely.ops import transform
from pyproj import Transformer

from app.models import Layer
from app.services.ingest import load_layer_gdf


def layer_to_dict(layer: Layer) -> dict[str, Any]:
    """Serialize a layer for API responses."""
    return {
        "id": layer.id,
        "name": layer.name,
        "slug": layer.slug,
        "crs": layer.crs,
        "geometry_type": layer.geometry_type,
        "feature_count": layer.feature_count,
        "bbox": (
            [layer.bbox_west, layer.bbox_south, layer.bbox_east, layer.bbox_north]
            if layer.bbox_west is not None
            else None
        ),
        "created_at": layer.created_at.isoformat() if layer.created_at else None,
        "endpoints": {
            "features": f"/v1/layers/{layer.id}/features",
            "tiles": f"/v1/layers/{layer.id}/tiles/{{z}}/{{x}}/{{y}}.mvt",
            "geojson": f"/v1/layers/{layer.id}/geojson",
        },
    }


def query_features(
    layer: Layer,
    *,
    bbox: tuple[float, float, float, float] | None = None,
    limit: int = 200,
    offset: int = 0,
) -> dict[str, Any]:
    """Return GeoJSON FeatureCollection clipped by optional bbox."""
    gdf = load_layer_gdf(layer)
    if bbox:
        minx, miny, maxx, maxy = bbox
        gdf = gdf[gdf.intersects(box(minx, miny, maxx, maxy))]
    total = len(gdf)
    page = gdf.iloc[offset : offset + limit]
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "id": int(row.geopipe_id) if "geopipe_id" in page.columns else idx,
                "geometry": mapping(row.geometry),
                "properties": {
                    key: (None if (isinstance(value, float) and math.isnan(value)) else value)
                    for key, value in row.drop(labels=["geometry"]).items()
                    if key != "geometry"
                },
            }
            for idx, row in page.iterrows()
        ],
        "meta": {"total": total, "limit": limit, "offset": offset},
    }


def encode_mvt(layer: Layer, z: int, x: int, y: int) -> bytes:
    """Encode a Mapbox Vector Tile for the requested XYZ tile."""
    gdf = load_layer_gdf(layer)
    tile = mercantile.Tile(x=x, y=y, z=z)
    bounds = mercantile.bounds(tile)
    tile_poly = box(bounds.west, bounds.south, bounds.east, bounds.north)
    clipped = gdf[gdf.intersects(tile_poly)].copy()
    if clipped.empty:
        return mapbox_vector_tile.encode([{"name": layer.slug or layer.id, "features": []}])

    # Convert WGS84 coords into tile-local extent coordinates (0..4096).
    def project(lon: float, lat: float) -> tuple[float, float]:
        # mercantile uses XYZ; mapbox-vector-tile expects y down within the tile.
        px = (lon - bounds.west) / (bounds.east - bounds.west) * 4096
        py = (bounds.north - lat) / (bounds.north - bounds.south) * 4096
        return px, py

    features: list[dict[str, Any]] = []
    for _, row in clipped.iterrows():
        geom = transform(lambda lon, lat, z=None: project(lon, lat), row.geometry)
        if geom.is_empty:
            continue
        props = {
            key: value
            for key, value in row.drop(labels=["geometry"]).items()
            if key != "geometry" and not (isinstance(value, float) and math.isnan(value))
        }
        features.append({"geometry": mapping(geom), "properties": props})

    return mapbox_vector_tile.encode(
        [{"name": layer.slug or layer.id, "features": features}],
        default_options={"extents": 4096},
    )


def buffer_layer(layer: Layer, distance_meters: float, limit: int = 100) -> dict[str, Any]:
    """Buffer layer geometries in meters and return GeoJSON."""
    gdf = load_layer_gdf(layer).head(limit).copy()
    # Approximate meters using Web Mercator for MVP buffering.
    projected = gdf.to_crs("EPSG:3857")
    projected["geometry"] = projected.buffer(distance_meters)
    result = projected.to_crs("EPSG:4326")
    return query_features_from_gdf(result)


def intersect_layers(layer_a: Layer, layer_b: Layer, limit: int = 100) -> dict[str, Any]:
    """Intersect two layers and return resulting GeoJSON."""
    a = load_layer_gdf(layer_a)
    b = load_layer_gdf(layer_b)
    result = gpd.overlay(a, b, how="intersection", keep_geom_type=False)
    if result.empty:
        return {"type": "FeatureCollection", "features": [], "meta": {"total": 0}}
    return query_features_from_gdf(result.head(limit))


def crs_transform(geojson_geometry: dict[str, Any], target_crs: str) -> dict[str, Any]:
    """Transform a GeoJSON geometry into the target CRS."""
    geom = shape(geojson_geometry)
    transformer = Transformer.from_crs("EPSG:4326", target_crs, always_xy=True)
    projected = transform(transformer.transform, geom)
    return mapping(projected)


def layer_stats(layer: Layer) -> dict[str, Any]:
    """Return basic spatial statistics for a layer."""
    gdf = load_layer_gdf(layer)
    projected = gdf.to_crs("EPSG:3857")
    area = float(projected.area.sum()) if projected.geom_type.isin(["Polygon", "MultiPolygon"]).any() else None
    length = float(projected.length.sum()) if projected.geom_type.isin(["LineString", "MultiLineString"]).any() else None
    return {
        "id": layer.id,
        "name": layer.name,
        "feature_count": len(gdf),
        "geometry_types": gdf.geom_type.value_counts().to_dict(),
        "bbox": [float(v) for v in gdf.total_bounds],
        "approx_area_m2": area,
        "approx_length_m": length,
        "columns": [c for c in gdf.columns if c != "geometry"],
    }


def query_features_from_gdf(gdf: gpd.GeoDataFrame) -> dict[str, Any]:
    """Serialize an arbitrary GeoDataFrame to GeoJSON FeatureCollection."""
    features = []
    for idx, row in gdf.iterrows():
        props = {
            key: (None if (isinstance(value, float) and math.isnan(value)) else value)
            for key, value in row.drop(labels=["geometry"]).items()
        }
        features.append(
            {
                "type": "Feature",
                "id": idx if isinstance(idx, int) else str(idx),
                "geometry": mapping(row.geometry),
                "properties": props,
            }
        )
    return {"type": "FeatureCollection", "features": features, "meta": {"total": len(features)}}
