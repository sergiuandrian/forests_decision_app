import { WMSTileLayer, LayersControl } from "react-leaflet";
import { WMS_LAYERS } from "../../constants/layers";

// Component for WMS overlay layers
function WmsLayers() {
  return (
    <>
      {WMS_LAYERS.map((layer) => (
        <LayersControl.Overlay key={layer.name} name={layer.name}>
          <WMSTileLayer
            url={layer.url}
            layers={layer.layers}
            format={layer.format}
            transparent={layer.transparent}
            version={layer.version}
          />
        </LayersControl.Overlay>
      ))}
    </>
  );
}

export default WmsLayers; 