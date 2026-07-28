from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router as api_router
from app.core.config import get_settings
from app.core.database import init_db
from app.mcp.server import router as agent_router
from app.mcp.sse import router as mcp_sse_router
from app.storage.registry import list_backends


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Initialize database and data directories on startup."""
    settings = get_settings()
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    await init_db()
    # Warm backend probes once so first UI load is fast.
    list_backends.cache_clear()
    list_backends()
    yield


def create_app() -> FastAPI:
    """Application factory."""
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        description=(
            "Upload spatial data into GeoPackage, DuckDB Spatial, SpatiaLite, or PostGIS. "
            "Serve Feature/MVT APIs and expose tools to any AI agent via MCP HTTP/stdio/SSE "
            "or OpenAI-compatible function calling."
        ),
        version="0.2.0",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins + ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(api_router, prefix=settings.api_prefix)
    app.include_router(agent_router, prefix=settings.api_prefix)
    app.include_router(mcp_sse_router, prefix=settings.api_prefix)
    return app


app = create_app()
