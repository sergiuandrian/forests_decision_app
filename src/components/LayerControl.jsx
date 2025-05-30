import React, { useState } from 'react';
import { BASE_LAYERS, WMS_LAYERS } from '../constants/layers';
import './LayerControl.css';

const LayerControl = ({
  onBaseLayerChange,
  onWmsLayerChange,
  onDbLayerChange,
  availableDbLayers,
  visibleDbLayers,
  activeBaseLayerName,
  onClose
}) => {
  return (
    <div className={`layer-control-sidebar`}>
      <div className="layer-control-content">
        <div className="layer-control-header">
          <button className="close-sidebar" onClick={onClose}>×</button>
          <h2>Fondul Forestier</h2>
        </div>

        {/* <div className="layer-filter">
          <input type="text" placeholder="Filtrați straturile" />
          <span className="filter-icon">∇</span>
        </div> */}

        <div className="header-icons">
          {/* <button className="icon-button">📁</button> */}
          <button className="icon-button">➕</button>
          {/* <button className="icon-button">💬</button> */}
        </div>

        <div className="layer-section">
          <h4>Default</h4>
          <div className="layer-list">
            {BASE_LAYERS.map((layer) => (
              <label key={layer.name} className="layer-item">
                <input
                  type="checkbox"
                  checked={activeBaseLayerName === layer.name}
                  onChange={() => onBaseLayerChange(layer)}
                />
                <span className="layer-item-menu-icon">☰</span>
                <span className="layer-name">{layer.name}</span>
                <span className="layer-item-expand-icon">▶</span>
              </label>
            ))}
          </div>
        </div>

        <h4>WMS Layers</h4>
        <div className="layer-list">
          {WMS_LAYERS.map((layer) => (
            <label key={layer.name} className="layer-item">
              <input
                type="checkbox"
                checked={visibleDbLayers && visibleDbLayers.has(layer.name)}
                onChange={() => onWmsLayerChange(layer)}
              />
              <span className="layer-item-menu-icon">☰</span>
              <span className="layer-name">{layer.name}</span>
              <span className="layer-item-expand-icon">▶</span>
            </label>
          ))}
        </div>

        <h4>Database Layers</h4>
        {Array.isArray(availableDbLayers) ? (
          <div className="layer-list">
            {availableDbLayers.map((layer) => (
              <label key={layer.table_name} className="layer-item">
                <input
                  type="checkbox"
                  checked={visibleDbLayers && visibleDbLayers.has(layer.table_name)}
                  onChange={() => onDbLayerChange(layer)}
                />
                <span className="layer-name">{layer.table_name}</span>

              </label>
            ))}
          </div>
        ) : (
          <p>Loading database layers...</p>
        )}
      </div>
    </div>
  );
};

export default LayerControl; 