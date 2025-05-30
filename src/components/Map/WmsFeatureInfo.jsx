import { useState, useEffect } from "react";
import { useMap, Popup } from "react-leaflet";

// Component to handle WMS GetFeatureInfo using direct WMS layer extension
function WmsFeatureInfo() {
  const map = useMap();
  const [popupPosition, setPopupPosition] = useState(null);
  const [popupContent, setPopupContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeWmsLayer, setActiveWmsLayer] = useState(null);

  useEffect(() => {
    if (!map) return;

    // Track active WMS layer
    const handleLayerChange = () => {
      let activeLayer = null;
      map.eachLayer(layer => {
        if (layer._url && layer.wmsParams && layer.options && layer.options.opacity > 0) {
          activeLayer = layer;
        }
      });
      setActiveWmsLayer(activeLayer);
    };

    // Listen for layer changes
    map.on('layeradd', handleLayerChange);
    map.on('layerremove', handleLayerChange);

    // Initial check
    handleLayerChange();

    // Cleanup
    return () => {
      map.off('layeradd', handleLayerChange);
      map.off('layerremove', handleLayerChange);
    };
  }, [map]);

  useEffect(() => {
    if (!map) return;

    // Define the getFeatureInfoUrl function
    function getFeatureInfoUrl(latlng, layer) {
      if (!layer || !layer._url || !layer.wmsParams) return null;

      // Make a point on the screen
      const point = map.latLngToContainerPoint(latlng);

      // Get the map size
      const size = map.getSize();

      // Get current bounds
      const bounds = map.getBounds();
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();

      // Format bbox properly based on WMS version
      let bbox;
      if (layer.wmsParams.version === '1.3.0') {
        bbox = `${sw.lat},${sw.lng},${ne.lat},${ne.lng}`;
      } else {
        bbox = `${sw.lng},${sw.lat},${ne.lng},${ne.lat}`;
      }

      // Parameters for GetFeatureInfo
      const params = {
        service: 'WMS',
        version: layer.wmsParams.version || '1.3.0',
        request: 'GetFeatureInfo',
        layers: layer.wmsParams.layers,
        query_layers: layer.wmsParams.layers,
        bbox: bbox,
        width: size.x,
        height: size.y,
        format: 'image/png',
        info_format: 'application/json',
        feature_count: 10,
        srs: 'EPSG:4326',
        crs: 'EPSG:4326'
      };

      // Add coordinates differently based on WMS version
      if (params.version === '1.3.0') {
        params.i = Math.round(point.x);
        params.j = Math.round(point.y);
      } else {
        params.x = Math.round(point.x);
        params.y = Math.round(point.y);
      }

      // Format URL
      return layer._url + L.Util.getParamString(params, layer._url);
    }

    // Function to fetch feature info
    async function fetchFeatureInfo(url, layerName) {
      try {
        if (!url) return null;

        console.log(`Fetching info for ${layerName} from:`, url);

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json, text/plain, */*'
          }
        });

        console.log("Response status:", response.status);

        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`);
        }

        const data = await response.json();
        return formatFeatureInfo(data, layerName);
      } catch (error) {
        console.error("Error fetching feature info:", error);
        return `<p>Error loading feature information</p>`;
      }
    }

    // Format the feature info for display
    function formatFeatureInfo(data, layerName) {
      if (data.features && data.features.length > 0) {
        const feature = data.features[0];
        const properties = feature.properties;

        // Define the properties we want to display
        const displayProperties = {
          "intreprinderea_silvica": "Forest Enterprise",
          "trupul": "Forest Unit",
          "proprietate": "Ownership",
          "suprafata": "Area"
        };

        let content = `<h4>${layerName}</h4>`;
        content += "<table>";

        // Only display the properties we're interested in
        for (const [key, label] of Object.entries(displayProperties)) {
          if (properties[key] !== null && properties[key] !== undefined) {
            content += `<tr><th>${label}</th><td>${properties[key]}</td></tr>`;
          }
        }

        content += "</table>";
        return content;
      } else if (data.text) {
        return `<h4>${layerName}</h4><div>${data.text}</div>`;
      } else {
        return `<p>No features found in ${layerName}</p>`;
      }
    }

    // Handle map click
    const handleMapClick = async (e) => {
      if (!activeWmsLayer) {
        console.log("No active WMS layer found");
        return;
      }

      const url = getFeatureInfoUrl(e.latlng, activeWmsLayer);
      if (!url) {
        console.log("Could not generate GetFeatureInfo URL");
        return;
      }

      setIsLoading(true);
      setPopupPosition(e.latlng);
      setPopupContent("Loading feature information...");

      try {
        const content = await fetchFeatureInfo(url, activeWmsLayer.wmsParams.layers);
        if (content) {
          setPopupContent(content);
        } else {
          setPopupContent("No feature information available");
        }
      } catch (error) {
        console.error("Error handling map click:", error);
        setPopupContent("Error loading feature information");
      } finally {
        setIsLoading(false);
      }
    };

    map.on('click', handleMapClick);

    return () => {
      map.off('click', handleMapClick);
    };
  }, [map, activeWmsLayer]);

  return popupPosition ? (
    <Popup position={popupPosition} onClose={() => setPopupPosition(null)}>
      {isLoading ? (
        <div>Loading feature information...</div>
      ) : (
        <div dangerouslySetInnerHTML={{ __html: popupContent }} />
      )}
    </Popup>
  ) : null;
}

export default WmsFeatureInfo; 