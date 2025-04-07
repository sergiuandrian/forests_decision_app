import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

// Component to set Moldova view on initialization
function InitialView() {
  const map = useMap();
  
  useEffect(() => {
    if (map) {
      // Define Moldova bounds
      const moldovaBounds = L.latLngBounds(
        [48.4902, 26.6162], // Northeast corner
        [45.4686, 30.1354]  // Southwest corner
      );
      
      // Fit map to Moldova bounds with padding
      map.fitBounds(moldovaBounds, {
        padding: [50, 50],
        maxZoom: 8,
        animate: true
      });

      // Enable necessary interactions for better user experience
      map.touchZoom.enable();
      map.doubleClickZoom.enable();
      map.scrollWheelZoom.enable();
      map.boxZoom.enable();
      map.keyboard.enable();
      
      // Set minimum and maximum zoom levels
      map.setMinZoom(6);
      map.setMaxZoom(18);
    }
  }, [map]);

  return null;
}

export default InitialView; 