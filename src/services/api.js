/**
 * API service module for handling all server communications
 */

const API_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * Make a GET request to the API
 * @param {string} endpoint - API endpoint
 * @param {Object} params - Query parameters
 * @returns {Promise<any>} - Response data
 */
export async function get(endpoint, params = {}) {
  const url = new URL(`${API_URL}${endpoint}`);
  
  // Add query parameters
  Object.keys(params).forEach(key => {
    url.searchParams.append(key, params[key]);
  });
  
  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Make a POST request to the API
 * @param {string} endpoint - API endpoint
 * @param {Object} data - Request body data
 * @returns {Promise<any>} - Response data
 */
export async function post(endpoint, data = {}) {
  const url = `${API_URL}${endpoint}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Fetch WMS feature info through the backend
 * @param {string} wmsUrl - WMS URL
 * @param {Object} params - WMS parameters
 * @returns {Promise<Object>} - Feature info data
 */
export async function getWmsFeatureInfo(wmsUrl, params) {
  // In the future, this will call a backend endpoint to handle CORS issues
  return get('/wms-proxy', {
    url: wmsUrl,
    ...params
  });
} 