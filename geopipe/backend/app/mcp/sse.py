"""SSE MCP transport mounted on the FastAPI app for remote MCP clients."""

from __future__ import annotations

import json
from typing import Annotated, Any

from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import StreamingResponse

from app.core.database import SessionLocal
from app.mcp.tools import TOOL_DEFINITIONS, execute_tool
from app.services import ingest

router = APIRouter(prefix="/mcp", tags=["mcp-sse"])


@router.get("/sse")
async def mcp_sse(
    request: Request,
    x_api_key: Annotated[str | None, Header(alias="X-API-Key")] = None,
) -> StreamingResponse:
    """Minimal SSE stream announcing GeoPipe MCP tools.

    Full bidirectional MCP-over-SSE can be layered later; this endpoint gives
    remote agents a discoverable event stream and heartbeat.
    """
    if not x_api_key:
        raise HTTPException(status_code=401, detail="X-API-Key required")

    async with SessionLocal() as db:
        await ingest.authenticate_api_key(db, x_api_key)

    async def event_generator():
        payload = {
            "type": "tools",
            "server": "geopipe",
            "tools": TOOL_DEFINITIONS,
            "invoke": "/v1/mcp/messages",
        }
        yield f"event: endpoint\ndata: /v1/mcp/messages\n\n"
        yield f"event: tools\ndata: {json.dumps(payload)}\n\n"
        while True:
            if await request.is_disconnected():
                break
            yield "event: ping\ndata: {}\n\n"
            import asyncio

            await asyncio.sleep(15)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/messages")
async def mcp_messages(
    body: dict[str, Any],
    x_api_key: Annotated[str | None, Header(alias="X-API-Key")] = None,
) -> dict[str, Any]:
    """JSON-RPC-ish MCP message endpoint for tool calls over HTTP+SSE setups."""
    async with SessionLocal() as db:
        project, api_key = await ingest.authenticate_api_key(db, x_api_key)
        method = body.get("method")
        params = body.get("params") or {}
        req_id = body.get("id")

        if method in {"tools/list", "list_tools"}:
            return {"jsonrpc": "2.0", "id": req_id, "result": {"tools": TOOL_DEFINITIONS}}

        if method in {"tools/call", "call_tool"}:
            tool_name = params.get("name") or params.get("tool")
            arguments = params.get("arguments") or params.get("input") or {}
            try:
                content = await execute_tool(db, project=project, tool_name=tool_name, payload=arguments)
            except ValueError as exc:
                return {"jsonrpc": "2.0", "id": req_id, "error": {"code": -32602, "message": str(exc)}}
            await ingest.record_usage(
                db,
                project_id=project.id,
                api_key_id=api_key.id,
                endpoint=f"mcp-sse:{tool_name}",
            )
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "content": [{"type": "text", "text": json.dumps(content, default=str)}],
                    "structuredContent": content,
                },
            }

        if method == "initialize":
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {"tools": {}},
                    "serverInfo": {"name": "geopipe", "version": "0.2.0"},
                },
            }

        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "error": {"code": -32601, "message": f"Method not found: {method}"},
        }
