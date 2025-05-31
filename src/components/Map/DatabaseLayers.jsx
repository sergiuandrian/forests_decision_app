import React, { useEffect } from 'react';
import { GeoJSON, useMap } from 'react-leaflet';

const DatabaseLayers = ({ visibleDbLayers, layerData, onEachFeature }) => {
  const map = useMap();

  useEffect(() => {
    if (map && Object.keys(layerData).length > 0) {
      map.invalidateSize();
    }
  }, [map, layerData]);

  const defaultGeoJSONStyle = () => ({
    color: '#2c3e50',      // Dark blue-gray for borders
    weight: 1,             // Thinner border
    opacity: 0.8,          // Slightly transparent border
    // fillColor: '#3498db',  // Nice blue for fill
    fillOpacity: 0.2,      // More transparent fill
    dashArray: '3',        // Dashed border
    smoothFactor: 0.5      // Smoother borders
  });

  // Style for hover state
  const highlightStyle = {
    weight: 2,
    opacity: 1,
    fillColor: '#2980b9',  // Darker blue on hover
    fillOpacity: 0.6,
    dashArray: '',
    color: '#2c3e50'
  };

  // Style for selected state
  const selectedStyle = {
    weight: 2,
    opacity: 1,
    fillColor: '#27ae60',  // Green for selected
    fillOpacity: 0.6,
    dashArray: '',
    color: '#2c3e50'
  };

  const onEachFeatureWithStyle = (feature, layer) => {
    // Add hover effects
    layer.on({
      mouseover: (e) => {
        const layer = e.target;
        layer.setStyle(highlightStyle);
        layer.bringToFront();
      },
      mouseout: (e) => {
        const layer = e.target;
        layer.setStyle(defaultGeoJSONStyle());
      },
      click: (e) => {
        const layer = e.target;
        layer.setStyle(selectedStyle);
      }
    });

    // Call the original onEachFeature if provided
    if (onEachFeature) {
      onEachFeature(feature, layer);
    }
  };

  return (
    <>
      {Array.from(visibleDbLayers).map(layerName => {
        const data = layerData[layerName];
        if (!data) return null;

        return (
          <GeoJSON
            key={layerName}
            data={data}
            style={defaultGeoJSONStyle}
            onEachFeature={onEachFeatureWithStyle}
          />
        );
      })}
    </>
  );
};

export default DatabaseLayers; 