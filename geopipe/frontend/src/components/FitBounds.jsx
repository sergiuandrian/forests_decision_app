import { useEffect } from 'react'
import { useMap } from 'react-leaflet'

/**
 * Fit the Leaflet map to a GeoJSON bounding box when data changes.
 * @param {{ type: string, features?: unknown[] } | null} geojson
 */
export default function FitBounds({ geojson }) {
  const map = useMap()

  useEffect(() => {
    if (!geojson?.features?.length) return
    const coords = []
    for (const feature of geojson.features) {
      collectCoords(feature.geometry, coords)
    }
    if (!coords.length) return
    map.fitBounds(coords, { padding: [36, 36], maxZoom: 14 })
  }, [geojson, map])

  return null
}

function collectCoords(geometry, bucket) {
  if (!geometry) return
  if (geometry.type === 'GeometryCollection') {
    geometry.geometries?.forEach((part) => collectCoords(part, bucket))
    return
  }
  walk(geometry.coordinates, bucket)
}

function walk(node, bucket) {
  if (!Array.isArray(node)) return
  if (typeof node[0] === 'number' && typeof node[1] === 'number') {
    bucket.push([node[1], node[0]])
    return
  }
  node.forEach((child) => walk(child, bucket))
}
