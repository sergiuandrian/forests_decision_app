const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

// Create a pool for database connections
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Initialize the database tables
const initDb = async () => {
  try {
    // Enable PostGIS extension
    await pool.query('CREATE EXTENSION IF NOT EXISTS postgis;');
    
    // Create the geojson_files table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS geojson_files (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        file_path VARCHAR(255) NOT NULL,
        upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        properties JSONB,
        geojson_data JSONB NOT NULL,
        geom geometry(Geometry, 4326)
      );
    `);

    // Create spatial index on the geometry column
    await pool.query(`
      CREATE INDEX IF NOT EXISTS geojson_files_geom_idx 
      ON geojson_files USING GIST (geom);
    `);

    // Create a table for raster data
    await pool.query(`
      CREATE TABLE IF NOT EXISTS raster_files (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        file_path VARCHAR(255) NOT NULL,
        upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        properties JSONB,
        metadata JSONB,
        raster_data raster
      );
    `);

    // Create a table for spatial analysis results
    await pool.query(`
      CREATE TABLE IF NOT EXISTS spatial_analysis (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        analysis_type VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        parameters JSONB,
        result_data JSONB,
        result_geom geometry(Geometry, 4326)
      );
    `);

    console.log('Database tables and PostGIS extension initialized successfully');
  } catch (error) {
    console.error('Error initializing database tables:', error);
    throw error;
  }
};

// Helper function to convert GeoJSON to PostGIS geometry
const geoJsonToGeometry = async (geoJson) => {
  try {
    const result = await pool.query(
      'SELECT ST_SetSRID(ST_GeomFromGeoJSON($1), 4326) as geom',
      [JSON.stringify(geoJson)]
    );
    return result.rows[0].geom;
  } catch (error) {
    console.error('Error converting GeoJSON to geometry:', error);
    throw error;
  }
};

// Helper function to perform spatial queries
const performSpatialQuery = async (query, params) => {
  try {
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Error performing spatial query:', error);
    throw error;
  }
};

module.exports = {
  pool,
  initDb,
  geoJsonToGeometry,
  performSpatialQuery
}; 