import './App.css';
import MapContainer from './components/Map/MapContainer';

function App() {
  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Forests Decision App</h1>
      </header>
      <main className="main-content">
        <MapContainer />
      </main>
    </div>
  );
}

export default App;
