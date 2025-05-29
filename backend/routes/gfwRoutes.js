const express = require('express');
const axios = require('axios');
const https = require('https');
const { validationResult, query, body } = require('express-validator');
const apicache = require('apicache');
const router = express.Router();

// API Configuration
const API_VERSION = 'v3'; // Updated to v3 as per latest GFW API
const GFW_API_BASE = 'https://api.globalforestwatch.org';
const GFW_DATA_API_BASE = 'https://data-api.globalforestwatch.org';

// Configure TLS agent with proper settings
const tlsAgent = new https.Agent({
  secureProtocol: 'TLSv1_2_method',
  rejectUnauthorized: true,
  ciphers: 'HIGH:!aNULL:!MD5',
  minVersion: 'TLSv1.2',
  maxVersion: 'TLSv1.3'
});

// Configure axios instances for different GFW APIs
const gfwApi = axios.create({
  baseURL: GFW_API_BASE,
  httpsAgent: tlsAgent,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

const gfwDataApi = axios.create({
  baseURL: GFW_DATA_API_BASE,
  httpsAgent: tlsAgent,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// Add API key to all requests
[gfwApi, gfwDataApi].forEach(api => {
  api.interceptors.request.use(config => {
    config.headers['Authorization'] = `Bearer ${process.env.GFW_API_KEY}`;
    return config;
  });
});

// Configure cache middleware with different durations
const cache = {
  short: apicache.middleware('5 minutes'),
  medium: apicache.middleware('1 hour'),
  long: apicache.middleware('1 day')
};

// Validation middleware
const validateCoordinates = [
  query('lat')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  query('lng')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  query('radius')
    .optional()
    .isFloat({ min: 100, max: 100000 })
    .withMessage('Radius must be between 100 and 100000 meters')
];

const validateDateRange = [
  query('start-date')
    .optional()
    .isISO8601()
    .withMessage('Start date must be in ISO 8601 format'),
  query('end-date')
    .optional()
    .isISO8601()
    .withMessage('End date must be in ISO 8601 format')
    .custom((endDate, { req }) => {
      if (endDate && req.query['start-date'] && new Date(endDate) <= new Date(req.query['start-date'])) {
        throw new Error('End date must be after start date');
      }
      return true;
    })
];

// Error handling middleware
const errorHandler = (err, req, res, next) => {
  console.error('Error:', {
    message: err.message,
    status: err.status,
    code: err.code,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });

  const status = err.status || 500;
  const message = err.message || 'Internal server error';
  
  res.status(status).json({
    error: {
      message,
      code: err.code || 'INTERNAL_ERROR',
      status,
      timestamp: new Date().toISOString()
    }
  });
};

// Helper function to create standardized error
const createError = (message, status = 500, code = null) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
};

// Helper function to get geostore ID with fallback endpoints
const getGeostoreId = async (coordinates, radius) => {
  const endpoints = [
    { url: '/v2/geostore/area', method: 'post', data: { ...coordinates, radius } },
    { url: '/v2/geostore/polygon', method: 'post', data: { ...coordinates, radius } },
    { url: '/v2/geostore', method: 'post', data: { ...coordinates, radius } }
  ];

  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      console.log(`Trying ${endpoint.url} endpoint...`);
      const response = await gfwApi[endpoint.method](endpoint.url, endpoint.data);
      
      if (response.data?.data?.id) {
        console.log(`Successfully got geostore ID from ${endpoint.url}`);
        return response.data.data;
      }
    } catch (error) {
      lastError = error;
      console.log(`${endpoint.url} endpoint failed: ${error.message}`);
      
      if (error.response?.status === 401) {
        throw createError('Authentication failed', 401, 'AUTH_ERROR');
      }
      if (error.response?.status === 429) {
        throw createError('Rate limit exceeded', 429, 'RATE_LIMIT');
      }
    }
  }

  throw createError('All geostore creation methods failed', 500, 'GEOSTORE_ERROR');
};

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: API_VERSION,
    timestamp: new Date().toISOString(),
    endpoints: {
      base: GFW_API_BASE,
      data: GFW_DATA_API_BASE
    }
  });
});

