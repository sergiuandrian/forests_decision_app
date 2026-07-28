from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Query, UploadFile
from fastapi.responses import Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.config import get_settings
from app.models import ApiKey, Layer, Project, UsageEvent
from app.services import ingest, spatial

router = APIRouter()


async def require_project(
    db: Annotated[AsyncSession, Depends(get_db)],
    x_api_key: Annotated[str | None, Header(alias="X-API-Key")] = None,
) -> tuple[Project, ApiKey | None]:
    """Resolve project from API key, or fall back to default project for local MVP UI."""
    if x_api_key:
        project, api_key = await ingest.authenticate_api_key(db, x_api_key)
        return project, api_key
    project = await ingest.ensure_default_project(db)
    return project, None


@router.get("/health")
async def health() -> dict[str, str]:
    """Liveness probe."""
    return {"status": "ok", "service": "geopipe"}


@router.get("/bootstrap")
async def bootstrap(db: Annotated[AsyncSession, Depends(get_db)]) -> dict:
    """Ensure default project exists and return dashboard bootstrap payload."""
    from app.storage.registry import list_backends

    project = await ingest.ensure_default_project(db)
    api_key = await ingest.get_project_api_key(db, project.id)
    layers_result = await db.execute(select(Layer).where(Layer.project_id == project.id).order_by(Layer.created_at.desc()))
    layers = layers_result.scalars().all()
    usage_result = await db.execute(
        select(func.coalesce(func.sum(UsageEvent.units), 0)).where(UsageEvent.project_id == project.id)
    )
    used = int(usage_result.scalar_one())
    bootstrap_key = getattr(project, "_bootstrap_api_key", None)
    return {
        "project": {"id": project.id, "name": project.name, "plan": project.plan},
        "api_key_prefix": api_key.key_prefix if api_key else None,
        "api_key": bootstrap_key,
        "usage": {"requests": used, "limit": 10_000},
        "backends": list_backends(),
        "default_backend": get_settings().spatial_backend,
        "layers": [spatial.layer_to_dict(layer) for layer in layers],
    }


@router.post("/api-keys/rotate")
async def rotate_api_key(
    db: Annotated[AsyncSession, Depends(get_db)],
    project_auth: Annotated[tuple[Project, ApiKey | None], Depends(require_project)],
) -> dict:
    """Create a new API key and revoke previous ones."""
    project, _ = project_auth
    existing = await db.execute(select(ApiKey).where(ApiKey.project_id == project.id, ApiKey.revoked_at.is_(None)))
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)
    for key in existing.scalars().all():
        key.revoked_at = now

    raw, prefix, hashed = ingest.generate_api_key()
    api_key = ApiKey(project_id=project.id, name="rotated", key_prefix=prefix, key_hash=hashed)
    db.add(api_key)
    ingest.write_bootstrap_api_key(raw)
    await db.commit()
    return {"api_key": raw, "prefix": prefix, "warning": "Store this key now. It will not be shown again."}


@router.get("/layers")
async def list_layers(
    db: Annotated[AsyncSession, Depends(get_db)],
    project_auth: Annotated[tuple[Project, ApiKey | None], Depends(require_project)],
) -> dict:
    """List layers for the authenticated project."""
    project, api_key = project_auth
    result = await db.execute(select(Layer).where(Layer.project_id == project.id).order_by(Layer.created_at.desc()))
    layers = result.scalars().all()
    await ingest.record_usage(
        db,
        project_id=project.id,
        api_key_id=api_key.id if api_key else None,
        endpoint="list_layers",
    )
    return {"layers": [spatial.layer_to_dict(layer) for layer in layers]}


@router.get("/backends")
async def backends() -> dict:
    """List spatial database backends and availability."""
    from app.storage.registry import list_backends

    return {
        "default": get_settings().spatial_backend,
        "backends": list_backends(),
    }


@router.post("/layers")
async def upload_layer(
    db: Annotated[AsyncSession, Depends(get_db)],
    project_auth: Annotated[tuple[Project, ApiKey | None], Depends(require_project)],
    file: UploadFile = File(...),
    name: str | None = Form(default=None),
    backend: str | None = Form(default=None),
) -> dict:
    """Upload and publish a spatial file as a layer."""
    project, api_key = project_auth
    layer = await ingest.ingest_upload(
        db,
        project=project,
        upload=file,
        layer_name=name,
        backend_name=backend,
    )
    await ingest.record_usage(
        db,
        project_id=project.id,
        api_key_id=api_key.id if api_key else None,
        endpoint="upload_layer",
    )
    return spatial.layer_to_dict(layer)


@router.get("/layers/{layer_id}")
async def get_layer(
    layer_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    project_auth: Annotated[tuple[Project, ApiKey | None], Depends(require_project)],
) -> dict:
    """Return layer metadata."""
    project, api_key = project_auth
    layer = await db.get(Layer, layer_id)
    if not layer or layer.project_id != project.id:
        raise HTTPException(status_code=404, detail="Layer not found")
    await ingest.record_usage(
        db,
        project_id=project.id,
        api_key_id=api_key.id if api_key else None,
        endpoint="get_layer",
    )
    return spatial.layer_to_dict(layer)


