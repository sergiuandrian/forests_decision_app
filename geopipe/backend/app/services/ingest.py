from __future__ import annotations

import hashlib
import re
import secrets
import zipfile
from pathlib import Path

import geopandas as gpd
from fastapi import HTTPException, UploadFile
from shapely import make_valid
from shapely.geometry.base import BaseGeometry
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models import ApiKey, Layer, Project, UsageEvent

settings = get_settings()


def slugify(value: str) -> str:
    """Convert a layer name into a URL-safe slug."""
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "layer"


def hash_api_key(raw_key: str) -> str:
    """Hash an API key for storage."""
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()


def generate_api_key() -> tuple[str, str, str]:
    """Return raw key, prefix, and hash."""
    raw = f"gp_{secrets.token_urlsafe(24)}"
    return raw, raw[:10], hash_api_key(raw)


def _bootstrap_key_path() -> Path:
    return settings.data_dir / ".bootstrap_api_key"


def read_bootstrap_api_key() -> str | None:
    """Read locally persisted MVP API key (dev convenience only)."""
    path = _bootstrap_key_path()
    if path.exists():
        return path.read_text(encoding="utf-8").strip() or None
    return None


def write_bootstrap_api_key(raw_key: str) -> None:
    """Persist MVP API key for local dashboard bootstrap."""
    path = _bootstrap_key_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(raw_key, encoding="utf-8")


async def ensure_default_project(db: AsyncSession) -> Project:
    """Create or return the default MVP project with an API key."""
    result = await db.execute(select(Project).limit(1))
    project = result.scalar_one_or_none()
    if project:
        project._bootstrap_api_key = read_bootstrap_api_key()  # type: ignore[attr-defined]
        return project

    project = Project(name="Default Project", plan="free")
    db.add(project)
    await db.flush()

    raw, prefix, hashed = generate_api_key()
    db.add(ApiKey(project_id=project.id, name="default", key_prefix=prefix, key_hash=hashed))
    write_bootstrap_api_key(raw)
    await db.commit()
    await db.refresh(project)
    project._bootstrap_api_key = raw  # type: ignore[attr-defined]
    return project


async def get_project_api_key(db: AsyncSession, project_id: str) -> ApiKey | None:
    """Return the newest active API key for a project."""
    result = await db.execute(
        select(ApiKey)
        .where(ApiKey.project_id == project_id, ApiKey.revoked_at.is_(None))
        .order_by(ApiKey.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def authenticate_api_key(db: AsyncSession, raw_key: str | None) -> tuple[Project, ApiKey]:
    """Validate an API key and return its project."""
    if not raw_key:
        raise HTTPException(status_code=401, detail="Missing API key. Use X-API-Key header.")
    hashed = hash_api_key(raw_key)
    result = await db.execute(select(ApiKey).where(ApiKey.key_hash == hashed, ApiKey.revoked_at.is_(None)))
    api_key = result.scalar_one_or_none()
    if not api_key:
        raise HTTPException(status_code=401, detail="Invalid API key")
    project = await db.get(Project, api_key.project_id)
    if not project:
        raise HTTPException(status_code=401, detail="Invalid API key project")
    return project, api_key


async def record_usage(
    db: AsyncSession,
    *,
    project_id: str,
    endpoint: str,
    api_key_id: str | None = None,
    units: int = 1,
) -> None:
    """Persist a metered usage event."""
    db.add(
        UsageEvent(
            project_id=project_id,
            api_key_id=api_key_id,
            endpoint=endpoint,
            units=units,
        )
    )
    await db.commit()


def _validate_geometry(geom: BaseGeometry | None) -> BaseGeometry | None:
    if geom is None or geom.is_empty:
        return None
    if not geom.is_valid:
        geom = make_valid(geom)
    return geom if geom and not geom.is_empty else None


def _extract_upload(path: Path) -> Path:
    """Return a readable spatial path; unzip shapefile archives when needed."""
    if path.suffix.lower() != ".zip":
        return path

    extract_dir = path.with_suffix("")
    extract_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(path, "r") as archive:
        archive.extractall(extract_dir)

    shapefiles = list(extract_dir.rglob("*.shp"))
    if shapefiles:
        return shapefiles[0]
    gpkgs = list(extract_dir.rglob("*.gpkg"))
    if gpkgs:
        return gpkgs[0]
    geojsons = list(extract_dir.rglob("*.geojson")) + list(extract_dir.rglob("*.json"))
    if geojsons:
        return geojsons[0]
    raise HTTPException(status_code=400, detail="Zip archive did not contain a supported spatial file")


def read_spatial_file(path: Path) -> gpd.GeoDataFrame:
    """Load a spatial file into a GeoDataFrame with validated geometries."""
    source = _extract_upload(path)
    try:
        gdf = gpd.read_file(source)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Could not read spatial file: {exc}") from exc

    if gdf.empty or "geometry" not in gdf:
        raise HTTPException(status_code=400, detail="File contains no geometries")

    if gdf.crs is None:
        gdf = gdf.set_crs(settings.default_crs)
    elif str(gdf.crs).upper() not in {settings.default_crs, "EPSG:4326", "WGS84"}:
        gdf = gdf.to_crs(settings.default_crs)

    gdf["geometry"] = gdf["geometry"].apply(_validate_geometry)
    gdf = gdf[gdf["geometry"].notna()].copy()
    if gdf.empty:
        raise HTTPException(status_code=400, detail="No valid geometries after validation")

    gdf = gdf.reset_index(drop=True)
    gdf["geopipe_id"] = gdf.index.astype(int)
    return gdf


async def ingest_upload(
    db: AsyncSession,
    *,
    project: Project,
    upload: UploadFile,
    layer_name: str | None = None,
) -> Layer:
    """Validate an upload and persist it as a GeoPackage-backed layer."""
    filename = upload.filename or "upload.geojson"
    suffix = Path(filename).suffix.lower()
    if suffix not in {".geojson", ".json", ".gpkg", ".zip", ".shp"}:
        raise HTTPException(
            status_code=400,
            detail="Supported formats: GeoJSON, GeoPackage, Shapefile (.zip)",
        )

    content = await upload.read()
    max_bytes = settings.max_upload_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(status_code=400, detail=f"File exceeds {settings.max_upload_mb}MB limit")

    layer_id = secrets.token_hex(8)
    raw_path = settings.upload_dir / f"{layer_id}_{filename}"
    raw_path.write_bytes(content)

    gdf = read_spatial_file(raw_path)
    gpkg_path = settings.data_dir / f"{layer_id}.gpkg"
    gdf.to_file(gpkg_path, driver="GPKG")

    bounds = gdf.total_bounds
    name = layer_name or Path(filename).stem
    layer = Layer(
        id=layer_id,
        project_id=project.id,
        name=name,
        slug=slugify(name),
        source_filename=filename,
        gpkg_path=str(gpkg_path),
        crs=settings.default_crs,
        geometry_type=str(gdf.geom_type.value_counts().index[0]),
        feature_count=len(gdf),
        bbox_west=float(bounds[0]),
        bbox_south=float(bounds[1]),
        bbox_east=float(bounds[2]),
        bbox_north=float(bounds[3]),
    )
    db.add(layer)
    await db.commit()
    await db.refresh(layer)
    return layer


def load_layer_gdf(layer: Layer) -> gpd.GeoDataFrame:
    """Load a layer GeoPackage from disk."""
    path = Path(layer.gpkg_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Layer data file missing")
    gdf = gpd.read_file(path)
    if gdf.crs is None:
        gdf = gdf.set_crs(settings.default_crs)
    return gdf
