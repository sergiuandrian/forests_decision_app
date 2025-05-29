# Forests Decision App Integration Guide

This guide provides detailed instructions and code examples for integrating with the Forests Decision App API.

## Getting Started

### Prerequisites
- Node.js 14.x or higher
- PostgreSQL 12.x or higher with PostGIS extension
- Basic understanding of REST APIs and GeoJSON

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-org/forests_decision_app.git
cd forests_decision_app
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
Create a `.env` file in the `backend` directory:
```env
DB_USER=postgres
DB_HOST=localhost
DB_NAME=decision_ungheni
DB_PASSWORD=your_password_here
DB_PORT=5432
PORT=5000
```

4. Start the server:
```bash
cd backend
npm run dev
```

## Code Examples

### JavaScript/Node.js

#### Fetching Forest Data
```javascript
// Using fetch API
async function getForestData() {
  const params = new URLSearchParams({
    minArea: 1000,
    forestType: 'ABC',
    bbox: '27.5,47.5,28.5,48.5'
  });

  try {
    const response = await fetch(`http://localhost:5000/api/forest/data?${params}`);
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching forest data:', error);
  }
}

// Using axios
const axios = require('axios');

async function getForestDataAxios() {
  try {
    const response = await axios.get('http://localhost:5000/api/forest/data', {
      params: {
        minArea: 1000,
        forestType: 'ABC',
        bbox: '27.5,47.5,28.5,48.5'
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching forest data:', error);
  }
}
```

#### Uploading Raster Data
```javascript
// Using FormData
async function uploadRaster(file, name, properties) {
  const formData = new FormData();
  formData.append('raster', file);
  formData.append('name', name);
  formData.append('properties', JSON.stringify(properties));

  try {
    const response = await fetch('http://localhost:5000/api/analysis/raster/upload', {
      method: 'POST',
      body: formData
    });
    return await response.json();
  } catch (error) {
    console.error('Error uploading raster:', error);
  }
}

// Example usage
const fileInput = document.querySelector('input[type="file"]');
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  const result = await uploadRaster(file, 'Forest DEM', {
    type: 'elevation',
    source: 'LIDAR'
  });
  console.log('Upload result:', result);
});
```

#### Performing Spatial Analysis
```javascript
// Buffer analysis
async function performBufferAnalysis(forestId, distance) {
  try {
    const response = await fetch(
      `http://localhost:5000/api/analysis/buffer?forestId=${forestId}&distance=${distance}`
    );
    const data = await response.json();
    
    // Example: Display buffer on a map using Leaflet
    const bufferLayer = L.geoJSON(data).addTo(map);
    return bufferLayer;
  } catch (error) {
    console.error('Error performing buffer analysis:', error);
  }
}

// Density analysis
async function analyzeForestDensity(forestType, cellSize = 1000) {
  try {
    const response = await fetch(
      `http://localhost:5000/api/analysis/density?forestType=${forestType}&cellSize=${cellSize}`
    );
    const data = await response.json();
    
    // Example: Create a heatmap using Leaflet.heat
    const points = data.features.map(feature => [
      feature.geometry.coordinates[1],
      feature.geometry.coordinates[0],
      feature.properties.density
    ]);
    
    const heatLayer = L.heatLayer(points, { radius: 25 }).addTo(map);
    return heatLayer;
  } catch (error) {
    console.error('Error analyzing forest density:', error);
  }
}
```

### Python

#### Using requests library
```python
import requests
import json

class ForestsAPI:
    def __init__(self, base_url='http://localhost:5000/api'):
        self.base_url = base_url

    def get_forest_data(self, min_area=None, forest_type=None, bbox=None):
        params = {
            'minArea': min_area,
            'forestType': forest_type,
            'bbox': bbox
        }
        params = {k: v for k, v in params.items() if v is not None}
        
        response = requests.get(f'{self.base_url}/forest/data', params=params)
        response.raise_for_status()
        return response.json()

    def upload_raster(self, file_path, name=None, properties=None):
        files = {'raster': open(file_path, 'rb')}
        data = {
            'name': name,
            'properties': json.dumps(properties) if properties else None
        }
        data = {k: v for k, v in data.items() if v is not None}
        
        response = requests.post(
            f'{self.base_url}/analysis/raster/upload',
            files=files,
            data=data
        )
        response.raise_for_status()
        return response.json()

    def perform_slope_analysis(self, forest_id, raster_id):
        params = {
            'forestId': forest_id,
            'rasterId': raster_id
        }
        response = requests.get(
            f'{self.base_url}/analysis/slope',
            params=params
        )
        response.raise_for_status()
        return response.json()

# Example usage
api = ForestsAPI()

# Get forest data
forest_data = api.get_forest_data(
    min_area=1000,
    forest_type='ABC',
    bbox='27.5,47.5,28.5,48.5'
)

# Upload raster
result = api.upload_raster(
    'path/to/dem.tif',
    name='Forest DEM',
    properties={'type': 'elevation', 'source': 'LIDAR'}
)

# Perform slope analysis
slope_analysis = api.perform_slope_analysis(forest_id=123, raster_id=456)
```

### Integration with Mapping Libraries

#### Leaflet.js
```javascript
// Initialize map
const map = L.map('map').setView([47.5, 27.5], 10);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

// Display forest data
async function displayForestData() {
  const data = await getForestData();
  const forestLayer = L.geoJSON(data, {
    style: (feature) => ({
      color: '#228B22',
      weight: 2,
      fillOpacity: 0.6
    }),
    onEachFeature: (feature, layer) => {
      layer.bindPopup(`
        Forest Unit: ${feature.properties.forest_unit}<br>
        Area: ${feature.properties.area} m²
      `);
    }
  }).addTo(map);
}

// Display raster data
async function displayRasterData(rasterId, bbox) {
  const [minx, miny, maxx, maxy] = bbox.split(',').map(Number);
  const response = await fetch(
    `/api/analysis/raster/bbox?rasterId=${rasterId}&minx=${minx}&miny=${miny}&maxx=${maxx}&maxy=${maxy}`
  );
  const data = await response.json();
  
  // Convert base64 to image
  const img = new Image();
  img.src = `data:image/tiff;base64,${data.raster_data}`;
  
  // Add to map as overlay
  const bounds = [[miny, minx], [maxy, maxx]];
  L.imageOverlay(img, bounds).addTo(map);
}
```

#### Mapbox GL JS
```javascript
// Initialize map
mapboxgl.accessToken = 'your_mapbox_token';
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/satellite-v9',
  center: [27.5, 47.5],
  zoom: 10
});

