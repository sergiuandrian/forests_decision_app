"""HTTP MCP / agent tool endpoints for any AI host.

Works with MCP-compatible clients, OpenAI-style tool callers, LangChain,
custom agents, Claude Desktop (via bridge), Copilot, Continue, etc.
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.mcp.tools import TOOL_DEFINITIONS, execute_tool, openai_tools
from app.services import ingest

router = APIRouter(tags=["agents"])


@router.get("/mcp/tools")
async def list_mcp_tools() -> dict[str, Any]:
    """Return MCP-compatible tool definitions."""
    return {
        "protocol": "mcp-tools",
        "server": get_settings().mcp_server_name,
        "transports": ["http", "stdio", "sse"],
        "tools": TOOL_DEFINITIONS,
    }


@router.get("/agents/tools")
async def list_agent_tools() -> dict[str, Any]:
    """Return tools in OpenAI function-calling format plus MCP schema."""
    return {
        "openai": openai_tools(),
        "mcp": TOOL_DEFINITIONS,
    }


@router.post("/mcp/tools/{tool_name}")
@router.post("/agents/tools/{tool_name}")
async def call_tool(
    tool_name: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    payload: dict[str, Any] | None = None,
    x_api_key: Annotated[str | None, Header(alias="X-API-Key")] = None,
) -> dict[str, Any]:
    """Execute a named spatial tool for an authenticated project."""
    project, api_key = await ingest.authenticate_api_key(db, x_api_key)
    try:
        data = await execute_tool(db, project=project, tool_name=tool_name, payload=payload or {})
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    await ingest.record_usage(
        db,
        project_id=project.id,
        api_key_id=api_key.id,
        endpoint=f"tool:{tool_name}",
    )
    return {"tool": tool_name, "content": data}


@router.get("/agents/connectors")
async def agent_connectors(
    x_api_key: Annotated[str | None, Header(alias="X-API-Key")] = None,
) -> dict[str, Any]:
    """Return ready-to-paste connector configs for common AI hosts."""
    settings = get_settings()
    base = settings.public_base_url.rstrip("/")
    key = x_api_key or "$GEOPIPE_API_KEY"
    stdio_command = [
        "python",
        "-m",
        "app.mcp.stdio_server",
        "--api-url",
        base,
        "--api-key",
        key,
    ]
    return {
        "http": {
            "base_url": f"{base}/v1",
            "tools_url": f"{base}/v1/mcp/tools",
            "call_url": f"{base}/v1/mcp/tools/{{tool_name}}",
            "headers": {"X-API-Key": key},
        },
        "openai_compatible": {
            "tools_url": f"{base}/v1/agents/tools",
            "invoke_url": f"{base}/v1/agents/tools/{{tool_name}}",
            "headers": {"X-API-Key": key},
        },
        "mcp_stdio": {
            "description": "Works with any MCP host (Claude Desktop, Copilot, Continue, Cursor, custom).",
            "mcpServers": {
                settings.mcp_server_name: {
                    "command": stdio_command[0],
                    "args": stdio_command[1:],
                    "env": {
                        "GEOPIPE_API_URL": base,
                        "GEOPIPE_API_KEY": key,
                        "PYTHONPATH": "geopipe/backend",
                    },
                }
            },
        },
        "mcp_sse": {
            "url": f"{base}/v1/mcp/sse",
            "headers": {"X-API-Key": key},
        },
    }
