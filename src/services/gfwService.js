import { get } from './api';

/**
 * Fetch geostore details by ID
 * @param {string} geostoreId - The geostore ID
 * @returns {Promise<Object>} Geostore details
 */
export async function getGeostoreDetails(geostoreId) {
  return get(`/gfw/geostore/${geostoreId}`);
}

/**
 * Fetch forest data for a geostore
 * @param {string} geostoreId - The geostore ID
 * @param {Object} options - Query options
 * @param {string} [options.dataset='umd_tree_cover_loss'] - Dataset to use
 * @returns {Promise<Object>} Forest data
 */
export async function getForestData(geostoreId, { dataset = 'umd_tree_cover_loss' } = {}) {
  return get(`/gfw/forest/${geostoreId}`, { dataset });
}

/**
 * Fetch alerts for a geostore
 * @param {string} geostoreId - The geostore ID
 * @param {Object} options - Query options
 * @param {string} [options.start_date] - Start date in ISO format
 * @param {string} [options.end_date] - End date in ISO format
 * @param {string} [options.confidence='3'] - Confidence level (1-3)
 * @returns {Promise<Object>} Alerts data
 */
export async function getAlerts(geostoreId, { start_date, end_date, confidence = '3' } = {}) {
  return get(`/gfw/alerts/${geostoreId}`, { start_date, end_date, confidence });
}

/**
 * Fetch analysis data for a geostore
 * @param {string} geostoreId - The geostore ID
 * @param {Object} options - Query options
 * @param {string} [options.start_date] - Start date in ISO format
 * @param {string} [options.end_date] - End date in ISO format
 * @returns {Promise<Object>} Analysis data
 */
export async function getAnalysis(geostoreId, { start_date, end_date } = {}) {
  return get(`/gfw/analysis/${geostoreId}`, { start_date, end_date });
}

/**
 * Fetch all data for a geostore
 * @param {string} geostoreId - The geostore ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Combined data from all endpoints
 */
export async function getAllGeostoreData(geostoreId, options = {}) {
  const [geostore, forest, alerts, analysis] = await Promise.all([
    getGeostoreDetails(geostoreId),
    getForestData(geostoreId, options),
    getAlerts(geostoreId, options),
    getAnalysis(geostoreId, options)
  ]);

  return {
    geostore,
    forest,
    alerts,
    analysis
  };
}

/**
 * Fetch polygon data for a geostore
 * @param {string} geostoreId - The geostore ID
 * @returns {Promise<Object>} Polygon data in GeoJSON format
 */
export async function getPolygon(geostoreId) {
  try {
    const response = await get(`/gfw/polygon/${geostoreId}`);
    return response;
  } catch (error) {
    console.error('Failed to get polygon:', error);
    throw new Error('Failed to get polygon data. Please try again.');
  }
} 