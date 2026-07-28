from __future__ import annotations

from pathlib import Path

import geopandas as gpd

from app.core.config import get_settings
from app.storage.base import SpatialBackend, StoredLayerRef

settings = get_settings()


class SpatiaLiteBackend(SpatialBackend):
    """SQLite + SpatiaLite via GDAL/OGR."""

    name = "spatialite"

    def is_available(self) -> tuple[bool, str]:
        try:
            path = settings.data_dir / "spatialite" / "_probe.sqlite"
            path.parent.mkdir(parents=True, exist_ok=True)
            probe = gpd.GeoDataFrame({"id": [1]}, geometry=gpd.points_from_xy([0], [0]), crs="EPSG:4326")
            probe.to_file(path, driver="SQLite", spatialite=True, layer="probe")
            gpd.read_file(path, layer="probe")
            path.unlink(missing_ok=True)
            return True, "SpatiaLite (GDAL SQLite) ready"
        except Exception as exc:  # noqa: BLE001
            return False, f"SpatiaLite unavailable: {exc}"

    def write_layer(self, layer_id: str, gdf: gpd.GeoDataFrame, *, slug: str) -> StoredLayerRef:
        path = settings.data_dir / "spatialite" / f"{layer_id}.sqlite"
        path.parent.mkdir(parents=True, exist_ok=True)
        if path.exists():
            path.unlink()
        table = (slug[:50] or "layer").replace("-", "_")
        gdf.to_file(path, driver="SQLite", spatialite=True, layer=table)
        return StoredLayerRef(backend=self.name, uri=str(path), table_name=table)

    def read_layer(self, ref: StoredLayerRef) -> gpd.GeoDataFrame:
        path = Path(ref.uri)
        if not path.exists():
            raise FileNotFoundError(f"SpatiaLite DB missing: {path}")
        gdf = gpd.read_file(path, layer=ref.table_name) if ref.table_name else gpd.read_file(path)
        if gdf.crs is None:
            gdf = gdf.set_crs("EPSG:4326")
        return gdf
