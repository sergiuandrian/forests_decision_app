const { pool } = require('../models/database');
const path = require('path');
const fs = require('fs').promises;

// Upload and process raster data
const uploadRaster = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { name, properties } = req.body;
    const filePath = req.file.path;
    const fileName = req.file.filename;

    // Insert raster metadata into database
    const query = `
      INSERT INTO raster_files (name, file_path, upload_date, properties, metadata)
      VALUES ($1, $2, NOW(), $3, $4)
      RETURNING id;
    `;

    // Basic metadata extraction (you might want to use GDAL for more detailed metadata)
    const metadata = {
      filename: fileName,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      upload_date: new Date()
    };

    const result = await pool.query(query, [
      name || fileName,
      filePath,
      properties ? JSON.parse(properties) : {},
      metadata
    ]);

    res.status(201).json({
      message: 'Raster uploaded successfully',
      id: result.rows[0].id,
      metadata: metadata
    });
  } catch (error) {
    console.error('Error uploading raster:', error);
    // Clean up file if database insert fails
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting file:', unlinkError);
      }
    }
    res.status(500).json({ error: 'Error uploading raster' });
  }
};

// Get raster data within a bounding box
const getRasterInBbox = async (req, res) => {
  try {
    const { minx, miny, maxx, maxy, rasterId } = req.query;

    if (!minx || !miny || !maxx || !maxy) {
      return res.status(400).json({ error: 'Bounding box coordinates are required' });
    }

    const query = `
      SELECT 
        r.id,
        r.name,
        r.file_path,
        r.properties,
        r.metadata,
        ST_AsBinary(ST_Clip(r.raster_data, ST_MakeEnvelope($1, $2, $3, $4, 4326))) as clipped_raster
      FROM raster_files r
      WHERE r.id = $5
    `;

    const result = await pool.query(query, [minx, miny, maxx, maxy, rasterId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Raster not found' });
    }

    // Convert binary raster to base64 for transmission
    const rasterData = result.rows[0].clipped_raster;
    const base64Raster = rasterData ? rasterData.toString('base64') : null;

    res.json({
      id: result.rows[0].id,
      name: result.rows[0].name,
      properties: result.rows[0].properties,
      metadata: result.rows[0].metadata,
      raster_data: base64Raster
    });
  } catch (error) {
    console.error('Error fetching raster:', error);
    res.status(500).json({ error: 'Error fetching raster data' });
  }
};

// Get list of available rasters
const getRasterList = async (req, res) => {
  try {
    const query = `
      SELECT 
        id,
        name,
        upload_date,
        properties,
        metadata
      FROM raster_files
      ORDER BY upload_date DESC
    `;

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching raster list:', error);
    res.status(500).json({ error: 'Error fetching raster list' });
  }
};

// Delete raster
const deleteRaster = async (req, res) => {
  try {
    const { id } = req.params;

    // First get the file path
    const getQuery = 'SELECT file_path FROM raster_files WHERE id = $1';
    const getResult = await pool.query(getQuery, [id]);

    if (getResult.rows.length === 0) {
      return res.status(404).json({ error: 'Raster not found' });
    }

    // Delete from database
    const deleteQuery = 'DELETE FROM raster_files WHERE id = $1';
    await pool.query(deleteQuery, [id]);

    // Delete file from filesystem
    try {
      await fs.unlink(getResult.rows[0].file_path);
    } catch (unlinkError) {
      console.error('Error deleting file:', unlinkError);
      // Continue even if file deletion fails
    }

    res.json({ message: 'Raster deleted successfully' });
  } catch (error) {
    console.error('Error deleting raster:', error);
    res.status(500).json({ error: 'Error deleting raster' });
  }
};

// Resample raster to different resolution
const resampleRaster = async (req, res) => {
  try {
    const { rasterId, targetResolution } = req.query;

    if (!rasterId || !targetResolution) {
      return res.status(400).json({ error: 'Raster ID and target resolution are required' });
    }

    const query = `
      WITH source_raster AS (
        SELECT raster_data
        FROM raster_files
        WHERE id = $1
      ),
      resampled AS (
        SELECT 
          ST_Resample(
            raster_data,
            $2, $2,
            'Bilinear'
          ) as resampled_raster
        FROM source_raster
      )
      SELECT 
        ST_AsBinary(resampled_raster) as raster_data,
        ST_Width(resampled_raster) as width,
        ST_Height(resampled_raster) as height,
        ST_Value(resampled_raster, 1, 1, 1) as sample_value
      FROM resampled;
    `;

    const result = await pool.query(query, [rasterId, targetResolution]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Raster not found' });
    }

    const rasterData = result.rows[0].raster_data;
    const base64Raster = rasterData ? rasterData.toString('base64') : null;

    res.json({
      raster_id: rasterId,
      new_resolution: targetResolution,
      width: result.rows[0].width,
      height: result.rows[0].height,
      sample_value: result.rows[0].sample_value,
      raster_data: base64Raster
    });
  } catch (error) {
    console.error('Error resampling raster:', error);
    res.status(500).json({ error: 'Error resampling raster' });
  }
};

// Reclassify raster values
const reclassifyRaster = async (req, res) => {
  try {
    const { rasterId } = req.query;
    const { reclassRules } = req.body;

    if (!rasterId || !reclassRules) {
      return res.status(400).json({ error: 'Raster ID and reclassification rules are required' });
    }

    // Build reclassification expression
    const reclassExpr = reclassRules.map(rule => 
      `WHEN ${rule.min} <= val AND val < ${rule.max} THEN ${rule.newValue}`
    ).join(' ');

    const query = `
      WITH source_raster AS (
        SELECT raster_data
        FROM raster_files
        WHERE id = $1
      ),
      reclassified AS (
        SELECT 
          ST_Reclass(
            raster_data,
            1,
            'CASE ${reclassExpr} ELSE 0 END',
            '32BF',
            0
          ) as reclassed_raster
        FROM source_raster
      )
      SELECT 
        ST_AsBinary(reclassed_raster) as raster_data,
        ST_ValueCount(reclassed_raster) as value_counts
      FROM reclassified;
    `;

    const result = await pool.query(query, [rasterId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Raster not found' });
    }

    const rasterData = result.rows[0].raster_data;
    const base64Raster = rasterData ? rasterData.toString('base64') : null;

    res.json({
      raster_id: rasterId,
      value_counts: result.rows[0].value_counts,
      raster_data: base64Raster
    });
  } catch (error) {
    console.error('Error reclassifying raster:', error);
    res.status(500).json({ error: 'Error reclassifying raster' });
  }
};

// Calculate zonal statistics
const zonalStats = async (req, res) => {
  try {
    const { rasterId, forestId } = req.query;

    if (!rasterId || !forestId) {
      return res.status(400).json({ error: 'Raster ID and forest ID are required' });
    }

    const query = `
      WITH forest AS (
        SELECT geom
        FROM padure
        WHERE id = $1
      ),
      raster AS (
        SELECT raster_data
        FROM raster_files
        WHERE id = $2
      ),
      stats AS (
        SELECT 
          ST_SummaryStats(
            ST_Clip(r.raster_data, f.geom)
          ) as stats
        FROM forest f, raster r
      )
      SELECT 
        (stats).min as min_value,
        (stats).max as max_value,
        (stats).mean as mean_value,
        (stats).stddev as stddev_value,
        (stats).sum as sum_value,
        (stats).count as pixel_count
      FROM stats;
    `;

    const result = await pool.query(query, [forestId, rasterId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Analysis failed - forest unit or raster not found' });
    }

    res.json({
      forest_id: forestId,
      raster_id: rasterId,
      statistics: {
        min_value: result.rows[0].min_value,
        max_value: result.rows[0].max_value,
        mean_value: result.rows[0].mean_value,
        stddev_value: result.rows[0].stddev_value,
        sum_value: result.rows[0].sum_value,
        pixel_count: result.rows[0].pixel_count
      }
    });
  } catch (error) {
    console.error('Error calculating zonal statistics:', error);
    res.status(500).json({ error: 'Error calculating zonal statistics' });
  }
};

// Calculate raster histogram
const rasterHistogram = async (req, res) => {
  try {
    const { rasterId, numBins } = req.query;
    const bins = numBins || 10;

    const query = `
      WITH raster AS (
        SELECT raster_data
        FROM raster_files
        WHERE id = $1
      ),
      stats AS (
        SELECT 
          (ST_SummaryStats(raster_data)).* as stats
        FROM raster
      ),
      histogram AS (
        SELECT 
          width_bucket(
            (ST_PixelAsPoints(raster_data)).val,
            (stats).min,
            (stats).max,
            $2
          ) as bin,
          count(*) as count
        FROM raster, stats
        GROUP BY bin
        ORDER BY bin
      )
      SELECT 
        json_agg(
          json_build_object(
            'bin', bin,
            'count', count,
            'range', json_build_object(
              'min', (stats).min + (bin - 1) * ((stats).max - (stats).min) / $2,
              'max', (stats).min + bin * ((stats).max - (stats).min) / $2
            )
          )
        ) as histogram
      FROM histogram, stats;
    `;

    const result = await pool.query(query, [rasterId, bins]);

    if (!result.rows[0].histogram) {
      return res.status(404).json({ error: 'Raster not found' });
    }

    res.json({
      raster_id: rasterId,
      num_bins: bins,
      histogram: result.rows[0].histogram
    });
  } catch (error) {
    console.error('Error calculating raster histogram:', error);
    res.status(500).json({ error: 'Error calculating raster histogram' });
  }
};

module.exports = {
  uploadRaster,
  getRasterInBbox,
  getRasterList,
  deleteRaster,
  resampleRaster,
  reclassifyRaster,
  zonalStats,
  rasterHistogram
}; 