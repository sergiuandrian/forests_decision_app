import './App.css';
import WebGISMap from './map';

function App() {
  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Forests Decision App</h1>
      </header>
      <main className="main-content">
        <WebGISMap />
      </main>
    </div>
  );
}

export default App;
