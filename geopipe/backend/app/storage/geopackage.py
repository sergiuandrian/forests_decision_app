from __future__ import annotations

from pathlib import Path

import geopandas as gpd

from app.core.config import get_settings
from app.storage.base import SpatialBackend, StoredLayerRef

settings = get_settings()


class GeoPackageBackend(SpatialBackend):
    """Default file-backed store using GeoPackage."""

    name = "geopackage"

    def is_available(self) -> tuple[bool, str]:
        return True, "GeoPackage file store ready"

    def write_layer(self, layer_id: str, gdf: gpd.GeoDataFrame, *, slug: str) -> StoredLayerRef:
        path = settings.data_dir / "geopackage" / f"{layer_id}.gpkg"
        path.parent.mkdir(parents=True, exist_ok=True)
        gdf.to_file(path, driver="GPKG", layer=slug[:60] or "layer")
        return StoredLayerRef(backend=self.name, uri=str(path), table_name=slug[:60] or "layer")

    def read_layer(self, ref: StoredLayerRef) -> gpd.GeoDataFrame:
        path = Path(ref.uri)
        if not path.exists():
            raise FileNotFoundError(f"GeoPackage missing: {path}")
        kwargs = {"layer": ref.table_name} if ref.table_name else {}
        gdf = gpd.read_file(path, **kwargs)
        if gdf.crs is None:
            gdf = gdf.set_crs("EPSG:4326")
        return gdf
