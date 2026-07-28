import { useCallback, useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet'
import { api } from './lib/api'

export default function App() {
  const [bootstrap, setBootstrap] = useState(null)
  const [layers, setLayers] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [geojson, setGeojson] = useState(null)
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('geopipe_api_key') || '')
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

  async function onUpload(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setBusy(true)
    setError('')
    setStatus('Uploading and validating…')
    try {
      const body = new FormData()
      body.append('file', file)
      body.append('name', file.name.replace(/\.[^.]+$/, ''))
      const layer = await api('/v1/layers', {
        method: 'POST',
        body,
        apiKey: apiKey || undefined,
      })
      setStatus(`Published ${layer.name} (${layer.feature_count} features)`)
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

  const mapCenter = selected?.bbox
    ? [(selected.bbox[1] + selected.bbox[3]) / 2, (selected.bbox[0] + selected.bbox[2]) / 2]
    : [48.85, 2.35]

  return (
    <div className="shell">
      <header className="hero">
        <div>
          <p className="brand">GeoPipe</p>
          <h1>Spatial data in. API + MCP out.</h1>
          <p className="lede">
            Upload GeoJSON, GeoPackage, or Shapefile. Get authenticated features, vector tiles,
            and agent-ready spatial tools.
          </p>
        </div>
        <label className={`upload ${busy ? 'disabled' : ''}`}>
          <input type="file" accept=".geojson,.json,.gpkg,.zip" onChange={onUpload} disabled={busy} />
          Upload layer
        </label>
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
                    {layer.feature_count} · {layer.geometry_type}
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
              <code>POST /v1/mcp/tools/query_features</code>
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
