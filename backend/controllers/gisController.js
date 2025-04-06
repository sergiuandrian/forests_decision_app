const fs = require('fs');
const path = require('path');
const { pool } = require('../models/database');

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

    // Store in the database
    const result = await pool.query(
      `INSERT INTO geojson_files (name, file_path, properties, geojson_data) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, name, file_path, upload_date`,
      [
        req.file.originalname,
        req.file.path,
        JSON.stringify(geoJson.properties || {}),
        JSON.stringify(geoJson)
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