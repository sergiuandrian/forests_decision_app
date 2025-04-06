# Forests Decision App Backend

This is the Express.js backend for the Forests Decision GIS Application with PostgreSQL database integration.

## Database Setup

1. Install PostgreSQL if you don't have it already.
2. Create a new database:
   ```
   CREATE DATABASE forest_gis;
   ```
3. The application will automatically create the required tables when first started.

## Setup

1. Install dependencies:
   ```
   cd backend
   npm install
   ```

2. Create a `.env` file in the backend directory with the following variables:
   ```
   PORT=5000
   NODE_ENV=development
   CORS_ORIGIN=http://localhost:3000
   
   # Database Configuration
   DB_USER=postgres
   DB_HOST=localhost
   DB_NAME=forest_gis
   DB_PASSWORD=postgres
   DB_PORT=5432
   ```
   Adjust the database credentials as needed for your setup.

3. Create an `uploads` directory in the backend folder (or the server will create it automatically on first use).

## Running the Server

Development mode with auto-reload:
```
npm run dev
```

Production mode:
```
npm start
```

## API Endpoints

### GeoJSON Operations

- `POST /api/gis/upload` - Upload a GeoJSON file
  - Request: Form data with a file field named 'geojson'
  - Response: File info with ID

- `GET /api/gis/geojson` - Get list of all GeoJSON files
  - Response: Array of file info objects

- `GET /api/gis/geojson/:id` - Get a specific GeoJSON file by ID
  - Response: File info and GeoJSON content

## Architecture

The backend follows an MVC architecture:

- `controllers/` - Request handlers
- `routes/` - API endpoint definitions
- `models/` - Data models and database connection
- `middleware/` - Custom middleware
- `utils/` - Helper functions
- `uploads/` - Uploaded GeoJSON files

## Database Schema

The application uses a PostgreSQL database with the following schema:

### geojson_files Table

- `id` - SERIAL PRIMARY KEY
- `name` - VARCHAR(255) - Original filename
- `file_path` - VARCHAR(255) - Path to the file on the server
- `upload_date` - TIMESTAMP - When the file was uploaded
- `properties` - JSONB - Properties from the GeoJSON
- `geojson_data` - JSONB - The complete GeoJSON data

## Future Enhancements

- Implement user authentication
- Add spatial analysis capabilities
- Add validation middleware
- Add spatial queries using PostGIS 