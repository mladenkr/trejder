import React, { useState, useEffect } from 'react';
import {
  FormControl,
  Autocomplete,
  TextField,
  Box,
  Typography,
  CircularProgress,
  Chip,
} from '@mui/material';
import { TrendingUp } from '@mui/icons-material';
import mexcApiService from '../services/mexcApi';

function TradingPairSelector({ value, onChange, disabled = false }) {
  const [tradingPairs, setTradingPairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTradingPairs();
  }, []);

  const fetchTradingPairs = async () => {
    setLoading(true);
    setError(null);
    
    try {
                  const pairs = await mexcApiService.fetchUSDCTradingPairs();
      setTradingPairs(pairs);
      
      if (pairs.length > 0) {
        console.log(`Loaded ${pairs.length} USDC trading pairs from MEXC`);
      }
    } catch (error) {
      console.error('Error fetching trading pairs:', error);
      setError('Failed to load trading pairs');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (event, newValue) => {
    if (newValue) {
      onChange(newValue.symbol);
    }
  };

  // Find the selected option object
  const selectedOption = tradingPairs.find(pair => pair.symbol === value) || null;

  return (
    <FormControl fullWidth>
      <Autocomplete
        value={selectedOption}
        onChange={handleChange}
        options={tradingPairs}
        getOptionLabel={(option) => option.symbol || ''}
        isOptionEqualToValue={(option, value) => option.symbol === value?.symbol}
        loading={loading}
        disabled={disabled}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Trading Pair"
            placeholder="Search for trading pair..."
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {loading ? <CircularProgress color="inherit" size={20} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
            helperText={
              error ? error : 
              loading ? "Loading trading pairs..." :
                                  `${tradingPairs.length} USDC pairs available`
            }
            error={!!error}
          />
        )}
        renderOption={(props, option) => (
          <Box component="li" {...props}>
            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              <TrendingUp sx={{ mr: 1, color: 'primary.main', fontSize: 16 }} />
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="body2" fontWeight="bold">
                  {option.symbol}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  {option.baseAsset} / {option.quoteAsset}
                </Typography>
              </Box>
                              {option.symbol === 'BTCUSDC' && (
                <Chip 
                  label="Popular" 
                  size="small" 
                  color="primary" 
                  variant="outlined"
                />
              )}
            </Box>
          </Box>
        )}
        filterOptions={(options, { inputValue }) => {
          // Custom filtering for better search experience
          const filtered = options.filter((option) => {
            const searchTerm = inputValue.toLowerCase();
            return (
              option.symbol.toLowerCase().includes(searchTerm) ||
              option.baseAsset.toLowerCase().includes(searchTerm)
            );
          });
          
          // Sort with exact matches first, then BTC, ETH, and popular coins
          return filtered.sort((a, b) => {
            const searchTerm = inputValue.toLowerCase();
            
            // Exact matches first
            if (a.symbol.toLowerCase() === searchTerm) return -1;
            if (b.symbol.toLowerCase() === searchTerm) return 1;
            
            // BTC and ETH first
            if (a.baseAsset === 'BTC' && b.baseAsset !== 'BTC') return -1;
            if (b.baseAsset === 'BTC' && a.baseAsset !== 'BTC') return 1;
            if (a.baseAsset === 'ETH' && b.baseAsset !== 'ETH') return -1;
            if (b.baseAsset === 'ETH' && a.baseAsset !== 'ETH') return 1;
            
            // Alphabetical order
            return a.symbol.localeCompare(b.symbol);
          });
        }}
        noOptionsText={
          loading ? "Loading..." : 
          error ? "Error loading pairs" :
          "No trading pairs found"
        }
        sx={{
          '& .MuiAutocomplete-option': {
            '&:hover': {
              backgroundColor: 'action.hover',
            },
          },
        }}
      />
    </FormControl>
  );
}

export default TradingPairSelector; 