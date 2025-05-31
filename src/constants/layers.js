// Base layer definitions
export const BASE_LAYERS = [
  {
    name: "OpenStreetMap",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    checked: true
  },
  {
    name: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: '&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
  },
  {
    name: "Terrain",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}",
    attribution: '&copy; Esri &mdash; Source: USGS, Esri, TANA, DeLorme, and NPS'
  }
];

// WMS layer definitions
export const WMS_LAYERS = [
  {
    name: "Forest Districts",
    url: "https://geodata.gov.md/geoserver/moldsilva/wms",
    layers: "moldsilva:fondul_silvic",
    format: "image/png",
    transparent: true,
    version: "1.1.1",
    opacity: 0.7,
    zIndex: 10,
    checked: false
  },
  {
    name: "Small Rivers",
    url: "http://localhost:8080/geoserver/Moldova/wms",
    layers: "riuri_mici",
    format: "image/png",
    transparent: true,
    version: "1.3.0",
    opacity: 0.7,
    zIndex: 20,
    checked: false
  },
  {
    name: "Lakes",
    url: "http://localhost:8080/geoserver/Moldova/wms",
    layers: "lacuri",
    format: "image/png",
    transparent: true,
    version: "1.3.0",
    opacity: 0.7,
    zIndex: 30,
    checked: false
  }
];

// Feature info field mappings
export const FEATURE_INFO_MAPPINGS = {
  "intreprinderea_silvica": "Forest Enterprise",
  "trupul": "Forest Unit",
  "proprietate": "Ownership",
  "suprafata": "Area",
  "categoria": "Category",
  "specia": "Species",
  "nume": "Name",
  "tip": "Type"
}; 