import React, { useState, useEffect } from 'react';
import { getAllGeostoreData } from '../../services/gfwService';
import { Card, CardContent, Typography, Grid, CircularProgress, Alert } from '@mui/material';
import { format } from 'date-fns';

const GeostoreAnalysis = ({ geostoreId }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await getAllGeostoreData(geostoreId, {
          start_date: format(new Date().setFullYear(new Date().getFullYear() - 1), 'yyyy-MM-dd'),
          end_date: format(new Date(), 'yyyy-MM-dd')
        });
        setData(result);
      } catch (err) {
        setError(err.message || 'Failed to fetch geostore data');
      } finally {
        setLoading(false);
      }
    };

    if (geostoreId) {
      fetchData();
    }
  }, [geostoreId]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
        <CircularProgress />
      </div>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ margin: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!data) {
    return null;
  }

  const { geostore, forest, alerts, analysis } = data;

  return (
    <Grid container spacing={2}>
      {/* Geostore Details */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Geostore Details
            </Typography>
            <Typography variant="body2">
              Area: {(geostore.data?.attributes?.areaHa / 100).toFixed(2)} km²
            </Typography>
            <Typography variant="body2">
              Bounding Box: {geostore.data?.attributes?.bbox?.join(', ')}
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      {/* Forest Data */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Forest Data
            </Typography>
            {forest.data ? (
              <>
                <Typography variant="body2">
                  Tree Cover Loss: {forest.data.attributes?.treeCoverLoss?.toFixed(2)} ha
                </Typography>
                <Typography variant="body2">
                  Tree Cover Gain: {forest.data.attributes?.treeCoverGain?.toFixed(2)} ha
                </Typography>
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No forest data available
              </Typography>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Alerts */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Recent Alerts
            </Typography>
            {alerts.data?.length > 0 ? (
              <>
                <Typography variant="body2">
                  Total Alerts: {alerts.data.length}
                </Typography>
                <Typography variant="body2">
                  Latest Alert: {format(new Date(alerts.data[0].attributes.date), 'PP')}
                </Typography>
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No recent alerts
              </Typography>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Analysis */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Analysis Summary
            </Typography>
            {analysis.data ? (
              <>
                <Typography variant="body2">
                  Total Area Analyzed: {analysis.data.attributes?.totalArea?.toFixed(2)} ha
                </Typography>
                <Typography variant="body2">
                  Forest Cover: {analysis.data.attributes?.forestCover?.toFixed(2)} ha
                </Typography>
                <Typography variant="body2">
                  Deforestation Risk: {analysis.data.attributes?.deforestationRisk || 'N/A'}
                </Typography>
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No analysis data available
              </Typography>
            )}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

export default GeostoreAnalysis; 