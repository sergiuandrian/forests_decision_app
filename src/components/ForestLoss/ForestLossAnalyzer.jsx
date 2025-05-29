import { useState, useCallback } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { createGeostore, fetchForestData, polygonToGeoJSON } from '../../utils/gfwApi';

function ForestLossAnalyzer() {
  const map = useMap();
  const [drawing, setDrawing] = useState(false);
  const [polygon, setPolygon] = useState(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  // Initialize drawing control
  const initDrawing = useCallback(() => {
    if (!map) return;

    // Remove existing drawing control if it exists
    if (map.drawingControl) {
      map.removeControl(map.drawingControl);
    }

    // Create drawing control
    const drawingControl = new L.Control.Draw({
      draw: {
        polygon: {
          allowIntersection: false,
          drawError: {
            color: '#e1e100',
            message: '<strong>Error:</strong> Polygon edges cannot intersect!'
          },
          shapeOptions: {
            color: '#3388ff'
          }
        },
        polyline: false,
        circle: false,
        rectangle: false,
        circlemarker: false,
        marker: false
      },
      edit: {
        featureGroup: new L.FeatureGroup(),
        remove: true
      }
    });

    map.addControl(drawingControl);
    map.drawingControl = drawingControl;

    // Handle drawing events
    map.on(L.Draw.Event.CREATED, handleDrawCreated);
    map.on(L.Draw.Event.EDITED, handleDrawEdited);
    map.on(L.Draw.Event.DELETED, handleDrawDeleted);

    setDrawing(true);
  }, [map]);

  // Handle polygon creation
  const handleDrawCreated = async (e) => {
    const layer = e.layer;
    setPolygon(layer);
    map.addLayer(layer);

    try {
      setLoading(true);
      setError(null);

      // Convert polygon to GeoJSON
      const geometry = polygonToGeoJSON(layer);
      
      // Create geostore
      const geostoreId = await createGeostore(geometry);
      
      // Fetch forest loss data
      const data = await fetchForestData(geostoreId);
      
      setResults(data);
    } catch (err) {
      setError(err.message);
      console.error('Error analyzing forest loss:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle polygon edit
  const handleDrawEdited = async (e) => {
    const layers = e.layers;
    layers.eachLayer(async (layer) => {
      setPolygon(layer);
      await handleDrawCreated({ layer });
    });
  };

  // Handle polygon deletion
  const handleDrawDeleted = () => {
    setPolygon(null);
    setResults(null);
  };

  return (
    <div className="forest-loss-analyzer">
      <button 
        onClick={initDrawing}
        className="draw-button"
        disabled={drawing}
      >
        {drawing ? 'Drawing Active' : 'Start Drawing Area'}
      </button>

      {loading && (
        <div className="loading-message">
          Analyzing forest loss data...
        </div>
      )}

      {error && (
        <div className="error-message">
          Error: {error}
        </div>
      )}

      {results && (
        <div className="results-container">
          <h3>Forest Loss Analysis</h3>
          <div className="results-content">
            {results.data && results.data.map((year, index) => (
              <div key={index} className="year-result">
                <h4>{year.year}</h4>
                <p>Loss Area: {(year.value / 10000).toFixed(2)} ha</p>
                {year.confidence && (
                  <p>Confidence: {year.confidence}%</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <style jsx>{`
        .forest-loss-analyzer {
          position: absolute;
          top: 10px;
          right: 10px;
          z-index: 1000;
          background: white;
          padding: 10px;
          border-radius: 4px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }

        .draw-button {
          padding: 8px 16px;
          background: #3388ff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }

        .draw-button:disabled {
          background: #ccc;
          cursor: not-allowed;
        }

        .loading-message,
        .error-message {
          margin-top: 10px;
          padding: 8px;
          border-radius: 4px;
        }

        .loading-message {
          background: #e3f2fd;
          color: #1976d2;
        }

        .error-message {
          background: #ffebee;
          color: #c62828;
        }

        .results-container {
          margin-top: 10px;
          max-height: 300px;
          overflow-y: auto;
        }

        .year-result {
          padding: 8px;
          border-bottom: 1px solid #eee;
        }

        .year-result:last-child {
          border-bottom: none;
        }
      `}</style>
    </div>
  );
}

export default ForestLossAnalyzer; 