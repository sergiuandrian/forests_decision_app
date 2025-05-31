import React, { useState, useEffect, useRef, memo } from 'react';
import { 
  MapContainer, TileLayer, WMSTileLayer, 
  ZoomControl, ScaleControl, useMap, useMapEvents
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import api from './services/api';
import { BASE_LAYERS, WMS_LAYERS } from './constants/layers';
import InitialView from './components/Map/InitialView';
import DatabaseLayers from './components/Map/DatabaseLayers';
import BaseLayerSwitcher from './components/Map/BaseLayerSwitcher';

// Fix for default Leaflet icon issue
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'leaflet/images/marker-icon-2x.png',
  iconUrl: 'leaflet/images/marker-icon.png',
  shadowUrl: 'leaflet/images/marker-shadow.png',
});

// Define SVG renderer
const svgRenderer = L.svg();

// Map controls component
const MapControls = ({ onPositionChange }) => {
  const map = useMap();
  const [coordinates, setCoordinates] = useState({ lat: 0, lng: 0, zoom: 0 });

  useMapEvents({
    mousemove: (e) => {
      const { lat, lng } = e.latlng;
      const zoom = map.getZoom();
      setCoordinates({ lat, lng, zoom });
      onPositionChange && onPositionChange({ lat, lng, zoom });
    },
    zoom: () => {
      const center = map.getCenter();
      const zoom = map.getZoom();
      setCoordinates({ lat: center.lat, lng: center.lat, zoom });
      onPositionChange && onPositionChange({ lat: center.lat, lng: center.lat, zoom });
    }
  });

  return (
    <div className="map-controls">
      <div className="coordinates-display">
        <span>Lat: {coordinates.lat.toFixed(4)}</span>
        <span>Lng: {coordinates.lng.toFixed(4)}</span>
        <span>Zoom: {coordinates.zoom}</span>
      </div>
      <div className="map-tools">
        <button 
          className="map-tool-button" 
          onClick={() => map.setView([0, 0], 2)}
          title="Reset View"
        >
          🏠
        </button>
        <button 
          className="map-tool-button"
          onClick={() => {
            if (document.fullscreenElement) {
              document.exitFullscreen();
            } else {
              document.documentElement.requestFullscreen();
            }
          }}
          title="Toggle Fullscreen"
        >
          ⛶
        </button>
      </div>
    </div>
  );
};

export default memo(function WebGISMap({
  activeBaseLayer,
  visibleWmsLayers,
  visibleDbLayers,
  layerData,
  onEachFeature,
  onBaseLayerChange
}) {
  const [error, setError] = useState(null);
  const [layerOpacities, setLayerOpacities] = useState({});
  const mapRef = useRef(null);

  useEffect(() => {
    console.log("Visible DB Layers updated in map.jsx useEffect:", visibleDbLayers);
  }, [visibleDbLayers]);

  const handlePositionChange = (coords) => {
  };

  return (
    <div className="map-container">
      <MapContainer
        center={[45.9432, 24.9668]}
        zoom={7}
        style={{ height: "100%", width: "100%" }}
        preferCanvas={false}
        renderer={svgRenderer}
        ref={mapRef}
        zoomControl={false}
      >
        <ZoomControl position="bottomright" />
        <InitialView />

        <BaseLayerSwitcher
          baseLayers={BASE_LAYERS}
          activeLayer={activeBaseLayer}
          onLayerChange={onBaseLayerChange}
        />

        {activeBaseLayer && (
          <TileLayer
            url={activeBaseLayer.url}
            attribution={activeBaseLayer.attribution}
          />
        )}

        {WMS_LAYERS.map((layer) => (
          visibleWmsLayers.has(layer.name) && (
            <WMSTileLayer
              key={layer.name}
              url={layer.url}
              layers={layer.layers}
              format={layer.format || "image/png"}
              transparent={true}
              version={layer.version || "1.1.1"}
              opacity={layerOpacities[layer.name] || 1}
              zIndex={layer.zIndex || 10}
            />
          )
        ))}

        <DatabaseLayers
          visibleDbLayers={visibleDbLayers}
          layerData={layerData}
          onEachFeature={onEachFeature}
        />

        <MapControls onPositionChange={handlePositionChange} />

      </MapContainer>
      {error && <div className="error-message">{error}</div>}
    </div>
  );
});