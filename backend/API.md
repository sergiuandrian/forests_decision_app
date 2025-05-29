# Forests Decision App API Documentation

This document provides detailed information about the available API endpoints for the Forests Decision App.

## Base URL

All API endpoints are prefixed with `/api`.

## Authentication

Currently, the API does not require authentication. This may change in future versions.

## Error Handling

All endpoints return errors in the following format:
```json
{
  "error": "Error message description"
}
```

Common HTTP status codes:
- 200: Success
- 201: Created (for POST requests)
- 400: Bad Request (invalid parameters)
- 404: Not Found
- 500: Internal Server Error

## Endpoints

### Forest Data Endpoints

#### GET /api/forest/data
Retrieves forest data with optional filtering.

**Query Parameters:**
- `minArea` (optional): Minimum forest area in square meters
- `maxArea` (optional): Maximum forest area in square meters
- `forestType` (optional): Forest type code (e.g., 'ABC', 'XYZ')
- `propertyType` (optional): Property type (e.g., 'public', 'private')
- `bbox` (optional): Bounding box coordinates as "minx,miny,maxx,maxy"

**Example Request:**
```bash
curl "http://localhost:5000/api/forest/data?minArea=1000&forestType=ABC&bbox=27.5,47.5,28.5,48.5"
```

**Example Response:**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[27.5, 47.5], [28.5, 47.5], [28.5, 48.5], [27.5, 48.5], [27.5, 47.5]]]
      },
      "properties": {
        "id": "123",
        "forest_unit": "ABC",
        "management_unit": "XYZ",
        "area": 1000,
        "volume": 5000,
        "forest_type": "ABC",
        "property_type": "public"
      }
    }
  ]
}
```

#### GET /api/forest/stats
Returns overall statistics about the forest data.

**Example Request:**
```bash
curl "http://localhost:5000/api/forest/stats"
```

**Example Response:**
```json
{
  "total_units": 100,
  "total_area": 50000,
  "total_volume": 100000,
  "average_area": 500,
  "average_volume": 1000,
  "forest_types": {
    "ABC": {
      "count": 50,
      "total_area": 25000,
      "average_area": 500
    },
    "XYZ": {
      "count": 50,
      "total_area": 25000,
      "average_area": 500
    }
  },
  "property_types": {
    "public": {
      "count": 70,
      "total_area": 35000
    },
    "private": {
      "count": 30,
      "total_area": 15000
    }
  }
}
```

### Raster Operations

#### POST /api/analysis/raster/upload
Uploads a GeoTIFF file.

**Request:**
- Content-Type: `multipart/form-data`
- Body:
  - `raster`: GeoTIFF file (required)
  - `name` (optional): Raster name
  - `properties` (optional): JSON string with additional properties

**Example Request:**
```bash
curl -X POST \
  -F "raster=@/path/to/dem.tif" \
  -F "name=Forest DEM" \
  -F "properties={\"type\":\"elevation\",\"source\":\"LIDAR\"}" \
  http://localhost:5000/api/analysis/raster/upload
```

**Example Response:**
```json
{
  "message": "Raster uploaded successfully",
  "id": 123,
  "metadata": {
    "filename": "dem.tif",
    "originalname": "dem.tif",
    "mimetype": "image/tiff",
    "size": 1000000,
    "upload_date": "2024-03-20T12:00:00Z"
  }
}
```

#### GET /api/analysis/raster/list
Retrieves list of available rasters.

**Example Request:**
```bash
curl "http://localhost:5000/api/analysis/raster/list"
```

**Example Response:**
```json
[
  {
    "id": 123,
    "name": "Forest DEM",
    "upload_date": "2024-03-20T12:00:00Z",
    "properties": {
      "type": "elevation",
      "source": "LIDAR"
    },
    "metadata": {
      "filename": "dem.tif",
      "size": 1000000
    }
  }
]
```

#### GET /api/analysis/raster/bbox
Retrieves raster data within a bounding box.

**Query Parameters:**
- `minx`: Minimum X coordinate (required)
- `miny`: Minimum Y coordinate (required)
- `maxx`: Maximum X coordinate (required)
- `maxy`: Maximum Y coordinate (required)
- `rasterId`: ID of the raster to retrieve (required)

**Example Request:**
```bash
curl "http://localhost:5000/api/analysis/raster/bbox?minx=27.5&miny=47.5&maxx=28.5&maxy=48.5&rasterId=123"
```

**Example Response:**
```json
{
  "id": 123,
  "name": "Forest DEM",
  "properties": {
    "type": "elevation",
    "source": "LIDAR"
  },
  "metadata": {
    "filename": "dem.tif",
    "size": 1000000
  },
  "raster_data": "base64_encoded_data",
  "bbox": [27.5, 47.5, 28.5, 48.5],
  "width": 1000,
  "height": 1000,
  "resolution": 30
}
```

#### GET /api/analysis/raster/resample
Resamples a raster to a different resolution.

**Query Parameters:**
- `rasterId`: ID of the raster to resample (required)
- `targetResolution`: Target resolution in meters (required)

**Example Request:**
```bash
curl "http://localhost:5000/api/analysis/raster/resample?rasterId=123&targetResolution=30"
```

**Example Response:**
```json
{
  "raster_id": 123,
  "new_resolution": 30,
  "width": 1000,
  "height": 1000,
  "raster_data": "base64_encoded_data",
  "metadata": {
    "original_resolution": 10,
    "resampling_method": "Bilinear"
  }
}
```

#### POST /api/analysis/raster/reclassify
Reclassifies raster values based on rules.

**Query Parameters:**
- `rasterId`: ID of the raster to reclassify (required)

**Request Body:**
```json
{
  "reclassRules": [
    {"min": 0, "max": 100, "newValue": 1, "label": "Low"},
    {"min": 100, "max": 200, "newValue": 2, "label": "Medium"},
    {"min": 200, "max": 300, "newValue": 3, "label": "High"}
  ]
}
```

**Example Request:**
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"reclassRules":[{"min":0,"max":100,"newValue":1,"label":"Low"},{"min":100,"max":200,"newValue":2,"label":"Medium"},{"min":200,"max":300,"newValue":3,"label":"High"}]}' \
  "http://localhost:5000/api/analysis/raster/reclassify?rasterId=123"
```

