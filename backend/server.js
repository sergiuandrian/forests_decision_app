const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const { initDb } = require('./models/database');

// Load environment variables
dotenv.config();

// Import routes
const gisRoutes = require('./routes/gisRoutes');
const forestRoutes = require('./routes/forestRoutes');
const analysisRoutes = require('./routes/analysisRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize database
initDb()
  .then(() => {
    console.log('Database and PostGIS initialized successfully');
    
    // Register routes after database is initialized
    app.use('/api/gis', gisRoutes);
    app.use('/api/forest', forestRoutes);
    app.use('/api/analysis', analysisRoutes);

    // Start server only after database is initialized and routes are registered
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Database initialization error:', err);
    process.exit(1);
  });

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
const rastersDir = path.join(uploadsDir, 'rasters');
require('fs').mkdirSync(uploadsDir, { recursive: true });
require('fs').mkdirSync(rastersDir, { recursive: true });

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Basic route
app.get('/', (req, res) => {
  res.send('Forests Decision App API is running');
}); 