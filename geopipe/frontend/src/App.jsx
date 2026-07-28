import { useCallback, useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet'
import { api } from './lib/api'
import { copyText } from './lib/clipboard'
import FitBounds from './components/FitBounds'

const TABS = [
  { id: 'layers', label: 'Layers' },
  { id: 'connect', label: 'Connect' },
  { id: 'api', label: 'API' },
]

const LAYER_STYLE = {
  color: '#0F766E',
  weight: 2,
  fillColor: '#14B8A6',
  fillOpacity: 0.35,
}

export default function App() {
  const [bootstrap, setBootstrap] = useState(null)
  const [layers, setLayers] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [geojson, setGeojson] = useState(null)
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('geopipe_api_key') || '')
  const [backend, setBackend] = useState(() => localStorage.getItem('geopipe_backend') || 'geopackage')
  const [connectors, setConnectors] = useState(null)
  const [tab, setTab] = useState('layers')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [copied, setCopied] = useState('')

  const selected = useMemo(
    () => layers.find((layer) => layer.id === selectedId) || null,
    [layers, selectedId],
  )

  const backends = bootstrap?.backends || []

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
    setGeojson(null)
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

  async function flashCopy(label, value) {
    const ok = await copyText(value)
    setCopied(ok ? label : '')
    setStatus(ok ? `Copied ${label}` : 'Copy failed')
    window.setTimeout(() => setCopied(''), 1600)
  }

  async function publishFile(file) {
    if (!file) return
    setBusy(true)
    setError('')
    setStatus(`Publishing to ${backend}…`)
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
      setStatus(`${layer.name} live on ${layer.backend}`)
      setTab('layers')
      await refresh()
      setSelectedId(layer.id)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
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
      setStatus('New API key created')
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

  function onDrop(event) {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files?.[0]
    publishFile(file)
  }

  const mapCenter = selected?.bbox
    ? [(selected.bbox[1] + selected.bbox[3]) / 2, (selected.bbox[0] + selected.bbox[2]) / 2]
    : [20, 0]

  const stdioSnippet = connectors
    ? JSON.stringify(connectors.mcp_stdio.mcpServers, null, 2)
    : ''

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand-block">
          <p className="brand">GeoPipe</p>
          <p className="tagline">Spatial API for databases and agents</p>
        </div>
        <div className="topbar-meta">
          {bootstrap && (
            <span className="chip">
              {bootstrap.usage.requests}/{bootstrap.usage.limit} requests
            </span>
          )}
          <span className="chip muted">{bootstrap?.project.plan || 'free'}</span>
        </div>
      </header>

      <section className="stage">
        <div
          className={`map-stage ${dragging ? 'dragging' : ''}`}
          onDragEnter={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <MapContainer
            center={mapCenter}
            zoom={selected ? 11 : 2}
            className="map"
            key={selectedId || 'empty'}
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            />
            {geojson && (
              <>
                <GeoJSON data={geojson} style={() => LAYER_STYLE} />
                <FitBounds geojson={geojson} />
              </>
            )}
          </MapContainer>

          {!selected && (
            <div className="map-empty">
              <p className="brand">GeoPipe</p>
              <h1>Drop a spatial file to publish</h1>
              <p>GeoJSON, GeoPackage, or Shapefile ZIP → Feature API, tiles, and agent tools.</p>
            </div>
          )}

          <div className="publish-bar">
            <label className="field">
              <span>Store in</span>
              <select value={backend} onChange={onBackendChange} aria-label="Spatial backend">
                {(backends.length
                  ? backends
                  : [
                      { name: 'geopackage', available: true },
                      { name: 'duckdb', available: true },
                      { name: 'spatialite', available: true },
                      { name: 'postgis', available: false },
                    ]
                ).map((item) => (
                  <option key={item.name} value={item.name} disabled={!item.available}>
                    {item.name}
                    {!item.available ? ' · setup needed' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className={`upload ${busy ? 'disabled' : ''}`}>
              <input
                type="file"
                accept=".geojson,.json,.gpkg,.zip"
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  publishFile(file)
                  event.target.value = ''
                }}
              />
              {busy ? 'Publishing…' : 'Upload layer'}
            </label>
          </div>
        </div>

        <aside className="dock" aria-label="Workspace">
          <nav className="tabs" aria-label="Workspace sections">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={tab === item.id ? 'active' : ''}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="dock-body">
            {tab === 'layers' && (
              <div className="panel-block fade-in">
                <h2>Published layers</h2>
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
                          {layer.backend} · {layer.feature_count} features · {layer.geometry_type}
                        </span>
                      </button>
                    </li>
                  ))}
                  {!layers.length && (
                    <li className="empty">No layers yet. Upload or drop a file on the map.</li>
                  )}
                </ul>

                {selected && (
                  <div className="detail">
                    <h2>Selected</h2>
                    <dl className="meta">
                      <div>
                        <dt>Backend</dt>
                        <dd>{selected.backend}</dd>
                      </div>
                      <div>
                        <dt>Features</dt>
                        <dd>{selected.feature_count}</dd>
                      </div>
                    </dl>
                    <CopyRow
                      label="Features URL"
                      value={selected.endpoints.features}
                      copied={copied}
                      onCopy={flashCopy}
                    />
                    <CopyRow
                      label="Tiles URL"
                      value={selected.endpoints.tiles}
                      copied={copied}
                      onCopy={flashCopy}
                    />
                  </div>
                )}
              </div>
            )}

            {tab === 'connect' && (
              <div className="panel-block fade-in">
                <h2>Connect any AI agent</h2>
                <p className="help">
                  Same tools over MCP HTTP/stdio/SSE or OpenAI-compatible function calling.
                </p>
                {connectors ? (
                  <>
                    <CopyRow
                      label="MCP HTTP tools"
                      value={connectors.http.tools_url}
                      copied={copied}
                      onCopy={flashCopy}
                    />
                    <CopyRow
                      label="OpenAI tools"
                      value={connectors.openai_compatible.tools_url}
                      copied={copied}
                      onCopy={flashCopy}
                    />
                    <CopyRow
                      label="MCP SSE"
                      value={connectors.mcp_sse.url}
                      copied={copied}
                      onCopy={flashCopy}
                    />
                    <div className="snippet">
                      <div className="snippet-head">
                        <span>MCP stdio config</span>
                        <button type="button" onClick={() => flashCopy('stdio config', stdioSnippet)}>
                          {copied === 'stdio config' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <pre>{stdioSnippet}</pre>
                    </div>
                  </>
                ) : (
                  <p className="empty">Load an API key to generate connector snippets.</p>
                )}
              </div>
            )}

            {tab === 'api' && (
              <div className="panel-block fade-in">
                <h2>API key</h2>
                <p className="help">Send as `X-API-Key` for features, tiles, and agent tools.</p>
                <CopyRow label="API key" value={apiKey || 'Unavailable'} copied={copied} onCopy={flashCopy} />
                <button type="button" className="secondary" onClick={rotateKey} disabled={busy}>
                  Rotate key
                </button>

                <h2>Backends</h2>
                <ul className="backend-list">
                  {backends.map((item) => (
                    <li key={item.name} className={item.available ? 'ok' : 'off'}>
                      <strong>{item.name}</strong>
                      <span>{item.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {(status || error) && (
            <div className="toast-row">
              {status && <p className="status">{status}</p>}
              {error && <p className="error">{error}</p>}
            </div>
          )}
        </aside>
      </section>
    </div>
  )
}

function CopyRow({ label, value, copied, onCopy }) {
  return (
    <div className="copy-row">
      <div>
        <span className="copy-label">{label}</span>
        <code>{value}</code>
      </div>
      <button type="button" onClick={() => onCopy(label, value)} disabled={!value || value === 'Unavailable'}>
        {copied === label ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}
