/**
 * Resolve the MapLibre / Mapbox style URL.
 * Set VITE_MAPBOX_TOKEN to use Mapbox Light; otherwise Carto Voyager (free).
 * Override entirely with VITE_MAP_STYLE.
 */
export function resolveMapStyle() {
  if (import.meta.env.VITE_MAP_STYLE) {
    return import.meta.env.VITE_MAP_STYLE
  }
  const token = import.meta.env.VITE_MAPBOX_TOKEN
  if (token) {
    return {
      version: 8,
      sources: {
        mapbox: {
          type: 'raster',
          tiles: [
            `https://api.mapbox.com/styles/v1/mapbox/light-v11/tiles/{z}/{x}/{y}?access_token=${token}`,
          ],
          tileSize: 512,
          attribution: '© Mapbox © OpenStreetMap',
        },
      },
      layers: [
        {
          id: 'mapbox-light',
          type: 'raster',
          source: 'mapbox',
        },
      ],
    }
  }
  return 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json'
}
