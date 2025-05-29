const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const rasterController = require('../controllers/rasterController');
const spatialAnalysisController = require('../controllers/spatialAnalysisController');

// Configure multer for raster uploads
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, path.join(__dirname, '../uploads/rasters/'));
  },
  filename: function(req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: function(req, file, cb) {
    if (file.mimetype === 'image/tiff' ||
        file.originalname.endsWith('.tif') ||
        file.originalname.endsWith('.tiff')) {
      cb(null, true);
    } else {
      cb(new Error('Only GeoTIFF files are allowed!'), false);
    }
  }
});

// Raster routes
router.post('/raster/upload', upload.single('raster'), rasterController.uploadRaster);
router.get('/raster/list', rasterController.getRasterList);
router.get('/raster/bbox', rasterController.getRasterInBbox);
router.delete('/raster/:id', rasterController.deleteRaster);

// New raster processing routes
router.get('/raster/resample', rasterController.resampleRaster);
router.post('/raster/reclassify', rasterController.reclassifyRaster);
router.get('/raster/zonal-stats', rasterController.zonalStats);
router.get('/raster/histogram', rasterController.rasterHistogram);

// Spatial analysis routes
router.get('/buffer', spatialAnalysisController.bufferAnalysis);
router.get('/fragmentation/:forestId', spatialAnalysisController.fragmentationAnalysis);
router.get('/connectivity', spatialAnalysisController.connectivityAnalysis);
router.get('/edge/:forestId/:edgeWidth', spatialAnalysisController.edgeEffectAnalysis);

// New spatial analysis routes
router.get('/slope', spatialAnalysisController.slopeAnalysis);
router.get('/aspect', spatialAnalysisController.aspectAnalysis);
router.get('/density', spatialAnalysisController.densityAnalysis);
router.get('/patch-metrics', spatialAnalysisController.patchMetricsAnalysis);

module.exports = router; 