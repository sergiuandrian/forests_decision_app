"""Stdio MCP server for any MCP-compatible host.

Usage:
  GEOPIPE_API_URL=http://127.0.0.1:8000 GEOPIPE_API_KEY=gp_... \\
    PYTHONPATH=geopipe/backend python -m app.mcp.stdio_server
"""

from __future__ import annotations

import argparse
import json
import os
from typing import Any

import httpx
from mcp.server.fastmcp import FastMCP

from app.mcp.tools import TOOL_DEFINITIONS

API_URL = os.environ.get("GEOPIPE_API_URL", "http://127.0.0.1:8000").rstrip("/")
API_KEY = os.environ.get("GEOPIPE_API_KEY", "")

mcp = FastMCP("geopipe")


def _headers() -> dict[str, str]:
    if not API_KEY:
        raise RuntimeError("GEOPIPE_API_KEY is required for the stdio MCP bridge")
    return {"X-API-Key": API_KEY, "Content-Type": "application/json"}


def _call(tool_name: str, payload: dict[str, Any] | None = None) -> str:
    response = httpx.post(
        f"{API_URL}/v1/mcp/tools/{tool_name}",
        headers=_headers(),
        json=payload or {},
        timeout=60.0,
    )
    response.raise_for_status()
    return json.dumps(response.json(), default=str)


@mcp.tool(name="list_layers", description=TOOL_DEFINITIONS[0]["description"])
def list_layers() -> str:
    """List published spatial layers."""
    return _call("list_layers")


@mcp.tool(name="list_spatial_backends", description=TOOL_DEFINITIONS[1]["description"])
def list_spatial_backends() -> str:
    """List spatial database backends."""
    return _call("list_spatial_backends")


@mcp.tool(name="query_features", description=TOOL_DEFINITIONS[2]["description"])
def query_features(layer_id: str, bbox: list[float] | None = None, limit: int = 100) -> str:
    """Query features from a layer."""
    payload: dict[str, Any] = {"layer_id": layer_id, "limit": limit}
    if bbox:
        payload["bbox"] = bbox
    return _call("query_features", payload)


@mcp.tool(name="layer_stats", description=TOOL_DEFINITIONS[3]["description"])
def layer_stats(layer_id: str) -> str:
    """Return spatial statistics for a layer."""
    return _call("layer_stats", {"layer_id": layer_id})


@mcp.tool(name="buffer", description=TOOL_DEFINITIONS[4]["description"])
def buffer(layer_id: str, distance_meters: float, limit: int = 100) -> str:
    """Buffer geometries by meters."""
    return _call(
        "buffer",
        {"layer_id": layer_id, "distance_meters": distance_meters, "limit": limit},
    )


@mcp.tool(name="intersect", description=TOOL_DEFINITIONS[5]["description"])
def intersect(layer_a_id: str, layer_b_id: str) -> str:
    """Intersect two layers."""
    return _call("intersect", {"layer_a_id": layer_a_id, "layer_b_id": layer_b_id})


@mcp.tool(name="crs_transform", description=TOOL_DEFINITIONS[6]["description"])
def crs_transform(geometry: dict[str, Any], target_crs: str) -> str:
    """Transform a GeoJSON geometry CRS."""
    return _call("crs_transform", {"geometry": geometry, "target_crs": target_crs})


def main() -> None:
    """CLI entrypoint for stdio MCP transport."""
    parser = argparse.ArgumentParser(description="GeoPipe MCP stdio server")
    parser.add_argument("--api-url", default=None, help="GeoPipe API base URL")
    parser.add_argument("--api-key", default=None, help="GeoPipe API key")
    args, _unknown = parser.parse_known_args()

    global API_URL, API_KEY
    if args.api_url:
        API_URL = args.api_url.rstrip("/")
        os.environ["GEOPIPE_API_URL"] = API_URL
    if args.api_key:
        API_KEY = args.api_key
        os.environ["GEOPIPE_API_KEY"] = API_KEY

    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
