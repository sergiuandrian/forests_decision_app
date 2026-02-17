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

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Initialize database and start server
async function startServer() {
  try {
    await initDb();
    console.log('Database and PostGIS initialized successfully');
    
    // Register routes after database is initialized
    app.use('/api/gis', gisRoutes);
    app.use('/api/forest', forestRoutes);
    app.use('/api/analysis', analysisRoutes);

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(__dirname, 'uploads');
    const rastersDir = path.join(uploadsDir, 'rasters');
    require('fs').mkdirSync(uploadsDir, { recursive: true });
    require('fs').mkdirSync(rastersDir, { recursive: true });

    // Serve static files
    app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

    // Basic route
    app.get('/', (req, res) => {
      res.json({ 
        message: 'Forests Decision App API is running',
        version: '1.0.0',
        timestamp: new Date().toISOString()
      });
    });

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy',
        timestamp: new Date().toISOString()
      });
    });

    // 404 handler
    app.use('*', (req, res) => {
      res.status(404).json({ 
        error: 'Endpoint not found',
        path: req.originalUrl
      });
    });

    // Global error handler
    app.use((err, req, res, next) => {
      console.error('Global error handler:', err);
      res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
      });
    });

    // Start server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (err) {
    console.error('Server initialization error:', err);
    process.exit(1);
  }
}

startServer(); 