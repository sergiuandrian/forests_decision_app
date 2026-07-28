"""Tests for pluggable spatial backends."""

from pathlib import Path

import geopandas as gpd
from shapely.geometry import Point, box

from app.storage.duckdb_spatial import DuckDBSpatialBackend
from app.storage.geopackage import GeoPackageBackend
from app.storage.spatialite import SpatiaLiteBackend


def _sample_gdf() -> gpd.GeoDataFrame:
    return gpd.GeoDataFrame(
        {"name": ["a", "b"]},
        geometry=[Point(2.35, 48.85), box(2.32, 48.85, 2.36, 48.87)],
        crs="EPSG:4326",
    )


def test_geopackage_roundtrip(tmp_path: Path, monkeypatch) -> None:
    from app.core import config

    monkeypatch.setattr(config.get_settings(), "data_dir", tmp_path)
    backend = GeoPackageBackend()
    assert backend.is_available()[0]
    ref = backend.write_layer("abc123", _sample_gdf(), slug="paris")
    loaded = backend.read_layer(ref)
    assert len(loaded) == 2
    assert loaded.crs is not None


def test_duckdb_roundtrip(tmp_path: Path, monkeypatch) -> None:
    from app.core import config

    monkeypatch.setattr(config.get_settings(), "data_dir", tmp_path)
    backend = DuckDBSpatialBackend()
    ok, message = backend.is_available()
    assert ok, message
    ref = backend.write_layer("duck123", _sample_gdf(), slug="paris-sites")
    loaded = backend.read_layer(ref)
    assert len(loaded) == 2


def test_spatialite_roundtrip_if_available(tmp_path: Path, monkeypatch) -> None:
    from app.core import config

    monkeypatch.setattr(config.get_settings(), "data_dir", tmp_path)
    backend = SpatiaLiteBackend()
    ok, _message = backend.is_available()
    if not ok:
        return
    ref = backend.write_layer("spl123", _sample_gdf(), slug="paris")
    loaded = backend.read_layer(ref)
    assert len(loaded) == 2
