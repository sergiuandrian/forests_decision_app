import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polygon } from 'react-leaflet';
import { gfwApi } from '../../utils/gfwApi';
import DateRangePicker from 'react-daterange-picker';
import 'react-daterange-picker/dist/lib/css/calendar.css';
import './ForestAnalysis.css';

// Example GeoJSON for Moldova (Codrii Centrali forest)
const MOLDOVA_FOREST_GEOJSON = {
  type: 'Feature',
  geometry: {
    type: 'Polygon',
    coordinates: [[
      [28.8638, 47.0105],
      [28.8638, 47.2105],
      [29.0638, 47.2105],
      [29.0638, 47.0105],
      [28.8638, 47.0105]
    ]]
  }
};

const ForestAnalysis = () => {
  const [polygon, setPolygon] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)),
    endDate: new Date()
  });

  // Load polygon from GFW on component mount
  useEffect(() => {
    const loadPolygon = async () => {
      try {
        setLoading(true);
        const response = await gfwApi.getPolygon(MOLDOVA_FOREST_GEOJSON);
        if (response.data?.polygon) {
          // Convert GeoJSON coordinates to Leaflet polygon format
          const coordinates = response.data.polygon.geometry.coordinates[0];
          const leafletPolygon = coordinates.map(coord => ({
            lat: coord[1],
            lng: coord[0]
          }));
          setPolygon(leafletPolygon);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadPolygon();
  }, []);

  // Calculate center and bounds of polygon
  const getPolygonCenter = () => {
    if (!polygon || polygon.length === 0) return [0, 0];
    const bounds = polygon.reduce((acc, point) => {
      return {
        minLat: Math.min(acc.minLat, point.lat),
        maxLat: Math.max(acc.maxLat, point.lat),
        minLng: Math.min(acc.minLng, point.lng),
        maxLng: Math.max(acc.maxLng, point.lng)
      };
    }, { minLat: 90, maxLat: -90, minLng: 180, maxLng: -180 });

    return [
      (bounds.minLat + bounds.maxLat) / 2,
      (bounds.minLng + bounds.maxLng) / 2
    ];
  };

  // Analyze forest data
  const analyzeArea = async () => {
    if (!polygon || polygon.length < 3) {
      setError('No polygon available for analysis');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const center = getPolygonCenter();
      const radius = 10000; // 10km radius

      const [analysisData, forestLossData, alertsData] = await Promise.all([
        gfwApi.getAreaAnalysis({
          lat: center[0],
          lng: center[1],
          radius,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate
        }),
        gfwApi.getForestLoss({
          lat: center[0],
          lng: center[1],
          radius,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate
        }),
        gfwApi.getAlerts({
          lat: center[0],
          lng: center[1],
          radius,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate
        })
      ]);

      setAnalysis({
        ...analysisData.data,
        forestLoss: forestLossData.data.forestLoss,
        alerts: alertsData.data.alerts
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="forest-analysis">
      <div className="controls">
        <DateRangePicker
          value={dateRange}
          onSelect={setDateRange}
          singleDateRange={true}
        />
        <button 
          onClick={analyzeArea}
          disabled={loading || !polygon}
        >
          {loading ? 'Analyzing...' : 'Analyze Area'}
        </button>
      </div>

      <div className="map-container">
        <MapContainer
          center={[47.1105, 28.9638]} // Center on Moldova forest
          zoom={10}
          style={{ height: '500px', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          {polygon && (
            <Polygon
              positions={polygon}
              pathOptions={{ color: 'blue', fillColor: 'blue', fillOpacity: 0.2 }}
            />
          )}
        </MapContainer>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {analysis && (
        <div className="analysis-results">
          <h3>Analysis Results</h3>
          <div className="results-grid">
            <div className="result-card">
              <h4>Forest Loss</h4>
              <p>Total Loss: {analysis.forestLoss?.loss || 0} ha</p>
              <p>Total Gain: {analysis.forestLoss?.gain || 0} ha</p>
              <p>Net Change: {(analysis.forestLoss?.loss || 0) - (analysis.forestLoss?.gain || 0)} ha</p>
            </div>

            <div className="result-card">
              <h4>Deforestation Alerts</h4>
              <p>Total Alerts: {analysis.alerts?.deforestation?.alerts || 0}</p>
              <p>Confidence: {analysis.alerts?.deforestation?.confidence || 'N/A'}</p>
              <p>Area Affected: {analysis.alerts?.deforestation?.area || 0} ha</p>
            </div>

            <div className="result-card">
              <h4>Fire Alerts</h4>
              <p>Total Alerts: {analysis.alerts?.fire?.alerts || 0}</p>
              <p>Intensity: {analysis.alerts?.fire?.intensity || 'N/A'}</p>
              <p>Area Affected: {analysis.alerts?.fire?.area || 0} ha</p>
            </div>
          </div>

          <div className="metadata">
            <p>Analysis Date: {new Date(analysis.metadata.timestamp).toLocaleString()}</p>
            <p>API Version: {analysis.metadata.version}</p>
            {analysis.metadata.dateRange && (
              <p>
                Period: {analysis.metadata.dateRange.startDate} to {analysis.metadata.dateRange.endDate}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ForestAnalysis; 