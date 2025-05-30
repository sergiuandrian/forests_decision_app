import { useState, useEffect } from "react";
import { 
  MapContainer, TileLayer, WMSTileLayer, 
  ZoomControl
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import api from './services/api';
import { BASE_LAYERS, WMS_LAYERS } from './constants/layers';
import InitialView from './components/Map/InitialView';
import DatabaseLayers from './components/Map/DatabaseLayers';
import LayerControl from './components/LayerControl';

// Fix for default Leaflet icon issue
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'leaflet/images/marker-icon-2x.png',
  iconUrl: 'leaflet/images/marker-icon.png',
  shadowUrl: 'leaflet/images/marker-shadow.png',
});

// Define SVG renderer
const svgRenderer = L.svg();

export default function WebGISMap() {
  console.log("WebGISMap component rendering..."); // Debug log at the start of render
  const [visibleLayers, setVisibleLayers] = useState(new Set());
  const [layerData, setLayerData] = useState({});
  const [error, setError] = useState(null);
  const [availableDbLayers, setAvailableDbLayers] = useState([]);
  const [activeBaseLayer, setActiveBaseLayer] = useState(BASE_LAYERS.find(layer => layer.checked) || BASE_LAYERS[0]); // Initialize with checked layer or first layer
  const [visibleWmsLayers, setVisibleWmsLayers] = useState(new Set(WMS_LAYERS.filter(layer => layer.checked).map(layer => layer.name))); // Initialize with checked WMS layers
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // State for sidebar open/close, set to false by default

  // Fetch available database layers on component mount
  useEffect(() => {
    const fetchAvailableLayers = async () => {
      try {
        console.log("Attempting to fetch available layers..."); // Debug log
        const response = await api.get('/gis/layers');
        console.log("Fetched available layers raw response:", response); // Debug log
        console.log("Fetched available layers data:", response.data); // Debug log
        
        // Filter the layers to only include 'hotar' and 'padure'
        const filteredLayers = response.data.layers.filter(layer => 
          layer.table_name === 'hotar' || layer.table_name === 'padure'
        );
        
        setAvailableDbLayers(filteredLayers); // Set state with the filtered array
        
        // Initialize visibleLayers state to include all filtered layers
        setVisibleLayers(new Set(filteredLayers.map(layer => layer.table_name)));

        console.log("availableDbLayers and visibleLayers states updated.", filteredLayers); // Debug log
      } catch (err) {
        console.error('Failed to load available layers:', err); // Debug log
        setError('Failed to load available layers');
      }
    };
    fetchAvailableLayers();
  }, []);

  // Add function to fetch layer data
  const fetchLayerData = async (layer) => {
    try {
      const response = await api.get(`/gis/data/${layer.table_name}`);
      setLayerData(prev => ({
        ...prev,
        [layer.table_name]: response.data
      }));
    } catch (err) {
      setError(`Failed to load data for ${layer.table_name}`);
    }
  };

  const handleBaseLayerChange = (layer) => {
    setActiveBaseLayer(layer);
  };

  const handleWmsLayerChange = (layer) => {
    setVisibleWmsLayers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(layer.name)) {
        newSet.delete(layer.name);
      } else {
        newSet.add(layer.name);
      }
      return newSet;
    });
  };

  const handleDbLayerChange = (layer) => {
    setVisibleLayers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(layer.table_name)) {
        newSet.delete(layer.table_name);
        setLayerData(prev => {
          const newData = { ...prev };
          delete newData[layer.table_name];
          return newData;
        });
      } else {
        newSet.add(layer.table_name);
      }
      return newSet;
    });
  };

  // Popup content for database features
  const onEachFeature = (feature, layer) => {
    if (feature.properties) {
      const popupContent = Object.entries(feature.properties)
        .map(([key, value]) => `<strong>${key}:</strong> ${value}`)
        .join('<br/>');
      layer.bindPopup(popupContent);
    }
  };

  return (
    <div className="map-container">
      <MapContainer
        center={[45.9432, 24.9668]}
        zoom={7}
        style={{ height: "100vh", width: "100%" }}
        preferCanvas={false}
        renderer={svgRenderer}
      >
        <ZoomControl position="bottomright" />
        <InitialView />

        {/* Base Layer */}
        {activeBaseLayer && (
          <TileLayer
            url={activeBaseLayer.url}
            attribution={activeBaseLayer.attribution}
          />
        )}

        {/* WMS Layers */}
        {WMS_LAYERS.map((layer) => (
          visibleWmsLayers.has(layer.name) && (
            <WMSTileLayer
              key={layer.name}
              url={layer.url}
              layers={layer.layers}
              format={layer.format || "image/png"}
              transparent={true}
              version={layer.version || "1.1.1"}
              opacity={layer.opacity || 0.7}
              zIndex={layer.zIndex || 10}
            />
          )
        ))}

        {/* Database Layers */}
        <DatabaseLayers
          visibleLayers={visibleLayers}
          layerData={layerData}
          fetchLayerData={fetchLayerData}
          onEachFeature={onEachFeature}
        />

        {/* Layer Control Sidebar */}
        {isSidebarOpen && (
           <LayerControl
             onBaseLayerChange={handleBaseLayerChange}
             onWmsLayerChange={handleWmsLayerChange}
             onDbLayerChange={handleDbLayerChange}
             availableDbLayers={availableDbLayers}
             visibleDbLayers={visibleLayers} // Pass visibleLayers for DB layers
             activeBaseLayerName={activeBaseLayer?.name} // Pass active base layer name with optional chaining
             onClose={() => setIsSidebarOpen(false)} // Pass close handler
           />
        )}

        {/* Button to open sidebar when closed */}
        {!isSidebarOpen && (
           <button 
             className="open-sidebar-button"
             onClick={() => setIsSidebarOpen(true)}
             style={{
                position: 'absolute',
                top: '10px',
                left: '10px',
                zIndex: 1000,
                // Add more styling for a button/icon
                padding: '10px',
                backgroundColor: 'white',
                border: 'none',
                borderRadius: '4px',
                boxShadow: '0 1px 5px rgba(0,0,0,0.2)',
                cursor: 'pointer'
             }}
           >
             Layers {/* Or an icon */}
           </button>
        )}

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
      </MapContainer>
    </div>
  );
}