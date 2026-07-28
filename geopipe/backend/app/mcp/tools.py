"""Shared spatial tool definitions and execution for any AI agent runtime.

Supports:
- MCP tool schema (Claude Desktop, Copilot, Continue, Cursor, custom MCP hosts)
- OpenAI-compatible function tools
- Direct HTTP tool invocation
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Layer, Project
from app.services import spatial

TOOL_DEFINITIONS: list[dict[str, Any]] = [
    {
        "name": "list_layers",
        "description": "List published spatial layers available to the authenticated project.",
        "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "name": "list_spatial_backends",
        "description": "List available spatial database backends (GeoPackage, DuckDB, SpatiaLite, PostGIS).",
        "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "name": "query_features",
        "description": "Query features from a layer with optional bbox filter [minLon,minLat,maxLon,maxLat].",
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
        "description": "Buffer layer geometries by a distance in meters and return GeoJSON.",
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
        "description": "Intersect two layers and return the resulting geometries as GeoJSON.",
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
                "target_crs": {"type": "string"},
            },
        },
    },
]


def openai_tools() -> list[dict[str, Any]]:
    """Convert tool definitions to OpenAI function-calling format."""
    return [
        {
            "type": "function",
            "function": {
                "name": tool["name"],
                "description": tool["description"],
                "parameters": tool["inputSchema"],
            },
        }
        for tool in TOOL_DEFINITIONS
    ]


async def execute_tool(
    db: AsyncSession,
    *,
    project: Project,
    tool_name: str,
    payload: dict[str, Any] | None = None,
) -> Any:
    """Execute a named spatial tool in the context of a project."""
    payload = payload or {}

    async def owned_layer(layer_id: str) -> Layer:
        layer = await db.get(Layer, layer_id)
        if not layer or layer.project_id != project.id:
            raise ValueError(f"Layer not found: {layer_id}")
        return layer

    if tool_name == "list_layers":
        result = await db.execute(select(Layer).where(Layer.project_id == project.id))
        layers = result.scalars().all()
        return {"layers": [spatial.layer_to_dict(layer) for layer in layers]}

    if tool_name == "list_spatial_backends":
        from app.storage.registry import BACKENDS

        return {"backends": [backend.describe() for backend in BACKENDS.values()]}

    if tool_name == "query_features":
        layer = await owned_layer(payload["layer_id"])
        bbox = payload.get("bbox")
        parsed = tuple(bbox) if bbox else None
        return spatial.query_features(layer, bbox=parsed, limit=int(payload.get("limit", 100)))  # type: ignore[arg-type]

    if tool_name == "layer_stats":
        layer = await owned_layer(payload["layer_id"])
        return spatial.layer_stats(layer)

    if tool_name == "buffer":
        layer = await owned_layer(payload["layer_id"])
        return spatial.buffer_layer(
            layer,
            distance_meters=float(payload["distance_meters"]),
            limit=int(payload.get("limit", 100)),
        )

    if tool_name == "intersect":
        a = await owned_layer(payload["layer_a_id"])
        b = await owned_layer(payload["layer_b_id"])
        return spatial.intersect_layers(a, b)

    if tool_name == "crs_transform":
        return {
            "crs": payload["target_crs"],
            "geometry": spatial.crs_transform(payload["geometry"], payload["target_crs"]),
        }

    raise ValueError(f"Unknown tool: {tool_name}")
