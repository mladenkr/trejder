import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  Clear,
  Timeline,
} from '@mui/icons-material';
import { createChart } from 'lightweight-charts';
import axios from 'axios';
import { format } from 'date-fns';
import ChartIndicators from '../components/ChartIndicators';
import AIAnalysisConsole from '../components/AIAnalysisConsole';
import DataFrequencyControl from '../components/DataFrequencyControl';
import TradingPerformanceDashboard from '../components/TradingPerformanceDashboard';
import config from '../config';

function Dashboard() {
  const [logs, setLogs] = useState([]);
  const [selectedInterval, setSelectedInterval] = useState('15m');
  const [activeIndicators, setActiveIndicators] = useState([]);
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const indicatorSeriesRef = useRef({});
  const [tradeHistory, setTradeHistory] = useState([]);

  // Initialize chart only once
  useEffect(() => {
    if (chartContainerRef.current && !chartRef.current) {
      const chart = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height: 500,
        layout: {
          background: { color: '#1e222d' },
          textColor: '#d1d4dc',
        },
        grid: {
          vertLines: { color: '#2B2B43' },
          horzLines: { color: '#2B2B43' },
        },
        timeScale: {
          timeVisible: true,
          secondsVisible: true,
        },
      });

      const candlestickSeries = chart.addCandlestickSeries({
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: false,
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
      });
      
      chartRef.current = { chart, candlestickSeries };

      // Handle resize
      const handleResize = () => {
        if (chartContainerRef.current) {
          chart.applyOptions({
            width: chartContainerRef.current.clientWidth,
          });
        }
      };

      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        if (chart) {
          chart.remove();
        }
      };
    }
  }, []);

  // Fetch trade history
  const fetchTradeHistory = async () => {
    try {
      const response = await axios.get(`${config.API_URL}/api/trading-history`);
      if (response.data && Array.isArray(response.data)) {
        setTradeHistory(response.data);
      }
    } catch (error) {
      console.error('Error fetching trade history:', error);
    }
  };

  // Add trading markers to chart
  const addTradingMarkers = () => {
    if (!chartRef.current || !tradeHistory.length) return;

    const markers = tradeHistory.map(trade => {
      const timestamp = new Date(trade.timestamp).getTime() / 1000;
      return {
        time: timestamp,
        position: trade.type === 'BUY' ? 'belowBar' : 'aboveBar',
        color: trade.type === 'BUY' ? '#26a69a' : '#ef5350',
        shape: 'circle',
        text: trade.type.charAt(0), // 'B' for BUY, 'S' for SELL
        size: 1.5,
      };
    });

    chartRef.current.candlestickSeries.setMarkers(markers);
  };

  // Fetch data when interval changes
  useEffect(() => {
    const fetchChartData = async () => {
      if (!chartRef.current) return;
      
      try {
        addLog(`Fetching ${selectedInterval} chart data...`);
        const response = await axios.get(`${config.API_URL}/api/klines?interval=${selectedInterval}&limit=200`);
        console.log('Chart data response:', response.data);
        
        if (response.data && response.data.data && Array.isArray(response.data.data)) {
          chartRef.current.candlestickSeries.setData(response.data.data);
          addLog(`Chart updated with ${response.data.data.length} ${selectedInterval} candles`);
          
          // Add trading markers after chart data is loaded
          addTradingMarkers();
        } else {
          addLog(`No chart data received for ${selectedInterval}`);
        }
      } catch (error) {
        console.error('Error fetching chart data:', error);
        addLog(`Error loading chart data: ${error.message}`);
      }
    };

    fetchChartData();
    fetchTradeHistory();
  }, [selectedInterval]);

  // Update markers when trade history changes
  useEffect(() => {
    addTradingMarkers();
  }, [tradeHistory]);

  // Periodically refresh trade history to catch new trades
  useEffect(() => {
    const interval = setInterval(() => {
      fetchTradeHistory();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, []);

  // Helper functions for indicator calculations (defined early to avoid hoisting issues)
  const calculateSMA = (data, period) => {
    const result = [];
    for (let i = period - 1; i < data.length; i++) {
      const sum = data.slice(i - period + 1, i + 1).reduce((acc, candle) => acc + candle.close, 0);
      result.push({ time: data[i].time, value: sum / period });
    }
    return result;
  };

  const calculateEMA = (data, period) => {
    const result = [];
    const multiplier = 2 / (period + 1);
    let ema = data[0].close;
    
    for (let i = 0; i < data.length; i++) {
      if (i === 0) {
        ema = data[i].close;
      } else {
        ema = (data[i].close * multiplier) + (ema * (1 - multiplier));
      }
      result.push({ time: data[i].time, value: ema });
    }
    return result;
  };

  const calculateWMA = (data, period) => {
    const result = [];
    for (let i = period - 1; i < data.length; i++) {
      let weightedSum = 0;
      let weightSum = 0;
      for (let j = 0; j < period; j++) {
        const weight = period - j;
        weightedSum += data[i - j].close * weight;
        weightSum += weight;
      }
      result.push({ time: data[i].time, value: weightedSum / weightSum });
    }
    return result;
  };

  const calculateRSI = (data, period) => {
    const result = [];
    const gains = [];
    const losses = [];

    for (let i = 1; i < data.length; i++) {
      const change = data[i].close - data[i - 1].close;
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }

    for (let i = period - 1; i < gains.length; i++) {
      const avgGain = gains.slice(i - period + 1, i + 1).reduce((a, b) => a + b) / period;
      const avgLoss = losses.slice(i - period + 1, i + 1).reduce((a, b) => a + b) / period;
      const rs = avgGain / avgLoss;
      const rsi = 100 - (100 / (1 + rs));
      result.push({ time: data[i + 1].time, value: rsi });
    }
    return result;
  };

  const calculateMACD = (data, fastPeriod, slowPeriod, signalPeriod) => {
    const fastEMA = calculateEMA(data, fastPeriod);
    const slowEMA = calculateEMA(data, slowPeriod);
    const macdLine = [];

    for (let i = 0; i < Math.min(fastEMA.length, slowEMA.length); i++) {
      macdLine.push({
        time: fastEMA[i].time,
        value: fastEMA[i].value - slowEMA[i].value
      });
    }

    return macdLine;
  };

  const calculateBollingerBands = (data, period, stdDev) => {
    const sma = calculateSMA(data, period);
    const result = [];

    for (let i = 0; i < sma.length; i++) {
      const dataIndex = i + period - 1;
      const slice = data.slice(dataIndex - period + 1, dataIndex + 1);
      const variance = slice.reduce((acc, candle) => acc + Math.pow(candle.close - sma[i].value, 2), 0) / period;
      const standardDeviation = Math.sqrt(variance);
      
      result.push({
        time: sma[i].time,
        upper: sma[i].value + (standardDeviation * stdDev),
        middle: sma[i].value,
        lower: sma[i].value - (standardDeviation * stdDev)
      });
    }
    return result;
  };

  const calculateStochastic = (data, kPeriod, dPeriod) => {
    const result = [];
    
    for (let i = kPeriod - 1; i < data.length; i++) {
      const slice = data.slice(i - kPeriod + 1, i + 1);
      const highest = Math.max(...slice.map(d => d.high));
      const lowest = Math.min(...slice.map(d => d.low));
      const k = ((data[i].close - lowest) / (highest - lowest)) * 100;
      result.push({ time: data[i].time, value: k });
    }
    return result;
  };

  const calculateWilliamsR = (data, period) => {
    const result = [];
    
    for (let i = period - 1; i < data.length; i++) {
      const slice = data.slice(i - period + 1, i + 1);
      const highest = Math.max(...slice.map(d => d.high));
      const lowest = Math.min(...slice.map(d => d.low));
      const wr = ((highest - data[i].close) / (highest - lowest)) * -100;
      result.push({ time: data[i].time, value: wr });
    }
    return result;
  };

  const calculateCCI = (data, period) => {
    const result = [];
    
    for (let i = period - 1; i < data.length; i++) {
      const slice = data.slice(i - period + 1, i + 1);
      const typicalPrices = slice.map(d => (d.high + d.low + d.close) / 3);
      const sma = typicalPrices.reduce((a, b) => a + b) / period;
      const meanDeviation = typicalPrices.reduce((acc, tp) => acc + Math.abs(tp - sma), 0) / period;
      const cci = (typicalPrices[typicalPrices.length - 1] - sma) / (0.015 * meanDeviation);
      result.push({ time: data[i].time, value: cci });
    }
    return result;
  };

  const calculateROC = (data, period) => {
    const result = [];
    
    for (let i = period; i < data.length; i++) {
      const roc = ((data[i].close - data[i - period].close) / data[i - period].close) * 100;
      result.push({ time: data[i].time, value: roc });
    }
    return result;
  };

  const calculateADX = (data, period) => {
    // Simplified ADX calculation
    const result = [];
    const trueRanges = [];
    const plusDMs = [];
    const minusDMs = [];

    for (let i = 1; i < data.length; i++) {
      const tr = Math.max(
        data[i].high - data[i].low,
        Math.abs(data[i].high - data[i - 1].close),
        Math.abs(data[i].low - data[i - 1].close)
      );
      trueRanges.push(tr);

      const plusDM = data[i].high - data[i - 1].high > data[i - 1].low - data[i].low ? 
        Math.max(data[i].high - data[i - 1].high, 0) : 0;
      const minusDM = data[i - 1].low - data[i].low > data[i].high - data[i - 1].high ? 
        Math.max(data[i - 1].low - data[i].low, 0) : 0;
      
      plusDMs.push(plusDM);
      minusDMs.push(minusDM);
    }

    for (let i = period - 1; i < trueRanges.length; i++) {
      const avgTR = trueRanges.slice(i - period + 1, i + 1).reduce((a, b) => a + b) / period;
      const avgPlusDM = plusDMs.slice(i - period + 1, i + 1).reduce((a, b) => a + b) / period;
      const avgMinusDM = minusDMs.slice(i - period + 1, i + 1).reduce((a, b) => a + b) / period;
      
      const plusDI = (avgPlusDM / avgTR) * 100;
      const minusDI = (avgMinusDM / avgTR) * 100;
      const dx = Math.abs(plusDI - minusDI) / (plusDI + minusDI) * 100;
      
      result.push({ time: data[i + 1].time, value: dx });
    }
    return result;
  };

  const calculateParabolicSAR = (data) => {
    const result = [];
    let sar = data[0].low;
    let ep = data[0].high;
    let af = 0.02;
    let isUptrend = true;

    for (let i = 1; i < data.length; i++) {
      const prevSar = sar;
      
      if (isUptrend) {
        sar = prevSar + af * (ep - prevSar);
        if (data[i].high > ep) {
          ep = data[i].high;
          af = Math.min(af + 0.02, 0.2);
        }
        if (data[i].low <= sar) {
          isUptrend = false;
          sar = ep;
          ep = data[i].low;
          af = 0.02;
        }
      } else {
        sar = prevSar + af * (ep - prevSar);
        if (data[i].low < ep) {
          ep = data[i].low;
          af = Math.min(af + 0.02, 0.2);
        }
        if (data[i].high >= sar) {
          isUptrend = true;
          sar = ep;
          ep = data[i].high;
          af = 0.02;
        }
      }
      
      result.push({ time: data[i].time, value: sar });
    }
    return result;
  };

  const calculateOBV = (data) => {
    const result = [];
    let obv = 0;

    for (let i = 1; i < data.length; i++) {
      if (data[i].close > data[i - 1].close) {
        obv += data[i].volume;
      } else if (data[i].close < data[i - 1].close) {
        obv -= data[i].volume;
      }
      result.push({ time: data[i].time, value: obv });
    }
    return result;
  };

  const calculateMFI = (data, period) => {
    const result = [];
    const typicalPrices = data.map(d => (d.high + d.low + d.close) / 3);
    const rawMoneyFlows = data.map((d, i) => typicalPrices[i] * d.volume);

    for (let i = period; i < data.length; i++) {
      let positiveFlow = 0;
      let negativeFlow = 0;

      for (let j = i - period + 1; j <= i; j++) {
        if (typicalPrices[j] > typicalPrices[j - 1]) {
          positiveFlow += rawMoneyFlows[j];
        } else if (typicalPrices[j] < typicalPrices[j - 1]) {
          negativeFlow += rawMoneyFlows[j];
        }
      }

      const moneyFlowRatio = positiveFlow / negativeFlow;
      const mfi = 100 - (100 / (1 + moneyFlowRatio));
      result.push({ time: data[i].time, value: mfi });
    }
    return result;
  };

  const calculateVWAP = (data) => {
    const result = [];
    let cumulativeVolume = 0;
    let cumulativeVolumePrice = 0;

    for (let i = 0; i < data.length; i++) {
      const typicalPrice = (data[i].high + data[i].low + data[i].close) / 3;
      cumulativeVolumePrice += typicalPrice * data[i].volume;
      cumulativeVolume += data[i].volume;
      
      const vwap = cumulativeVolumePrice / cumulativeVolume;
      result.push({ time: data[i].time, value: vwap });
    }
    return result;
  };

  const calculateKeltnerChannel = (data, period, multiplier) => {
    const ema = calculateEMA(data, period);
    const result = [];

    for (let i = period - 1; i < data.length; i++) {
      const slice = data.slice(i - period + 1, i + 1);
      const atr = slice.reduce((acc, candle, idx) => {
        if (idx === 0) return acc;
        const tr = Math.max(
          candle.high - candle.low,
          Math.abs(candle.high - slice[idx - 1].close),
          Math.abs(candle.low - slice[idx - 1].close)
        );
        return acc + tr;
      }, 0) / (period - 1);

      const emaIndex = i - period + 1;
      result.push({
        time: data[i].time,
        upper: ema[emaIndex].value + (multiplier * atr),
        middle: ema[emaIndex].value,
        lower: ema[emaIndex].value - (multiplier * atr)
      });
    }
    return result;
  };

  const calculateDonchianChannel = (data, period) => {
    const result = [];
    
    for (let i = period - 1; i < data.length; i++) {
      const slice = data.slice(i - period + 1, i + 1);
      const highest = Math.max(...slice.map(d => d.high));
      const lowest = Math.min(...slice.map(d => d.low));
      const middle = (highest + lowest) / 2;
      
      result.push({
        time: data[i].time,
        upper: highest,
        middle: middle,
        lower: lowest
      });
    }
    return result;
  };

  // Main indicator calculation function
  const calculateIndicator = useCallback((data, type) => {
    if (!data.length) return [];

    switch (type) {
      // Moving Averages
      case 'sma20':
        return calculateSMA(data, 20);
      case 'sma50':
        return calculateSMA(data, 50);
      case 'sma100':
        return calculateSMA(data, 100);
      case 'sma200':
        return calculateSMA(data, 200);
      case 'ema12':
        return calculateEMA(data, 12);
      case 'ema26':
        return calculateEMA(data, 26);
      case 'ema50':
        return calculateEMA(data, 50);
      case 'wma20':
        return calculateWMA(data, 20);

      // Bands & Envelopes
      case 'bollinger':
        return calculateBollingerBands(data, 20, 2);
      case 'keltner':
        return calculateKeltnerChannel(data, 20, 2);
      case 'donchian':
        return calculateDonchianChannel(data, 20);

      // Oscillators
      case 'rsi':
        return calculateRSI(data, 14);
      case 'stochastic':
        return calculateStochastic(data, 14, 3);
      case 'williams':
        return calculateWilliamsR(data, 14);
      case 'cci':
        return calculateCCI(data, 20);
      case 'roc':
        return calculateROC(data, 12);

      // Trend Indicators
      case 'macd':
        return calculateMACD(data, 12, 26, 9);
      case 'adx':
        return calculateADX(data, 14);
      case 'parabolic':
        return calculateParabolicSAR(data);

      // Volume Indicators
      case 'obv':
        return calculateOBV(data);
      case 'mfi':
        return calculateMFI(data, 14);
      case 'vwap':
        return calculateVWAP(data);

      default:
        return [];
    }
  }, []); // Empty dependency array since helper functions are defined above

  // Define updateIndicators function AFTER calculateIndicator
  const updateIndicators = useCallback((data) => {
    if (!chartRef.current || !data.length) return;

    // Clear existing indicator series
    Object.values(indicatorSeriesRef.current).forEach(series => {
      if (series && typeof series.remove === 'function') {
        try {
          chartRef.current.chart.removeSeries(series);
        } catch (e) {
          // Series might already be removed
        }
      }
    });
    indicatorSeriesRef.current = {};

    // Add active indicators
    activeIndicators.forEach(indicatorId => {
      const indicatorData = calculateIndicator(data, indicatorId);
      if (!indicatorData.length) return;

      try {
        let series;
        const indicatorConfig = getIndicatorConfig(indicatorId);

        if (indicatorConfig.type === 'line') {
          series = chartRef.current.chart.addLineSeries({
            color: indicatorConfig.color,
            lineWidth: indicatorConfig.lineWidth || 2,
            title: indicatorConfig.name,
          });
          series.setData(indicatorData);
        } else if (indicatorConfig.type === 'histogram') {
          series = chartRef.current.chart.addHistogramSeries({
            color: indicatorConfig.color,
            title: indicatorConfig.name,
          });
          series.setData(indicatorData);
        } else if (indicatorConfig.type === 'bands') {
          // For Bollinger Bands, Keltner Channel, etc.
          const upperSeries = chartRef.current.chart.addLineSeries({
            color: indicatorConfig.upperColor || indicatorConfig.color,
            lineWidth: 1,
            title: `${indicatorConfig.name} Upper`,
          });
          const middleSeries = chartRef.current.chart.addLineSeries({
            color: indicatorConfig.middleColor || indicatorConfig.color,
            lineWidth: 1,
            title: `${indicatorConfig.name} Middle`,
          });
          const lowerSeries = chartRef.current.chart.addLineSeries({
            color: indicatorConfig.lowerColor || indicatorConfig.color,
            lineWidth: 1,
            title: `${indicatorConfig.name} Lower`,
          });

          const upperData = indicatorData.map(item => ({ time: item.time, value: item.upper }));
          const middleData = indicatorData.map(item => ({ time: item.time, value: item.middle }));
          const lowerData = indicatorData.map(item => ({ time: item.time, value: item.lower }));

          upperSeries.setData(upperData);
          middleSeries.setData(middleData);
          lowerSeries.setData(lowerData);

          indicatorSeriesRef.current[`${indicatorId}_upper`] = upperSeries;
          indicatorSeriesRef.current[`${indicatorId}_middle`] = middleSeries;
          indicatorSeriesRef.current[`${indicatorId}_lower`] = lowerSeries;
          return; // Don't set the main series for bands
        }

        indicatorSeriesRef.current[indicatorId] = series;
        addLog(`Added ${indicatorConfig.name} indicator`);
      } catch (error) {
        console.error(`Error adding ${indicatorId} indicator:`, error);
        addLog(`Error adding ${indicatorId} indicator: ${error.message}`);
      }
    });
  }, [activeIndicators, calculateIndicator]);

  // Update indicators when they change
  useEffect(() => {
    const updateChartIndicators = async () => {
      if (!chartRef.current || activeIndicators.length === 0) return;
      
      try {
        const response = await axios.get(`${config.API_URL}/api/klines?interval=${selectedInterval}&limit=200`);
        if (response.data && response.data.data) {
          updateIndicators(response.data.data);
        }
      } catch (error) {
        console.error('Error updating indicators:', error);
      }
    };

    if (activeIndicators.length > 0) {
      updateChartIndicators();
    }
  }, [activeIndicators, updateIndicators]);

  // Set up periodic updates (separate from chart initialization)
  useEffect(() => {
    // Determine update frequency based on interval
    let updateFrequency;
    if (selectedInterval === '1s') {
      updateFrequency = 1000; // Update every 1 second
    } else if (selectedInterval === '5s') {
      updateFrequency = 5000; // Update every 5 seconds
    } else if (selectedInterval === '1m') {
      updateFrequency = 10000; // Update every 10 seconds
    } else {
      updateFrequency = 30000; // Update every 30 seconds for longer intervals
    }

    const chartUpdateInterval = setInterval(async () => {
      if (!chartRef.current) return;
      
              try {
          const response = await axios.get(`${config.API_URL}/api/klines?interval=${selectedInterval}&limit=200`);
          if (response.data && response.data.data) {
            chartRef.current.candlestickSeries.setData(response.data.data);
            
            // Update indicators if any are active
            if (activeIndicators.length > 0) {
              updateIndicators(response.data.data);
            }
          }
        } catch (error) {
          console.error('Error updating chart data:', error);
        }
    }, updateFrequency);

    return () => clearInterval(chartUpdateInterval);
  }, [selectedInterval, activeIndicators, updateIndicators]);



  const addLog = (message) => {
    setLogs(prev => [...prev, {
      timestamp: new Date(),
      message
    }].slice(-100)); // Keep last 100 logs
  };

  const handleIntervalChange = (interval) => {
    setSelectedInterval(interval);
    // Data fetching will be handled by the useEffect hook
  };

  const getIndicatorConfig = (indicatorId) => {
    const configs = {
      // Moving Averages
      sma20: { name: 'SMA 20', type: 'line', color: '#2196F3', lineWidth: 2 },
      sma50: { name: 'SMA 50', type: 'line', color: '#FF9800', lineWidth: 2 },
      sma100: { name: 'SMA 100', type: 'line', color: '#9C27B0', lineWidth: 2 },
      sma200: { name: 'SMA 200', type: 'line', color: '#F44336', lineWidth: 2 },
      ema12: { name: 'EMA 12', type: 'line', color: '#4CAF50', lineWidth: 2 },
      ema26: { name: 'EMA 26', type: 'line', color: '#FF5722', lineWidth: 2 },
      ema50: { name: 'EMA 50', type: 'line', color: '#607D8B', lineWidth: 2 },
      wma20: { name: 'WMA 20', type: 'line', color: '#795548', lineWidth: 2 },

      // Bands & Envelopes
      bollinger: { 
        name: 'Bollinger Bands', 
        type: 'bands', 
        upperColor: '#2196F3', 
        middleColor: '#FFC107', 
        lowerColor: '#2196F3' 
      },
      keltner: { 
        name: 'Keltner Channel', 
        type: 'bands', 
        upperColor: '#9C27B0', 
        middleColor: '#E91E63', 
        lowerColor: '#9C27B0' 
      },
      donchian: { 
        name: 'Donchian Channel', 
        type: 'bands', 
        upperColor: '#FF5722', 
        middleColor: '#FF9800', 
        lowerColor: '#FF5722' 
      },

      // Oscillators (these would typically be in a separate pane)
      rsi: { name: 'RSI', type: 'line', color: '#9C27B0', lineWidth: 2 },
      stochastic: { name: 'Stochastic %K', type: 'line', color: '#FF9800', lineWidth: 2 },
      williams: { name: 'Williams %R', type: 'line', color: '#F44336', lineWidth: 2 },
      cci: { name: 'CCI', type: 'line', color: '#4CAF50', lineWidth: 2 },
      roc: { name: 'Rate of Change', type: 'line', color: '#2196F3', lineWidth: 2 },

      // Trend Indicators
      macd: { name: 'MACD', type: 'line', color: '#FF5722', lineWidth: 2 },
      adx: { name: 'ADX', type: 'line', color: '#795548', lineWidth: 2 },
      parabolic: { name: 'Parabolic SAR', type: 'line', color: '#E91E63', lineWidth: 1 },

      // Volume Indicators
      obv: { name: 'OBV', type: 'line', color: '#607D8B', lineWidth: 2 },
      mfi: { name: 'MFI', type: 'line', color: '#3F51B5', lineWidth: 2 },
      vwap: { name: 'VWAP', type: 'line', color: '#009688', lineWidth: 2 },
    };

    return configs[indicatorId] || { name: indicatorId, type: 'line', color: '#666666', lineWidth: 2 };
  };

  const handleIndicatorToggle = (indicatorId) => {
    setActiveIndicators(prev => {
      const newIndicators = prev.includes(indicatorId)
        ? prev.filter(id => id !== indicatorId)
        : [...prev, indicatorId];
      
      return newIndicators;
    });
    // Indicators will be updated by the useEffect hook when activeIndicators changes
  };

  const handleAddTrendLine = () => {
    addLog('Trend line tool activated - Click and drag on chart to draw');
    // This would require more complex implementation with chart interaction
  };

  const handleClearDrawings = () => {
    // Clear any drawings/annotations
    addLog('Chart drawings cleared');
  };



  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Trading Dashboard
      </Typography>

      {/* Trading Performance Dashboard */}
      <TradingPerformanceDashboard />

      <Grid container spacing={3}>
        {/* Chart */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box>
                <Typography variant="h6">
                  BTC Price Chart
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  📊 {selectedInterval} historical data + 🔴 Real-time WebSocket updates (~100ms)
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {['1m', '5m', '15m', '30m', '1h', '4h', '1d'].map((interval) => (
                  <Button
                    key={interval}
                    size="small"
                    variant={selectedInterval === interval ? "contained" : "outlined"}
                    onClick={() => handleIntervalChange(interval)}
                    sx={{ minWidth: '40px' }}
                  >
                    {interval}
                  </Button>
                ))}
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <ChartIndicators
                onIndicatorToggle={handleIndicatorToggle}
                activeIndicators={activeIndicators}
              />
              <Button
                size="small"
                variant="outlined"
                onClick={handleAddTrendLine}
                startIcon={<Timeline />}
              >
                Trend Line
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={handleClearDrawings}
                startIcon={<Clear />}
              >
                Clear
              </Button>
            </Box>
            <div 
              ref={chartContainerRef} 
              style={{ width: '100%', height: '500px' }}
            />
          </Paper>
        </Grid>

        {/* Data Frequency Control */}
        <Grid item xs={12}>
          <DataFrequencyControl />
        </Grid>

        {/* AI Analysis Console */}
        <Grid item xs={12}>
          <AIAnalysisConsole />
        </Grid>

        {/* Trading Logs */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Trading Logs
            </Typography>
            <List sx={{ maxHeight: 200, overflow: 'auto' }}>
              {[...logs].reverse().map((log, index) => (
                <React.Fragment key={index}>
                  <ListItem>
                    <ListItemText
                      primary={log.message}
                      secondary={format(log.timestamp, 'HH:mm:ss')}
                    />
                  </ListItem>
                  {index < logs.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default Dashboard; 