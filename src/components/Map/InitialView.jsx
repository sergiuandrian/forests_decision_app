import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

// Component to set Moldova view on initialization
function InitialView() {
  const map = useMap();
  
  useEffect(() => {
    if (map) {
      const moldovaBounds = L.latLngBounds(
        [48.4902, 26.6162],
        [45.4686, 30.1354]
      );
      
      // Fit map to Moldova bounds with padding
      map.fitBounds(moldovaBounds, {
        padding: [50, 50],
        maxZoom: 8,
        animate: true
      });

      map.invalidateSize();
      map.touchZoom.enable();
      map.doubleClickZoom.enable();
      map.scrollWheelZoom.enable();
      map.boxZoom.enable();
      map.keyboard.enable();
      map.setMinZoom(6);
      map.setMaxZoom(18);
    }
  }, [map]);

  return null;
}

export default InitialView; 