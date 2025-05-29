const { pool } = require('../models/database');

// Perform buffer analysis around forest units
const bufferAnalysis = async (req, res) => {
  try {
    const { forestId, distance } = req.query;

    if (!forestId || !distance) {
      return res.status(400).json({ error: 'Forest ID and buffer distance are required' });
    }

    const query = `
      WITH buffered AS (
        SELECT 
          ST_Buffer(geom, $1) as buffer_geom,
          trupul as forest_unit,
          ua as management_unit
        FROM padure
        WHERE id = $2
      )
      SELECT 
        ST_AsGeoJSON(buffer_geom)::json as geometry,
        forest_unit,
        management_unit,
        ST_Area(buffer_geom) as buffer_area
      FROM buffered;
    `;

    const result = await pool.query(query, [distance, forestId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Forest unit not found' });
    }

    res.json({
      type: 'Feature',
      geometry: result.rows[0].geometry,
      properties: {
        forest_unit: result.rows[0].forest_unit,
        management_unit: result.rows[0].management_unit,
        buffer_area: result.rows[0].buffer_area,
        buffer_distance: distance
      }
    });
  } catch (error) {
    console.error('Error performing buffer analysis:', error);
    res.status(500).json({ error: 'Error performing buffer analysis' });
  }
};

// Analyze forest fragmentation
const fragmentationAnalysis = async (req, res) => {
  try {
    const { forestId } = req.params;

    const query = `
      WITH forest_patch AS (
        SELECT 
          id,
          geom,
          ST_Area(geom) as patch_area,
          ST_Perimeter(geom) as patch_perimeter
        FROM padure
        WHERE id = $1
      ),
      neighbors AS (
        SELECT 
          p.id,
          p.geom,
          ST_Area(p.geom) as neighbor_area,
          ST_Distance(p.geom, fp.geom) as distance
        FROM padure p, forest_patch fp
        WHERE p.id != fp.id
        AND ST_DWithin(p.geom, fp.geom, 1000) -- Within 1km
      )
      SELECT 
        fp.patch_area,
        fp.patch_perimeter,
        COUNT(n.id) as neighbor_count,
        AVG(n.neighbor_area) as avg_neighbor_area,
        AVG(n.distance) as avg_distance,
        (fp.patch_perimeter / (2 * SQRT(PI * fp.patch_area))) as shape_index
      FROM forest_patch fp
      LEFT JOIN neighbors n ON true
      GROUP BY fp.id, fp.patch_area, fp.patch_perimeter;
    `;

    const result = await pool.query(query, [forestId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Forest unit not found' });
    }

    res.json({
      forest_id: forestId,
      metrics: {
        patch_area: result.rows[0].patch_area,
        patch_perimeter: result.rows[0].patch_perimeter,
        neighbor_count: result.rows[0].neighbor_count,
        avg_neighbor_area: result.rows[0].avg_neighbor_area,
        avg_distance: result.rows[0].avg_distance,
        shape_index: result.rows[0].shape_index
      }
    });
  } catch (error) {
    console.error('Error performing fragmentation analysis:', error);
    res.status(500).json({ error: 'Error performing fragmentation analysis' });
  }
};

// Analyze forest connectivity
const connectivityAnalysis = async (req, res) => {
  try {
    const { forestType, maxDistance } = req.query;
    const distance = maxDistance || 1000; // Default 1km

    const query = `
      WITH forest_patches AS (
        SELECT 
          id,
          geom,
          cns as forest_type,
          ST_Area(geom) as area
        FROM padure
        WHERE cns = $1
      ),
      connections AS (
        SELECT 
          a.id as patch1_id,
          b.id as patch2_id,
          ST_Distance(a.geom, b.geom) as distance,
          ST_MakeLine(ST_Centroid(a.geom), ST_Centroid(b.geom)) as connection_line
        FROM forest_patches a
        JOIN forest_patches b ON a.id < b.id
        WHERE ST_DWithin(a.geom, b.geom, $2)
      )
      SELECT 
        patch1_id,
        patch2_id,
        distance,
        ST_AsGeoJSON(connection_line)::json as geometry
      FROM connections
      ORDER BY distance;
    `;

    const result = await pool.query(query, [forestType, distance]);

    const features = result.rows.map(row => ({
      type: 'Feature',
      geometry: row.geometry,
      properties: {
        patch1_id: row.patch1_id,
        patch2_id: row.patch2_id,
        distance: row.distance
      }
    }));

    res.json({
      type: 'FeatureCollection',
      features: features,
      metadata: {
        forest_type: forestType,
        max_distance: distance,
        total_connections: features.length
      }
    });
  } catch (error) {
    console.error('Error performing connectivity analysis:', error);
    res.status(500).json({ error: 'Error performing connectivity analysis' });
  }
};

// Analyze forest edge effects
const edgeEffectAnalysis = async (req, res) => {
  try {
    const { forestId, edgeWidth } = req.params;
    const width = edgeWidth || 100; // Default 100m edge width

    const query = `
      WITH forest AS (
        SELECT geom, trupul as forest_unit
        FROM padure
        WHERE id = $1
      ),
      edge AS (
        SELECT 
          ST_Buffer(geom, -$2) as inner_buffer,
          ST_Buffer(geom, $2) as outer_buffer,
          forest_unit
        FROM forest
      ),
      edge_zone AS (
        SELECT 
          ST_Difference(outer_buffer, inner_buffer) as edge_geom,
          forest_unit
        FROM edge
      )
      SELECT 
        ST_AsGeoJSON(edge_geom)::json as geometry,
        forest_unit,
        ST_Area(edge_geom) as edge_area,
        ST_Perimeter(edge_geom) as edge_perimeter
      FROM edge_zone;
    `;

    const result = await pool.query(query, [forestId, width]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Forest unit not found' });
    }

    res.json({
      type: 'Feature',
      geometry: result.rows[0].geometry,
      properties: {
        forest_unit: result.rows[0].forest_unit,
        edge_width: width,
        edge_area: result.rows[0].edge_area,
        edge_perimeter: result.rows[0].edge_perimeter
      }
    });
  } catch (error) {
    console.error('Error performing edge effect analysis:', error);
    res.status(500).json({ error: 'Error performing edge effect analysis' });
  }
};

// Analyze forest slope using DEM data
const slopeAnalysis = async (req, res) => {
  try {
    const { forestId, rasterId } = req.query;

    if (!forestId || !rasterId) {
      return res.status(400).json({ error: 'Forest ID and raster ID are required' });
    }

    const query = `
      WITH forest AS (
        SELECT geom, trupul as forest_unit
        FROM padure
        WHERE id = $1
      ),
      raster AS (
        SELECT raster_data
        FROM raster_files
        WHERE id = $2
      ),
      slope_stats AS (
        SELECT 
          ST_SummaryStats(
            ST_Clip(
              ST_Slope(r.raster_data, 1, '32BF', 'DEGREES'),
              f.geom
            )
          ) as stats
        FROM forest f, raster r
      )
      SELECT 
        (stats).min as min_slope,
        (stats).max as max_slope,
        (stats).mean as mean_slope,
        (stats).stddev as stddev_slope,
        forest_unit
      FROM slope_stats, forest;
    `;

    const result = await pool.query(query, [forestId, rasterId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Analysis failed - forest unit or raster not found' });
    }

    res.json({
      forest_id: forestId,
      raster_id: rasterId,
      slope_analysis: {
        min_slope: result.rows[0].min_slope,
        max_slope: result.rows[0].max_slope,
        mean_slope: result.rows[0].mean_slope,
        stddev_slope: result.rows[0].stddev_slope,
        forest_unit: result.rows[0].forest_unit
      }
    });
  } catch (error) {
    console.error('Error performing slope analysis:', error);
    res.status(500).json({ error: 'Error performing slope analysis' });
  }
};

// Analyze forest aspect using DEM data
const aspectAnalysis = async (req, res) => {
  try {
    const { forestId, rasterId } = req.query;

    if (!forestId || !rasterId) {
      return res.status(400).json({ error: 'Forest ID and raster ID are required' });
    }

    const query = `
      WITH forest AS (
        SELECT geom, trupul as forest_unit
        FROM padure
        WHERE id = $1
      ),
      raster AS (
        SELECT raster_data
        FROM raster_files
        WHERE id = $2
      ),
      aspect_stats AS (
        SELECT 
          ST_SummaryStats(
            ST_Clip(
              ST_Aspect(r.raster_data, '32BF', 'DEGREES'),
              f.geom
            )
          ) as stats
        FROM forest f, raster r
      )
      SELECT 
        (stats).min as min_aspect,
        (stats).max as max_aspect,
        (stats).mean as mean_aspect,
        (stats).stddev as stddev_aspect,
        forest_unit
      FROM aspect_stats, forest;
    `;

    const result = await pool.query(query, [forestId, rasterId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Analysis failed - forest unit or raster not found' });
    }

    res.json({
      forest_id: forestId,
      raster_id: rasterId,
      aspect_analysis: {
        min_aspect: result.rows[0].min_aspect,
        max_aspect: result.rows[0].max_aspect,
        mean_aspect: result.rows[0].mean_aspect,
        stddev_aspect: result.rows[0].stddev_aspect,
        forest_unit: result.rows[0].forest_unit
      }
    });
  } catch (error) {
    console.error('Error performing aspect analysis:', error);
    res.status(500).json({ error: 'Error performing aspect analysis' });
  }
};

// Analyze forest density patterns
const densityAnalysis = async (req, res) => {
  try {
    const { forestType, cellSize } = req.query;
    const size = cellSize || 1000; // Default 1km cell size

    const query = `
      WITH forest_grid AS (
        SELECT 
          (ST_PixelAsPolygons(
            ST_AsRaster(
              ST_Union(geom),
              $1, $1,
              '32BF',
              0
            )
          )).*
        FROM padure
        WHERE cns = $2
      ),
      density_stats AS (
        SELECT 
          x, y,
          val as density,
          ST_Area(geom) as cell_area,
          COUNT(*) OVER (PARTITION BY x, y) as patch_count
        FROM forest_grid
      )
      SELECT 
        json_build_object(
          'type', 'FeatureCollection',
          'features', json_agg(
            json_build_object(
              'type', 'Feature',
              'geometry', ST_AsGeoJSON(geom)::json,
              'properties', json_build_object(
                'density', density,
                'cell_area', cell_area,
                'patch_count', patch_count,
                'x', x,
                'y', y
              )
            )
          )
        ) as geojson
      FROM density_stats;
    `;

    const result = await pool.query(query, [size, forestType]);

    if (!result.rows[0].geojson) {
      return res.status(404).json({ error: 'No forest data found for the specified type' });
    }

    res.json(result.rows[0].geojson);
  } catch (error) {
    console.error('Error performing density analysis:', error);
    res.status(500).json({ error: 'Error performing density analysis' });
  }
};

// Analyze forest patch metrics
const patchMetricsAnalysis = async (req, res) => {
  try {
    const { forestType } = req.query;

    const query = `
      WITH forest_patches AS (
        SELECT 
          id,
          geom,
          ST_Area(geom) as area,
          ST_Perimeter(geom) as perimeter,
          ST_NumPoints(geom) as vertex_count
        FROM padure
        WHERE cns = $1
      ),
      metrics AS (
        SELECT 
          id,
          area,
          perimeter,
          vertex_count,
          (perimeter / (2 * SQRT(PI * area))) as shape_index,
          (4 * SQRT(area) / perimeter) as compactness,
          (perimeter / (2 * SQRT(PI * area))) as fractal_dimension
        FROM forest_patches
      )
      SELECT 
        json_build_object(
          'type', 'FeatureCollection',
          'features', json_agg(
            json_build_object(
              'type', 'Feature',
              'geometry', ST_AsGeoJSON(p.geom)::json,
              'properties', json_build_object(
                'id', m.id,
                'area', m.area,
                'perimeter', m.perimeter,
                'vertex_count', m.vertex_count,
                'shape_index', m.shape_index,
                'compactness', m.compactness,
                'fractal_dimension', m.fractal_dimension
              )
            )
          )
        ) as geojson
      FROM metrics m
      JOIN forest_patches p ON m.id = p.id;
    `;

    const result = await pool.query(query, [forestType]);

    if (!result.rows[0].geojson) {
      return res.status(404).json({ error: 'No forest data found for the specified type' });
    }

    res.json(result.rows[0].geojson);
  } catch (error) {
    console.error('Error performing patch metrics analysis:', error);
    res.status(500).json({ error: 'Error performing patch metrics analysis' });
  }
};

module.exports = {
  bufferAnalysis,
  fragmentationAnalysis,
  connectivityAnalysis,
  edgeEffectAnalysis,
  slopeAnalysis,
  aspectAnalysis,
  densityAnalysis,
  patchMetricsAnalysis
}; 