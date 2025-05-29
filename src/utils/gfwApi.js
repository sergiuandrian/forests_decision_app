import axios from 'axios';

const API_BASE = '/api/gfw';

// Create axios instance with default config
const gfwClient = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  },
  // Add retry configuration
  retry: 3,
  retryDelay: (retryCount) => retryCount * 1000
});

// Add retry interceptor
gfwClient.interceptors.response.use(null, async (error) => {
  const { config } = error;
  if (!config || !config.retry) {
    return Promise.reject(error);
  }

  config.retryCount = config.retryCount || 0;

  if (config.retryCount >= config.retry) {
    return Promise.reject(error);
  }

  config.retryCount += 1;
  const delay = config.retryDelay(config.retryCount);
  
  await new Promise(resolve => setTimeout(resolve, delay));
  return gfwClient(config);
});

// Helper to convert coordinates to the format expected by the API
const formatCoordinates = (lat, lng, radius = 10000) => ({
  lat: parseFloat(lat),
  lng: parseFloat(lng),
  radius: parseFloat(radius)
});

// Helper to format date range
const formatDateRange = (startDate, endDate) => {
  if (!startDate || !endDate) return undefined;
  return {
    'start-date': startDate.toISOString().split('T')[0],
    'end-date': endDate.toISOString().split('T')[0]
  };
};

// API methods
export const gfwApi = {
  // Health check
  checkHealth: async () => {
    try {
      const response = await gfwClient.get('/health');
      return response.data;
    } catch (error) {
      console.error('Health check failed:', error);
      throw new Error('Failed to connect to GFW API. Please check your connection.');
    }
  },

  // Get area analysis
  getAreaAnalysis: async ({ lat, lng, radius, startDate, endDate }) => {
    try {
      const params = {
        ...formatCoordinates(lat, lng, radius),
        ...formatDateRange(startDate, endDate)
      };
      const response = await gfwClient.get('/analyze', { params });
      return response.data;
    } catch (error) {
      console.error('Area analysis failed:', error);
      throw new Error('Failed to get area analysis. Please try again.');
    }
  },

  // Get forest loss data
  getForestLoss: async ({ lat, lng, radius, startDate, endDate }) => {
    try {
      const params = {
        ...formatCoordinates(lat, lng, radius),
        ...formatDateRange(startDate, endDate)
      };
      const response = await gfwClient.get('/forest-loss', { params });
      return response.data;
    } catch (error) {
      console.error('Forest loss data fetch failed:', error);
      throw new Error('Failed to get forest loss data. Please try again.');
    }
  },

  // Get alerts data
  getAlerts: async ({ lat, lng, radius, startDate, endDate }) => {
    try {
      const params = {
        ...formatCoordinates(lat, lng, radius),
        ...formatDateRange(startDate, endDate)
      };
      const response = await gfwClient.get('/alerts', { params });
      return response.data;
    } catch (error) {
      console.error('Alerts data fetch failed:', error);
      throw new Error('Failed to get alerts data. Please try again.');
    }
  },

  // Convert Leaflet polygon to GeoJSON
  polygonToGeoJSON: (polygon) => {
    if (!polygon || !polygon.getLatLngs) {
      throw new Error('Invalid polygon object');
    }

    const latLngs = polygon.getLatLngs();
    const coordinates = latLngs.map(latLng => [latLng.lng, latLng.lat]);

    // Close the polygon if it's not already closed
    if (coordinates[0][0] !== coordinates[coordinates.length - 1][0] ||
        coordinates[0][1] !== coordinates[coordinates.length - 1][1]) {
      coordinates.push(coordinates[0]);
    }

    return {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [coordinates]
      },
      properties: {}
    };
  },

  // Get polygon from GFW
  getPolygon: async (geojson) => {
    try {
      const response = await gfwClient.post('/polygon', { geojson });
      return response.data;
    } catch (error) {
      console.error('Failed to get polygon from GFW:', error);
      throw new Error('Failed to get polygon from GFW. Please try again.');
    }
  }
};

// Error handling middleware
gfwClient.interceptors.response.use(
  response => response,
  error => {
    if (error.code === 'ERR_NETWORK') {
      throw new Error('Network error. Please check your internet connection.');
    }
    
    const { response } = error;
    if (response) {
      switch (response.status) {
        case 401:
          throw new Error('Authentication failed. Please check your API key.');
        case 429:
          throw new Error('Rate limit exceeded. Please try again later.');
        case 400:
          throw new Error(response.data.errors?.[0]?.msg || 'Invalid request parameters.');
        default:
          throw new Error(response.data.error?.message || 'An error occurred while fetching data.');
      }
    }
    throw error;
  }
);

export default gfwApi; 