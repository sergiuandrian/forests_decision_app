const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const { initDb } = require('./models/database');

// Load environment variables
dotenv.config();

// Import routes
const gisRoutes = require('./routes/gisRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize database
// initDb()
//   .then(() => console.log('Database initialized'))
//   .catch(err => {
//     console.error('Database initialization error:', err);
//     process.exit(1);
//   });

// Serve static files if needed
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/gis', gisRoutes);

// Basic route
app.get('/', (req, res) => {
  res.send('Forests Decision App API is running');
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 