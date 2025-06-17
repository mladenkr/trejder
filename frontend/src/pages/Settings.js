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
} from '@mui/material';
import axios from 'axios';
import config from '../config';

function Settings() {
  const [settings, setSettings] = useState({
            trading_pair: 'BTC/USDC',
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

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await axios.get(`${config.API_URL}/api/settings`);
        setSettings(response.data);
      } catch (error) {
        console.error('Error fetching settings:', error);
      }
    };

    fetchSettings();
  }, []);

  const handleChange = (event) => {
    const { name, value, checked } = event.target;
    setSettings(prev => ({
      ...prev,
      [name]: event.target.type === 'checkbox' ? checked : value,
    }));
  };

  const handleSave = async () => {
    try {
      await axios.post(`${config.API_URL}/api/settings`, settings);
      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Error saving settings. Please try again.');
    }
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Trading Settings
      </Typography>

      <Paper sx={{ p: 3 }}>
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
              onChange={handleChange}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Timeframe</InputLabel>
              <Select
                name="timeframe"
                value={settings.timeframe}
                onChange={handleChange}
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
            <Typography variant="h6" gutterBottom>
              Trading Parameters
            </Typography>
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
                                      label="Initial Balance (USDC)"
              name="initial_balance"
              type="number"
              value={settings.initial_balance}
              onChange={handleChange}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Max Position Size (BTC)"
              name="max_position_size"
              type="number"
              value={settings.max_position_size}
              onChange={handleChange}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Stop Loss (%)"
              name="stop_loss_percentage"
              type="number"
              value={settings.stop_loss_percentage}
              onChange={handleChange}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Take Profit (%)"
              name="take_profit_percentage"
              type="number"
              value={settings.take_profit_percentage}
              onChange={handleChange}
            />
          </Grid>

          {/* Technical Indicators */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Technical Indicators
            </Typography>
          </Grid>
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.enable_indicators}
                  onChange={handleChange}
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
              onChange={handleChange}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="RSI Overbought"
              name="rsi_overbought"
              type="number"
              value={settings.rsi_overbought}
              onChange={handleChange}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="RSI Oversold"
              name="rsi_oversold"
              type="number"
              value={settings.rsi_oversold}
              onChange={handleChange}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="MACD Fast Period"
              name="macd_fast"
              type="number"
              value={settings.macd_fast}
              onChange={handleChange}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="MACD Slow Period"
              name="macd_slow"
              type="number"
              value={settings.macd_slow}
              onChange={handleChange}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="MACD Signal Period"
              name="macd_signal"
              type="number"
              value={settings.macd_signal}
              onChange={handleChange}
            />
          </Grid>

          {/* Save Button */}
          <Grid item xs={12}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleSave}
              sx={{ mt: 2 }}
            >
              Save Settings
            </Button>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
}

export default Settings; 