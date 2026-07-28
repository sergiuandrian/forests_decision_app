from __future__ import annotations

from functools import lru_cache

from fastapi import HTTPException

from app.core.config import get_settings
from app.storage.base import SpatialBackend, StoredLayerRef
from app.storage.duckdb_spatial import DuckDBSpatialBackend
from app.storage.geopackage import GeoPackageBackend
from app.storage.postgis import PostGISBackend
from app.storage.spatialite import SpatiaLiteBackend

BACKENDS: dict[str, SpatialBackend] = {
    GeoPackageBackend.name: GeoPackageBackend(),
    DuckDBSpatialBackend.name: DuckDBSpatialBackend(),
    SpatiaLiteBackend.name: SpatiaLiteBackend(),
    PostGISBackend.name: PostGISBackend(),
}


@lru_cache
def list_backends() -> list[dict]:
    """Describe all registered spatial backends."""
    return [backend.describe() for backend in BACKENDS.values()]


def get_backend(name: str | None = None) -> SpatialBackend:
    """Resolve a spatial backend by name, falling back to settings default."""
    settings = get_settings()
    backend_name = (name or settings.spatial_backend or "geopackage").lower()
    backend = BACKENDS.get(backend_name)
    if not backend:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown spatial backend '{backend_name}'. Choose: {', '.join(BACKENDS)}",
        )
    ok, message = backend.is_available()
    if not ok:
        raise HTTPException(status_code=400, detail=message)
    return backend


def ref_from_layer(layer) -> StoredLayerRef:
    """Build a storage reference from a Layer ORM object."""
    backend = getattr(layer, "backend", None) or "geopackage"
    uri = getattr(layer, "storage_uri", None) or getattr(layer, "gpkg_path", None)
    table = getattr(layer, "table_name", None)
    if not uri:
        raise HTTPException(status_code=404, detail="Layer storage reference missing")
    return StoredLayerRef(backend=backend, uri=uri, table_name=table)


def read_layer_gdf(layer):
    """Load layer geometries from the backend recorded on the layer."""
    ref = ref_from_layer(layer)
    backend = BACKENDS.get(ref.backend) or get_backend(ref.backend)
    try:
        return backend.read_layer(ref)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Failed to read layer from {ref.backend}: {exc}") from exc
