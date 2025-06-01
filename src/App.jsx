import './App.css';
import WebGISMap from './map';
import { useState, useEffect, useCallback } from 'react';
import LayerControl from './components/LayerControl';
import api from './services/api';
import { BASE_LAYERS, WMS_LAYERS } from './constants/layers';
import L from "leaflet";

function App() {
  const [showHelp, setShowHelp] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [availableDbLayers, setAvailableDbLayers] = useState([]);
  const [visibleDbLayers, setVisibleDbLayers] = useState(new Set());
  const [visibleWmsLayers, setVisibleWmsLayers] = useState(new Set(WMS_LAYERS.filter(layer => layer.checked).map(layer => layer.name)));
  const [activeBaseLayer, setActiveBaseLayer] = useState(BASE_LAYERS.find(layer => layer.checked) || BASE_LAYERS[0]);
  const [layerData, setLayerData] = useState({});

  useEffect(() => {
    const fetchDbLayers = async () => {
      try {
        const response = await api.get('/gis/layers', {
          headers: {
            'ngrok-skip-browser-warning': 'true'
          }
        });

        // Explicitly parse response data as JSON, even if Content-Type is not application/json
        let responseData = response.data;

        console.log("Value of responseData.layers:", responseData.layers);

        const layers = Array.isArray(responseData) ? responseData : responseData.layers || [];
        
        const processedLayers = layers.map(layer => {
          return {
            ...layer,
            id: layer.table_name,
            name: layer.name || layer.table_name
          };
        });

        setAvailableDbLayers(processedLayers);
        console.log("=== State Updates ===");
        console.log("Setting availableDbLayers to:", processedLayers);
        
        const initialVisibleDbLayers = new Set();
        setVisibleDbLayers(initialVisibleDbLayers);
        console.log("Setting initialVisibleDbLayers to:", Array.from(initialVisibleDbLayers));

      } catch (err) {
        setAvailableDbLayers([]);
        setVisibleDbLayers(new Set());
      }
    };

    fetchDbLayers();
  }, []);

  const fetchLayerData = useCallback(async (layer) => {
    if (!layerData[layer.table_name]) {
      console.log(`Fetching data for layer: ${layer.table_name}`);
      try {
        const response = await api.get(`/gis/data/${layer.table_name}`);
        setLayerData(prev => ({
          ...prev,
          [layer.table_name]: response.data
        }));
      } catch (err) {
        console.error(`Error fetching data for layer ID ${layer.id}:`, err);
        setVisibleDbLayers(prev => {
            const newSet = new Set(prev);
            newSet.delete(layer.id);
            return newSet;
        });
      }
    }
  }, [layerData]);

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
    console.log('handleDbLayerChange called with layer:', layer);
    console.log('Current visibleDbLayers:', Array.from(visibleDbLayers));
    
    setVisibleDbLayers(prev => {
      const newSet = new Set(prev);
      console.log('Current visibility for layer.id:', layer.id, 'is:', newSet.has(layer.id));
      
      if (newSet.has(layer.id)) {
        console.log('Removing layer.id:', layer.id);
        newSet.delete(layer.id);
        setLayerData(prev => {
          const newData = { ...prev };
          delete newData[layer.id];
          return newData;
        });
      } else {
        console.log('Adding layer.id:', layer.id);
        newSet.add(layer.id);
        fetchLayerData(layer);
      }
      console.log('New visibleDbLayers:', Array.from(newSet));
      return newSet;
    });
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const onEachFeature = useCallback((feature, layer) => {
    if (feature.properties) {
      const popupContent = Object.entries(feature.properties)
        .map(([key, value]) => `<strong>${key}:</strong> ${value}`)
        .join('<br/>');
      layer.bindPopup(popupContent);
    }
  }, []);

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-left">
          <h1>Forests Decision App</h1>
          <p className="subtitle">Interactive Forest Management and Analysis Tool</p>
        </div>
        <nav className="header-nav">
          <button className="nav-button" title="Documentation">
            <span className="icon">📚</span>
            <span className="nav-text">Docs</span>
          </button>
          <button className="nav-button" title="Help" onClick={() => setShowHelp(!showHelp)}>
            <span className="icon">❓</span>
            <span className="nav-text">Help</span>
          </button>
          <button className="nav-button" title="Share">
            <span className="icon">↗️</span>
            <span className="nav-text">Share</span>
          </button>
        </nav>
      </header>
      {showHelp && (
        <div className="help-overlay">
          <div className="help-content">
            <h3>Quick Help</h3>
            <ul>
              <li>Use the layer control panel to toggle different map layers</li>
              <li>Click on map features to view detailed information</li>
              <li>Use the search bar to filter layers</li>
              <li>Adjust layer opacity using the slider controls</li>
            </ul>
            <button className="close-help" onClick={() => setShowHelp(false)}>Close</button>
          </div>
        </div>
      )}
      <main className="main-content">
        <LayerControl
          isOpen={isSidebarOpen}
          toggleSidebar={toggleSidebar}
          onBaseLayerChange={handleBaseLayerChange}
          onWmsLayerChange={handleWmsLayerChange}
          onDbLayerChange={handleDbLayerChange}
          availableDbLayers={availableDbLayers}
          visibleDbLayers={visibleDbLayers}
          visibleWmsLayers={visibleWmsLayers}
          activeBaseLayerName={activeBaseLayer?.name}
        />
        <WebGISMap
          activeBaseLayer={activeBaseLayer}
          visibleWmsLayers={visibleWmsLayers}
          visibleDbLayers={visibleDbLayers}
          layerData={layerData}
          onEachFeature={onEachFeature}
          onBaseLayerChange={handleBaseLayerChange}
        />
      </main>
    </div>
  );
}

export default App;