@router.get("/layers/{layer_id}/features")
async def get_features(
    layer_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    project_auth: Annotated[tuple[Project, ApiKey | None], Depends(require_project)],
    bbox: str | None = Query(default=None, description="minLon,minLat,maxLon,maxLat"),
    limit: int = Query(default=200, ge=1, le=5000),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """Query layer features as GeoJSON."""
    project, api_key = project_auth
    layer = await db.get(Layer, layer_id)
    if not layer or layer.project_id != project.id:
        raise HTTPException(status_code=404, detail="Layer not found")

    parsed_bbox = None
    if bbox:
        try:
            parts = [float(v) for v in bbox.split(",")]
            if len(parts) != 4:
                raise ValueError
            parsed_bbox = (parts[0], parts[1], parts[2], parts[3])
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="bbox must be minLon,minLat,maxLon,maxLat") from exc

    payload = spatial.query_features(layer, bbox=parsed_bbox, limit=limit, offset=offset)
    await ingest.record_usage(
        db,
        project_id=project.id,
        api_key_id=api_key.id if api_key else None,
        endpoint="features",
    )
    return payload


@router.get("/layers/{layer_id}/geojson")
async def get_geojson(
    layer_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    project_auth: Annotated[tuple[Project, ApiKey | None], Depends(require_project)],
    limit: int = Query(default=5000, ge=1, le=20000),
) -> dict:
    """Download layer as GeoJSON FeatureCollection."""
    project, api_key = project_auth
    layer = await db.get(Layer, layer_id)
    if not layer or layer.project_id != project.id:
        raise HTTPException(status_code=404, detail="Layer not found")
    payload = spatial.query_features(layer, limit=limit, offset=0)
    await ingest.record_usage(
        db,
        project_id=project.id,
        api_key_id=api_key.id if api_key else None,
        endpoint="geojson",
    )
    return payload


@router.get("/layers/{layer_id}/tiles/{z}/{x}/{y}.mvt")
async def get_tile(
    layer_id: str,
    z: int,
    x: int,
    y: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    project_auth: Annotated[tuple[Project, ApiKey | None], Depends(require_project)],
) -> Response:
    """Serve a Mapbox Vector Tile for a layer."""
    project, api_key = project_auth
    layer = await db.get(Layer, layer_id)
    if not layer or layer.project_id != project.id:
        raise HTTPException(status_code=404, detail="Layer not found")
    if z < 0 or z > 22:
        raise HTTPException(status_code=400, detail="Invalid zoom")

    tile = spatial.encode_mvt(layer, z, x, y)
    await ingest.record_usage(
        db,
        project_id=project.id,
        api_key_id=api_key.id if api_key else None,
        endpoint="tiles",
    )
    return Response(content=tile, media_type="application/vnd.mapbox-vector-tile")


@router.get("/layers/{layer_id}/stats")
async def get_stats(
    layer_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    project_auth: Annotated[tuple[Project, ApiKey | None], Depends(require_project)],
) -> dict:
    """Return spatial statistics for a layer."""
    project, api_key = project_auth
    layer = await db.get(Layer, layer_id)
    if not layer or layer.project_id != project.id:
        raise HTTPException(status_code=404, detail="Layer not found")
    stats = spatial.layer_stats(layer)
    await ingest.record_usage(
        db,
        project_id=project.id,
        api_key_id=api_key.id if api_key else None,
        endpoint="stats",
    )
    return stats


@router.post("/tools/buffer")
async def tool_buffer(
    payload: dict,
    db: Annotated[AsyncSession, Depends(get_db)],
    project_auth: Annotated[tuple[Project, ApiKey | None], Depends(require_project)],
) -> dict:
    """Buffer a layer by distance in meters."""
    project, api_key = project_auth
    layer_id = payload.get("layer_id")
    distance = float(payload.get("distance_meters", 100))
    layer = await db.get(Layer, layer_id)
    if not layer or layer.project_id != project.id:
        raise HTTPException(status_code=404, detail="Layer not found")
    result = spatial.buffer_layer(layer, distance_meters=distance)
    await ingest.record_usage(
        db,
        project_id=project.id,
        api_key_id=api_key.id if api_key else None,
        endpoint="buffer",
    )
    return result


@router.post("/tools/intersect")
async def tool_intersect(
    payload: dict,
    db: Annotated[AsyncSession, Depends(get_db)],
    project_auth: Annotated[tuple[Project, ApiKey | None], Depends(require_project)],
) -> dict:
    """Intersect two layers owned by the project."""
    project, api_key = project_auth
    layer_a = await db.get(Layer, payload.get("layer_a_id"))
    layer_b = await db.get(Layer, payload.get("layer_b_id"))
    if not layer_a or layer_a.project_id != project.id:
        raise HTTPException(status_code=404, detail="layer_a not found")
    if not layer_b or layer_b.project_id != project.id:
        raise HTTPException(status_code=404, detail="layer_b not found")
    result = spatial.intersect_layers(layer_a, layer_b)
    await ingest.record_usage(
        db,
        project_id=project.id,
        api_key_id=api_key.id if api_key else None,
        endpoint="intersect",
    )
    return result


@router.post("/tools/crs-transform")
async def tool_crs_transform(
    payload: dict,
    db: Annotated[AsyncSession, Depends(get_db)],
    project_auth: Annotated[tuple[Project, ApiKey | None], Depends(require_project)],
) -> dict:
    """Transform a GeoJSON geometry into another CRS."""
    project, api_key = project_auth
    geometry = payload.get("geometry")
    target_crs = payload.get("target_crs", "EPSG:3857")
    if not geometry:
        raise HTTPException(status_code=400, detail="geometry is required")
    result = spatial.crs_transform(geometry, target_crs=target_crs)
    await ingest.record_usage(
        db,
        project_id=project.id,
        api_key_id=api_key.id if api_key else None,
        endpoint="crs_transform",
    )
    return {"crs": target_crs, "geometry": result}
