import { useEffect, useState, useCallback } from "react";
import { 
  MapContainer, TileLayer, WMSTileLayer, FeatureGroup, 
  LayersControl, GeoJSON, useMapEvents, ZoomControl, useMap, Popup, Marker
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { EditControl } from "react-leaflet-draw";
import "leaflet-draw/dist/leaflet.draw.css";
import L from "leaflet";
import GeostoreAnalysis from "./components/ForestAnalysis/GeostoreAnalysis";
import { Box, Paper } from "@mui/material";
import { getGeostoreDetails } from "./services/gfwService";

// Mock data for WMS feature info when real requests fail
const mockFeatureData = {
  "Forest Districts": {
    "NAME_RO": "Codrii Centrali",
    "AREA_HA": 24568.32,
    "FOREST_TYPE": "Mixed Deciduous",
    "PROTECTED": "Yes",
    "SPECIES": "Oak, Hornbeam, Beech",
    "MANAGEMENT": "Conservation"
  },
  "Forest Cover": {
    "COVER_PCT": 75.8,
    "DOM_SPECIES": "Quercus robur",
    "AGE_CLASS": "80-100",
    "DENSITY": "Medium",
    "HEALTH": "Good"
  },
  "Protected Areas": {
    "AREA_NAME": "Rezervație Naturală",
    "IUCN_CAT": "IV",
    "ESTABLISHED": "1993",
    "PROTECTION": "Strict",
    "DESCRIPTION": "Forest ecosystem protection zone"
  }
};

// Component to set Moldova view on initialization
function InitialView() {
  const map = useMap();
  
  useEffect(() => {
    if (map) {
      // Set view to Moldova 
      const moldovaCenter = [47.0105, 28.8638]; // Coordinates for Moldova
      const zoomLevel = 8; // Zoom level to show most of Moldova
      
      map.setView(moldovaCenter, zoomLevel);
      
      // Add a boundary for Moldova to help with orientation
      const moldovaBounds = L.latLngBounds(
        [48.4902, 26.6162], // Northeast corner
        [45.4686, 30.1354]  // Southwest corner
      );
      
      // Fit bounds with padding to ensure Moldova is visible
      map.fitBounds(moldovaBounds, {
        padding: [20, 20],
        maxZoom: 8
      });
    }
  }, [map]);

  return null;
}

// Component to handle WMS GetFeatureInfo using direct WMS layer extension
function WmsDirectFeatureInfo() {
  const map = useMap();
  const [popupPosition, setPopupPosition] = useState(null);
  const [popupContent, setPopupContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeWmsLayer, setActiveWmsLayer] = useState(null);
  
  useEffect(() => {
    if (!map) return;
    
    // Track active WMS layer
    const handleLayerChange = () => {
      let activeLayer = null;
      map.eachLayer(layer => {
        if (layer._url && layer.wmsParams && layer.options && layer.options.opacity > 0) {
          activeLayer = layer;
        }
      });
      setActiveWmsLayer(activeLayer);
    };
    
    // Listen for layer changes
    map.on('layeradd', handleLayerChange);
    map.on('layerremove', handleLayerChange);
    
    // Initial check
    handleLayerChange();
    
    // Cleanup
    return () => {
      map.off('layeradd', handleLayerChange);
      map.off('layerremove', handleLayerChange);
    };
  }, [map]);
  
  useEffect(() => {
    if (!map) return;
    
    // Define the getFeatureInfoUrl function
    function getFeatureInfoUrl(latlng, layer) {
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
    
    // Function to fetch feature info
    async function fetchFeatureInfo(url, layerName) {
      try {
        if (!url) return null;
        
        console.log(`Fetching info for ${layerName} from:`, url);
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json, text/plain, */*'
          }
        });
        
        console.log("Response status:", response.status);
        
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`);
        }
        
        const data = await response.json();
        return formatFeatureInfo(data, layerName);
      } catch (error) {
        console.error("Error fetching feature info:", error);
        return `<p>Error loading feature information</p>`;
      }
    }
    
    // Format the feature info for display
    function formatFeatureInfo(data, layerName) {
      if (data.features && data.features.length > 0) {
        const feature = data.features[0];
        const properties = feature.properties;
        
        // Define the properties we want to display
        const displayProperties = {
          "intreprinderea_silvica": "Forest Enterprise",
          "trupul": "Forest Unit",
          "proprietate": "Ownership",
          "suprafata": "Area"
        };
        
        let content = `<h4>${layerName}</h4>`;
        content += "<table>";
        
        // Only display the properties we're interested in
        for (const [key, label] of Object.entries(displayProperties)) {
          if (properties[key] !== null && properties[key] !== undefined) {
            content += `<tr><th>${label}</th><td>${properties[key]}</td></tr>`;
          }
        }
        
        content += "</table>";
        return content;
      } else if (data.text) {
        return `<h4>${layerName}</h4><div>${data.text}</div>`;
      } else {
        return `<p>No features found in ${layerName}</p>`;
      }
    }
    
    // Handle map click
    const handleMapClick = async (e) => {
      if (!activeWmsLayer) {
        console.log("No active WMS layer found");
        return;
      }
      
      const url = getFeatureInfoUrl(e.latlng, activeWmsLayer);
      if (!url) {
        console.log("Could not generate GetFeatureInfo URL");
        return;
      }
      
      setIsLoading(true);
      setPopupPosition(e.latlng);
      setPopupContent("Loading feature information...");
      
      try {
        const content = await fetchFeatureInfo(url, activeWmsLayer.wmsParams.layers);
        if (content) {
          setPopupContent(content);
        } else {
          setPopupContent("No feature information available");
        }
      } catch (error) {
        console.error("Error handling map click:", error);
        setPopupContent("Error loading feature information");
      } finally {
        setIsLoading(false);
      }
    };
    
    map.on('click', handleMapClick);
    
    return () => {
      map.off('click', handleMapClick);
    };
  }, [map, activeWmsLayer]);
  
  return popupPosition ? (
    <Popup position={popupPosition} onClose={() => setPopupPosition(null)}>
      {isLoading ? (
        <div>Loading feature information...</div>
      ) : (
        <div dangerouslySetInnerHTML={{ __html: popupContent }} />
      )}
    </Popup>
  ) : null;
}

// Format mock feature data for display
function formatMockFeatureInfo(layerName) {
  console.log("Formatting mock data for", layerName);
  const layerKey = layerName.includes(":") ? 
    layerName.split(":")[1] : layerName;
    
  // Try to find a matching mock data key
  const mockDataKey = Object.keys(mockFeatureData).find(key => 
    layerKey.toLowerCase().includes(key.toLowerCase())
  ) || Object.keys(mockFeatureData)[0]; // Fallback to first key
  
  const properties = mockFeatureData[mockDataKey];
  
  let content = `<h4>${layerName} <span class="mock-indicator">(Mock Data)</span></h4>`;
  content += "<table>";
  for (const key in properties) {
    content += `<tr><th>${key}</th><td>${properties[key]}</td></tr>`;
  }
  content += "</table>";
  return content;
}

// Component to display geostore polygon
function GeostorePolygon({ geostoreId }) {
  const [polygonData, setPolygonData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPolygon = async () => {
      try {
        setLoading(true);
        console.log('Starting to fetch polygon for geostore:', geostoreId);
        
        // Test the API endpoint directly
        const testResponse = await fetch(`/api/gfw/geostore/${geostoreId}`);
        console.log('Direct API test response status:', testResponse.status);
        const testData = await testResponse.json();
        console.log('Direct API test data:', testData);

        // Now try the service call
        const response = await getGeostoreDetails(geostoreId);
        console.log('Service call response:', response);
        
        if (!response || !response.data) {
          throw new Error('Invalid response from geostore service');
        }

        const geojson = response.data?.attributes?.geojson;
        if (!geojson) {
          console.error('No geojson in response:', response);
          throw new Error('No geojson data in response');
        }

        // Validate the geojson structure
        if (!geojson.type || !geojson.features) {
          console.error('Invalid geojson structure:', geojson);
          throw new Error('Invalid geojson structure');
        }

        console.log('Setting valid polygon data:', geojson);
        setPolygonData(geojson);
      } catch (err) {
        console.error('Error in fetchPolygon:', err);
        setError(err.message || 'Failed to fetch polygon data');
      } finally {
        setLoading(false);
      }
    };

    if (geostoreId) {
      fetchPolygon();
    }
  }, [geostoreId]);

  // Show loading state
  if (loading) {
    return (
      <div style={{ 
        position: 'absolute', 
        top: '50%', 
        left: '50%', 
        transform: 'translate(-50%, -50%)',
        zIndex: 1000,
        background: 'white',
        padding: '10px',
        borderRadius: '4px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
      }}>
        Loading polygon data...
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div style={{ 
        position: 'absolute', 
        top: '50%', 
        left: '50%', 
        transform: 'translate(-50%, -50%)',
        zIndex: 1000,
        background: '#ffebee',
        padding: '10px',
        borderRadius: '4px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        color: '#c62828'
      }}>
        Error: {error}
      </div>
    );
  }

  // Show when no data
  if (!polygonData) {
    return (
      <div style={{ 
        position: 'absolute', 
        top: '50%', 
        left: '50%', 
        transform: 'translate(-50%, -50%)',
        zIndex: 1000,
        background: '#fff3e0',
        padding: '10px',
        borderRadius: '4px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        color: '#ef6c00'
      }}>
        No polygon data available
      </div>
    );
  }

  console.log('About to render GeoJSON with data:', polygonData);

  return (
    <>
      <GeoJSON 
        key={geostoreId} // Force re-render when geostoreId changes
        data={polygonData}
        style={{
          color: '#ff0000',
          weight: 3,
          fillColor: '#ff0000',
          fillOpacity: 0.3
        }}
        eventHandlers={{
          click: (e) => {
            const layer = e.target;
            layer.bindPopup(`
              <div>
                <h4>Geostore Area</h4>
                <p>Area: ${(polygonData.attributes?.areaHa / 100).toFixed(2)} km²</p>
              </div>
            `).openPopup();
          }
        }}
      />
      {/* Add a marker at the center of the polygon for debugging */}
      {polygonData.bbox && (
        <Marker 
          position={[
            (polygonData.bbox[1] + polygonData.bbox[3]) / 2,
            (polygonData.bbox[0] + polygonData.bbox[2]) / 2
          ]}
        >
          <Popup>
            <div>Polygon Center</div>
          </Popup>
        </Marker>
      )}
    </>
  );
}

export default function WebGISMap() {
  const [mapInstance, setMapInstance] = useState(null);
  const [selectedGeostoreId, setSelectedGeostoreId] = useState("3af540d618da092dc8d6a250f013aed7"); // Set the geostore ID
  const [drawnItems, setDrawnItems] = useState(new L.FeatureGroup());
  const [showAnalysis, setShowAnalysis] = useState(true); // Show analysis by default

  const onCreated = useCallback((e) => {
    const layer = e.layer;
    drawnItems.addLayer(layer);

    // Get the bounds of the drawn polygon
    const bounds = layer.getBounds();
    const coordinates = layer.getLatLngs()[0].map(latLng => [latLng.lat, latLng.lng]);
    
    // Create a geostore with the drawn polygon
    const createGeostore = async () => {
      try {
        const response = await fetch('/api/gfw/geostore', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            geojson: {
              type: 'Polygon',
              coordinates: [coordinates]
            }
          })
        });

        if (!response.ok) {
          throw new Error('Failed to create geostore');
        }

        const data = await response.json();
        setSelectedGeostoreId(data.data.id);
        setShowAnalysis(true);
      } catch (error) {
        console.error('Error creating geostore:', error);
      }
    };

    createGeostore();
  }, [drawnItems]);

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      <Box sx={{ flex: 1, position: 'relative' }}>
        <MapContainer
          center={[47.0105, 28.8638]}
          zoom={8}
          style={{ height: '100%', width: '100%' }}
          whenCreated={setMapInstance}
          zoomControl={false}
        >
          {/* Base Layers */}
          <LayersControl position="topleft" collapsed={false}>
            <LayersControl.BaseLayer checked name="OpenStreetMap">
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
            </LayersControl.BaseLayer>
            
            <LayersControl.BaseLayer name="Satellite">
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                attribution='&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
              />
            </LayersControl.BaseLayer>

            <LayersControl.BaseLayer name="Terrain">
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}"
                attribution='&copy; Esri &mdash; Source: USGS, Esri, TANA, DeLorme, and NPS'
              />
            </LayersControl.BaseLayer>
          </LayersControl>

          {/* Add the GeostorePolygon component */}
          {selectedGeostoreId && (
            <>
              <GeostorePolygon geostoreId={selectedGeostoreId} />
              <FeatureGroup>
                <EditControl
                  position="topright"
                  onCreated={onCreated}
                  onEdited={onEdited}
                  onDeleted={onDeleted}
                  draw={{
                    rectangle: false,
                    circle: false,
                    circlemarker: false,
                    marker: false,
                    polyline: false
                  }}
                />
              </FeatureGroup>
            </>
          )}
          
          <ZoomControl position="bottomright" />
          <InitialView />
          <WmsDirectFeatureInfo />
        </MapContainer>
      </Box>

      {showAnalysis && selectedGeostoreId && (
        <Paper 
          elevation={3} 
          sx={{ 
            width: 400, 
            height: '100%', 
            overflow: 'auto',
            p: 2,
            backgroundColor: 'background.paper'
          }}
        >
          <GeostoreAnalysis geostoreId={selectedGeostoreId} />
        </Paper>
      )}
    </Box>
  );
}