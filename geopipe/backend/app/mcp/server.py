"""HTTP-accessible MCP-style tool catalog for AI agents.

A full stdio MCP process can wrap these same operations; the MVP exposes an
HTTP tool manifest so Cursor/Claude connectors can call GeoPipe over the API.
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import Layer
from app.services import ingest, spatial

router = APIRouter(prefix="/mcp", tags=["mcp"])


TOOLS: list[dict[str, Any]] = [
    {
        "name": "list_layers",
        "description": "List published spatial layers available to the API key.",
        "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "name": "query_features",
        "description": "Query features from a layer with optional bbox filter.",
        "inputSchema": {
            "type": "object",
            "required": ["layer_id"],
            "properties": {
                "layer_id": {"type": "string"},
                "bbox": {
                    "type": "array",
                    "items": {"type": "number"},
                    "minItems": 4,
                    "maxItems": 4,
                    "description": "[minLon, minLat, maxLon, maxLat]",
                },
                "limit": {"type": "integer", "default": 100, "maximum": 1000},
            },
        },
    },
    {
        "name": "layer_stats",
        "description": "Return feature counts, bbox, and approximate length/area for a layer.",
        "inputSchema": {
            "type": "object",
            "required": ["layer_id"],
            "properties": {"layer_id": {"type": "string"}},
        },
    },
    {
        "name": "buffer",
        "description": "Buffer layer geometries by a distance in meters.",
        "inputSchema": {
            "type": "object",
            "required": ["layer_id", "distance_meters"],
            "properties": {
                "layer_id": {"type": "string"},
                "distance_meters": {"type": "number"},
                "limit": {"type": "integer", "default": 100},
            },
        },
    },
    {
        "name": "intersect",
        "description": "Intersect two layers and return the resulting geometries.",
        "inputSchema": {
            "type": "object",
            "required": ["layer_a_id", "layer_b_id"],
            "properties": {
                "layer_a_id": {"type": "string"},
                "layer_b_id": {"type": "string"},
            },
        },
    },
    {
        "name": "crs_transform",
        "description": "Transform a GeoJSON geometry from EPSG:4326 into another CRS.",
        "inputSchema": {
            "type": "object",
            "required": ["geometry", "target_crs"],
            "properties": {
                "geometry": {"type": "object"},
                "target_crs": {"type": "string", "examples": ["EPSG:3857", "EPSG:32633"]},
            },
        },
    },
]


@router.get("/tools")
async def list_tools() -> dict[str, Any]:
    """Return MCP-compatible tool definitions."""
    return {"tools": TOOLS}


@router.post("/tools/{tool_name}")
async def call_tool(
    tool_name: str,
    payload: dict[str, Any],
    db: Annotated[AsyncSession, Depends(get_db)],
    x_api_key: Annotated[str | None, Header(alias="X-API-Key")] = None,
) -> dict[str, Any]:
    """Execute a named spatial tool for an authenticated project."""
    project, api_key = await ingest.authenticate_api_key(db, x_api_key)

    async def owned_layer(layer_id: str) -> Layer:
        layer = await db.get(Layer, layer_id)
        if not layer or layer.project_id != project.id:
            raise HTTPException(status_code=404, detail=f"Layer not found: {layer_id}")
        return layer

    if tool_name == "list_layers":
        result = await db.execute(select(Layer).where(Layer.project_id == project.id))
        layers = result.scalars().all()
        data: Any = {"layers": [spatial.layer_to_dict(layer) for layer in layers]}
    elif tool_name == "query_features":
        layer = await owned_layer(payload["layer_id"])
        bbox = payload.get("bbox")
        parsed = tuple(bbox) if bbox else None
        data = spatial.query_features(
            layer,
            bbox=parsed,  # type: ignore[arg-type]
            limit=int(payload.get("limit", 100)),
        )
    elif tool_name == "layer_stats":
        layer = await owned_layer(payload["layer_id"])
        data = spatial.layer_stats(layer)
    elif tool_name == "buffer":
        layer = await owned_layer(payload["layer_id"])
        data = spatial.buffer_layer(
            layer,
            distance_meters=float(payload["distance_meters"]),
            limit=int(payload.get("limit", 100)),
        )
    elif tool_name == "intersect":
        a = await owned_layer(payload["layer_a_id"])
        b = await owned_layer(payload["layer_b_id"])
        data = spatial.intersect_layers(a, b)
    elif tool_name == "crs_transform":
        data = {
            "crs": payload["target_crs"],
            "geometry": spatial.crs_transform(payload["geometry"], payload["target_crs"]),
        }
    else:
        raise HTTPException(status_code=404, detail=f"Unknown tool: {tool_name}")

    await ingest.record_usage(
        db,
        project_id=project.id,
        api_key_id=api_key.id,
        endpoint=f"mcp:{tool_name}",
    )
    return {"tool": tool_name, "content": data}
