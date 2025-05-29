const fs = require('fs');
const path = require('path');
const { pool, geoJsonToGeometry, performSpatialQuery } = require('../models/database');

// Controller to handle GeoJSON upload
exports.uploadGeoJson = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Read the uploaded file content
    const fileContent = fs.readFileSync(req.file.path, 'utf8');
    
    // Parse the GeoJSON to validate it
    let geoJson;
    try {
      geoJson = JSON.parse(fileContent);
      
      // Basic validation
      if (!geoJson.type || !geoJson.features) {
        throw new Error('Invalid GeoJSON format');
      }
    } catch (error) {
      // Delete the invalid file
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: 'Invalid GeoJSON file: ' + error.message });
    }

    // Convert GeoJSON to PostGIS geometry
    const geom = await geoJsonToGeometry(geoJson);

    // Store in the database with geometry
    const result = await pool.query(
      `INSERT INTO geojson_files (name, file_path, properties, geojson_data, geom) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, name, file_path, upload_date`,
      [
        req.file.originalname,
        req.file.path,
        JSON.stringify(geoJson.properties || {}),
        JSON.stringify(geoJson),
        geom
      ]
    );

    const fileInfo = result.rows[0];

    res.status(201).json({
      message: 'GeoJSON uploaded successfully',
      file: fileInfo
    });
  } catch (error) {
    console.error('Error uploading GeoJSON:', error);
    res.status(500).json({ message: 'Error uploading GeoJSON' });
  }
};

// Controller to get all GeoJSON files
exports.getAllGeoJson = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, file_path, upload_date, properties 
       FROM geojson_files 
       ORDER BY upload_date DESC`
    );
    
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error retrieving GeoJSON files:', error);
    res.status(500).json({ message: 'Error retrieving GeoJSON files' });
  }
};

// Controller to get a specific GeoJSON file by ID
exports.getGeoJsonById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `SELECT id, name, file_path, upload_date, properties, geojson_data 
       FROM geojson_files 
       WHERE id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'GeoJSON file not found' });
    }
    
    const fileInfo = result.rows[0];
    
    res.status(200).json({
      fileInfo: {
        id: fileInfo.id,
        name: fileInfo.name,
        path: fileInfo.file_path,
        uploadDate: fileInfo.upload_date,
        properties: fileInfo.properties
      },
      geoJson: fileInfo.geojson_data
    });
  } catch (error) {
    console.error('Error retrieving GeoJSON file:', error);
    res.status(500).json({ message: 'Error retrieving GeoJSON file' });
  }
};

// New spatial operations

// Get features within a bounding box
exports.getFeaturesInBbox = async (req, res) => {
  try {
    const { minx, miny, maxx, maxy } = req.query;
    
    if (!minx || !miny || !maxx || !maxy) {
      return res.status(400).json({ message: 'Bounding box coordinates required' });
    }

    const query = `
      SELECT id, name, ST_AsGeoJSON(geom)::json as geometry, properties
      FROM geojson_files
      WHERE ST_Intersects(
        geom,
        ST_MakeEnvelope($1, $2, $3, $4, 4326)
      );
    `;

    const features = await performSpatialQuery(query, [minx, miny, maxx, maxy]);
    
    res.status(200).json({
      type: 'FeatureCollection',
      features: features.map(f => ({
        type: 'Feature',
        geometry: f.geometry,
        properties: {
          ...f.properties,
          id: f.id,
          name: f.name
        }
      }))
    });
  } catch (error) {
    console.error('Error querying features in bbox:', error);
    res.status(500).json({ message: 'Error querying features' });
  }
};

// Perform spatial analysis (buffer, intersection, etc.)
exports.performSpatialAnalysis = async (req, res) => {
  try {
    const { analysisType, parameters, geometry } = req.body;

    if (!analysisType || !parameters || !geometry) {
      return res.status(400).json({ message: 'Missing required parameters' });
    }

    let result;
    switch (analysisType) {
      case 'buffer':
        const { distance } = parameters;
        result = await performSpatialQuery(
          'SELECT ST_AsGeoJSON(ST_Buffer(ST_GeomFromGeoJSON($1), $2))::json as result',
          [JSON.stringify(geometry), distance]
        );
        break;

      case 'intersection':
        const { targetGeom } = parameters;
        result = await performSpatialQuery(
          'SELECT ST_AsGeoJSON(ST_Intersection(ST_GeomFromGeoJSON($1), ST_GeomFromGeoJSON($2)))::json as result',
          [JSON.stringify(geometry), JSON.stringify(targetGeom)]
        );
        break;

      default:
        return res.status(400).json({ message: 'Unsupported analysis type' });
    }

    // Store analysis result
    await pool.query(
      `INSERT INTO spatial_analysis (name, analysis_type, parameters, result_data, result_geom)
       VALUES ($1, $2, $3, $4, ST_GeomFromGeoJSON($5))`,
      [
        `${analysisType}_analysis_${Date.now()}`,
        analysisType,
        JSON.stringify(parameters),
        JSON.stringify(result[0].result),
        JSON.stringify(result[0].result)
      ]
    );

    res.status(200).json({
      type: 'Feature',
      geometry: result[0].result
    });
  } catch (error) {
    console.error('Error performing spatial analysis:', error);
    res.status(500).json({ message: 'Error performing spatial analysis' });
  }
};

// Get raster data within a bounding box
exports.getRasterInBbox = async (req, res) => {
  try {
    const { minx, miny, maxx, maxy } = req.query;
    
    if (!minx || !miny || !maxx || !maxy) {
      return res.status(400).json({ message: 'Bounding box coordinates required' });
    }

    const query = `
      SELECT id, name, ST_AsBinary(ST_Clip(raster_data, ST_MakeEnvelope($1, $2, $3, $4, 4326))) as raster
      FROM raster_files
      WHERE ST_Intersects(
        ST_Envelope(raster_data),
        ST_MakeEnvelope($1, $2, $3, $4, 4326)
      );
    `;

    const rasters = await performSpatialQuery(query, [minx, miny, maxx, maxy]);
    
    // Convert binary raster data to base64 for transmission
    const rasterData = rasters.map(r => ({
      id: r.id,
      name: r.name,
      raster: r.raster.toString('base64')
    }));

    res.status(200).json(rasterData);
  } catch (error) {
    console.error('Error querying raster data:', error);
    res.status(500).json({ message: 'Error querying raster data' });
  }
}; 