// Add forest data source
map.on('load', async () => {
  const data = await getForestData();
  
  map.addSource('forests', {
    type: 'geojson',
    data: data
  });
  
  map.addLayer({
    id: 'forests-fill',
    type: 'fill',
    source: 'forests',
    paint: {
      'fill-color': '#228B22',
      'fill-opacity': 0.6
    }
  });
  
  map.addLayer({
    id: 'forests-outline',
    type: 'line',
    source: 'forests',
    paint: {
      'line-color': '#228B22',
      'line-width': 2
    }
  });
});

// Add raster data
async function addRasterLayer(rasterId, bbox) {
  const [minx, miny, maxx, maxy] = bbox.split(',').map(Number);
  const response = await fetch(
    `/api/analysis/raster/bbox?rasterId=${rasterId}&minx=${minx}&miny=${miny}&maxx=${maxx}&maxy=${maxy}`
  );
  const data = await response.json();
  
  map.addSource('raster', {
    type: 'image',
    url: `data:image/tiff;base64,${data.raster_data}`,
    coordinates: [
      [minx, maxy],
      [maxx, maxy],
      [maxx, miny],
      [minx, miny]
    ]
  });
  
  map.addLayer({
    id: 'raster-layer',
    type: 'raster',
    source: 'raster',
    paint: {
      'raster-opacity': 0.8
    }
  });
}
```

## Best Practices

### Error Handling
```javascript
async function handleApiRequest(url, options = {}) {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'API request failed');
    }
    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    // Implement your error handling logic here
    throw error;
  }
}
```

### Caching
```javascript
// Simple in-memory cache
const cache = new Map();

async function getCachedData(endpoint, params, ttl = 3600000) {
  const key = `${endpoint}?${new URLSearchParams(params)}`;
  const cached = cache.get(key);
  
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data;
  }
  
  const data = await handleApiRequest(`${endpoint}?${new URLSearchParams(params)}`);
  cache.set(key, { data, timestamp: Date.now() });
  return data;
}
```

### Rate Limiting
```javascript
class RateLimiter {
  constructor(maxRequests = 100, timeWindow = 60000) {
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindow;
    this.requests = [];
  }

  async checkLimit() {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.timeWindow);
    
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.timeWindow - (now - oldestRequest);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.requests.push(now);
  }
}

// Usage
const limiter = new RateLimiter(100, 60000); // 100 requests per minute

async function makeApiRequest(url) {
  await limiter.checkLimit();
  return handleApiRequest(url);
}
```

## Troubleshooting

### Common Issues

1. **CORS Errors**
   - Ensure the server is running and CORS is properly configured
   - Check if the request includes proper headers
   - Verify the API endpoint URL is correct

2. **Raster Upload Failures**
   - Verify the file is a valid GeoTIFF
   - Check file size limits
   - Ensure proper permissions on the upload directory

3. **Database Connection Issues**
   - Verify PostgreSQL is running
   - Check database credentials in `.env`
   - Ensure PostGIS extension is installed

### Debugging Tips

1. Enable detailed logging:
```javascript
// In your API client
const DEBUG = true;

function logApiCall(endpoint, params, response) {
  if (DEBUG) {
    console.log('API Call:', {
      endpoint,
      params,
      response,
      timestamp: new Date().toISOString()
    });
  }
}
```

2. Monitor network requests:
```javascript
// Using browser dev tools
// In Chrome: Network tab
// In Firefox: Network tab
// Look for:
// - Request/Response headers
// - Response status codes
// - Response payload
```

## Support

For additional support:
- Check the [API Documentation](API.md)
- Open an issue on GitHub
- Contact the development team

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details. 