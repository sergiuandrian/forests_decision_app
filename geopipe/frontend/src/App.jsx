import { useCallback, useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet'
import { api } from './lib/api'

export default function App() {
  const [bootstrap, setBootstrap] = useState(null)
  const [layers, setLayers] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [geojson, setGeojson] = useState(null)
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('geopipe_api_key') || '')
  const [backend, setBackend] = useState(() => localStorage.getItem('geopipe_backend') || 'geopackage')
  const [connectors, setConnectors] = useState(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const selected = useMemo(
    () => layers.find((layer) => layer.id === selectedId) || null,
    [layers, selectedId],
  )

  const refresh = useCallback(async () => {
    const data = await api('/v1/bootstrap')
    setBootstrap(data)
    setLayers(data.layers || [])
    if (data.default_backend && !localStorage.getItem('geopipe_backend')) {
      setBackend(data.default_backend)
    }
    if (data.api_key) {
      setApiKey(data.api_key)
      localStorage.setItem('geopipe_api_key', data.api_key)
    }
    if (!selectedId && data.layers?.length) {
      setSelectedId(data.layers[0].id)
    }
  }, [selectedId])

  useEffect(() => {
    refresh().catch((err) => setError(err.message))
  }, [refresh])

  useEffect(() => {
    if (!selectedId) {
      setGeojson(null)
      return
    }
    api(`/v1/layers/${selectedId}/geojson?limit=2000`, { apiKey: apiKey || undefined })
      .then(setGeojson)
      .catch((err) => setError(err.message))
  }, [selectedId, apiKey])

  useEffect(() => {
    if (!apiKey) return
    api('/v1/agents/connectors', { apiKey })
      .then(setConnectors)
      .catch(() => setConnectors(null))
  }, [apiKey])

  async function onUpload(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setBusy(true)
    setError('')
    setStatus(`Uploading into ${backend}…`)
    try {
      const body = new FormData()
      body.append('file', file)
      body.append('name', file.name.replace(/\.[^.]+$/, ''))
      body.append('backend', backend)
      const layer = await api('/v1/layers', {
        method: 'POST',
        body,
        apiKey: apiKey || undefined,
      })
      setStatus(`Published ${layer.name} on ${layer.backend} (${layer.feature_count} features)`)
      await refresh()
      setSelectedId(layer.id)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
      event.target.value = ''
    }
  }

  async function rotateKey() {
    setBusy(true)
    setError('')
    try {
      const data = await api('/v1/api-keys/rotate', {
        method: 'POST',
        apiKey: apiKey || undefined,
      })
      setApiKey(data.api_key)
      localStorage.setItem('geopipe_api_key', data.api_key)
      setStatus('New API key created. Store it now.')
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function onBackendChange(event) {
    const value = event.target.value
    setBackend(value)
    localStorage.setItem('geopipe_backend', value)
  }

  const mapCenter = selected?.bbox
    ? [(selected.bbox[1] + selected.bbox[3]) / 2, (selected.bbox[0] + selected.bbox[2]) / 2]
    : [48.85, 2.35]

  return (
    <div className="shell">
      <header className="hero">
        <div>
          <p className="brand">GeoPipe</p>
          <h1>Any spatial DB. Any AI agent.</h1>
          <p className="lede">
            Upload GeoJSON, GeoPackage, or Shapefile into GeoPackage, DuckDB, SpatiaLite, or
            PostGIS. Serve features, tiles, and tools over MCP HTTP/stdio/SSE or OpenAI-compatible
            function calling.
          </p>
        </div>
        <div className="hero-actions">
          <label className="backend">
            Backend
            <select value={backend} onChange={onBackendChange}>
              {(bootstrap?.backends || [
                { name: 'geopackage', available: true },
                { name: 'duckdb', available: true },
                { name: 'spatialite', available: true },
                { name: 'postgis', available: false },
              ]).map((item) => (
                <option key={item.name} value={item.name} disabled={!item.available}>
                  {item.name}
                  {!item.available ? ' (unavailable)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className={`upload ${busy ? 'disabled' : ''}`}>
            <input type="file" accept=".geojson,.json,.gpkg,.zip" onChange={onUpload} disabled={busy} />
            Upload layer
          </label>
        </div>
      </header>

      <section className="grid">
        <aside className="panel">
          <h2>Project</h2>
          {bootstrap && (
            <dl className="meta">
              <div>
                <dt>Plan</dt>
                <dd>{bootstrap.project.plan}</dd>
              </div>
              <div>
                <dt>Usage</dt>
                <dd>
                  {bootstrap.usage.requests} / {bootstrap.usage.limit}
                </dd>
              </div>
            </dl>
          )}

          <h2>API key</h2>
          <code className="key">{apiKey || bootstrap?.api_key_prefix || 'gp_••••'}</code>
          <button type="button" onClick={rotateKey} disabled={busy}>
            Rotate key
          </button>

          <h2>Layers</h2>
          <ul className="layer-list">
            {layers.map((layer) => (
              <li key={layer.id}>
                <button
                  type="button"
                  className={layer.id === selectedId ? 'active' : ''}
                  onClick={() => setSelectedId(layer.id)}
                >
                  <strong>{layer.name}</strong>
                  <span>
                    {layer.backend || 'geopackage'} · {layer.feature_count} · {layer.geometry_type}
                  </span>
                </button>
              </li>
            ))}
            {!layers.length && <li className="empty">No layers yet. Upload a GeoJSON to start.</li>}
          </ul>

          {selected && (
            <div className="endpoints">
              <h2>Endpoints</h2>
              <code>GET {selected.endpoints.features}</code>
              <code>GET {selected.endpoints.tiles}</code>
              <code>GET /v1/mcp/tools</code>
              <code>GET /v1/agents/tools</code>
              <code>POST /v1/mcp/messages</code>
            </div>
          )}

          {connectors && (
            <div className="endpoints">
              <h2>Agent connectors</h2>
              <code>HTTP tools: {connectors.http.tools_url}</code>
              <code>OpenAI tools: {connectors.openai_compatible.tools_url}</code>
              <code>MCP SSE: {connectors.mcp_sse.url}</code>
              <code>MCP stdio: python -m app.mcp.stdio_server</code>
            </div>
          )}

          {status && <p className="status">{status}</p>}
          {error && <p className="error">{error}</p>}
        </aside>

        <div className="map-wrap">
          <MapContainer center={mapCenter} zoom={selected ? 11 : 4} className="map" key={selectedId || 'empty'}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {geojson && <GeoJSON data={geojson} />}
          </MapContainer>
        </div>
      </section>
    </div>
  )
}
