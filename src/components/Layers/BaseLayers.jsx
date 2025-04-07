import { TileLayer, LayersControl } from "react-leaflet";
import { BASE_LAYERS } from "../../constants/layers";

// Component for map base layers
function BaseLayers() {
  return (
    <>
      {BASE_LAYERS.map((layer, index) => (
        <LayersControl.BaseLayer 
          key={layer.name} 
          checked={layer.checked}
          name={layer.name}
        >
          <TileLayer
            url={layer.url}
            attribution={layer.attribution}
          />
        </LayersControl.BaseLayer>
      ))}
    </>
  );
}

export default BaseLayers; 