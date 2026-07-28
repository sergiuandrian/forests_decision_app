# GeoPipe

Upload spatial data into **GeoPackage, DuckDB Spatial, SpatiaLite, or PostGIS**.
Serve a Feature API, vector tiles, and **agent tools** over MCP (HTTP / stdio / SSE) or OpenAI-compatible function calling.

Works with any MCP host or tool-calling agent — Claude Desktop, GitHub Copilot, Continue, custom LangChain/OpenAI agents, Cursor, etc.

## Scope

### Spatial backends
| Backend | Notes |
|---|---|
| `geopackage` | Default file store |
| `duckdb` | DuckDB + spatial extension |
| `spatialite` | SQLite/SpatiaLite via GDAL |
| `postgis` | Requires `POSTGIS_URL` |

### APIs
- `GET /v1/layers/{id}/features` — bbox GeoJSON
- `GET /v1/layers/{id}/tiles/{z}/{x}/{y}.mvt`
- `GET /v1/backends` — backend availability
- `GET /v1/mcp/tools` + `POST /v1/mcp/tools/{name}` — MCP HTTP tools
- `GET /v1/agents/tools` — OpenAI function-calling schema
- `GET /v1/mcp/sse` + `POST /v1/mcp/messages` — remote MCP-style transport
- `python -m app.mcp.stdio_server` — local stdio MCP bridge

## Quick start

```bash
cd geopipe/backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
PYTHONPATH=. uvicorn app.main:app --reload --port 8000
```

```bash
cd geopipe/frontend
npm install && npm run dev
```

Optional PostGIS:

```bash
cd geopipe
docker compose up -d postgis
export POSTGIS_URL=postgresql+psycopg://geopipe:geopipe@127.0.0.1:5432/geopipe
export SPATIAL_BACKEND=postgis
```

Sample: `geopipe/sample-data/paris-sites.geojson`

## Connect any agent

```bash
# Connector snippets for HTTP / OpenAI tools / MCP stdio / MCP SSE
curl http://127.0.0.1:8000/v1/agents/connectors -H "X-API-Key: $GEOPIPE_API_KEY"

# Stdio MCP bridge
cd geopipe/backend
GEOPIPE_API_URL=http://127.0.0.1:8000 GEOPIPE_API_KEY=gp_... \
  PYTHONPATH=. python -m app.mcp.stdio_server
```

Tools: `list_layers`, `list_spatial_backends`, `query_features`, `layer_stats`, `buffer`, `intersect`, `crs_transform`
