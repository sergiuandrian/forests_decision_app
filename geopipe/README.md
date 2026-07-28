# GeoPipe

Upload spatial data. Get a Feature API, vector tiles, and MCP tools for AI agents.

## MVP Scope

### In
- Upload GeoJSON, GeoPackage, or zipped Shapefile
- CRS / geometry validation (promote to EPSG:4326, fix invalid geoms)
- Per-project API keys + usage metering

### Out
- `GET /v1/layers/{id}/features` — bbox / limit GeoJSON
- `GET /v1/layers/{id}/tiles/{z}/{x}/{y}.mvt` — Mapbox Vector Tiles
- MCP tools: `list_layers`, `query_features`, `buffer`, `intersect`, `crs_transform`, `layer_stats`
- Web UI: upload → map preview → copy endpoints / API key

### Pricing (planned)
- Free: 1 layer, 10k requests/mo
- Starter $49: 20 layers, 500k requests
- Pro $149: 100 layers, 5M requests + MCP
- Scale $499: custom limits

### Non-goals (post-MVP)
- Stripe billing UI, SSO, PostGIS multi-tenant prod cluster, raster/COG, full OGC API Features

## Quick start

```bash
cd geopipe/backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

```bash
cd geopipe/frontend
npm install && npm run dev
```

API docs: http://localhost:8000/docs  
App: http://localhost:5173
