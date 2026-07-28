from __future__ import annotations

from pathlib import Path

import duckdb
import geopandas as gpd
from shapely import wkb

from app.core.config import get_settings
from app.storage.base import SpatialBackend, StoredLayerRef

settings = get_settings()


class DuckDBSpatialBackend(SpatialBackend):
    """DuckDB database with the spatial extension."""

    name = "duckdb"

    def _db_path(self, layer_id: str | None = None) -> Path:
        root = settings.data_dir / "duckdb"
        root.mkdir(parents=True, exist_ok=True)
        if layer_id:
            return root / f"{layer_id}.duckdb"
        return root / "geopipe.duckdb"

    def is_available(self) -> tuple[bool, str]:
        try:
            con = duckdb.connect(str(self._db_path("_probe")))
            con.execute("INSTALL spatial; LOAD spatial;")
            con.execute("SELECT ST_AsText(ST_Point(0, 0))")
            con.close()
            self._db_path("_probe").unlink(missing_ok=True)
            return True, "DuckDB Spatial ready"
        except Exception as exc:  # noqa: BLE001
            return False, f"DuckDB Spatial unavailable: {exc}"

    def write_layer(self, layer_id: str, gdf: gpd.GeoDataFrame, *, slug: str) -> StoredLayerRef:
        path = self._db_path(layer_id)
        if path.exists():
            path.unlink()
        table = (slug[:50] or "layer").replace("-", "_")
        frame = gdf.copy()
        frame["geom_wkb"] = frame.geometry.to_wkb()
        attrs = frame.drop(columns=["geometry"])
        con = duckdb.connect(str(path))
        try:
            con.execute("INSTALL spatial; LOAD spatial;")
            con.register("attrs_df", attrs)
            con.execute(
                f"CREATE TABLE {table} AS "
                "SELECT * EXCLUDE (geom_wkb), ST_GeomFromWKB(geom_wkb) AS geom FROM attrs_df"
            )
        finally:
            con.close()
        return StoredLayerRef(backend=self.name, uri=str(path), table_name=table)

    def read_layer(self, ref: StoredLayerRef) -> gpd.GeoDataFrame:
        path = Path(ref.uri)
        if not path.exists():
            raise FileNotFoundError(f"DuckDB file missing: {path}")
        table = ref.table_name or "layer"
        con = duckdb.connect(str(path), read_only=True)
        try:
            con.execute("INSTALL spatial; LOAD spatial;")
            rows = con.execute(
                f"SELECT * EXCLUDE (geom), ST_AsWKB(geom) AS geom_wkb FROM {table}"
            ).fetchdf()
        finally:
            con.close()
        geometry = rows["geom_wkb"].map(lambda value: wkb.loads(bytes(value)))
        return gpd.GeoDataFrame(rows.drop(columns=["geom_wkb"]), geometry=list(geometry), crs="EPSG:4326")
