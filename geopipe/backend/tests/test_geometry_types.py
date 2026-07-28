"""Geometry type labeling helpers."""

import geopandas as gpd
from shapely.geometry import Point, box

from app.services.ingest import _summarize_geometry_types


def test_summarize_geometry_types_single() -> None:
    gdf = gpd.GeoDataFrame(geometry=[Point(0, 0), Point(1, 1)], crs="EPSG:4326")
    assert _summarize_geometry_types(gdf) == "Point"


def test_summarize_geometry_types_mixed() -> None:
    gdf = gpd.GeoDataFrame(
        geometry=[Point(0, 0), box(0, 0, 1, 1)],
        crs="EPSG:4326",
    )
    assert _summarize_geometry_types(gdf) == "Point, Polygon"
