const express = require('express');
const router = express.Router();
const gisController = require('../controllers/gisController');
const multer = require('multer');
const path = require('path');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, path.join(__dirname, '../uploads/'));
  },
  filename: function(req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: function(req, file, cb) {
    // Accept only GeoJSON files
    if (file.mimetype === 'application/geo+json' || 
        file.originalname.endsWith('.geojson')) {
      cb(null, true);
    } else {
      cb(new Error('Only GeoJSON files are allowed!'), false);
    }
  }
});

// Route to upload GeoJSON file
router.post('/upload', upload.single('geojson'), gisController.uploadGeoJson);

// Route to get all GeoJSON files
router.get('/geojson', gisController.getAllGeoJson);

// Route to get a specific GeoJSON file by ID
router.get('/geojson/:id', gisController.getGeoJsonById);

// Additional routes for spatial operations can be added here

module.exports = router; 