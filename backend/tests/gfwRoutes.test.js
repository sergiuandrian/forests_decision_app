const request = require('supertest');
const express = require('express');
const axios = require('axios');
const https = require('https');
const app = express();

// Mock axios and https before importing routes
jest.mock('axios');
jest.mock('https');

// Create separate mock instances for GFW API and GFW Data API
const mockGfwApi = {
  get: jest.fn(),
  post: jest.fn(),
  interceptors: {
    request: { use: jest.fn() }
  }
};

const mockGfwDataApi = {
  get: jest.fn(),
  post: jest.fn(),
  interceptors: {
    request: { use: jest.fn() }
  }
};

// Mock axios.create to return different instances based on baseURL
axios.create = jest.fn().mockImplementation((config) => {
  const instance = config.baseURL === 'https://data-api.globalforestwatch.org' 
    ? mockGfwDataApi 
    : mockGfwApi;
  
  return {
    ...instance,
    get: instance.get.bind(instance),
    post: instance.post.bind(instance)
  };
});

// Mock https.Agent
const mockAgent = {
  secureProtocol: 'TLSv1_2_method',
  rejectUnauthorized: true
};
https.Agent = jest.fn().mockReturnValue(mockAgent);

// Import routes after mocks are set up
const gfwRoutes = require('../routes/gfwRoutes');
app.use('/api/gfw', gfwRoutes);

