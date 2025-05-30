const { pool } = require('../models/database');

// Get forest data with optional filtering
const getForestData = async (req, res) => {
  try {
    const { 
      minArea, 
      maxArea, 
      forestType, 
      propertyType,
      bbox // format: minx,miny,maxx,maxy
    } = req.query;

    let query = `
      SELECT 
        id, 
        trupul as forest_unit,
        ua as management_unit,
        suprafata as area,
        vrt as volume,
        cns as forest_type,
        proprietat as property_type,
        ST_AsGeoJSON(geom)::json as geometry
      FROM padure
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (minArea) {
      query += ` AND suprafata >= $${paramCount}`;
      params.push(minArea);
      paramCount++;
    }
    if (maxArea) {
      query += ` AND suprafata <= $${paramCount}`;
      params.push(maxArea);
      paramCount++;
    }
    if (forestType) {
      query += ` AND cns = $${paramCount}`;
      params.push(forestType);
      paramCount++;
    }
    if (propertyType) {
      query += ` AND proprietat = $${paramCount}`;
      params.push(propertyType);
      paramCount++;
    }
    if (bbox) {
      const [minx, miny, maxx, maxy] = bbox.split(',').map(Number);
      query += ` AND ST_Intersects(geom, ST_MakeEnvelope($${paramCount}, $${paramCount + 1}, $${paramCount + 2}, $${paramCount + 3}, 4326))`;
      params.push(minx, miny, maxx, maxy);
      paramCount += 4;
    }

    const result = await pool.query(query, params);
    
    // Format as GeoJSON FeatureCollection
    const features = result.rows.map(row => ({
      type: 'Feature',
      geometry: row.geometry,
      properties: {
        id: row.id,
        forest_unit: row.forest_unit,
        management_unit: row.management_unit,
        area: row.area,
        volume: row.volume,
        forest_type: row.forest_type,
        property_type: row.property_type
      }
    }));

    res.json({
      type: 'FeatureCollection',
      features: features
    });
  } catch (error) {
    console.error('Error fetching forest data:', error);
    res.status(500).json({ error: 'Error fetching forest data' });
  }
};

// Get forest statistics
const getForestStats = async (req, res) => {
  try {
    const query = `
      SELECT 
        COUNT(*) as total_units,
        SUM(suprafata) as total_area,
        SUM(vrt) as total_volume,
        COUNT(DISTINCT cns) as forest_types_count,
        COUNT(DISTINCT proprietat) as property_types_count,
        AVG(suprafata) as avg_area,
        AVG(vrt) as avg_volume
      FROM padure
    `;
    
    const result = await pool.query(query);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching forest statistics:', error);
    res.status(500).json({ error: 'Error fetching forest statistics' });
  }
};

// Get forest boundaries (hotar) data
const getForestBoundaries = async (req, res) => {
  try {
    const { forestId } = req.params;
    
    const query = `
      SELECT 
        h.id,
        h.denumire as name,
        h.aria as area,
        ST_AsGeoJSON(h.geom)::json as geometry,
        p.trupul as forest_unit,
        p.ua as management_unit
      FROM hotar h
      LEFT JOIN padure p ON ST_Intersects(h.geom, p.geom)
      WHERE p.id = $1
    `;
    
    const result = await pool.query(query, [forestId]);
    
    const features = result.rows.map(row => ({
      type: 'Feature',
      geometry: row.geometry,
      properties: {
        id: row.id,
        name: row.name,
        area: row.area,
        forest_unit: row.forest_unit,
        management_unit: row.management_unit
      }
    }));

    res.json({
      type: 'FeatureCollection',
      features: features
    });
  } catch (error) {
    console.error('Error fetching forest boundaries:', error);
    res.status(500).json({ error: 'Error fetching forest boundaries' });
  }
};

// Get forest analysis by property type
const getForestAnalysisByProperty = async (req, res) => {
  try {
    const query = `
      SELECT 
        proprietat as property_type,
        COUNT(*) as unit_count,
        SUM(suprafata) as total_area,
        SUM(vrt) as total_volume,
        AVG(suprafata) as avg_area,
        AVG(vrt) as avg_volume
      FROM padure
      GROUP BY proprietat
      ORDER BY total_area DESC
    `;
    
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching forest analysis:', error);
    res.status(500).json({ error: 'Error fetching forest analysis' });
  }
};

// Get forest units (hotar) data
const getForestUnits = async (req, res) => {
  try {
    const { minx, miny, maxx, maxy } = req.query;
    
    let query = `
      SELECT 
        h.id,
        h.denumire as name,
        h.aria as area,
        h.proprietate as property_type,
        h.management as management_type,
        ST_AsGeoJSON(h.geom)::json as geometry
      FROM hotar h
    `;
    
    const params = [];
    let paramCount = 1;
    
    if (minx && miny && maxx && maxy) {
      query += ` WHERE ST_Intersects(h.geom, ST_MakeEnvelope($${paramCount}, $${paramCount + 1}, $${paramCount + 2}, $${paramCount + 3}, 4326))`;
      params.push(minx, miny, maxx, maxy);
    }
    
    const result = await pool.query(query, params);
    
    const features = result.rows.map(row => ({
      type: 'Feature',
      geometry: row.geometry,
      properties: {
        id: row.id,
        name: row.name,
        area: row.area,
        property_type: row.property_type,
        management_type: row.management_type
      }
    }));

    res.json({
      type: 'FeatureCollection',
      features: features
    });
  } catch (error) {
    console.error('Error fetching forest units:', error);
    res.status(500).json({ error: 'Error fetching forest units' });
  }
};

// Get forest stands (padure) data
const getForestStands = async (req, res) => {
  try {
    const { minx, miny, maxx, maxy } = req.query;
    
    let query = `
      SELECT 
        p.id,
        p.trupul as forest_unit,
        p.ua as management_unit,
        p.suprafata as area,
        p.vrt as volume,
        p.cns as forest_type,
        p.proprietat as property_type,
        ST_AsGeoJSON(p.geom)::json as geometry
      FROM padure p
    `;
    
    const params = [];
    let paramCount = 1;
    
    if (minx && miny && maxx && maxy) {
      query += ` WHERE ST_Intersects(p.geom, ST_MakeEnvelope($${paramCount}, $${paramCount + 1}, $${paramCount + 2}, $${paramCount + 3}, 4326))`;
      params.push(minx, miny, maxx, maxy);
    }
    
    const result = await pool.query(query, params);
    
    const features = result.rows.map(row => ({
      type: 'Feature',
      geometry: row.geometry,
      properties: {
        id: row.id,
        forest_unit: row.forest_unit,
        management_unit: row.management_unit,
        area: row.area,
        volume: row.volume,
        forest_type: row.forest_type,
        property_type: row.property_type
      }
    }));

    res.json({
      type: 'FeatureCollection',
      features: features
    });
  } catch (error) {
    console.error('Error fetching forest stands:', error);
    res.status(500).json({ error: 'Error fetching forest stands' });
  }
};

module.exports = {
  getForestUnits,
  getForestStands,
  getForestData,
  getForestStats,
  getForestBoundaries,
  getForestAnalysisByProperty
}; 