import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Divider,
  Alert,
  Card,
  CardContent,
  CardHeader,
  IconButton,
} from '@mui/material';
import {
  Lock,
  Security,
  Settings as SettingsIcon,
  TrendingUp,
  PlayArrow,
  Pause,
  Logout,
} from '@mui/icons-material';
import axios from 'axios';
import config from '../config';
import Login from '../components/Login';
import { validateSession, destroySession } from '../utils/auth';

function UserArea() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [isTrading, setIsTrading] = useState(false);
  const [autoTradingEnabled, setAutoTradingEnabled] = useState(false);
  const [settings, setSettings] = useState({
    trading_pair: 'BTC/USDT',
    timeframe: '1m',
    initial_balance: 1000,
    max_position_size: 0.1,
    stop_loss_percentage: 2,
    take_profit_percentage: 4,
    enable_indicators: true,
    rsi_period: 14,
    rsi_overbought: 70,
    rsi_oversold: 30,
    macd_fast: 12,
    macd_slow: 26,
    macd_signal: 9,
  });

  // Check authentication on component mount
  useEffect(() => {
    const checkAuth = () => {
      if (validateSession()) {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
    };

    checkAuth();
  }, []);

  // Fetch settings when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchSettings();
      fetchAutoTradingStatus();
    }
  }, [isAuthenticated]);

  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${config.API_URL}/api/settings`);
      setSettings(response.data);
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const fetchAutoTradingStatus = async () => {
    try {
      const response = await axios.get(`${config.API_URL}/api/auto-trading-status`);
      setAutoTradingEnabled(response.data.auto_trading_enabled);
    } catch (error) {
      console.error('Error fetching auto trading status:', error);
    }
  };

  const handleLogin = (authenticated) => {
    setIsAuthenticated(authenticated);
  };

  const handleLogout = () => {
    destroySession();
    setIsAuthenticated(false);
    setApiKey('');
    setApiSecret('');
  };

  const handleSettingsChange = (event) => {
    const { name, value, checked } = event.target;
    setSettings(prev => ({
      ...prev,
      [name]: event.target.type === 'checkbox' ? checked : value,
    }));
  };

  const handleSaveSettings = async () => {
    try {
      await axios.post(`${config.API_URL}/api/settings`, settings);
      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Error saving settings. Please try again.');
    }
  };

  const handleStartTrading = async () => {
    try {
      await axios.post(`${config.API_URL}/api/start-trading`, {
        api_key: apiKey,
        api_secret: apiSecret
      });
      setIsTrading(true);
      alert('Trading started successfully!');
    } catch (error) {
      console.error('Error starting trading:', error);
      alert(`Error starting trading: ${error.message}`);
    }
  };

  const handleStopTrading = async () => {
    try {
      await axios.post(`${config.API_URL}/api/stop-trading`);
      setIsTrading(false);
      alert('Trading stopped!');
    } catch (error) {
      console.error('Error stopping trading:', error);
      alert(`Error stopping trading: ${error.message}`);
    }
  };

  const handleStartAutoTrading = async () => {
    try {
      await axios.post(`${config.API_URL}/api/start-auto-trading`);
      setAutoTradingEnabled(true);
      alert('Auto trading started!');
    } catch (error) {
      console.error('Error starting auto trading:', error);
      alert(`Error starting auto trading: ${error.message}`);
    }
  };

  const handlePauseAutoTrading = async () => {
    try {
      await axios.post(`${config.API_URL}/api/pause-auto-trading`);
      setAutoTradingEnabled(false);
      alert('Auto trading paused!');
    } catch (error) {
      console.error('Error pausing auto trading:', error);
      alert(`Error pausing auto trading: ${error.message}`);
    }
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Security sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h4" component="h1">
            User Area
          </Typography>
          <Typography variant="caption" color="textSecondary">
            Admin Access Only
          </Typography>
        </Box>
        <Button
          variant="outlined"
          color="error"
          startIcon={<Logout />}
          onClick={handleLogout}
        >
          Logout
        </Button>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          🔐 <strong>Secure Area:</strong> This page contains sensitive trading configuration. 
          Only administrators should have access to API keys and trading controls.
        </Typography>
      </Alert>

      <Grid container spacing={3}>
        {/* API Configuration */}
        <Grid item xs={12}>
          <Card>
            <CardHeader
              avatar={<Lock />}
              title="API Configuration"
              subheader="MEXC Exchange API Credentials"
              sx={{ backgroundColor: 'primary.main', color: 'primary.contrastText' }}
            />
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="API Key"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    type="password"
                    placeholder="Enter your MEXC API Key"
                    helperText="Keep this secure and never share it"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="API Secret"
                    value={apiSecret}
                    onChange={(e) => setApiSecret(e.target.value)}
                    type="password"
                    placeholder="Enter your MEXC API Secret"
                    helperText="This will be encrypted and stored securely"
                  />
                </Grid>
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button
                      variant="contained"
                      color={isTrading ? "error" : "success"}
                      onClick={isTrading ? handleStopTrading : handleStartTrading}
                      startIcon={<TrendingUp />}
                      disabled={!apiKey || !apiSecret}
                    >
                      {isTrading ? "Stop Trading" : "Start Trading"}
                    </Button>
                    <Typography variant="body2" color="textSecondary" sx={{ alignSelf: 'center' }}>
                      Status: {isTrading ? 
                        <span style={{ color: '#4caf50', fontWeight: 'bold' }}>🟢 Active</span> : 
                        <span style={{ color: '#f44336', fontWeight: 'bold' }}>⏸️ Inactive</span>
                      }
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Auto Trading Controls */}
        <Grid item xs={12}>
          <Card>
            <CardHeader
              avatar={<PlayArrow />}
              title="Auto Trading Controls"
              subheader="Automated trading based on AI analysis"
              sx={{ backgroundColor: 'success.main', color: 'success.contrastText' }}
            />
            <CardContent>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" gutterBottom>
                    Auto Trading Status
                  </Typography>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    {autoTradingEnabled ? 
                      <span style={{ color: '#4caf50', fontWeight: 'bold' }}>🟢 Active - AI is making trades</span> : 
                      <span style={{ color: '#f44336', fontWeight: 'bold' }}>⏸️ Paused - Manual control only</span>
                    }
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      variant="contained"
                      color="success"
                      onClick={handleStartAutoTrading}
                      disabled={autoTradingEnabled || !isTrading}
                      startIcon={<PlayArrow />}
                      sx={{ flex: 1 }}
                    >
                      Start Auto Trading
                    </Button>
                    <Button
                      variant="contained"
                      color="warning"
                      onClick={handlePauseAutoTrading}
                      disabled={!autoTradingEnabled}
                      startIcon={<Pause />}
                      sx={{ flex: 1 }}
                    >
                      Pause Auto Trading
                    </Button>
                  </Box>
                  {!isTrading && (
                    <Typography variant="caption" color="error" display="block" sx={{ mt: 1 }}>
                      Start manual trading first before enabling auto trading
                    </Typography>
                  )}
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Trading Settings */}
        <Grid item xs={12}>
          <Card>
            <CardHeader
              avatar={<SettingsIcon />}
              title="Trading Settings"
              subheader="Configure trading parameters and indicators"
              sx={{ backgroundColor: 'secondary.main', color: 'secondary.contrastText' }}
            />
            <CardContent>
              <Grid container spacing={3}>
                {/* Basic Settings */}
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>
                    Basic Settings
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Trading Pair"
                    name="trading_pair"
                    value={settings.trading_pair}
                    onChange={handleSettingsChange}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Timeframe</InputLabel>
                    <Select
                      name="timeframe"
                      value={settings.timeframe}
                      onChange={handleSettingsChange}
                      label="Timeframe"
                    >
                      <MenuItem value="1m">1 Minute</MenuItem>
                      <MenuItem value="5m">5 Minutes</MenuItem>
                      <MenuItem value="15m">15 Minutes</MenuItem>
                      <MenuItem value="1h">1 Hour</MenuItem>
                      <MenuItem value="4h">4 Hours</MenuItem>
                      <MenuItem value="1d">1 Day</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                {/* Trading Parameters */}
                <Grid item xs={12}>
                  <Divider sx={{ mt: 2, mb: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    Trading Parameters
                  </Typography>
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    label="Initial Balance (USDT)"
                    name="initial_balance"
                    type="number"
                    value={settings.initial_balance}
                    onChange={handleSettingsChange}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    label="Max Position Size (BTC)"
                    name="max_position_size"
                    type="number"
                    value={settings.max_position_size}
                    onChange={handleSettingsChange}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    label="Stop Loss (%)"
                    name="stop_loss_percentage"
                    type="number"
                    value={settings.stop_loss_percentage}
                    onChange={handleSettingsChange}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    label="Take Profit (%)"
                    name="take_profit_percentage"
                    type="number"
                    value={settings.take_profit_percentage}
                    onChange={handleSettingsChange}
                  />
                </Grid>

                {/* Technical Indicators */}
                <Grid item xs={12}>
                  <Divider sx={{ mt: 2, mb: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    Technical Indicators
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.enable_indicators}
                        onChange={handleSettingsChange}
                        name="enable_indicators"
                      />
                    }
                    label="Enable Technical Indicators"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="RSI Period"
                    name="rsi_period"
                    type="number"
                    value={settings.rsi_period}
                    onChange={handleSettingsChange}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="RSI Overbought"
                    name="rsi_overbought"
                    type="number"
                    value={settings.rsi_overbought}
                    onChange={handleSettingsChange}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="RSI Oversold"
                    name="rsi_oversold"
                    type="number"
                    value={settings.rsi_oversold}
                    onChange={handleSettingsChange}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="MACD Fast Period"
                    name="macd_fast"
                    type="number"
                    value={settings.macd_fast}
                    onChange={handleSettingsChange}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="MACD Slow Period"
                    name="macd_slow"
                    type="number"
                    value={settings.macd_slow}
                    onChange={handleSettingsChange}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="MACD Signal Period"
                    name="macd_signal"
                    type="number"
                    value={settings.macd_signal}
                    onChange={handleSettingsChange}
                  />
                </Grid>

                {/* Save Button */}
                <Grid item xs={12}>
                  <Divider sx={{ mt: 2, mb: 2 }} />
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleSaveSettings}
                    size="large"
                    sx={{ mt: 2 }}
                  >
                    Save All Settings
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

export default UserArea; 