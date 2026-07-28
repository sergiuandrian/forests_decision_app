"""Basic spatial service tests for GeoPipe MVP."""

from pathlib import Path

import geopandas as gpd
from shapely.geometry import Point, box

from app.models import Layer
from app.services.spatial import encode_mvt, layer_stats, query_features_from_gdf


def test_query_features_from_gdf_roundtrip(tmp_path: Path) -> None:
    gdf = gpd.GeoDataFrame(
        {"name": ["a", "b"]},
        geometry=[Point(2.35, 48.85), Point(2.30, 48.86)],
        crs="EPSG:4326",
    )
    payload = query_features_from_gdf(gdf)
    assert payload["type"] == "FeatureCollection"
    assert len(payload["features"]) == 2


def test_encode_mvt_and_stats(tmp_path: Path) -> None:
    gdf = gpd.GeoDataFrame(
        {"name": ["poly"]},
        geometry=[box(2.32, 48.85, 2.36, 48.87)],
        crs="EPSG:4326",
    )
    gpkg = tmp_path / "layer.gpkg"
    gdf.to_file(gpkg, driver="GPKG")
    layer = Layer(
        id="testlayer",
        project_id="proj",
        name="Test",
        slug="test",
        source_filename="test.gpkg",
        gpkg_path=str(gpkg),
        crs="EPSG:4326",
        geometry_type="Polygon",
        feature_count=1,
        bbox_west=2.32,
        bbox_south=48.85,
        bbox_east=2.36,
        bbox_north=48.87,
    )
    tile = encode_mvt(layer, 12, 2074, 1409)
    assert isinstance(tile, (bytes, bytearray))
    assert len(tile) > 0
    stats = layer_stats(layer)
    assert stats["feature_count"] == 1
    assert stats["approx_area_m2"] is not None
