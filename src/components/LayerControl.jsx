import React, { useState, useMemo } from 'react';
import { BASE_LAYERS, WMS_LAYERS } from '../constants/layers';
import './LayerControl.css';

// Helper component for individual layer items
const LayerItem = ({ layer, type, onToggle, isVisible, isActiveBaseLayer }) => {
  return (
    <div className={`layer-item-container ${type}-layer-item`}>
      <div className="layer-item">
        {type === 'base' ? (
          <input
            type="radio"
            name="base-layer"
            checked={isActiveBaseLayer}
            onChange={() => onToggle(layer)} // Keep onChange for radio buttons
          />
        ) : (
          <input
            type="checkbox"
            checked={isVisible}
            onChange={() => onToggle(layer)} // Keep onChange for checkboxes
          />
        )}
        <span className="layer-name">{layer.name || layer.table_name}</span>
        {/* Add a menu button or info icon here if needed */}
      </div>
      {/* Optional: Add more controls or info here */}
    </div>
  );
};

const LayerControl = ({
  onBaseLayerChange,
  onWmsLayerChange,
  onDbLayerChange,
  availableDbLayers,
  visibleDbLayers,
  visibleWmsLayers, // Keep visibleWmsLayers for now if needed for LayerItem checkbox logic
  activeBaseLayerName,
  onClose
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('layers'); // State for active tab
  const [expandedSections, setExpandedSections] = useState({
    wms: true,
    db: true,
    // analysis: true, // No longer needed as a separate collapsible section here
  });

  // State for Analysis Tools inputs
  const [intersectionSourceLayer, setIntersectionSourceLayer] = useState('');
  const [intersectionTargetLayer, setIntersectionTargetLayer] = useState('');
  const [sourceFeatureIds, setSourceFeatureIds] = useState('');
  const [forestMetricsYear, setForestMetricsYear] = useState('');
  // Add state for Buffer Analysis if implementing

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.name.endsWith('.shp') || file.name.endsWith('.geojson')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            if (file.name.endsWith('.geojson')) {
              const geojsonData = JSON.parse(e.target.result);
              // Assume onDbLayerChange can handle GeoJSON
              onDbLayerChange({ name: file.name, data: geojsonData });
            } else if (file.name.endsWith('.shp')) {
              console.log('Shapefile uploaded. Parsing not implemented yet.', file.name);
              alert('Shapefile upload is not fully implemented yet. Please upload a GeoJSON file.');
            }
          } catch (error) {
            console.error('Error reading or parsing file:', error);
            alert('Could not read or parse the file.');
          }
        };
        reader.readAsText(file); // Read as text for GeoJSON
      } else {
        alert('Unsupported file format. Please upload a .shp or .geojson file.');
      }
    }
  };

  const filteredLayers = useMemo(() => ({
    wms: WMS_LAYERS,
    db: Array.isArray(availableDbLayers) ? availableDbLayers : []
  }), [availableDbLayers]);

  // Placeholder functions for analysis tools
  const handleRunIntersectionAnalysis = () => {
    console.log('Running Intersection Analysis with:');
    console.log('Source Layer:', intersectionSourceLayer);
    console.log('Target Layer:', intersectionTargetLayer);
    console.log('Source Feature IDs:', sourceFeatureIds);
    // Call a prop function like onRunAnalysis passed from parent (map.jsx)
    // onRunAnalysis({ type: 'intersection', sourceLayer: intersectionSourceLayer, targetLayer: intersectionTargetLayer, featureIds: sourceFeatureIds });
    alert('Intersection Analysis: Implement actual analysis logic.');
  };

  const handleRunForestMetrics = () => {
    console.log('Running Forest Metrics for year:', forestMetricsYear);
     // Call a prop function like onRunAnalysis passed from parent (map.jsx)
    // onRunAnalysis({ type: 'forestMetrics', year: forestMetricsYear });
    alert('Forest Metrics: Implement actual analysis logic.');
  };

   // Placeholder for Buffer Analysis handler
   const handleRunBufferAnalysis = () => {
      console.log('Running Buffer Analysis: Implement logic.');
      alert('Buffer Analysis: Implement actual analysis logic.');
   };


  return (
    <>
      {/* Toggle button for the sidebar */}
      <button
        className="layer-control-toggle"
        onClick={toggleSidebar}
        title="Toggle layers and analysis tools"
      >
        <span className="layer-icon">📄</span> {/* Icon for layers/tools */}
      </button>

      {/* Layer Control Sidebar */}
      <div className={`layer-control-sidebar ${isOpen ? 'open' : 'closed'}`}>

        <div className="layer-control-content">
          {/* Header */}
          <div className="layer-control-header">
            <button className="close-sidebar" onClick={toggleSidebar} title="Close sidebar">×</button>
            <h2>GIS Tools</h2> {/* Updated title */}
          </div>

          {/* Tabs */}
          <div className="tab-container">
            <button
              className={`tab-button ${activeTab === 'layers' ? 'active' : ''}`}
              onClick={() => setActiveTab('layers')}
            >
              Layers
            </button>
            <button
              className={`tab-button ${activeTab === 'analysis' ? 'active' : ''}`}
              onClick={() => setActiveTab('analysis')}
            >
              Analysis
            </button>
          </div>

          {/* Content based on active tab */}
          <div className="tab-content">
            {activeTab === 'layers' && (
              <div className="layers-tab-content">
                 {/* File Upload Section - keeping outside sections for now as it was before */}
                <div className="upload-section">
                  <input
                    type="file"
                    accept=".shp,.geojson"
                    onChange={handleFileUpload}
                    id="file-upload-input"
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="file-upload-input" className="upload-button">
                    <span className="upload-icon">📁</span> Upload Layer
                  </label>
                  <p className="upload-hint">.shp or .geojson</p>
                </div>

                {/* Layer Sections */}
                <div className="layer-sections">
                  {/* WMS Layers Section */}
                  <div className="layer-section">
                    <div className="section-header" onClick={() => toggleSection('wms')}>
                      <h4>WMS Layers</h4>
                      <span className="expand-icon">{expandedSections.wms ? '▼' : '►'}</span>
                    </div>
                    {expandedSections.wms && (
                      <div className="layer-list">
                        {filteredLayers.wms.map(layer => (
                          <LayerItem
                            key={`wms-${layer.name}`}
                            layer={layer}
                            type="wms"
                            onToggle={onWmsLayerChange}
                            isVisible={visibleWmsLayers?.has(layer.name)} // Using visibleWmsLayers for WMS
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Database Layers Section */}
                  <div className="layer-section">
                    <div className="section-header" onClick={() => toggleSection('db')}>
                      <h4>Database Layers ({filteredLayers.db.length})</h4>
                      <span className="expand-icon">{expandedSections.db ? '▼' : '►'}</span>
                    </div>
                    {expandedSections.db && (
                      <div className="layer-list">
                        {filteredLayers.db.length > 0 ? (
                          filteredLayers.db.map(layer => (
                            <LayerItem
                              key={`db-${layer.table_name}`}
                              layer={layer}
                              type="db"
                              onToggle={onDbLayerChange}
                              isVisible={visibleDbLayers?.has(layer.table_name)} // Using .has(layer.table_name) for consistency
                            />
                          ))
                        ) : (
                          <p className="loading-text">No database layers available or still loading...</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'analysis' && (
              <div className="analysis-tab-content">
                {/* GIS Analysis Tools Section Content */}
                 <div className="analysis-tools-content">

                   {/* Buffer Analysis (Placeholder) */}
                  <div className="analysis-tool-section">
                     <div className="analysis-tool-header">
                       <h5>Buffer Analysis</h5>
                     </div>
                       <div className="analysis-tool-inputs">
                          <p className="hint-text">Configure buffer analysis parameters.</p>
                           {/* Add buffer analysis inputs here */}
                           <button className="run-analysis-button" onClick={handleRunBufferAnalysis}>
                              RUN BUFFER ANALYSIS
                          </button>
                       </div>
                   </div>

                  {/* Intersection Analysis */}
                  <div className="analysis-tool-section">
                     <div className="analysis-tool-header">
                       <h5>Intersection Analysis</h5>
                     </div>
                     <div className="analysis-tool-inputs">
                        <div className="input-group">
                           <label>Source Layer</label>
                           <select
                              value={intersectionSourceLayer}
                              onChange={(e) => setIntersectionSourceLayer(e.target.value)}
                           >
                              <option key="select-source-layer" value="">Select a layer</option>
                              {/* Add available layers as options */}
                               {Array.isArray(availableDbLayers) && availableDbLayers.map(layer => (
                                 <option key={layer.name} value={layer.name}>{layer.name}</option>
                               ))}
                               {filteredLayers.wms.map(layer => (
                                  <option key={layer.name} value={layer.name}>{layer.name}</option>
                               ))}
                           </select>
                        </div>
                        <div className="input-group">
                           <label>Target Layer</label>
                           <select
                              value={intersectionTargetLayer}
                              onChange={(e) => setIntersectionTargetLayer(e.target.value)}
                           >
                               <option key="select-target-layer" value="">Select a layer</option>
                                {/* Add available layers as options */}
                                {Array.isArray(availableDbLayers) && availableDbLayers.map(layer => (
                                 <option key={layer.name} value={layer.name}>{layer.name}</option>
                               ))}
                               {filteredLayers.wms.map(layer => (
                                  <option key={layer.name} value={layer.name}>{layer.name}</option>
                               ))}
                           </select>
                        </div>
                        <div className="input-group">
                           <label>Source Feature IDs (optional)</label>
                           <input
                              type="text"
                              value={sourceFeatureIds}
                              onChange={(e) => setSourceFeatureIds(e.target.value)}
                              placeholder="Comma-separated list"
                           />
                           <small className="hint-text">Comma-separated list of source feature IDs (leave empty for all)</small>
                        </div>
                        <button className="run-analysis-button" onClick={handleRunIntersectionAnalysis}>
                           RUN INTERSECTION ANALYSIS
                        </button>
                     </div>
                   </div>

                  {/* Forest Metrics */}
                   <div className="analysis-tool-section">
                     <div className="analysis-tool-header">
                       <h5>Forest Metrics</h5>
                     </div>
                       <div className="analysis-tool-inputs">
                           <p className="hint-text">Calculate forest metrics for the current map selection or view.</p>
                            <div className="input-group">
                               <label>Year</label>
                               <input
                                   type="number"
                                   value={forestMetricsYear}
                                   onChange={(e) => setForestMetricsYear(e.target.value)}
                                   placeholder="e.g., 2025"
                               />
                               <small className="hint-text">The year to calculate metrics for</small>
                            </div>
                            <button className="run-analysis-button" onClick={handleRunForestMetrics}>
                               CALCULATE METRICS
                           </button>
                       </div>
                   </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer - if any */}
          {/* <div className="layer-control-footer">
              <button className="expand-all" onClick={() => setExpandedSections({
                wms: true,
                db: true
              })}>
                Expand All
              </button>
              <button className="collapse-all" onClick={() => setExpandedSections({
                wms: false,
                db: false
              })}>
                Collapse All
              </button>
            </div> */}

        </div>

      </div>
    </>
  );
};

export default LayerControl; 