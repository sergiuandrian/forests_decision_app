const express = require('express');
const router = express.Router();
const forestController = require('../controllers/forestController');

// Get forest data with optional filtering
// Query parameters:
// - minArea: minimum area
// - maxArea: maximum area
// - forestType: forest type code
// - propertyType: property type
// - bbox: bounding box (minx,miny,maxx,maxy)
router.get('/data', forestController.getForestData);

// Get forest statistics
router.get('/stats', forestController.getForestStats);

// Get forest boundaries for a specific forest unit
router.get('/boundaries/:forestId', forestController.getForestBoundaries);

// Get forest analysis by property type
router.get('/analysis/property', forestController.getForestAnalysisByProperty);

module.exports = router; 