import { useEffect, useState } from "react";
import { 
  MapContainer, TileLayer, WMSTileLayer, FeatureGroup, 
  LayersControl, GeoJSON, useMapEvents
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { EditControl } from "react-leaflet-draw";
import "leaflet-draw/dist/leaflet.draw.css";
import L from "leaflet";

// Define the API URL - conditionally based on environment
const API_URL = process.env.NODE_ENV === 'production' 
  ? null // No API in production (GitHub Pages)
  : 'http://localhost:5000/api/gis';

// Import sample data for production mode
import sampleDataImport from './mockData/sampleData.json';

export default function WebGISMap() {
  const [geoJsonData, setGeoJsonData] = useState(null);
  const [mapInstance, setMapInstance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    console.log("Map initialized");
    
    // Load sample data if in production (GitHub Pages)
    if (process.env.NODE_ENV === 'production') {
      setGeoJsonData(sampleDataImport);
    }
  }, []);
  
  // Handle file upload - using localStorage for persistence
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      try {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const geoJson = JSON.parse(e.target.result);
            
            // Basic validation
            if (!geoJson.type || !geoJson.features) {
              setError("Invalid GeoJSON format");
              return;
            }
            
            // Set data and save to localStorage
            setGeoJsonData(geoJson);
            localStorage.setItem('forestGeoJson', JSON.stringify(geoJson));
          } catch (error) {
            console.error("Invalid GeoJSON file", error);
            setError("Invalid GeoJSON format");
          }
        };
        reader.readAsText(file);
      } catch (error) {
        console.error("Error handling file upload:", error);
        setError("Error uploading file");
      }
    }
  };

  // Load data from localStorage on component mount
  useEffect(() => {
    const savedData = localStorage.getItem('forestGeoJson');
    if (savedData) {
      try {
        setGeoJsonData(JSON.parse(savedData));
      } catch (e) {
        console.error("Error parsing saved GeoJSON", e);
      }
    }
  }, []);

  return (
    <div className="h-screen w-full relative">
      <input 
        type="file" 
        accept=".geojson" 
        onChange={handleFileUpload} 
        className="absolute top-2 left-2 bg-white p-2 z-10 border border-gray-300 rounded-md shadow-md" 
      />
      
      {loading && <div className="absolute top-2 right-2 bg-white p-2 z-10 border border-gray-300 rounded-md shadow-md">Loading...</div>}
      {error && <div className="absolute top-2 right-2 bg-white p-2 z-10 border border-red-300 rounded-md shadow-md text-red-500">{error}</div>}
      
      <MapContainer center={[45.9432, 24.9668]} zoom={7} className="mapcont h-full w-full" whenCreated={setMapInstance}>
        <LayersControl position="topright">
          {/* Base Layers */}
          <LayersControl.BaseLayer checked name="OpenStreetMap">
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
          </LayersControl.BaseLayer>
          
          <LayersControl.BaseLayer name="Satellite">
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution='&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
            />
          </LayersControl.BaseLayer>
          
          {/* Administrative Overlays */}
          <LayersControl.Overlay name="Moldova Boundaries">
            <WMSTileLayer
              url="https://demo.geoserver.org/geoserver/wms"
              layers="topp:states"
              format="image/png"
              transparent={true}
              version="1.1.0"
            />
          </LayersControl.Overlay>
          
          {/* Forest Overlays - Using demo layers since GeoServer won't be available on GitHub Pages */}
          <LayersControl.Overlay name="Forest Cover">
            <WMSTileLayer
              url="https://demo.geoserver.org/geoserver/wms"
              layers="sf:restricted"
              format="image/png"
              transparent={true}
              version="1.1.0"
            />
          </LayersControl.Overlay>
        </LayersControl>

        {geoJsonData && <GeoJSON data={geoJsonData} />} 
        
        {/* <FeatureGroup>
          <EditControl
            position="topright"
            draw={{
              rectangle: true,
              circle: true,
              polygon: true,
              polyline: true,
              marker: true,
            }}
            edit={{
              remove: true,
              edit: true,
            }}
          />
        </FeatureGroup> */}
      </MapContainer>
    </div>
  );
}