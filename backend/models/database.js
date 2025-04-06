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
    // Create the geojson_files table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS geojson_files (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        file_path VARCHAR(255) NOT NULL,
        upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        properties JSONB,
        geojson_data JSONB NOT NULL
      );
    `);
    console.log('Database tables initialized successfully');
  } catch (error) {
    console.error('Error initializing database tables:', error);
    throw error;
  }
};

module.exports = {
  pool,
  initDb
}; 