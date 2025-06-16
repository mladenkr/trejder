import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  FormControlLabel,
  Switch,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Box,
  Chip,
  Alert,
  Grid,
  Card,
  CardContent
} from '@mui/material';
import { Speed, Timeline, TrendingUp, Wifi, WifiOff } from '@mui/icons-material';
import config from '../config';

const DataFrequencyControl = () => {
  const [settings, setSettings] = useState({
    enable_ticker: true,
    enable_trades: true,
    enable_klines: false,
    kline_interval: '1m'
  });
  
  const [wsStatus, setWsStatus] = useState({
    is_connected: false,
    active_streams: [],
    data_frequencies: {},
    rate_limits: {}
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [liveData, setLiveData] = useState({
    lastPrice: null,
    lastUpdate: null,
    updateCount: 0
  });

  useEffect(() => {
    fetchWebSocketStatus();
    const interval = setInterval(fetchWebSocketStatus, 5000); // Check status every 5 seconds
    
    // Connect to WebSocket for live data updates
          const ws = new WebSocket(`${config.WS_URL}/ws`);
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'price_update' || data.type === 'trade_update') {
          setLiveData(prev => ({
            lastPrice: data.data.price,
            lastUpdate: new Date().toLocaleTimeString(),
            updateCount: prev.updateCount + 1
          }));
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    return () => {
      clearInterval(interval);
      ws.close();
    };
  }, []);

  const fetchWebSocketStatus = async () => {
    try {
      const response = await fetch(`${config.API_URL}/api/websocket-status`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log('WebSocket Status Response:', data);
      setWsStatus(data);
    } catch (error) {
      console.error('Error fetching WebSocket status:', error);
      // Set default disconnected state on error
      setWsStatus({
        is_connected: false,
        active_streams: [],
        data_frequencies: {},
        rate_limits: {}
      });
    }
  };

  const handleSettingChange = (setting, value) => {
    setSettings(prev => ({
      ...prev,
      [setting]: value
    }));
  };

  const applySettings = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${config.API_URL}/api/set-update-frequency`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });
      
      const result = await response.json();
      console.log('Update frequency configured:', result);
      
      // Refresh status after applying settings
      setTimeout(fetchWebSocketStatus, 1000);
      
    } catch (error) {
      console.error('Error setting update frequency:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getConnectionStatusIcon = () => {
    return wsStatus.is_connected ? <Wifi /> : <WifiOff />;
  };

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Speed color="primary" />
        Real-Time Data Frequency Control
      </Typography>

      {/* Connection Status */}
      <Box sx={{ mb: 3 }}>
        <Alert 
          severity={wsStatus.is_connected ? 'success' : 'warning'}
          icon={getConnectionStatusIcon()}
          sx={{ mb: 2 }}
        >
          <Typography variant="body2">
            <strong>WebSocket Status:</strong> {wsStatus.is_connected ? 'Connected' : 'Disconnected'}
            {wsStatus.active_streams.length > 0 && (
              <span> • Active Streams: {wsStatus.active_streams.length}</span>
            )}
          </Typography>
        </Alert>

        {/* Active Streams */}
        {wsStatus.active_streams.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              Active Data Streams:
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {wsStatus.active_streams.map((stream, index) => (
                <Chip 
                  key={index} 
                  label={stream} 
                  size="small" 
                  color="primary" 
                  variant="outlined"
                />
              ))}
            </Box>
          </Box>
        )}
      </Box>

      {/* Data Frequency Information */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card variant="outlined">
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                <Timeline sx={{ fontSize: 16, mr: 0.5 }} />
                Ticker Updates
              </Typography>
              <Typography variant="body2" color="textSecondary">
                ~100ms intervals
              </Typography>
              <Typography variant="caption" color="textSecondary">
                Real-time price changes
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Card variant="outlined">
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="subtitle2" color="success.main" gutterBottom>
                <TrendingUp sx={{ fontSize: 16, mr: 0.5 }} />
                Trade Updates
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Immediate
              </Typography>
              <Typography variant="caption" color="textSecondary">
                Every trade execution
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Card variant="outlined">
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="subtitle2" color="warning.main" gutterBottom>
                <Speed sx={{ fontSize: 16, mr: 0.5 }} />
                Kline Updates
              </Typography>
              <Typography variant="body2" color="textSecondary">
                On candle close
              </Typography>
              <Typography variant="caption" color="textSecondary">
                Complete candle data
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Settings Controls */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          Data Stream Settings
        </Typography>
        
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.enable_ticker}
                  onChange={(e) => handleSettingChange('enable_ticker', e.target.checked)}
                  color="primary"
                />
              }
              label="Enable Ticker Updates (~100ms)"
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.enable_trades}
                  onChange={(e) => handleSettingChange('enable_trades', e.target.checked)}
                  color="success"
                />
              }
              label="Enable Trade Updates (Immediate)"
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.enable_klines}
                  onChange={(e) => handleSettingChange('enable_klines', e.target.checked)}
                  color="warning"
                />
              }
              label="Enable Kline Updates"
            />
          </Grid>
          
          {settings.enable_klines && (
            <Grid item xs={12} sm={6}>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Kline Interval</InputLabel>
                <Select
                  value={settings.kline_interval}
                  label="Kline Interval"
                  onChange={(e) => handleSettingChange('kline_interval', e.target.value)}
                >
                  <MenuItem value="1m">1 minute</MenuItem>
                  <MenuItem value="5m">5 minutes</MenuItem>
                  <MenuItem value="15m">15 minutes</MenuItem>
                  <MenuItem value="30m">30 minutes</MenuItem>
                  <MenuItem value="1h">1 hour</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          )}
        </Grid>
      </Box>

      {/* Apply Button */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button
          variant="contained"
          onClick={applySettings}
          disabled={isLoading}
          sx={{ minWidth: 120 }}
        >
          {isLoading ? 'Applying...' : 'Apply Settings'}
        </Button>
        
        <Typography variant="caption" color="textSecondary">
          Changes take effect immediately
        </Typography>
      </Box>

      {/* Live Data Display */}
      {liveData.lastPrice && (
        <Alert severity="success" sx={{ mt: 2 }}>
          <Typography variant="body2">
            <strong>🔴 LIVE DATA:</strong> BTC Price: ${liveData.lastPrice?.toFixed(2)} • 
            Last Update: {liveData.lastUpdate} • 
            Updates Received: {liveData.updateCount}
          </Typography>
        </Alert>
      )}

      {/* Performance Note */}
      <Alert severity="info" sx={{ mt: 2 }}>
        <Typography variant="body2">
          <strong>Performance Note:</strong> Ticker and Trade updates provide the fastest data for short-term trading. 
          WebSocket connections have no rate limits, unlike REST API calls (500 requests per 10 seconds).
        </Typography>
      </Alert>
    </Paper>
  );
};

export default DataFrequencyControl; 