**Example Response:**
```json
{
  "raster_id": 123,
  "value_counts": {
    "1": 1000,
    "2": 2000,
    "3": 500
  },
  "raster_data": "base64_encoded_data",
  "metadata": {
    "rules": [
      {"min": 0, "max": 100, "newValue": 1, "label": "Low"},
      {"min": 100, "max": 200, "newValue": 2, "label": "Medium"},
      {"min": 200, "max": 300, "newValue": 3, "label": "High"}
    ]
  }
}
```

### Spatial Analysis

#### GET /api/analysis/buffer
Creates a buffer around a forest unit.

**Query Parameters:**
- `forestId`: ID of the forest unit (required)
- `distance`: Buffer distance in meters (required)

**Example Request:**
```bash
curl "http://localhost:5000/api/analysis/buffer?forestId=123&distance=1000"
```

**Example Response:**
```json
{
  "type": "Feature",
  "geometry": {
    "type": "Polygon",
    "coordinates": [[[27.5, 47.5], [28.5, 47.5], [28.5, 48.5], [27.5, 48.5], [27.5, 47.5]]]
  },
  "properties": {
    "forest_unit": "ABC",
    "buffer_area": 10000,
    "buffer_distance": 1000,
    "original_area": 5000,
    "buffer_ratio": 2.0
  }
}
```

#### GET /api/analysis/fragmentation/:forestId
Analyzes forest fragmentation for a specific unit.

**Example Request:**
```bash
curl "http://localhost:5000/api/analysis/fragmentation/123"
```

**Example Response:**
```json
{
  "forest_id": 123,
  "metrics": {
    "patch_area": 1000,
    "patch_perimeter": 400,
    "neighbor_count": 5,
    "avg_neighbor_area": 800,
    "avg_distance": 200,
    "shape_index": 1.5,
    "fragmentation_index": 0.7,
    "isolation_index": 0.3
  },
  "neighbors": [
    {
      "id": 124,
      "distance": 150,
      "area": 900
    },
    {
      "id": 125,
      "distance": 250,
      "area": 700
    }
  ]
}
```

#### GET /api/analysis/connectivity
Analyzes forest connectivity.

**Query Parameters:**
- `forestType`: Forest type code (required)
- `maxDistance` (optional): Maximum distance for connections in meters (default: 1000)

**Example Request:**
```bash
curl "http://localhost:5000/api/analysis/connectivity?forestType=ABC&maxDistance=2000"
```

