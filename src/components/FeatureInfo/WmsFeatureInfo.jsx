import { useState, useEffect } from "react";
import { useMap, Popup } from "react-leaflet";
import { fetchFeatureInfo, getFeatureInfoUrl } from "../../utils/map";

// Component to handle WMS GetFeatureInfo requests
function WmsFeatureInfo() {
  const map = useMap();
  const [popupPosition, setPopupPosition] = useState(null);
  const [popupContent, setPopupContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeWmsLayers, setActiveWmsLayers] = useState([]);
  
  // Track active WMS layers
  useEffect(() => {
    if (!map) return;
    
    const handleLayerChange = () => {
      const activeLayers = [];
      map.eachLayer(layer => {
        // Check if this is a WMS layer and it's visible
        if (layer._url && 
            layer.wmsParams && 
            layer.options && 
            layer.options.opacity > 0 &&
            !map.hasLayer(layer.options.pane)) {
          activeLayers.push(layer);
        }
      });
      setActiveWmsLayers(activeLayers);
    };
    
    map.on('layeradd', handleLayerChange);
    map.on('layerremove', handleLayerChange);
    map.on('overlayadd', handleLayerChange);
    map.on('overlayremove', handleLayerChange);
    
    // Initial check - run after a short delay to ensure layers are loaded
    setTimeout(handleLayerChange, 500);
    
    return () => {
      map.off('layeradd', handleLayerChange);
      map.off('layerremove', handleLayerChange);
      map.off('overlayadd', handleLayerChange);
      map.off('overlayremove', handleLayerChange);
    };
  }, [map]);
  
  // Handle map clicks and feature info requests
  useEffect(() => {
    if (!map) return;
    
    const handleMapClick = async (e) => {
      if (activeWmsLayers.length === 0) {
        console.log("No active WMS layers found");
        return;
      }
      
      setIsLoading(true);
      setPopupPosition(e.latlng);
      setPopupContent("Loading feature information...");
      
      // Try each active layer until we get a response
      let hasResponse = false;
      
      for (const layer of activeWmsLayers) {
        const url = getFeatureInfoUrl(e.latlng, layer, map);
        if (!url) continue;
        
        try {
          const response = await fetchFeatureInfo(url, layer.wmsParams.layers);
          if (response && response.content) {
            setPopupContent(response.content);
            hasResponse = true;
            break;
          }
        } catch (error) {
          console.error("Error fetching feature info:", error);
        }
      }
      
      if (!hasResponse) {
        setPopupContent("No feature information found at this location.");
      }
      
      setIsLoading(false);
    };
    
    map.on('click', handleMapClick);
    
    return () => {
      map.off('click', handleMapClick);
    };
  }, [map, activeWmsLayers]);
  
  return popupPosition ? (
    <Popup position={popupPosition} onClose={() => setPopupPosition(null)}>
      {isLoading ? (
        <div className="popup-loading">Loading feature information...</div>
      ) : (
        <div className="popup-content">
          <div dangerouslySetInnerHTML={{ __html: popupContent }} />
        </div>
      )}
    </Popup>
  ) : null;
}

export default WmsFeatureInfo; 