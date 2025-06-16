import React, { useState } from 'react';
import {
  Box,
  Button,
  Menu,
  MenuItem,
  ListItemText,
  Checkbox,
  Divider,
} from '@mui/material';
import { ShowChart, ExpandMore } from '@mui/icons-material';

function ChartIndicators({ onIndicatorToggle, activeIndicators = [] }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const indicators = [
    // Moving Averages
    { id: 'sma20', name: 'SMA (20)', color: '#2196F3', category: 'Moving Averages' },
    { id: 'sma50', name: 'SMA (50)', color: '#4CAF50', category: 'Moving Averages' },
    { id: 'sma100', name: 'SMA (100)', color: '#795548', category: 'Moving Averages' },
    { id: 'sma200', name: 'SMA (200)', color: '#607D8B', category: 'Moving Averages' },
    { id: 'ema12', name: 'EMA (12)', color: '#FF9800', category: 'Moving Averages' },
    { id: 'ema26', name: 'EMA (26)', color: '#FF5722', category: 'Moving Averages' },
    { id: 'ema50', name: 'EMA (50)', color: '#E91E63', category: 'Moving Averages' },
    { id: 'wma20', name: 'WMA (20)', color: '#9C27B0', category: 'Moving Averages' },
    
    // Bands & Envelopes
    { id: 'bollinger', name: 'Bollinger Bands', color: '#673AB7', category: 'Bands' },
    { id: 'keltner', name: 'Keltner Channel', color: '#3F51B5', category: 'Bands' },
    { id: 'donchian', name: 'Donchian Channel', color: '#2196F3', category: 'Bands' },
    
    // Oscillators
    { id: 'rsi', name: 'RSI (14)', color: '#F44336', category: 'Oscillators' },
    { id: 'stochastic', name: 'Stochastic %K', color: '#E91E63', category: 'Oscillators' },
    { id: 'williams', name: 'Williams %R', color: '#9C27B0', category: 'Oscillators' },
    { id: 'cci', name: 'CCI (20)', color: '#673AB7', category: 'Oscillators' },
    { id: 'roc', name: 'Rate of Change', color: '#3F51B5', category: 'Oscillators' },
    
    // Trend Indicators
    { id: 'macd', name: 'MACD', color: '#00BCD4', category: 'Trend' },
    { id: 'adx', name: 'ADX (14)', color: '#009688', category: 'Trend' },
    { id: 'parabolic', name: 'Parabolic SAR', color: '#4CAF50', category: 'Trend' },
    { id: 'ichimoku', name: 'Ichimoku Cloud', color: '#8BC34A', category: 'Trend' },
    
    // Volume Indicators
    { id: 'obv', name: 'On Balance Volume', color: '#CDDC39', category: 'Volume' },
    { id: 'mfi', name: 'Money Flow Index', color: '#FFC107', category: 'Volume' },
    { id: 'vwap', name: 'VWAP', color: '#FF9800', category: 'Volume' },
  ];

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleIndicatorClick = (indicatorId) => {
    onIndicatorToggle(indicatorId);
  };

  return (
    <Box>
      <Button
        size="small"
        variant="outlined"
        onClick={handleClick}
        startIcon={<ShowChart />}
        endIcon={<ExpandMore />}
      >
        Indicators ({activeIndicators.length})
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        PaperProps={{
          style: {
            maxHeight: 300,
            width: '250px',
          },
        }}
      >
        <MenuItem disabled>
          <ListItemText primary="Technical Indicators" />
        </MenuItem>
        <Divider />
        {['Moving Averages', 'Bands', 'Oscillators', 'Trend', 'Volume'].map(category => (
          <React.Fragment key={category}>
            <MenuItem disabled>
              <ListItemText 
                primary={category} 
                primaryTypographyProps={{ 
                  variant: 'caption', 
                  color: 'textSecondary',
                  fontWeight: 'bold'
                }} 
              />
            </MenuItem>
            {indicators
              .filter(indicator => indicator.category === category)
              .map((indicator) => (
                <MenuItem
                  key={indicator.id}
                  onClick={() => handleIndicatorClick(indicator.id)}
                  sx={{ pl: 3 }}
                >
                  <Checkbox
                    checked={activeIndicators.includes(indicator.id)}
                    size="small"
                  />
                  <ListItemText primary={indicator.name} />
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      backgroundColor: indicator.color,
                      borderRadius: '50%',
                      ml: 1,
                    }}
                  />
                </MenuItem>
              ))}
            {category !== 'Volume' && <Divider />}
          </React.Fragment>
        ))}
      </Menu>
    </Box>
  );
}

export default ChartIndicators; 