**Example Response:**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "LineString",
        "coordinates": [[27.5, 47.5], [28.5, 48.5]]
      },
      "properties": {
        "patch1_id": 123,
        "patch2_id": 456,
        "distance": 500,
        "patch1_area": 1000,
        "patch2_area": 800
      }
    }
  ],
  "metadata": {
    "forest_type": "ABC",
    "max_distance": 2000,
    "total_connections": 10,
    "average_distance": 750,
    "connectivity_index": 0.8
  }
}
```

#### GET /api/analysis/slope
Analyzes slope using DEM data.

**Query Parameters:**
- `forestId`: ID of the forest unit (required)
- `rasterId`: ID of the DEM raster (required)

**Example Request:**
```bash
curl "http://localhost:5000/api/analysis/slope?forestId=123&rasterId=456"
```

**Example Response:**
```json
{
  "forest_id": 123,
  "raster_id": 456,
  "slope_analysis": {
    "min_slope": 0,
    "max_slope": 45,
    "mean_slope": 15,
    "stddev_slope": 10,
    "forest_unit": "ABC",
    "slope_classes": {
      "0-5": 0.2,
      "5-15": 0.4,
      "15-30": 0.3,
      ">30": 0.1
    },
    "aspect_distribution": {
      "N": 0.15,
      "NE": 0.2,
      "E": 0.15,
      "SE": 0.1,
      "S": 0.15,
      "SW": 0.1,
      "W": 0.1,
      "NW": 0.05
    }
  }
}
```

#### GET /api/analysis/density
Analyzes forest density patterns.

**Query Parameters:**
- `forestType`: Forest type code (required)
- `cellSize` (optional): Cell size for analysis in meters (default: 1000)

**Example Request:**
```bash
curl "http://localhost:5000/api/analysis/density?forestType=ABC&cellSize=500"
```

**Example Response:**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[27.5, 47.5], [28.0, 47.5], [28.0, 48.0], [27.5, 48.0], [27.5, 47.5]]]
      },
      "properties": {
        "density": 0.8,
        "cell_area": 250000,
        "patch_count": 5,
        "forest_area": 200000,
        "edge_length": 2000
      }
    }
  ],
  "metadata": {
    "forest_type": "ABC",
    "cell_size": 500,
    "total_cells": 100,
    "average_density": 0.6,
    "density_classes": {
      "0-0.2": 10,
      "0.2-0.4": 20,
      "0.4-0.6": 30,
      "0.6-0.8": 25,
      "0.8-1.0": 15
    }
  }
}
```

#### GET /api/analysis/patch-metrics
Analyzes forest patch metrics.

**Query Parameters:**
- `forestType`: Forest type code (required)

**Example Request:**
```bash
curl "http://localhost:5000/api/analysis/patch-metrics?forestType=ABC"
```

**Example Response:**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[27.5, 47.5], [28.5, 47.5], [28.5, 48.5], [27.5, 48.5], [27.5, 47.5]]]
      },
      "properties": {
        "id": 123,
        "area": 1000,
        "perimeter": 400,
        "vertex_count": 5,
        "shape_index": 1.5,
        "compactness": 0.8,
        "fractal_dimension": 1.2,
        "core_area": 800,
        "edge_width": 100
      }
    }
  ],
  "metadata": {
    "forest_type": "ABC",
    "total_patches": 50,
    "average_metrics": {
      "area": 900,
      "perimeter": 380,
      "shape_index": 1.4,
      "compactness": 0.75,
      "fractal_dimension": 1.15
    },
    "size_classes": {
      "0-500": 20,
      "500-1000": 15,
      "1000-2000": 10,
      ">2000": 5
    }
  }
}
```

## Rate Limiting

Currently, there are no rate limits implemented. This may change in future versions.

## Data Formats

### GeoJSON
All spatial data is returned in GeoJSON format (RFC 7946). The coordinate system used is EPSG:4326 (WGS84).

Example GeoJSON structure:
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[lon1, lat1], [lon2, lat2], ...]]
      },
      "properties": {
        "id": "123",
        "name": "Forest Unit A",
        "area": 1000
      }
    }
  ]
}
```

### Raster Data
Raster data is returned as base64-encoded binary data. The following formats are supported:
- GeoTIFF (.tif, .tiff)
- Supported data types: 8-bit, 16-bit, 32-bit float
- Coordinate system: EPSG:4326 (WGS84)

Example raster metadata:
```json
{
  "id": 123,
  "name": "Forest DEM",
  "format": "GeoTIFF",
  "data_type": "32BF",
  "width": 1000,
  "height": 1000,
  "resolution": 30,
  "bbox": [27.5, 47.5, 28.5, 48.5],
  "properties": {
    "type": "elevation",
    "source": "LIDAR"
  }
}
```

## Best Practices

1. **Error Handling**
   - Always check response status codes
   - Implement proper error handling for network issues
   - Handle rate limiting and timeouts appropriately

2. **Data Management**
   - Use appropriate content types when sending data
   - Implement caching for frequently accessed data
   - Use bounding boxes to limit data transfer
   - Consider pagination for large datasets

3. **Performance**
   - Minimize the number of API calls
   - Use appropriate cell sizes for analysis
   - Consider using WebSocket for real-time updates
   - Implement client-side caching

4. **Security**
   - Validate input data
   - Handle sensitive data appropriately
   - Use HTTPS for all API calls
   - Implement proper authentication when available

## Versioning

The current API version is v1. Future versions will be indicated in the URL path (e.g., `/api/v2/...`).

## Support

For additional support:
- Check the [Integration Guide](INTEGRATION.md)
- Open an issue on GitHub
- Contact the development team

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details. 