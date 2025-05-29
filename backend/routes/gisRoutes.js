const express = require('express');
const router = express.Router();
const gisController = require('../controllers/gisController');
const multer = require('multer');
const path = require('path');
const { pool } = require('../models/database');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, path.join(__dirname, '../uploads/'));
  },
  filename: function(req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

// Configure multer for both GeoJSON and raster files
const upload = multer({ 
  storage: storage,
  fileFilter: function(req, file, cb) {
    // Accept GeoJSON and raster files
    if (file.mimetype === 'application/geo+json' || 
        file.originalname.endsWith('.geojson') ||
        file.mimetype === 'image/tiff' ||
        file.originalname.endsWith('.tif') ||
        file.originalname.endsWith('.tiff')) {
      cb(null, true);
    } else {
      cb(new Error('Only GeoJSON and GeoTIFF files are allowed!'), false);
    }
  }
});

// Route to upload GeoJSON file
router.post('/upload', upload.single('geojson'), gisController.uploadGeoJson);

// Route to get all GeoJSON files
router.get('/geojson', gisController.getAllGeoJson);

// Route to get a specific GeoJSON file by ID
router.get('/geojson/:id', gisController.getGeoJsonById);

// New spatial operation routes
router.get('/spatial/bbox', gisController.getFeaturesInBbox);
router.post('/spatial/analysis', gisController.performSpatialAnalysis);
router.get('/spatial/raster', gisController.getRasterInBbox);

// Upload raster data
router.post('/raster/upload', upload.single('raster'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // TODO: Implement raster upload and processing
    // This will require additional libraries like gdal.js or similar
    // to process the raster data before storing in PostGIS

    res.status(501).json({ message: 'Raster upload not yet implemented' });
  } catch (error) {
    console.error('Error uploading raster:', error);
    res.status(500).json({ message: 'Error uploading raster' });
  }
});

// Add test endpoint to verify database connection and tables
router.get('/test-db', async (req, res) => {
  try {
    // Test database connection
    const client = await pool.connect();
    
    // Check if PostGIS extension is enabled
    const postgisCheck = await client.query('SELECT PostGIS_version();');
    
    // Get list of tables
    const tablesCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    
    // Get table details
    const tableDetails = await Promise.all(
      tablesCheck.rows.map(async (table) => {
        const columns = await client.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = $1
          ORDER BY ordinal_position;
        `, [table.table_name]);
        
        return {
          table: table.table_name,
          columns: columns.rows
        };
      })
    );

    client.release();

    res.status(200).json({
      status: 'success',
      postgis_version: postgisCheck.rows[0].postgis_version,
      tables: tableDetails
    });
  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Get all forests in a bounding box
router.get('/forest/data', gisController.getForestData);

// Get forests with area > 1000
router.get('/forest/data', gisController.getForestData);

// Get forest statistics
router.get('/forest/stats', gisController.getForestStats);

// Get boundaries for forest unit 123
router.get('/forest/boundaries/:forestId', gisController.getForestBoundaries);

module.exports = router; 