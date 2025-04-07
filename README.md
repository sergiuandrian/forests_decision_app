# Forests Decision App

A web-based GIS application for forest management decision support.

## Live Demo

[View the live demo](https://sergiuandrian.github.io/forests_decision_app/)

## Features

- Interactive map visualization with multiple basemaps
- Layer management for different forest datasets
- GeoJSON upload and visualization
- Local storage for persisting user uploads
- WMS layer integration
- Automatic deployment via GitHub Actions

## Technology Stack

- Frontend: React.js with Vite, Leaflet.js
- Backend: Node.js, Express.js (for local development)
- GIS Server: GeoServer (for local development)
- Deployment: GitHub Pages with GitHub Actions

## Getting Started

### Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/sergiuandrian/forests_decision_app.git
   cd forests_decision_app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Access the application at http://localhost:3000

### Backend Setup (Local Development Only)

The backend is required only for local development and is not part of the GitHub Pages deployment.

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the backend server:
   ```bash
   npm run dev
   ```

## Deployment

The application is automatically deployed to GitHub Pages when changes are pushed to the main branch.

To manually deploy:
```bash
npm run deploy
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
