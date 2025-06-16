import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Chip,
  Divider,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  AccountBalance,
  Timeline,
  ShowChart,
} from '@mui/icons-material';
import axios from 'axios';
import config from '../config';

function TradingPerformanceDashboard() {
  const [performanceData, setPerformanceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPerformanceData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${config.API_URL}/api/trading-performance`);
      setPerformanceData(response.data);
      setError(null);
    } catch (error) {
      console.error('Error fetching performance data:', error);
      setError('Failed to fetch performance data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPerformanceData();
    
    // Refresh performance data every 30 seconds
    const interval = setInterval(fetchPerformanceData, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatCurrency = (value) => {
    if (value === null || value === undefined || isNaN(value)) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPercentage = (value) => {
    if (value === null || value === undefined || isNaN(value)) return '0.00%';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  const getPerformanceColor = (percentage) => {
    if (percentage > 0) return 'success.main';
    if (percentage < 0) return 'error.main';
    return 'text.secondary';
  };

  const getPerformanceIcon = (percentage) => {
    if (percentage > 0) return <TrendingUp />;
    if (percentage < 0) return <TrendingDown />;
    return <Timeline />;
  };

  if (loading) {
    return (
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 2 }}>
          <CircularProgress size={24} sx={{ mr: 2 }} />
          <Typography>Loading trading performance...</Typography>
        </Box>
      </Paper>
    );
  }

  if (error) {
    return (
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography color="error" align="center">
          {error}
        </Typography>
      </Paper>
    );
  }

  if (!performanceData) {
    return null;
  }

  const {
    initial_balance,
    current_balance,
    current_price,
    total_trades,
    trading_started,
    performance_24h,
    performance_1w,
    overall_performance,
    trades_24h,
    trades_1w
  } = performanceData;

  return (
    <Paper sx={{ p: 2, mb: 3, backgroundColor: 'background.paper' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <ShowChart sx={{ mr: 1, color: 'primary.main' }} />
        <Typography variant="h6" component="h2">
          Trading Performance Dashboard
        </Typography>
        <Chip 
          label={trading_started ? "ACTIVE" : "INACTIVE"} 
          color={trading_started ? "success" : "default"}
          size="small"
          sx={{ ml: 2 }}
        />
      </Box>

      <Grid container spacing={2}>
        {/* Balance Information */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <AccountBalance sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="subtitle1" fontWeight="bold">
                  Account Balance
                </Typography>
              </Box>
              <Typography variant="h4" color="primary.main" gutterBottom>
                {formatCurrency(current_balance)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Initial: {formatCurrency(initial_balance)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Current BTC Price: {formatCurrency(current_price)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Performance Metrics */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Performance Metrics
              </Typography>
              
              {/* 24h Performance */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  {getPerformanceIcon(performance_24h)}
                  <Typography variant="body2" sx={{ ml: 1 }}>
                    24h Performance
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography 
                    variant="body1" 
                    fontWeight="bold"
                    color={getPerformanceColor(performance_24h)}
                  >
                    {formatPercentage(performance_24h)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {trades_24h} trades
                  </Typography>
                </Box>
              </Box>

              <Divider sx={{ my: 1 }} />

              {/* 1 Week Performance */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  {getPerformanceIcon(performance_1w)}
                  <Typography variant="body2" sx={{ ml: 1 }}>
                    1 Week Performance
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography 
                    variant="body1" 
                    fontWeight="bold"
                    color={getPerformanceColor(performance_1w)}
                  >
                    {formatPercentage(performance_1w)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {trades_1w} trades
                  </Typography>
                </Box>
              </Box>

              <Divider sx={{ my: 1 }} />

              {/* Overall Performance */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  {getPerformanceIcon(overall_performance)}
                  <Typography variant="body2" sx={{ ml: 1 }}>
                    Overall Performance
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography 
                    variant="body1" 
                    fontWeight="bold"
                    color={getPerformanceColor(overall_performance)}
                  >
                    {formatPercentage(overall_performance)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {total_trades} total trades
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Additional Info */}
      {trading_started && (
        <Box sx={{ mt: 2, p: 1, backgroundColor: 'action.hover', borderRadius: 1 }}>
          <Typography variant="caption" color="text.secondary" align="center" display="block">
            💡 Performance metrics are calculated from actual trading history and updated in real-time
          </Typography>
        </Box>
      )}
      
      {!trading_started && (
        <Box sx={{ mt: 2, p: 1, backgroundColor: 'warning.light', borderRadius: 1 }}>
          <Typography variant="caption" color="warning.dark" align="center" display="block">
            ⚠️ Trading is not active. Start trading in User Area to see performance metrics
          </Typography>
        </Box>
      )}
    </Paper>
  );
}

export default TradingPerformanceDashboard; 