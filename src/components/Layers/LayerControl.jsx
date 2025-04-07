import { useEffect } from 'react';
import { LayersControl, TileLayer, WMSTileLayer, useMap } from 'react-leaflet';
import { BASE_LAYERS, WMS_LAYERS } from '../../constants/layers';
import './LayerControl.css';

function LayerControl() {
  const map = useMap();
  
  // Ensure the layers are properly initialized when component mounts
  useEffect(() => {
    if (map) {
      // Force a map resize to ensure proper rendering
      setTimeout(() => {
        map.invalidateSize();
        
        // Log to verify layers are added
        console.log("Map initialized with layers");
      }, 100);
    }
  }, [map]);

  return (
    <>
      <LayersControl position="topleft">
        {/* Base Layers */}
        {BASE_LAYERS.map((layer) => (
          <LayersControl.BaseLayer 
            key={layer.name} 
            name={layer.name}
            checked={layer.checked}
          >
            <TileLayer
              url={layer.url}
              attribution={layer.attribution}
            />
          </LayersControl.BaseLayer>
        ))}

        {/* WMS Layers */}
        {WMS_LAYERS.map((layer) => (
          <LayersControl.Overlay
            key={layer.name}
            name={layer.name}
            checked={layer.checked}
          >
            <WMSTileLayer
              url={layer.url}
              layers={layer.layers}
              format={layer.format || "image/png"}
              transparent={true}
              version={layer.version || "1.1.1"}
              opacity={layer.opacity || 0.7}
              zIndex={layer.zIndex || 10}
            />
          </LayersControl.Overlay>
        ))}
      </LayersControl>
    </>
  );
}

export default LayerControl; 