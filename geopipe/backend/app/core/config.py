from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "GeoPipe"
    api_prefix: str = "/v1"
    database_url: str = "sqlite+aiosqlite:///./geopipe.db"
    data_dir: Path = Path(__file__).resolve().parents[3] / "data"
    upload_dir: Path = Path(__file__).resolve().parents[3] / "uploads"
    default_crs: str = "EPSG:4326"
    max_upload_mb: int = 50
    free_request_limit: int = 10_000
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    # Spatial stores: geopackage | duckdb | spatialite | postgis
    spatial_backend: str = "geopackage"
    postgis_url: str | None = None
    # Public base URL used in agent connector snippets
    public_base_url: str = "http://127.0.0.1:8000"
    mcp_server_name: str = "geopipe"


@lru_cache
def get_settings() -> Settings:
    """Return cached settings instance."""
    settings = Settings()
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    return settings
