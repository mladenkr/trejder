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
  CircularProgress,
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
import TradingPairSelector from '../components/TradingPairSelector';
import { validateSession, destroySession, saveApiCredentials, loadApiCredentials, clearApiCredentials } from '../utils/auth';
import mexcApiService from '../services/mexcApi';

function UserArea() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [isTrading, setIsTrading] = useState(false);
  const [autoTradingEnabled, setAutoTradingEnabled] = useState(false);
  const [accountBalance, setAccountBalance] = useState({
    usdtBalance: 0,
    loading: false,
    error: null
  });
  const [settings, setSettings] = useState({
    trading_pair: 'BTCUSDT',
    timeframe: '1m',
    balance_percentage: 50, // % of balance to use for trading
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

  // Fetch settings and load API credentials when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchSettings();
      fetchAutoTradingStatus();
      
      // Load saved API credentials
      const savedCredentials = loadApiCredentials();
      if (savedCredentials) {
        setApiKey(savedCredentials.apiKey);
        setApiSecret(savedCredentials.apiSecret);
      }
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
    clearApiCredentials();
    setIsAuthenticated(false);
    setApiKey('');
    setApiSecret('');
    setAccountBalance({ usdtBalance: 0, loading: false, error: null });
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

  const fetchAccountBalance = async () => {
    if (!apiKey || !apiSecret) {
      setAccountBalance({
        usdtBalance: 0,
        loading: false,
        error: 'API credentials required'
      });
      return;
    }

    setAccountBalance(prev => ({ ...prev, loading: true, error: null }));

    try {
      const result = await mexcApiService.fetchAccountBalance(apiKey, apiSecret);
      
      if (result.success) {
        setAccountBalance({
          usdtBalance: result.usdtBalance,
          loading: false,
          error: null
        });
        
        // Save API credentials when successfully validated
        if (apiKey && apiSecret) {
          saveApiCredentials(apiKey, apiSecret);
        }
      } else {
        setAccountBalance({
          usdtBalance: 0,
          loading: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Error fetching balance:', error);
      setAccountBalance({
        usdtBalance: 0,
        loading: false,
        error: 'Failed to fetch balance'
      });
    }
  };

  // Fetch balance when API keys change
  useEffect(() => {
    if (apiKey && apiSecret) {
      fetchAccountBalance();
    }
  }, [apiKey, apiSecret]);

  const handleStartTrading = async () => {
    try {
      await axios.post(`${config.API_URL}/api/start-trading`, {
        api_key: apiKey,
        api_secret: apiSecret,
        trading_pair: settings.trading_pair,
        balance_percentage: settings.balance_percentage
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
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Button
                      variant="contained"
                      color={isTrading ? "error" : "success"}
                      onClick={isTrading ? handleStopTrading : handleStartTrading}
                      startIcon={<TrendingUp />}
                      disabled={!apiKey || !apiSecret}
                    >
                      {isTrading ? "Stop Trading" : "Start Trading"}
                    </Button>
                    {(apiKey || apiSecret) && (
                      <Button
                        variant="outlined"
                        color="warning"
                        onClick={() => {
                          clearApiCredentials();
                          setApiKey('');
                          setApiSecret('');
                          setAccountBalance({ usdtBalance: 0, loading: false, error: null });
                        }}
                        size="small"
                      >
                        Clear API Keys
                      </Button>
                    )}
                    <Typography variant="body2" color="textSecondary" sx={{ alignSelf: 'center' }}>
                      Status: {isTrading ? 
                        <span style={{ color: '#4caf50', fontWeight: 'bold' }}>🟢 Active</span> : 
                        <span style={{ color: '#f44336', fontWeight: 'bold' }}>⏸️ Inactive</span>
                      }
                    </Typography>
                  </Box>
                  {(apiKey && apiSecret) && (
                    <Typography variant="caption" color="success.main" sx={{ mt: 1, display: 'block' }}>
                      ✓ API credentials are saved and will persist across page refreshes
                    </Typography>
                  )}
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
                   <TradingPairSelector
                     value={settings.trading_pair}
                     onChange={(newValue) => handleSettingsChange({ target: { name: 'trading_pair', value: newValue } })}
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
                 <Grid item xs={12} md={6}>
                   <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                     <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                       <Typography variant="subtitle2">
                         Account Balance (USDT)
                       </Typography>
                       {apiKey && apiSecret && (
                         <Button
                           size="small"
                           onClick={fetchAccountBalance}
                           disabled={accountBalance.loading}
                           variant="outlined"
                         >
                           Refresh
                         </Button>
                       )}
                     </Box>
                     {accountBalance.loading ? (
                       <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                         <CircularProgress size={16} />
                         <Typography variant="body2" color="textSecondary">
                           Fetching balance...
                         </Typography>
                       </Box>
                     ) : accountBalance.error ? (
                       <Typography variant="body2" color="error">
                         {accountBalance.error}
                       </Typography>
                     ) : (
                       <Typography variant="h6" color="success.main">
                         ${accountBalance.usdtBalance.toFixed(2)}
                       </Typography>
                     )}
                     {!apiKey && (
                       <Typography variant="caption" color="textSecondary">
                         Enter API keys to fetch real balance
                       </Typography>
                     )}
                   </Box>
                 </Grid>
                 <Grid item xs={12} md={6}>
                   <TextField
                     fullWidth
                     label="Balance Usage (%)"
                     name="balance_percentage"
                     type="number"
                     value={settings.balance_percentage}
                     onChange={handleSettingsChange}
                     inputProps={{ min: 1, max: 100 }}
                     helperText={`Using ${settings.balance_percentage}% of account balance for trading${accountBalance.usdtBalance > 0 ? ` (~$${(accountBalance.usdtBalance * settings.balance_percentage / 100).toFixed(2)})` : ''}`}
                   />
                 </Grid>

                 {/* Trading Strategy Explanation */}
                 <Grid item xs={12}>
                   <Alert severity="info" sx={{ mt: 2 }}>
                     <Typography variant="body2" gutterBottom>
                       <strong>📈 Auto Trading Strategy:</strong>
                     </Typography>
                     <Typography variant="body2">
                       • <strong>LONG Signal</strong>: Bot buys and holds the selected crypto with specified % of USDT balance<br/>
                       • <strong>EXIT Signal</strong>: Bot sells all crypto back to USDT<br/>
                       • <strong>Continuous</strong>: Process repeats automatically based on AI analysis<br/>
                       • <strong>No Stop Loss/Take Profit</strong>: Strategy relies purely on AI signals for entry/exit
                     </Typography>
                   </Alert>
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