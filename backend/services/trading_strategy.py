import pandas as pd
import numpy as np
from typing import Dict, List, Tuple
import ta
from datetime import datetime

class TradingStrategy:
    def __init__(self):
        self.indicators = {}
        self.last_signal = None
        self.position = None

    def calculate_indicators(self, klines: List) -> Dict:
        """Calculate technical indicators from kline data"""
        # Convert klines to DataFrame - handle variable number of columns
        if not klines:
            return {}
            
        # MEXC API returns 8 columns: timestamp, open, high, low, close, volume, close_time, quote_volume
        df = pd.DataFrame(klines)
        
        # Ensure we have at least the required columns
        if len(df.columns) < 6:
            raise ValueError(f"Insufficient kline data: got {len(df.columns)} columns, need at least 6")
        
        # Map to standard column names
        df.columns = ['timestamp', 'open', 'high', 'low', 'close', 'volume'] + [f'col_{i}' for i in range(6, len(df.columns))]
        
        # Convert string values to float
        for col in ['open', 'high', 'low', 'close', 'volume']:
            df[col] = pd.to_numeric(df[col], errors='coerce')

        # Calculate indicators with error handling
        try:
            # RSI
            df['rsi'] = ta.momentum.RSIIndicator(df['close']).rsi()
            
            # MACD
            macd = ta.trend.MACD(df['close'])
            df['macd'] = macd.macd()
            df['macd_signal'] = macd.macd_signal()
            df['macd_diff'] = macd.macd_diff()
            
            # Bollinger Bands
            bollinger = ta.volatility.BollingerBands(df['close'])
            df['bb_high'] = bollinger.bollinger_hband()
            df['bb_low'] = bollinger.bollinger_lband()
            df['bb_mid'] = bollinger.bollinger_mavg()
            
            # Moving Averages
            df['sma_20'] = ta.trend.sma_indicator(df['close'], window=20)
            df['sma_50'] = ta.trend.sma_indicator(df['close'], window=50)
            
            # Store the latest values with NaN handling
            self.indicators = {
                'rsi': df['rsi'].iloc[-1] if not pd.isna(df['rsi'].iloc[-1]) else 50.0,
                'macd': df['macd'].iloc[-1] if not pd.isna(df['macd'].iloc[-1]) else 0.0,
                'macd_signal': df['macd_signal'].iloc[-1] if not pd.isna(df['macd_signal'].iloc[-1]) else 0.0,
                'macd_diff': df['macd_diff'].iloc[-1] if not pd.isna(df['macd_diff'].iloc[-1]) else 0.0,
                'bb_high': df['bb_high'].iloc[-1] if not pd.isna(df['bb_high'].iloc[-1]) else df['close'].iloc[-1] * 1.02,
                'bb_low': df['bb_low'].iloc[-1] if not pd.isna(df['bb_low'].iloc[-1]) else df['close'].iloc[-1] * 0.98,
                'bb_mid': df['bb_mid'].iloc[-1] if not pd.isna(df['bb_mid'].iloc[-1]) else df['close'].iloc[-1],
                'sma_20': df['sma_20'].iloc[-1] if not pd.isna(df['sma_20'].iloc[-1]) else df['close'].iloc[-1],
                'sma_50': df['sma_50'].iloc[-1] if not pd.isna(df['sma_50'].iloc[-1]) else df['close'].iloc[-1],
                'current_price': df['close'].iloc[-1]
            }
        except Exception as e:
            # Return basic indicators if calculation fails
            current_price = df['close'].iloc[-1] if len(df) > 0 else 0.0
            self.indicators = {
                'rsi': 50.0,
                'macd': 0.0,
                'macd_signal': 0.0,
                'macd_diff': 0.0,
                'bb_high': current_price * 1.02,
                'bb_low': current_price * 0.98,
                'bb_mid': current_price,
                'sma_20': current_price,
                'sma_50': current_price,
                'current_price': current_price
            }
            print(f"Error calculating indicators: {e}")
        
        return self.indicators

    def analyze_signals(self) -> Tuple[str, float]:
        """
        Analyze technical indicators and return trading signal
        Returns: (signal_type, confidence)
        """
        if not self.indicators:
            return None, 0.0

        signals = []
        confidence = 0.0

        # RSI Analysis
        if self.indicators['rsi'] < 30:
            signals.append(('BUY', 0.3))
        elif self.indicators['rsi'] > 70:
            signals.append(('SELL', 0.3))

        # MACD Analysis
        if self.indicators['macd'] > self.indicators['macd_signal']:
            signals.append(('BUY', 0.2))
        elif self.indicators['macd'] < self.indicators['macd_signal']:
            signals.append(('SELL', 0.2))

        # Bollinger Bands Analysis
        if self.indicators['current_price'] < self.indicators['bb_low']:
            signals.append(('BUY', 0.2))
        elif self.indicators['current_price'] > self.indicators['bb_high']:
            signals.append(('SELL', 0.2))

        # Moving Average Analysis
        if self.indicators['sma_20'] > self.indicators['sma_50']:
            signals.append(('BUY', 0.3))
        elif self.indicators['sma_20'] < self.indicators['sma_50']:
            signals.append(('SELL', 0.3))

        # Aggregate signals
        if signals:
            buy_signals = [s[1] for s in signals if s[0] == 'BUY']
            sell_signals = [s[1] for s in signals if s[0] == 'SELL']
            
            buy_confidence = sum(buy_signals)
            sell_confidence = sum(sell_signals)
            
            if buy_confidence > sell_confidence and buy_confidence > 0.3:
                return 'BUY', buy_confidence
            elif sell_confidence > buy_confidence and sell_confidence > 0.3:
                return 'SELL', sell_confidence

        return None, 0.0

    def should_trade(self) -> Tuple[bool, str, float]:
        """
        Determine if we should trade based on current market conditions
        Returns: (should_trade, action, confidence)
        """
        signal, confidence = self.analyze_signals()
        
        if signal is None:
            return False, None, 0.0
            
        # Only trade if we have moderate confidence  
        if confidence < 0.3:
            return False, None, confidence
            
        # Don't trade if we're already in a position and signal is the same
        if self.position == signal:
            return False, None, confidence
            
        return True, signal, confidence

    def update_position(self, position: str):
        """Update the current position"""
        self.position = position 