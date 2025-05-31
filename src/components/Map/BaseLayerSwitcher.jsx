import React from 'react';
import { BASE_LAYERS } from '../../constants/layers';
import './BaseLayerSwitcher.css';

const BaseLayerSwitcher = ({ activeLayer, onLayerChange }) => {
  const activeLayerData = BASE_LAYERS.find(layer => layer.name === activeLayer?.name);

  return (
    <div className="base-layer-switcher leaflet-control">
      <select
        value={activeLayer?.name || ''}
        onChange={(e) => {
          const selectedLayer = BASE_LAYERS.find(layer => layer.name === e.target.value);
          if (selectedLayer) {
            onLayerChange(selectedLayer);
          }
        }}
        className="base-layer-select"
      >
        {BASE_LAYERS.map(layer => (
          <option key={layer.name} value={layer.name}>
            {layer.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default BaseLayerSwitcher; 