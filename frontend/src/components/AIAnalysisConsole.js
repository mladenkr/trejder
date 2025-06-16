import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
  Divider,
  Chip,
  Grid,
  Card,
  CardContent,
  Switch,
  FormControlLabel,
  LinearProgress,
} from '@mui/material';
import {
  Psychology,
  TrendingUp,
  TrendingDown,
  Remove,
  PlayArrow,
  Stop,
  Refresh,
  Timeline,
} from '@mui/icons-material';
import axios from 'axios';
import { format } from 'date-fns';
import config from '../config';

function AIAnalysisConsole() {
  const [isAnalysisRunning, setIsAnalysisRunning] = useState(true); // AI analysis runs by default
  const [analysisHistory, setAnalysisHistory] = useState([]);
  const [currentAnalysis, setCurrentAnalysis] = useState(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const logContainerRef = useRef(null);
  const wsRef = useRef(null);

  // Define connectWebSocket BEFORE useEffect that uses it
  const connectWebSocket = useCallback(() => {
    wsRef.current = new WebSocket(`${config.WS_URL}/ws`);
    
    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'ai_analysis') {
        setCurrentAnalysis(data.data);
        setAnalysisHistory(prev => [...prev, data.data].slice(-50)); // Keep last 50 analyses
      }
    };

    wsRef.current.onclose = () => {
      // Reconnect after 3 seconds
      setTimeout(connectWebSocket, 3000);
    };
  }, []);

  useEffect(() => {
    // Check initial AI analysis status
    checkAnalysisStatus();
    
    // Connect to WebSocket for real-time updates
    connectWebSocket();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectWebSocket]);

  useEffect(() => {
    // Auto-scroll to bottom when new analysis arrives
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [analysisHistory, autoScroll]);

  const checkAnalysisStatus = async () => {
    try {
      const response = await axios.get(`${config.API_URL}/api/ai-analysis-status`);
      setIsAnalysisRunning(response.data.is_running);
      if (response.data.last_analysis) {
        setCurrentAnalysis(response.data.last_analysis);
      }
    } catch (error) {
      console.error('Error checking AI analysis status:', error);
    }
  };

  const startAnalysis = async () => {
    try {
      await axios.post(`${config.API_URL}/api/start-ai-analysis`);
      setIsAnalysisRunning(true);
    } catch (error) {
      console.error('Error starting AI analysis:', error);
    }
  };

  const stopAnalysis = async () => {
    try {
      await axios.post(`${config.API_URL}/api/stop-ai-analysis`);
      setIsAnalysisRunning(false);
    } catch (error) {
      console.error('Error stopping AI analysis:', error);
    }
  };

  const runManualAnalysis = async () => {
    try {
      const response = await axios.post(`${config.API_URL}/api/manual-ai-analysis`);
      setCurrentAnalysis(response.data);
      setAnalysisHistory(prev => [...prev, response.data].slice(-50));
    } catch (error) {
      console.error('Error running manual analysis:', error);
    }
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'LONG': return 'success';
      case 'SHORT': return 'error';
      default: return 'default';
    }
  };

  const getActionIcon = (action) => {
    switch (action) {
      case 'LONG': return <TrendingUp />;
      case 'SHORT': return <TrendingDown />;
      default: return <Remove />;
    }
  };

  const formatTimestamp = (timestamp) => {
    return format(new Date(timestamp), 'HH:mm:ss');
  };

  const getSignalBreakdown = (analysis) => {
    if (!analysis?.ai_decision) return "No signal data available";
    
    const bullishSignals = [];
    const bearishSignals = [];
    
    // Parse reasoning to understand which signals were triggered
    const reasoning = analysis.ai_decision.reasoning || [];
    
    reasoning.forEach(reason => {
      if (reason.includes('RSI oversold') || reason.includes('RSI at') && reason.includes('Strong buy')) {
        bullishSignals.push(`🟢 RSI Oversold (${reason.match(/RSI at ([\d.]+)/)?.[1] || 'N/A'})`);
      } else if (reason.includes('RSI at') && reason.includes('Moderate bullish')) {
        bullishSignals.push(`🟢 RSI Moderate Bullish (${reason.match(/RSI at ([\d.]+)/)?.[1] || 'N/A'})`);
      } else if (reason.includes('RSI overbought') || reason.includes('RSI at') && reason.includes('Sell signal')) {
        bearishSignals.push(`🔴 RSI Overbought (${reason.match(/RSI at ([\d.]+)/)?.[1] || 'N/A'})`);
      } else if (reason.includes('RSI at') && reason.includes('Moderate bearish')) {
        bearishSignals.push(`🔴 RSI Moderate Bearish (${reason.match(/RSI at ([\d.]+)/)?.[1] || 'N/A'})`);
      }
      
      if (reason.includes('MACD histogram positive')) {
        bullishSignals.push('🟢 MACD Bullish Momentum');
      } else if (reason.includes('MACD histogram negative')) {
        bearishSignals.push('🔴 MACD Bearish Momentum');
      }
      
      if (reason.includes('Price above SMA20 > SMA50')) {
        bullishSignals.push('🟢 Strong Uptrend (Price > SMA20 > SMA50)');
      } else if (reason.includes('Price below SMA20 < SMA50')) {
        bearishSignals.push('🔴 Strong Downtrend (Price < SMA20 < SMA50)');
      }
      
      if (reason.includes('Near support level')) {
        const distance = reason.match(/([\d.]+)% away/)?.[1];
        bullishSignals.push(`🟢 Near Support Level (${distance}% away)`);
      }
      
      if (reason.includes('Near resistance level')) {
        const distance = reason.match(/([\d.]+)% away/)?.[1];
        bearishSignals.push(`🔴 Near Resistance Level (${distance}% away)`);
      }
      
      if (reason.includes('Market structure is bullish')) {
        bullishSignals.push('🟢 Bullish Market Structure');
      } else if (reason.includes('Market structure is bearish')) {
        bearishSignals.push('🔴 Bearish Market Structure');
      }
      
      if (reason.includes('Volume supports bullish bias')) {
        bullishSignals.push('🟢 Bullish Volume Confirmation');
      } else if (reason.includes('Volume supports bearish bias')) {
        bearishSignals.push('🔴 Bearish Volume Confirmation');
      }
      
      if (reason.includes('Potential upward breakout')) {
        bullishSignals.push('🟢 Upward Breakout Potential');
      } else if (reason.includes('Potential downward breakout')) {
        bearishSignals.push('🔴 Downward Breakout Potential');
      }
      
      // New Advanced Indicators
      if (reason.includes('CCI')) {
        if (reason.includes('oversold')) {
          bullishSignals.push(`🟢 CCI Oversold (${reason.match(/CCI.*at ([\\d.-]+)/)?.[1] || 'N/A'})`);
        } else if (reason.includes('overbought')) {
          bearishSignals.push(`🔴 CCI Overbought (${reason.match(/CCI.*at ([\\d.-]+)/)?.[1] || 'N/A'})`);
        }
      }
      
      if (reason.includes('MFI')) {
        if (reason.includes('oversold')) {
          bullishSignals.push(`🟢 MFI Oversold (${reason.match(/MFI.*at ([\\d.-]+)/)?.[1] || 'N/A'})`);
        } else if (reason.includes('overbought')) {
          bearishSignals.push(`🔴 MFI Overbought (${reason.match(/MFI.*at ([\\d.-]+)/)?.[1] || 'N/A'})`);
        }
      }
      
      if (reason.includes('ADX')) {
        if (reason.includes('uptrend')) {
          bullishSignals.push(`🟢 ADX Strong Uptrend (${reason.match(/ADX: ([\\d.-]+)/)?.[1] || 'N/A'})`);
        } else if (reason.includes('downtrend')) {
          bearishSignals.push(`🔴 ADX Strong Downtrend (${reason.match(/ADX: ([\\d.-]+)/)?.[1] || 'N/A'})`);
        }
      }
      
      if (reason.includes('VWAP')) {
        if (reason.includes('above')) {
          bullishSignals.push('🟢 Price Above VWAP');
        } else if (reason.includes('below')) {
          bearishSignals.push('🔴 Price Below VWAP');
        }
      }
      
      if (reason.includes('Fear') || reason.includes('Greed')) {
        if (reason.includes('fear')) {
          bullishSignals.push(`🟢 Extreme Fear - Contrarian Buy (${reason.match(/F&G: ([\\d.-]+)/)?.[1] || 'N/A'})`);
        } else if (reason.includes('greed')) {
          bearishSignals.push(`🔴 Extreme Greed - Caution (${reason.match(/F&G: ([\\d.-]+)/)?.[1] || 'N/A'})`);
        }
      }
      
      if (reason.includes('Bull power') || reason.includes('Bear power')) {
        if (reason.includes('Bull power dominates')) {
          bullishSignals.push('🟢 Bull Power Dominance');
        } else if (reason.includes('Bear power dominates')) {
          bearishSignals.push('🔴 Bear Power Dominance');
        } else if (reason.includes('Strong bullish momentum')) {
          bullishSignals.push('🟢 Strong Bull/Bear Power');
        }
      }
      
      if (reason.includes('Fibonacci')) {
        bullishSignals.push('🟢 Fibonacci Support Level');
      }
      
      if (reason.includes('Aroon')) {
        if (reason.includes('uptrend')) {
          bullishSignals.push(`🟢 Aroon Uptrend (${reason.match(/Oscillator: ([\\d.-]+)/)?.[1] || 'N/A'})`);
        } else if (reason.includes('downtrend')) {
          bearishSignals.push(`🔴 Aroon Downtrend (${reason.match(/Oscillator: ([\\d.-]+)/)?.[1] || 'N/A'})`);
        }
      }
      
      if (reason.includes('ROC') || reason.includes('momentum')) {
        if (reason.includes('positive')) {
          bullishSignals.push(`🟢 Strong Positive Momentum (${reason.match(/ROC: ([\\d.-]+)/)?.[1] || 'N/A'}%)`);
        } else if (reason.includes('negative')) {
          bearishSignals.push(`🔴 Strong Negative Momentum (${reason.match(/ROC: ([\\d.-]+)/)?.[1] || 'N/A'}%)`);
        }
      }
      
      if (reason.includes('volatility')) {
        bearishSignals.push(`🔴 High Volatility Risk (${reason.match(/([\\d.-]+)/)?.[1] || 'N/A'})`);
      }
    });
    
    // Build the breakdown string
    let breakdown = `BULLISH SIGNALS (${analysis.ai_decision.bullish_signals || 0}):\n`;
    if (bullishSignals.length > 0) {
      breakdown += bullishSignals.join('\n') + '\n';
    } else {
      breakdown += 'No bullish signals detected\n';
    }
    
    breakdown += `\nBEARISH SIGNALS (${analysis.ai_decision.bearish_signals || 0}):\n`;
    if (bearishSignals.length > 0) {
      breakdown += bearishSignals.join('\n') + '\n';
    } else {
      breakdown += 'No bearish signals detected\n';
    }
    
    breakdown += `\nSIGNAL STRENGTH: ${analysis.ai_decision.signal_strength || 0}/10`;
    breakdown += `\nCONFIDENCE: ${(analysis.confidence_score || 0).toFixed(1)}%`;
    breakdown += `\nRECOMMENDATION: ${analysis.recommendation || 'HOLD'}`;
    
    breakdown += '\n\n--- TIMEFRAME & SIGNAL EXPLANATION ---';
    breakdown += '\n⏰ ANALYSIS TIMEFRAME: 15-minute candles';
    breakdown += '\n📊 OPTIMIZED FOR: Swing trading (1-24 hour positions)';
    breakdown += '\n🔄 UPDATE FREQUENCY: Every 60 seconds';
    breakdown += '\n\n🟢 Bullish signals suggest upward price movement';
    breakdown += '\n🔴 Bearish signals suggest downward price movement';
    breakdown += '\n• RSI < 30 = Oversold (Strong Buy)';
    breakdown += '\n• RSI 30-45 = Moderate Bullish';
    breakdown += '\n• RSI > 70 = Overbought (Sell Signal)';
    breakdown += '\n• MACD Histogram > 0 = Bullish Momentum';
    breakdown += '\n• Price > SMA20 > SMA50 = Strong Uptrend';
    breakdown += '\n• Near Support = Potential Bounce';
    breakdown += '\n• Near Resistance = Potential Rejection';
    
    return breakdown;
  };

  return (
    <Box>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Psychology color="primary" />
              AI Trading Analysis Console
              <Chip
                size="small"
                label={isAnalysisRunning ? "Auto-Running" : "Stopped"}
                color={isAnalysisRunning ? "success" : "default"}
                variant="outlined"
                sx={{ fontSize: '0.7rem', height: '20px' }}
              />
              <Chip
                size="small"
                label="15m"
                color="info"
                variant="filled"
                sx={{ fontSize: '0.7rem', height: '20px', fontWeight: 'bold' }}
              />
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
              15-minute candles • Updates every 60s • Swing trading (1-24h positions)
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <FormControlLabel
              control={
                <Switch
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                  size="small"
                />
              }
              label="Auto-scroll"
            />
            <Button
              variant="outlined"
              size="small"
              onClick={runManualAnalysis}
              startIcon={<Refresh />}
            >
              Manual Analysis
            </Button>
            <Button
              variant={isAnalysisRunning ? "contained" : "outlined"}
              color={isAnalysisRunning ? "error" : "primary"}
              onClick={isAnalysisRunning ? stopAnalysis : startAnalysis}
              startIcon={isAnalysisRunning ? <Stop /> : <PlayArrow />}
            >
              {isAnalysisRunning ? "Stop AI" : "Start AI"}
            </Button>
          </Box>
        </Box>

        {/* Current Analysis Summary */}
        {currentAnalysis && (
          <Grid container spacing={1.5} sx={{ mb: 2 }}>
            <Grid item xs={6} md={3}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.7rem' }}>
                    AI Recommendation
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                    <Chip
                      icon={getActionIcon(currentAnalysis.recommendation)}
                      label={currentAnalysis.recommendation}
                      color={getActionColor(currentAnalysis.recommendation)}
                      variant="filled"
                      size="small"
                      sx={{ fontSize: '0.7rem', height: '22px' }}
                    />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} md={3}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.7rem' }}>
                    Confidence
                  </Typography>
                  <Typography variant="subtitle1" sx={{ mt: 0.5, fontSize: '1rem', fontWeight: 'bold' }}>
                    {currentAnalysis.confidence_score?.toFixed(1)}%
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={currentAnalysis.confidence_score || 0}
                    sx={{ mt: 0.5, height: 4 }}
                  />
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} md={3}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.7rem' }}>
                    BTC Price
                  </Typography>
                  <Typography variant="subtitle1" sx={{ mt: 0.5, fontSize: '1rem', fontWeight: 'bold' }}>
                    ${currentAnalysis.current_price?.toFixed(2)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} md={3}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.7rem' }}>
                    Signal Strength
                  </Typography>
                  <Typography variant="subtitle1" sx={{ mt: 0.5, fontSize: '1rem', fontWeight: 'bold' }}>
                    {currentAnalysis.ai_decision?.signal_strength || 0}/10
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Analysis Reasoning */}
        {currentAnalysis?.ai_decision?.reasoning && (
          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>
                AI Reasoning ({currentAnalysis.ai_decision.reasoning.length} factors)
              </Typography>
              <List dense>
                {currentAnalysis.ai_decision.reasoning.map((reason, index) => (
                  <ListItem key={index} sx={{ py: 0.5 }}>
                    <ListItemText
                      primary={reason}
                      primaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        )}

        {/* Long Signal Conditions Breakdown */}
        {currentAnalysis && (
          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Timeline fontSize="small" />
                Long Signal Conditions
              </Typography>
              <Grid container spacing={2}>
                {/* RSI Condition */}
                <Grid item xs={12} md={6}>
                  <Box sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="caption" color="textSecondary">RSI Oversold Signal</Typography>
                    {(() => {
                      const rsi = currentAnalysis.indicators?.rsi || 50;
                      const isOversold = rsi < 30;
                      const isModerateBullish = rsi >= 30 && rsi <= 45;
                      const progress = rsi <= 30 ? 100 : rsi <= 45 ? 60 : Math.max(0, 100 - ((rsi - 30) * 2));
                      
                      return (
                        <>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            RSI: {rsi.toFixed(1)} {isOversold ? '🟢' : isModerateBullish ? '🟡' : '🔴'}
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={Math.min(progress, 100)}
                            sx={{ 
                              mt: 0.5, 
                              height: 4,
                              '& .MuiLinearProgress-bar': {
                                backgroundColor: isOversold ? '#4caf50' : isModerateBullish ? '#ff9800' : '#f44336'
                              }
                            }}
                          />
                          <Typography variant="caption">
                            {isOversold ? 'Strong buy signal' : isModerateBullish ? 'Moderate bullish' : `Need ${(45 - rsi).toFixed(1)} points`}
                          </Typography>
                        </>
                      );
                    })()}
                  </Box>
                </Grid>

                {/* Support Distance */}
                <Grid item xs={12} md={6}>
                  <Box sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="caption" color="textSecondary">Near Support Level</Typography>
                    {(() => {
                      const distance = currentAnalysis.support_resistance?.distance_to_support;
                      const isNearSupport = distance && distance < 1;
                      const progress = distance ? Math.max(0, 100 - (distance * 100)) : 0;
                      
                      return (
                        <>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            Distance: {distance ? `${distance.toFixed(2)}%` : 'N/A'} {isNearSupport ? '🟢' : '🔴'}
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={Math.min(progress, 100)}
                            sx={{ 
                              mt: 0.5, 
                              height: 4,
                              '& .MuiLinearProgress-bar': {
                                backgroundColor: isNearSupport ? '#4caf50' : '#f44336'
                              }
                            }}
                          />
                          <Typography variant="caption">
                            {isNearSupport ? 'Near support' : distance ? `Need ${(distance - 1).toFixed(2)}% closer` : 'No support data'}
                          </Typography>
                        </>
                      );
                    })()}
                  </Box>
                </Grid>

                {/* MACD Condition */}
                <Grid item xs={12} md={6}>
                  <Box sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="caption" color="textSecondary">MACD Momentum</Typography>
                    {(() => {
                      const macd = currentAnalysis.indicators?.macd;
                      const isPositive = macd?.histogram > 0;
                      const histogram = macd?.histogram || 0;
                      
                      return (
                        <>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            Histogram: {histogram.toFixed(3)} {isPositive ? '🟢' : '🔴'}
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={isPositive ? 100 : 0}
                            sx={{ 
                              mt: 0.5, 
                              height: 4,
                              '& .MuiLinearProgress-bar': {
                                backgroundColor: isPositive ? '#4caf50' : '#f44336'
                              }
                            }}
                          />
                          <Typography variant="caption">
                            {isPositive ? 'Bullish momentum' : 'Need positive momentum'}
                          </Typography>
                        </>
                      );
                    })()}
                  </Box>
                </Grid>

                {/* Moving Average Trend */}
                <Grid item xs={12} md={6}>
                  <Box sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="caption" color="textSecondary">Price vs Moving Averages</Typography>
                    {(() => {
                      const price = currentAnalysis.current_price || 0;
                      const sma20 = currentAnalysis.indicators?.sma_20 || price;
                      const sma50 = currentAnalysis.indicators?.sma_50 || price;
                      const isAboveBoth = price > sma20 && sma20 > sma50;
                      const progress = isAboveBoth ? 100 : (price > sma20 ? 50 : 0);
                      
                      return (
                        <>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            Trend: {isAboveBoth ? 'Strong Up' : price > sma20 ? 'Moderate' : 'Down'} {isAboveBoth ? '🟢' : price > sma20 ? '🟡' : '🔴'}
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={progress}
                            sx={{ 
                              mt: 0.5, 
                              height: 4,
                              '& .MuiLinearProgress-bar': {
                                backgroundColor: isAboveBoth ? '#4caf50' : progress > 0 ? '#ff9800' : '#f44336'
                              }
                            }}
                          />
                          <Typography variant="caption">
                            {isAboveBoth ? 'Price > SMA20 > SMA50' : 'Need uptrend confirmation'}
                          </Typography>
                        </>
                      );
                    })()}
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        )}

        {/* Support/Resistance and Long Signal Trigger */}
        <Grid container spacing={1.5} sx={{ mb: 2 }}>
          {/* Support/Resistance Levels */}
          {currentAnalysis?.support_resistance && (
            <>
              <Grid item xs={6} md={3}>
                <Card variant="outlined" sx={{ height: '100%' }}>
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.7rem' }}>
                      Support
                    </Typography>
                    {currentAnalysis.support_resistance.nearest_support && (
                      <Typography variant="body2" sx={{ fontSize: '0.85rem', mt: 0.5 }}>
                        ${currentAnalysis.support_resistance.nearest_support.toFixed(2)}
                        {currentAnalysis.support_resistance.distance_to_support && (
                          <span style={{ color: '#4caf50', fontSize: '0.75rem' }}>
                            {' '}(-{currentAnalysis.support_resistance.distance_to_support.toFixed(1)}%)
                          </span>
                        )}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} md={3}>
                <Card variant="outlined" sx={{ height: '100%' }}>
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.7rem' }}>
                      Resistance
                    </Typography>
                    {currentAnalysis.support_resistance.nearest_resistance && (
                      <Typography variant="body2" sx={{ fontSize: '0.85rem', mt: 0.5 }}>
                        ${currentAnalysis.support_resistance.nearest_resistance.toFixed(2)}
                        {currentAnalysis.support_resistance.distance_to_resistance && (
                          <span style={{ color: '#f44336', fontSize: '0.75rem' }}>
                            {' '}(+{currentAnalysis.support_resistance.distance_to_resistance.toFixed(1)}%)
                          </span>
                        )}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </>
          )}
          
          {/* Long Signal Trigger Indicator */}
          <Grid item xs={12} md={currentAnalysis?.support_resistance ? 6 : 12}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <TrendingUp fontSize="small" />
                  Long Signal Trigger
                </Typography>
                {currentAnalysis?.ai_decision ? (
                  <>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5, mt: 0.5 }}>
                      <Typography variant="caption" color="success.main" sx={{ fontSize: '0.75rem' }}>
                        Bullish: {currentAnalysis.ai_decision.bullish_signals || 0}
                      </Typography>
                      <Typography variant="caption" color="error.main" sx={{ fontSize: '0.75rem' }}>
                        Bearish: {currentAnalysis.ai_decision.bearish_signals || 0}
                      </Typography>
                    </Box>
                    
                    {(() => {
                      const bullish = currentAnalysis.ai_decision.bullish_signals || 0;
                      const bearish = currentAnalysis.ai_decision.bearish_signals || 0;
                      const needed = Math.max(0, (bearish + 2) - bullish);
                      const progress = needed === 0 ? 100 : Math.max(0, 100 - (needed * 25));
                      
                      return (
                        <>
                          <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.7rem' }}>
                            {needed === 0 ? 
                              "🟢 LONG signal active!" : 
                              `Need ${needed} more bullish signal${needed > 1 ? 's' : ''}`
                            }
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={progress}
                            sx={{ 
                              mt: 0.5, 
                              height: 6, 
                              borderRadius: 3,
                              backgroundColor: 'rgba(0,0,0,0.1)',
                              '& .MuiLinearProgress-bar': {
                                backgroundColor: progress >= 100 ? '#4caf50' : progress >= 75 ? '#ff9800' : '#2196f3'
                              }
                            }}
                          />
                          <Typography variant="caption" color="textSecondary" sx={{ mt: 0.25, display: 'block', fontSize: '0.7rem' }}>
                            Proximity: {progress.toFixed(0)}%
                          </Typography>
                        </>
                      );
                    })()}
                  </>
                ) : (
                  <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.75rem' }}>
                    Waiting for analysis data...
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Paper>

      {/* Signal Explanation */}
      <Paper sx={{ p: 1.5, mb: 2 }}>
        <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: '1rem' }}>
          📊 Signal System
          <Chip size="small" label="15m" color="info" variant="outlined" sx={{ fontSize: '0.7rem', height: '20px' }} />
        </Typography>
        <Typography variant="caption" color="textSecondary" paragraph sx={{ fontSize: '0.75rem', mb: 1 }}>
          AI analyzes 25+ indicators on <strong>15-minute candles</strong> for swing trading (1-24h positions).
        </Typography>
        
        <Box sx={{ mb: 1.5, p: 1, backgroundColor: 'info.main', color: 'info.contrastText', borderRadius: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}>
            ⏰ 15m timeframe: Balanced signal quality • Swing trading optimized • Updates every 60s
          </Typography>
        </Box>
        
        <Grid container spacing={1.5}>
          <Grid item xs={12} md={6}>
            <Typography variant="caption" color="success.main" gutterBottom sx={{ fontSize: '0.8rem', fontWeight: 'bold' }}>
              🟢 Bullish Signals
            </Typography>
            <Typography variant="caption" component="div" sx={{ fontSize: '0.7rem', lineHeight: 1.3 }}>
              • <strong>RSI Oversold (&lt;30):</strong> +2 - Strong buy<br/>
              • <strong>RSI Moderate (30-45):</strong> +1 - Mild bullish<br/>
              • <strong>MACD Positive:</strong> +1 - Upward momentum<br/>
              • <strong>Strong Uptrend:</strong> +2 - Price &gt; SMA20 &gt; SMA50<br/>
              • <strong>Near Support:</strong> +2 - Within 1% of support<br/>
              • <strong>CCI Oversold (&lt;-100):</strong> +2 - Strong momentum<br/>
              • <strong>MFI Oversold (&lt;20):</strong> +2 - Money flow buy<br/>
              • <strong>ADX Strong (&gt;25):</strong> +1 - Trend confirmation<br/>
              • <strong>Price Above VWAP:</strong> +1 - Institutional support<br/>
              • <strong>Fear &amp; Greed (&lt;25):</strong> +2 - Contrarian opportunity<br/>
              • <strong>Bull Power Dominance:</strong> +1-2 - Buying strength<br/>
              • <strong>Fibonacci Support:</strong> +1 - Key retracement
            </Typography>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Typography variant="caption" color="error.main" gutterBottom sx={{ fontSize: '0.8rem', fontWeight: 'bold' }}>
              🔴 Bearish Signals
            </Typography>
            <Typography variant="caption" component="div" sx={{ fontSize: '0.7rem', lineHeight: 1.3 }}>
              • <strong>RSI Overbought (&gt;70):</strong> +2 - Strong sell<br/>
              • <strong>RSI Moderate (55-70):</strong> +1 - Mild bearish<br/>
              • <strong>MACD Negative:</strong> +1 - Downward momentum<br/>
              • <strong>Strong Downtrend:</strong> +2 - Price &lt; SMA20 &lt; SMA50<br/>
              • <strong>Near Resistance:</strong> +1 - Within 1% of resistance<br/>
              • <strong>CCI Overbought (&gt;100):</strong> +2 - Strong momentum<br/>
              • <strong>MFI Overbought (&gt;80):</strong> +2 - Money flow sell<br/>
              • <strong>High Volatility:</strong> +1 - Increased risk<br/>
              • <strong>Price Below VWAP:</strong> +1 - Institutional selling<br/>
              • <strong>Extreme Greed (&gt;75):</strong> +1 - Market overheated<br/>
              • <strong>Bear Power Dominance:</strong> +1 - Selling pressure
            </Typography>
          </Grid>
        </Grid>
        
        <Box sx={{ mt: 1, p: 0.75, backgroundColor: 'action.hover', borderRadius: 1 }}>
          <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.7rem' }}>
            <strong>Decision Logic:</strong> LONG when bullish signals exceed bearish by 2+ (e.g., 5🟢 vs 3🔴). Equal/close = HOLD.
          </Typography>
        </Box>
        
        {/* Timeframe Comparison */}
        <Box sx={{ mt: 1.5, p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          <Typography variant="caption" gutterBottom sx={{ fontSize: '0.8rem', fontWeight: 'bold' }}>
            ⏰ Timeframe Comparison
          </Typography>
          <Grid container spacing={1}>
            <Grid item xs={12} md={4}>
              <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 'bold', fontSize: '0.7rem' }}>
                Short (1m-5m)
              </Typography>
              <Typography variant="caption" component="div" color="textSecondary" sx={{ fontSize: '0.65rem', lineHeight: 1.2 }}>
                Noisy • Scalping • High false positives
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box sx={{ p: 0.5, backgroundColor: 'info.main', color: 'info.contrastText', borderRadius: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 'bold', fontSize: '0.7rem' }}>
                  15m ← CURRENT
                </Typography>
                <Typography variant="caption" component="div" sx={{ fontSize: '0.65rem', lineHeight: 1.2 }}>
                  Balanced • Swing trading • Optimal
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 'bold', fontSize: '0.7rem' }}>
                Long (1h-1d)
              </Typography>
              <Typography variant="caption" component="div" color="textSecondary" sx={{ fontSize: '0.65rem', lineHeight: 1.2 }}>
                Reliable • Position trading • Slower
              </Typography>
            </Grid>
          </Grid>
        </Box>
      </Paper>

      {/* Analysis History Log */}
      <Paper sx={{ p: 1.5 }}>
        <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: '1rem' }}>
          Analysis History ({analysisHistory.length})
          <Chip size="small" label="15m" color="info" variant="outlined" sx={{ fontSize: '0.7rem', height: '20px' }} />
        </Typography>
        <Box
          ref={logContainerRef}
          sx={{
            height: 250,
            overflow: 'auto',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            p: 0.75,
            backgroundColor: 'background.default',
          }}
        >
          {analysisHistory.length === 0 ? (
            <Typography variant="caption" color="textSecondary" sx={{ textAlign: 'center', mt: 4, fontSize: '0.75rem' }}>
              {isAnalysisRunning ? 
                "AI analysis is running... Waiting for first analysis results." : 
                "No analysis data yet. Start AI analysis to see real-time insights."
              }
            </Typography>
          ) : (
            <List dense>
              {[...analysisHistory].reverse().map((analysis, index) => (
                <React.Fragment key={index}>
                  <ListItem sx={{ py: 0.5, px: 0.5 }}>
                    <Box sx={{ width: '100%' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                        <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.7rem' }}>
                          {formatTimestamp(analysis.timestamp)}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                          <Chip
                            size="small"
                            label={analysis.recommendation}
                            color={getActionColor(analysis.recommendation)}
                            variant="outlined"
                            sx={{ fontSize: '0.65rem', height: '18px' }}
                          />
                          <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                            {analysis.confidence_score?.toFixed(1)}%
                          </Typography>
                        </Box>
                      </Box>
                      <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                        ${analysis.current_price?.toFixed(2)} • {analysis.ai_decision?.bullish_signals || 0}🟢 {analysis.ai_decision?.bearish_signals || 0}🔴
                        <Chip
                          size="small"
                          label="Details"
                          variant="outlined"
                          onClick={() => {
                            const signalDetails = getSignalBreakdown(analysis);
                            alert(`Signal Breakdown:\n\n${signalDetails}`);
                          }}
                          sx={{ fontSize: '0.6rem', height: '16px', cursor: 'pointer', ml: 0.5 }}
                        />
                      </Typography>
                      {analysis.ai_decision?.reasoning?.length > 0 && (
                        <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.65rem', mt: 0.25, display: 'block' }}>
                          {analysis.ai_decision.reasoning.slice(0, 1).join(' • ')}
                          {analysis.ai_decision.reasoning.length > 1 && ` • +${analysis.ai_decision.reasoning.length - 1} more`}
                        </Typography>
                      )}
                    </Box>
                  </ListItem>
                  {index < analysisHistory.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
        </Box>
      </Paper>
    </Box>
  );
}

export default AIAnalysisConsole; 