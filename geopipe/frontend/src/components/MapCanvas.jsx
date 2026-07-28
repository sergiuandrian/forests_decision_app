import { useEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { resolveMapStyle } from '../lib/mapStyle'

const SOURCE_ID = 'geopipe-layer'
const FILL_ID = 'geopipe-fill'
const LINE_ID = 'geopipe-line'
const CIRCLE_ID = 'geopipe-circle'
const EMPTY = { type: 'FeatureCollection', features: [] }

/**
 * Full-bleed MapLibre canvas with GeoJSON preview and fly-to bounds.
 * @param {{
 *   geojson: GeoJSON.FeatureCollection | null,
 *   bbox?: number[] | null,
 *   empty: boolean,
 * }} props
 */
export default function MapCanvas({ geojson, bbox, empty }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const popupRef = useRef(null)
  const readyRef = useRef(false)
  const latestRef = useRef({ geojson, bbox, empty })

  latestRef.current = { geojson, bbox, empty }

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: resolveMapStyle(),
      center: [2.33, 48.86],
      zoom: 1.4,
      attributionControl: false,
      pitch: 0,
    })

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), 'bottom-right')
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      'bottom-left',
    )

    popupRef.current = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 14,
      className: 'geopipe-popup',
    })

    /**
     * Push the latest GeoJSON onto the map and frame it.
     */
    function syncLayer() {
      const source = map.getSource(SOURCE_ID)
      if (!source) return
      const current = latestRef.current
      source.setData(current.geojson || EMPTY)
      if (current.geojson?.features?.length) {
        const bounds = boundsFromBboxOrGeojson(current.bbox, current.geojson)
        if (bounds) {
          map.fitBounds(bounds, {
            padding: { top: 96, bottom: 120, left: 48, right: 420 },
            maxZoom: 13.5,
            duration: 1100,
          })
        }
      } else if (current.empty) {
        map.easeTo({ center: [12, 28], zoom: 1.55, duration: 900 })
      }
    }

    map.on('load', () => {
      map.addSource(SOURCE_ID, { type: 'geojson', data: EMPTY })
      map.addLayer({
        id: FILL_ID,
        type: 'fill',
        source: SOURCE_ID,
        filter: ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]],
        paint: {
          'fill-color': '#0F766E',
          'fill-opacity': 0.28,
        },
      })
      map.addLayer({
        id: LINE_ID,
        type: 'line',
        source: SOURCE_ID,
        filter: [
          'in',
          ['geometry-type'],
          ['literal', ['Polygon', 'LineString', 'MultiLineString', 'MultiPolygon']],
        ],
        paint: {
          'line-color': '#0F766E',
          'line-width': 2.2,
          'line-opacity': 0.9,
        },
      })
      map.addLayer({
        id: CIRCLE_ID,
        type: 'circle',
        source: SOURCE_ID,
        filter: ['in', ['geometry-type'], ['literal', ['Point', 'MultiPoint']]],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 4, 12, 8, 16, 11],
          'circle-color': '#0F766E',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
          'circle-opacity': 0.95,
        },
      })

      readyRef.current = true
      syncLayer()
    })

    const onMove = (event) => {
      const feature = map.queryRenderedFeatures(event.point, {
        layers: [CIRCLE_ID, FILL_ID, LINE_ID],
      })[0]
      if (!feature) {
        map.getCanvas().style.cursor = ''
        popupRef.current?.remove()
        return
      }
      map.getCanvas().style.cursor = 'pointer'
      const name = feature.properties?.name || feature.properties?.geopipe_id || 'Feature'
      popupRef.current
        ?.setLngLat(event.lngLat)
        .setHTML(`<strong>${escapeHtml(String(name))}</strong>`)
        .addTo(map)
    }

    map.on('mousemove', onMove)
    map.on('mouseleave', CIRCLE_ID, () => popupRef.current?.remove())
    map.on('mouseleave', FILL_ID, () => popupRef.current?.remove())

    mapRef.current = map
    map.__geopipeSync = syncLayer

    return () => {
      popupRef.current?.remove()
      map.remove()
      mapRef.current = null
      readyRef.current = false
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current || typeof map.__geopipeSync !== 'function') return
    map.__geopipeSync()
  }, [geojson, bbox, empty])
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const onResize = () => map.resize()
    window.addEventListener('resize', onResize)
    const timer = window.setTimeout(onResize, 80)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return <div ref={containerRef} className="map" role="presentation" data-testid="map-canvas" />
}

/**
 * @param {number[] | null | undefined} bbox
 * @param {GeoJSON.FeatureCollection} geojson
 */
function boundsFromBboxOrGeojson(bbox, geojson) {
  if (bbox && bbox.length === 4) {
    return [
      [bbox[0], bbox[1]],
      [bbox[2], bbox[3]],
    ]
  }
  const bounds = new maplibregl.LngLatBounds()
  let found = false
  for (const feature of geojson.features || []) {
    walkCoords(feature.geometry, (lng, lat) => {
      bounds.extend([lng, lat])
      found = true
    })
  }
  return found ? bounds : null
}

function walkCoords(geometry, visit) {
  if (!geometry) return
  if (geometry.type === 'GeometryCollection') {
    geometry.geometries?.forEach((part) => walkCoords(part, visit))
    return
  }
  const walk = (node) => {
    if (!Array.isArray(node)) return
    if (typeof node[0] === 'number' && typeof node[1] === 'number') {
      visit(node[0], node[1])
      return
    }
    node.forEach(walk)
  }
  walk(geometry.coordinates)
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}
