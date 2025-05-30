import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import './LayerList.css';

const LayerList = ({ onLayerSelect }) => {
  const [layers, setLayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchLayers();
  }, []);

  const fetchLayers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/gis/layers');
      setLayers(response.data.layers);
      setError(null);
    } catch (err) {
      setError('Failed to fetch layers: ' + (err.message || 'Unknown error'));
      console.error('Error fetching layers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLayerVisibility = (layer) => {
    if (onLayerSelect) {
      onLayerSelect(layer);
    }
  };

  if (loading) {
    return <div className="layer-list-loading">Loading layers...</div>;
  }

  if (error) {
    return <div className="layer-list-error">{error}</div>;
  }

  return (
    <div className="layer-list">
      <h3>Available Layers</h3>
      <div className="layer-list-content">
        {layers.map((layer) => (
          <div key={layer.table_name} className="layer-item-simple">
            <span className="layer-name-simple">{layer.table_name}</span>
            
            <button 
              className="layer-visibility-toggle-simple"
              onClick={() => handleLayerVisibility(layer)}
            >
              Toggle
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LayerList; 