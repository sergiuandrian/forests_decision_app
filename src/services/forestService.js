import { get } from './api';

/**
 * Service for handling forest data operations
 */

/**
 * Fetch forest units (hotar) data
 * @param {Object} params - Query parameters (bbox, forestType, etc.)
 * @returns {Promise<GeoJSON>} Forest units data in GeoJSON format
 */
export async function getForestUnits(params = {}) {
  return get('/forest/units', params);
}

/**
 * Fetch forest stands (padure) data
 * @param {Object} params - Query parameters (bbox, forestType, etc.)
 * @returns {Promise<GeoJSON>} Forest stands data in GeoJSON format
 */
export async function getForestStands(params = {}) {
  return get('/forest/stands', params);
}

/**
 * Fetch forest statistics
 * @returns {Promise<Object>} Forest statistics data
 */
export async function getForestStats() {
  return get('/forest/stats');
}

/**
 * Fetch forest data within a bounding box
 * @param {Object} bbox - Bounding box coordinates {minx, miny, maxx, maxy}
 * @param {string} layerType - Type of layer ('units' or 'stands')
 * @returns {Promise<GeoJSON>} Forest data in GeoJSON format
 */
export async function getForestDataInBbox(bbox, layerType) {
  const params = {
    minx: bbox.minx,
    miny: bbox.miny,
    maxx: bbox.maxx,
    maxy: bbox.maxy
  };
  
  return layerType === 'units' 
    ? getForestUnits(params)
    : getForestStands(params);
} 