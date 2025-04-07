import L from "leaflet";
import { FEATURE_INFO_MAPPINGS } from "../constants/layers";

// Mock data for when WMS requests fail
const MOCK_FEATURE_DATA = {
  "Forest Districts": {
    "NAME_RO": "Codrii Centrali",
    "AREA_HA": 24568.32,
    "FOREST_TYPE": "Mixed Deciduous",
    "PROTECTED": "Yes",
    "SPECIES": "Oak, Hornbeam, Beech",
    "MANAGEMENT": "Conservation"
  },
  "Forest Cover": {
    "TYPE": "Broadleaf Forest",
    "DENSITY": "High",
    "AGE": "80-120 years",
    "HEIGHT": "22-28m",
    "AREA_HA": 156.78,
    "HEALTH": "Good"
  },
  "Protected Areas": {
    "NAME": "Plaiul Fagului",
    "TYPE": "Nature Reserve",
    "IUCN": "Category Ia",
    "ESTABLISHED": "1976",
    "AREA_HA": 5642.8,
    "PROTECTION": "Strict"
  }
};

/**
 * Generates a WMS GetFeatureInfo URL
 * @param {Object} latlng - Leaflet LatLng object
 * @param {Object} layer - WMS layer
 * @param {Object} map - Leaflet map instance
 * @returns {string|null} - URL for the GetFeatureInfo request
 */
export function getFeatureInfoUrl(latlng, layer, map) {
  if (!layer || !layer._url || !layer.wmsParams) return null;
  
  // Make a point on the screen
  const point = map.latLngToContainerPoint(latlng);
  
  // Get the map size
  const size = map.getSize();
  
  // Get current bounds
  const bounds = map.getBounds();
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  
  // Format bbox properly based on WMS version
  let bbox;
  if (layer.wmsParams.version === '1.3.0') {
    bbox = `${sw.lat},${sw.lng},${ne.lat},${ne.lng}`;
  } else {
    bbox = `${sw.lng},${sw.lat},${ne.lng},${ne.lat}`;
  }
  
  // Parameters for GetFeatureInfo
  const params = {
    service: 'WMS',
    version: layer.wmsParams.version || '1.3.0',
    request: 'GetFeatureInfo',
    layers: layer.wmsParams.layers,
    query_layers: layer.wmsParams.layers,
    bbox: bbox,
    width: size.x,
    height: size.y,
    format: 'image/png',
    info_format: 'application/json',
    feature_count: 10,
    srs: 'EPSG:4326',
    crs: 'EPSG:4326'
  };
  
  // Add coordinates differently based on WMS version
  if (params.version === '1.3.0') {
    params.i = Math.round(point.x);
    params.j = Math.round(point.y);
  } else {
    params.x = Math.round(point.x);
    params.y = Math.round(point.y);
  }
  
  // Format URL
  return layer._url + L.Util.getParamString(params, layer._url);
}

/**
 * Fetches feature info from a WMS GetFeatureInfo URL
 * @param {string} url - GetFeatureInfo URL
 * @param {string} layerName - Name of the layer
 * @returns {Promise<Object>} - HTML content for popup
 */
export async function fetchFeatureInfo(url, layerName) {
  try {
    if (!url) return null;
    
    console.log(`Fetching info for ${layerName} from:`, url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json, text/plain, */*'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    
    const data = await response.json();
    return {
      content: formatFeatureInfoToHtml(data, layerName)
    };
  } catch (error) {
    console.error("Error fetching feature info:", error);
    return null;
  }
}

/**
 * Formats feature info data into HTML
 * @param {Object} data - Feature info response data
 * @param {string} layerName - Name of the layer
 * @returns {string} - HTML content for popup
 */
export function formatFeatureInfoToHtml(data, layerName) {
  if (!data || !data.features || data.features.length === 0) {
    return `<p>No features found in ${layerName}</p>`;
  }
  
  const feature = data.features[0];
  const properties = feature.properties || {};
  
  let content = `<h4>${layerName}</h4>`;
  
  if (Object.keys(properties).length === 0) {
    return `${content}<p>No properties available for this feature</p>`;
  }
  
  content += "<table>";
  
  // First try to display the mapped properties
  let mappedPropertiesFound = false;
  for (const [key, label] of Object.entries(FEATURE_INFO_MAPPINGS)) {
    if (properties[key] !== null && properties[key] !== undefined) {
      content += `<tr><th>${label}</th><td>${properties[key]}</td></tr>`;
      mappedPropertiesFound = true;
    }
  }
  
  // If no mapped properties were found, display all available properties
  if (!mappedPropertiesFound) {
    for (const key in properties) {
      if (properties[key] !== null && properties[key] !== undefined) {
        content += `<tr><th>${key}</th><td>${properties[key]}</td></tr>`;
      }
    }
  }
  
  content += "</table>";
  
  return content;
} 