from __future__ import annotations

import re

import geopandas as gpd
from sqlalchemy import create_engine, text

from app.core.config import get_settings
from app.storage.base import SpatialBackend, StoredLayerRef

settings = get_settings()


class PostGISBackend(SpatialBackend):
    """PostgreSQL + PostGIS table store."""

    name = "postgis"

    def _engine(self):
        if not settings.postgis_url:
            raise RuntimeError("POSTGIS_URL is not configured")
        return create_engine(settings.postgis_url)

    def is_available(self) -> tuple[bool, str]:
        if not settings.postgis_url:
            return False, "Set POSTGIS_URL to enable PostGIS (e.g. postgresql+psycopg://user:pass@localhost:5432/geopipe)"
        try:
            engine = self._engine()
            with engine.connect() as conn:
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
                conn.execute(text("SELECT PostGIS_Version()"))
            return True, "PostGIS connection ready"
        except Exception as exc:  # noqa: BLE001
            return False, f"PostGIS unavailable: {exc}"

    def write_layer(self, layer_id: str, gdf: gpd.GeoDataFrame, *, slug: str) -> StoredLayerRef:
        ok, message = self.is_available()
        if not ok:
            raise RuntimeError(message)
        table = re.sub(r"[^a-z0-9_]+", "_", (slug or "layer").lower())[:50] or "layer"
        table = f"layer_{layer_id[:8]}_{table}"[:60]
        engine = self._engine()
        gdf.to_postgis(table, engine, if_exists="replace", index=False)
        return StoredLayerRef(backend=self.name, uri=settings.postgis_url, table_name=table)

    def read_layer(self, ref: StoredLayerRef) -> gpd.GeoDataFrame:
        if not ref.table_name:
            raise ValueError("PostGIS layer is missing table_name")
        engine = create_engine(ref.uri or settings.postgis_url)
        gdf = gpd.read_postgis(f"SELECT * FROM {ref.table_name}", engine, geom_col="geometry")
        if gdf.crs is None:
            gdf = gdf.set_crs("EPSG:4326")
        elif str(gdf.crs).upper() not in {"EPSG:4326", "WGS84"}:
            gdf = gdf.to_crs("EPSG:4326")
        return gdf