// Main analysis endpoint
router.get('/analyze', 
  [...validateCoordinates, ...validateDateRange],
  cache.medium,
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { lat, lng, radius = 10000, 'start-date': startDate, 'end-date': endDate } = req.query;
      const coordinates = { lat: parseFloat(lat), lng: parseFloat(lng) };

      // Get geostore ID
      const geostore = await getGeostoreId(coordinates, parseFloat(radius));

      // Get analysis data with date range if provided
      const params = {};
      if (startDate) params['start-date'] = startDate;
      if (endDate) params['end-date'] = endDate;

      const [forestData, alertsData, biodiversityData, climateData] = await Promise.all([
        gfwApi.get(`/v2/forest/${geostore.id}`, { params }),
        gfwApi.get(`/v2/alerts/${geostore.id}`, { params }),
        gfwApi.get(`/v2/biodiversity/${geostore.id}`, { params }),
        gfwApi.get(`/v2/climate/${geostore.id}`, { params })
      ]);

      res.json({
        data: {
          coordinates,
          radius: parseFloat(radius),
          geostore: {
            id: geostore.id,
            areaHa: geostore.attributes?.areaHa,
            bbox: geostore.attributes?.bbox
          },
          analysis: {
            forest: forestData.data?.data?.attributes || {},
            alerts: alertsData.data?.data?.attributes || {},
            biodiversity: biodiversityData.data?.data?.attributes || {},
            climate: climateData.data?.data?.attributes || {}
          },
          metadata: {
            timestamp: new Date().toISOString(),
            version: API_VERSION,
            dateRange: startDate && endDate ? { startDate, endDate } : undefined
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get forest loss data for a specific area
router.get('/forest-loss',
  [...validateCoordinates, ...validateDateRange],
  cache.long,
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { lat, lng, radius = 10000, 'start-date': startDate, 'end-date': endDate } = req.query;
      const coordinates = { lat: parseFloat(lat), lng: parseFloat(lng) };

      const geostore = await getGeostoreId(coordinates, parseFloat(radius));
      
      const response = await gfwDataApi.get('/dataset/umd_tree_cover_loss/area', {
        params: {
          geostore: geostore.id,
          period: startDate && endDate ? `${startDate},${endDate}` : '2001-2022',
          threshold: 30
        }
      });

      res.json({
        data: {
          coordinates,
          radius: parseFloat(radius),
          geostore: {
            id: geostore.id,
            areaHa: geostore.attributes?.areaHa
          },
          forestLoss: response.data?.data || {},
          metadata: {
            timestamp: new Date().toISOString(),
            version: API_VERSION,
            dateRange: startDate && endDate ? { startDate, endDate } : undefined
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get alerts data (deforestation and fire)
router.get('/alerts',
  [...validateCoordinates, ...validateDateRange],
  cache.short,
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { lat, lng, radius = 10000, 'start-date': startDate, 'end-date': endDate } = req.query;
      const coordinates = { lat: parseFloat(lat), lng: parseFloat(lng) };

      const geostore = await getGeostoreId(coordinates, parseFloat(radius));

      const [gladAlerts, fireAlerts] = await Promise.all([
        gfwDataApi.get('/dataset/glad-alerts/area', {
          params: {
            geostore: geostore.id,
            period: startDate && endDate ? `${startDate},${endDate}` : undefined
          }
        }),
        gfwDataApi.get('/dataset/fire-alerts/area', {
          params: {
            geostore: geostore.id,
            period: startDate && endDate ? `${startDate},${endDate}` : undefined
          }
        })
      ]);

      res.json({
        data: {
          coordinates,
          radius: parseFloat(radius),
          geostore: {
            id: geostore.id,
            areaHa: geostore.attributes?.areaHa
          },
          alerts: {
            deforestation: gladAlerts.data?.data || {},
            fire: fireAlerts.data?.data || {}
          },
          metadata: {
            timestamp: new Date().toISOString(),
            version: API_VERSION,
            dateRange: startDate && endDate ? { startDate, endDate } : undefined
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get analysis data for a geostore
router.get('/analysis/:geostoreId', cache.medium, async (req, res, next) => {
  try {
    const { geostoreId } = req.params;
    const { start_date, end_date } = req.query;
    
    const response = await gfwDataApi.get(`/analysis/${geostoreId}`, {
      params: { start_date, end_date }
    });
    
    res.json(response.data);
  } catch (error) {
    next(createError('Failed to fetch analysis data', 500, 'ANALYSIS_ERROR'));
  }
});

// Apply error handling middleware
router.use(errorHandler);

module.exports = router; 