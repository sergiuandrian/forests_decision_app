import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

// Mock the map component
vi.mock('../map', () => ({
  default: () => <div data-testid="map">Map Component</div>
}));

// Mock the LayerControl component
vi.mock('../components/LayerControl', () => ({
  default: ({ isOpen }) => (
    <div data-testid="layer-control">
      Layer Control {isOpen ? 'Open' : 'Closed'}
    </div>
  )
}));

// Mock the API service
vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: { layers: [] } }))
  }
}));

describe('App Component', () => {
  it('renders without crashing', () => {
    render(<App />);
    expect(screen.getByText('Forests Decision App')).toBeInTheDocument();
  });

  it('displays the subtitle', () => {
    render(<App />);
    expect(screen.getByText('Interactive Forest Management and Analysis Tool')).toBeInTheDocument();
  });

  it('renders navigation buttons', () => {
    render(<App />);
    expect(screen.getByText('Docs')).toBeInTheDocument();
    expect(screen.getByText('Help')).toBeInTheDocument();
    expect(screen.getByText('Share')).toBeInTheDocument();
  });

  it('renders map component', () => {
    render(<App />);
    expect(screen.getByTestId('map')).toBeInTheDocument();
  });

  it('renders layer control', () => {
    render(<App />);
    expect(screen.getByTestId('layer-control')).toBeInTheDocument();
  });
}); 