describe('GFW API Routes', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    mockGfwApi.get.mockReset();
    mockGfwApi.post.mockReset();
    mockGfwDataApi.get.mockReset();
    mockGfwDataApi.post.mockReset();
    axios.create.mockClear();
  });

  describe('GET /api/gfw/health', () => {
    it('should return healthy status', async () => {
      const response = await request(app)
        .get('/api/gfw/health')
        .expect(200);

      expect(response.body).toEqual({
        status: 'healthy',
        version: 'v3',
        timestamp: expect.any(String),
        endpoints: {
          base: 'https://api.globalforestwatch.org',
          data: 'https://data-api.globalforestwatch.org'
        }
      });
    });
  });

  describe('GET /api/gfw/analyze', () => {
    const validCoordinates = {
      lat: 0,
      lng: 0,
      radius: 10000
    };

    beforeEach(() => {
      // Mock geostore creation with fallback behavior
      mockGfwApi.post.mockImplementation((url) => {
        if (url === '/v2/geostore/area') {
          return Promise.reject({ response: { status: 500 } });
        }
        if (url === '/v2/geostore/polygon') {
          return Promise.reject({ response: { status: 500 } });
        }
        if (url === '/v2/geostore') {
          return Promise.resolve({
            data: {
              data: {
                id: 'test-geostore-id',
                attributes: {
                  areaHa: 100,
                  bbox: [-1, -1, 1, 1]
                }
              }
            }
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      // Mock successful alerts retrieval
      mockGfwDataApi.get.mockImplementation((url) => {
        if (url.includes('glad-alerts')) {
          return Promise.resolve({
            data: {
              data: {
                alerts: 10,
                confidence: 'high',
                area: 500
              }
            }
          });
        }
        if (url.includes('fire-alerts')) {
          return Promise.resolve({
            data: {
              data: {
                alerts: 5,
                intensity: 'medium',
                area: 200
              }
            }
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });
    });

    it('should return comprehensive area analysis with valid coordinates', async () => {
      const response = await request(app)
        .get('/api/gfw/analyze')
        .query(validCoordinates)
        .expect(200);

      // Verify geostore creation call
      expect(mockGfwApi.post).toHaveBeenCalledWith(
        '/v2/geostore/area',
        expect.objectContaining({
          lat: 0,
          lng: 0,
          radius: 10000
        })
      );

      // Verify alerts data calls
      expect(mockGfwDataApi.get).toHaveBeenCalledTimes(2);
      expect(mockGfwDataApi.get).toHaveBeenCalledWith(
        '/dataset/glad-alerts/area',
        expect.objectContaining({
          params: expect.objectContaining({
            geostore: 'test-geostore-id'
          })
        })
      );

      expect(response.body.data).toEqual({
        coordinates: {
          lat: 0,
          lng: 0
        },
        radius: 10000,
        geostore: {
          id: 'test-geostore-id',
          areaHa: 100,
          bbox: [-1, -1, 1, 1]
        },
        alerts: {
          deforestation: {
            alerts: 10,
            confidence: 'high',
            area: 500
          },
          fire: {
            alerts: 5,
            intensity: 'medium',
            area: 200
          }
        },
        metadata: {
          timestamp: expect.any(String),
          version: 'v3'
        }
      });
    });

    it('should validate coordinate ranges', async () => {
      const invalidCoordinates = [
        { lat: 91, lng: 0, radius: 10000 },
        { lat: -91, lng: 0, radius: 10000 },
        { lat: 0, lng: 181, radius: 10000 },
        { lat: 0, lng: -181, radius: 10000 }
      ];

      for (const coords of invalidCoordinates) {
        const response = await request(app)
          .get('/api/gfw/analyze')
          .query(coords)
          .expect(400);

        expect(response.body.errors).toBeDefined();
      }
    });

    it('should validate radius range', async () => {
      const response = await request(app)
        .get('/api/gfw/analyze')
        .query({ ...validCoordinates, radius: 50 })
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });

    it('should handle API errors gracefully', async () => {
      // Mock authentication error
      mockGfwApi.post.mockImplementationOnce(() => 
        Promise.reject({
          response: { 
            status: 401,
            data: { message: 'Authentication failed' }
          }
        })
      );

      const response = await request(app)
        .get('/api/gfw/analyze')
        .query(validCoordinates)
        .expect(401);

      expect(response.body.error).toEqual({
        message: 'Authentication failed',
        code: 'AUTH_ERROR',
        status: 401,
        timestamp: expect.any(String)
      });
    });
  });

  describe('GET /api/gfw/forest-loss', () => {
    const validCoordinates = {
      lat: 0,
      lng: 0,
      radius: 10000,
      'start-date': '2023-01-01',
      'end-date': '2023-12-31'
    };

    const mockForestLossResponse = {
      data: {
        data: {
          loss: 100,
          gain: 20,
          total: 1000
        }
      }
    };

    beforeEach(() => {
      mockGfwApi.post.mockResolvedValueOnce({
        data: {
          data: {
            id: 'test-geostore-id',
            attributes: { areaHa: 100 }
          }
        }
      });
      mockGfwApi.get.mockResolvedValueOnce(mockForestLossResponse);
    });

    it('should return forest loss data with valid coordinates and date range', async () => {
      const response = await request(app)
        .get('/api/gfw/forest-loss')
        .query(validCoordinates)
        .expect(200);

      expect(response.body.data).toEqual({
        coordinates: {
          lat: 0,
          lng: 0
        },
        radius: 10000,
        geostore: {
          id: 'test-geostore-id',
          areaHa: 100
        },
        forestLoss: {
          loss: 100,
          gain: 20,
          total: 1000
        },
        metadata: {
          timestamp: expect.any(String),
          version: 'v3',
          dateRange: {
            startDate: '2023-01-01',
            endDate: '2023-12-31'
          }
        }
      });
    });

    it('should validate date range', async () => {
      const invalidDateRange = {
        ...validCoordinates,
        'start-date': '2023-12-31',
        'end-date': '2023-01-01'
      };

      const response = await request(app)
        .get('/api/gfw/forest-loss')
        .query(invalidDateRange)
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });
  });

  describe('GET /api/gfw/alerts', () => {
    const validCoordinates = {
      lat: 0,
      lng: 0,
      radius: 10000,
      'start-date': '2023-01-01',
      'end-date': '2023-12-31'
    };

    beforeEach(() => {
      // Mock successful geostore creation
      mockGfwApi.post.mockImplementation(() => Promise.resolve({
        data: {
          data: {
            id: 'test-geostore-id',
            attributes: { areaHa: 100 }
          }
        }
      }));

      // Mock successful alerts retrieval
      mockGfwDataApi.get.mockImplementation((url) => {
        if (url.includes('glad-alerts')) {
          return Promise.resolve({
            data: {
              data: {
                alerts: 10,
                confidence: 'high',
                area: 500
              }
            }
          });
        } else if (url.includes('fire-alerts')) {
          return Promise.resolve({
            data: {
              data: {
                alerts: 5,
                intensity: 'medium',
                area: 200
              }
            }
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });
    });

    it('should return alerts data with valid coordinates and date range', async () => {
      const response = await request(app)
        .get('/api/gfw/alerts')
        .query(validCoordinates)
        .expect(200);

      // Verify geostore creation
      expect(mockGfwApi.post).toHaveBeenCalledWith(
        '/v2/geostore/area',
        expect.objectContaining({
          lat: 0,
          lng: 0,
          radius: 10000
        })
      );

      // Verify alerts data calls
      expect(mockGfwDataApi.get).toHaveBeenCalledTimes(2);
      expect(mockGfwDataApi.get).toHaveBeenCalledWith(
        '/dataset/glad-alerts/area',
        expect.objectContaining({
          params: expect.objectContaining({
            geostore: 'test-geostore-id',
            period: '2023-01-01,2023-12-31'
          })
        })
      );

      expect(response.body.data).toEqual({
        coordinates: {
          lat: 0,
          lng: 0
        },
        radius: 10000,
        geostore: {
          id: 'test-geostore-id',
          areaHa: 100
        },
        alerts: {
          deforestation: {
            alerts: 10,
            confidence: 'high',
            area: 500
          },
          fire: {
            alerts: 5,
            intensity: 'medium',
            area: 200
          }
        },
        metadata: {
          timestamp: expect.any(String),
          version: 'v3',
          dateRange: {
            startDate: '2023-01-01',
            endDate: '2023-12-31'
          }
        }
      });
    });

    it('should handle partial alerts data failure', async () => {
      // Mock successful GLAD alerts but failed fire alerts
      mockGfwDataApi.get.mockImplementation((url) => {
        if (url.includes('glad-alerts')) {
          return Promise.resolve({
            data: {
              data: {
                alerts: 10,
                confidence: 'high',
                area: 500
              }
            }
          });
        }
        return Promise.reject(new Error('Fire alerts service unavailable'));
      });

      const response = await request(app)
        .get('/api/gfw/alerts')
        .query(validCoordinates)
        .expect(200);

      expect(response.body.data.alerts).toEqual({
        deforestation: {
          alerts: 10,
          confidence: 'high',
          area: 500
        },
        fire: {}
      });
    });
  });
}); 