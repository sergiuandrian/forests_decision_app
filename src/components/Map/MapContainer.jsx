import { MapContainer as LeafletMapContainer, TileLayer, ZoomControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import LayerControl from '../Layers/LayerControl';
import './MapContainer.css';

// Main map container component
function MapContainer() {
  return (
    <div className="map-wrapper">
      <LeafletMapContainer
        center={[47.0105, 28.8638]}
        zoom={8}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        preferCanvas={true}
      >
        {/* Base layer added for initial display */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        {/* Layer control with base and WMS layers */}
        <LayerControl />
        
        {/* Zoom controls in top right */}
        <ZoomControl position="topright" />
      </LeafletMapContainer>
    </div>
  );
}

export default MapContainer; 