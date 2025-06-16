import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class AITradingAnalysis:
    def __init__(self):
        self.analysis_history = []
        self.support_levels = []
        self.resistance_levels = []
        
    def analyze_market(self, klines: List, current_price: float) -> Dict:
        """
        Comprehensive AI market analysis using multiple indicators and pattern recognition
        """
        try:
            if len(klines) < 50:
                return {"error": "Insufficient data for analysis"}
            
            # Convert klines to DataFrame for easier analysis
            df = self._klines_to_dataframe(klines)
            
            # Calculate all indicators
            indicators = self._calculate_all_indicators(df)
            
            # Detect support and resistance levels
            support_resistance = self._detect_support_resistance(df)
            
            # Pattern recognition
            patterns = self._detect_patterns(df)
            
            # Market structure analysis
            market_structure = self._analyze_market_structure(df)
            
            # Volume analysis
            volume_analysis = self._analyze_volume(df)
            
            # AI decision making
            ai_decision = self._make_ai_decision(
                indicators, support_resistance, patterns, 
                market_structure, volume_analysis, current_price
            )
            
            # Generate analysis report
            analysis = {
                "timestamp": datetime.now().isoformat(),
                "current_price": current_price,
                "indicators": indicators,
                "support_resistance": support_resistance,
                "patterns": patterns,
                "market_structure": market_structure,
                "volume_analysis": volume_analysis,
                "ai_decision": ai_decision,
                "confidence_score": ai_decision.get("confidence", 0),
                "recommendation": ai_decision.get("action", "HOLD"),
                "reasoning": ai_decision.get("reasoning", [])
            }
            
            # Store analysis history
            self.analysis_history.append(analysis)
            if len(self.analysis_history) > 100:  # Keep last 100 analyses
                self.analysis_history.pop(0)
            
            return analysis
            
        except Exception as e:
            logger.error(f"Error in AI analysis: {str(e)}")
            return {"error": str(e)}
    
    def _klines_to_dataframe(self, klines: List) -> pd.DataFrame:
        """Convert klines to pandas DataFrame"""
        data = []
        for kline in klines:
            data.append({
                'timestamp': kline[0],
                'open': float(kline[1]),
                'high': float(kline[2]),
                'low': float(kline[3]),
                'close': float(kline[4]),
                'volume': float(kline[5])
            })
        
        df = pd.DataFrame(data)
        df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
        return df.sort_values('timestamp').reset_index(drop=True)
    
    def _calculate_all_indicators(self, df: pd.DataFrame) -> Dict:
        """Calculate comprehensive technical indicators"""
        indicators = {}
        
        # Moving Averages
        indicators['sma_20'] = df['close'].rolling(20).mean().iloc[-1]
        indicators['sma_50'] = df['close'].rolling(50).mean().iloc[-1]
        indicators['ema_12'] = df['close'].ewm(span=12).mean().iloc[-1]
        indicators['ema_26'] = df['close'].ewm(span=26).mean().iloc[-1]
        
        # RSI
        indicators['rsi'] = self._calculate_rsi(df['close'], 14)
        
        # MACD
        macd_line, signal_line, histogram = self._calculate_macd(df['close'])
        indicators['macd'] = {
            'macd_line': macd_line,
            'signal_line': signal_line,
            'histogram': histogram
        }
        
        # Bollinger Bands
        bb_upper, bb_middle, bb_lower = self._calculate_bollinger_bands(df['close'], 20, 2)
        indicators['bollinger'] = {
            'upper': bb_upper,
            'middle': bb_middle,
            'lower': bb_lower,
            'position': self._get_bb_position(df['close'].iloc[-1], bb_upper, bb_lower)
        }
        
        # Stochastic
        indicators['stochastic'] = self._calculate_stochastic(df, 14)
        
        # Williams %R
        indicators['williams_r'] = self._calculate_williams_r(df, 14)
        
        # Volume indicators
        indicators['volume_sma'] = df['volume'].rolling(20).mean().iloc[-1]
        indicators['volume_ratio'] = df['volume'].iloc[-1] / indicators['volume_sma']
        
        # Advanced Momentum Indicators
        indicators['cci'] = self._calculate_cci(df, 20)
        indicators['roc'] = self._calculate_roc(df['close'], 12)
        indicators['momentum'] = self._calculate_momentum(df['close'], 10)
        
        # Volatility Indicators
        indicators['atr'] = self._calculate_atr(df, 14)
        indicators['volatility'] = self._calculate_volatility(df['close'], 20)
        
        # Trend Strength Indicators
        indicators['adx'] = self._calculate_adx(df, 14)
        indicators['aroon'] = self._calculate_aroon(df, 14)
        
        # Volume-based Indicators
        indicators['obv'] = self._calculate_obv(df)
        indicators['mfi'] = self._calculate_mfi(df, 14)
        indicators['vwap'] = self._calculate_vwap(df)
        
        # Price Action Indicators
        indicators['pivot_points'] = self._calculate_pivot_points(df)
        indicators['fibonacci_levels'] = self._calculate_fibonacci_retracements(df)
        
        # Market Sentiment Indicators
        indicators['fear_greed'] = self._calculate_fear_greed_index(df)
        indicators['bull_bear_power'] = self._calculate_bull_bear_power(df)
        
        return indicators
    
    def _detect_support_resistance(self, df: pd.DataFrame) -> Dict:
        """Detect support and resistance levels using pivot points and price action"""
        highs = df['high'].values
        lows = df['low'].values
        closes = df['close'].values
        
        # Find pivot points
        resistance_levels = self._find_resistance_levels(highs, closes)
        support_levels = self._find_support_levels(lows, closes)
        
        current_price = closes[-1]
        
        # Find nearest levels
        nearest_resistance = min([r for r in resistance_levels if r > current_price], default=None)
        nearest_support = max([s for s in support_levels if s < current_price], default=None)
        
        return {
            "resistance_levels": resistance_levels,
            "support_levels": support_levels,
            "nearest_resistance": nearest_resistance,
            "nearest_support": nearest_support,
            "distance_to_resistance": (nearest_resistance - current_price) / current_price * 100 if nearest_resistance else None,
            "distance_to_support": (current_price - nearest_support) / current_price * 100 if nearest_support else None
        }
    
    def _detect_patterns(self, df: pd.DataFrame) -> Dict:
        """Detect chart patterns"""
        patterns = {
            "trend": self._detect_trend(df),
            "candlestick_patterns": self._detect_candlestick_patterns(df),
            "breakout_potential": self._detect_breakout_potential(df),
            "divergence": self._detect_divergence(df)
        }
        return patterns
    
    def _analyze_market_structure(self, df: pd.DataFrame) -> Dict:
        """Analyze market structure (higher highs, higher lows, etc.)"""
        highs = df['high'].values[-20:]  # Last 20 periods
        lows = df['low'].values[-20:]
        
        # Detect market structure
        higher_highs = sum(1 for i in range(1, len(highs)) if highs[i] > highs[i-1])
        higher_lows = sum(1 for i in range(1, len(lows)) if lows[i] > lows[i-1])
        
        structure_score = (higher_highs + higher_lows) / (len(highs) - 1)
        
        if structure_score > 0.6:
            trend_structure = "BULLISH"
        elif structure_score < 0.4:
            trend_structure = "BEARISH"
        else:
            trend_structure = "SIDEWAYS"
        
        return {
            "trend_structure": trend_structure,
            "structure_score": structure_score,
            "higher_highs_ratio": higher_highs / (len(highs) - 1),
            "higher_lows_ratio": higher_lows / (len(lows) - 1)
        }
    
    def _analyze_volume(self, df: pd.DataFrame) -> Dict:
        """Analyze volume patterns"""
        volume = df['volume'].values
        price_change = df['close'].pct_change().values
        
        # Volume trend
        volume_sma = np.convolve(volume, np.ones(10)/10, mode='valid')
        volume_trend = "INCREASING" if volume_sma[-1] > volume_sma[-5] else "DECREASING"
        
        # Volume-price relationship
        positive_volume = np.sum(volume[-10:][price_change[-10:] > 0])
        negative_volume = np.sum(volume[-10:][price_change[-10:] < 0])
        
        volume_bias = "BULLISH" if positive_volume > negative_volume else "BEARISH"
        
        return {
            "volume_trend": volume_trend,
            "volume_bias": volume_bias,
            "avg_volume_10": np.mean(volume[-10:]),
            "current_volume": volume[-1],
            "volume_ratio": volume[-1] / np.mean(volume[-20:])
        }
    
    def _make_ai_decision(self, indicators: Dict, support_resistance: Dict, 
                         patterns: Dict, market_structure: Dict, 
                         volume_analysis: Dict, current_price: float) -> Dict:
        """AI decision making based on all analysis"""
        
        bullish_signals = 0
        bearish_signals = 0
        reasoning = []
        
        # RSI Analysis
        rsi = indicators.get('rsi', 50)
        if rsi < 30:
            bullish_signals += 2
            reasoning.append(f"RSI oversold at {rsi:.1f} - Strong buy signal")
        elif rsi > 70:
            bearish_signals += 2
            reasoning.append(f"RSI overbought at {rsi:.1f} - Sell signal")
        elif 30 <= rsi <= 45:
            bullish_signals += 1
            reasoning.append(f"RSI at {rsi:.1f} - Moderate bullish")
        elif 55 <= rsi <= 70:
            bearish_signals += 1
            reasoning.append(f"RSI at {rsi:.1f} - Moderate bearish")
        
        # MACD Analysis
        macd = indicators.get('macd', {})
        if macd.get('histogram', 0) > 0:
            bullish_signals += 1
            reasoning.append("MACD histogram positive - Bullish momentum")
        else:
            bearish_signals += 1
            reasoning.append("MACD histogram negative - Bearish momentum")
        
        # Moving Average Analysis
        sma_20 = indicators.get('sma_20', current_price)
        sma_50 = indicators.get('sma_50', current_price)
        if current_price > sma_20 > sma_50:
            bullish_signals += 2
            reasoning.append("Price above SMA20 > SMA50 - Strong uptrend")
        elif current_price < sma_20 < sma_50:
            bearish_signals += 2
            reasoning.append("Price below SMA20 < SMA50 - Strong downtrend")
        
        # Support/Resistance Analysis
        distance_to_support = support_resistance.get('distance_to_support')
        distance_to_resistance = support_resistance.get('distance_to_resistance')
        
        if distance_to_support and distance_to_support < 1:
            bullish_signals += 2
            reasoning.append(f"Near support level - {distance_to_support:.2f}% away")
        
        if distance_to_resistance and distance_to_resistance < 1:
            bearish_signals += 1
            reasoning.append(f"Near resistance level - {distance_to_resistance:.2f}% away")
        
        # Market Structure Analysis
        if market_structure.get('trend_structure') == 'BULLISH':
            bullish_signals += 1
            reasoning.append("Market structure is bullish")
        elif market_structure.get('trend_structure') == 'BEARISH':
            bearish_signals += 1
            reasoning.append("Market structure is bearish")
        
        # Volume Analysis
        if volume_analysis.get('volume_bias') == 'BULLISH' and volume_analysis.get('volume_trend') == 'INCREASING':
            bullish_signals += 1
            reasoning.append("Volume supports bullish bias")
        elif volume_analysis.get('volume_bias') == 'BEARISH' and volume_analysis.get('volume_trend') == 'INCREASING':
            bearish_signals += 1
            reasoning.append("Volume supports bearish bias")
        
        # Pattern Analysis
        if patterns.get('breakout_potential', {}).get('direction') == 'UP':
            bullish_signals += 1
            reasoning.append("Potential upward breakout detected")
        
        # Advanced Momentum Indicators
        cci = indicators.get('cci', 0)
        if cci < -100:
            bullish_signals += 2
            reasoning.append(f"CCI oversold at {cci:.1f} - Strong buy signal")
        elif cci > 100:
            bearish_signals += 2
            reasoning.append(f"CCI overbought at {cci:.1f} - Strong sell signal")
        
        roc = indicators.get('roc', 0)
        if roc > 5:
            bullish_signals += 1
            reasoning.append(f"Strong positive momentum - ROC: {roc:.1f}%")
        elif roc < -5:
            bearish_signals += 1
            reasoning.append(f"Strong negative momentum - ROC: {roc:.1f}%")
        
        # Volatility Analysis
        atr = indicators.get('atr', 0)
        volatility = indicators.get('volatility', 0)
        if volatility > 0.3:  # High volatility
            bearish_signals += 1
            reasoning.append(f"High volatility detected - {volatility:.2f}")
        
        # Trend Strength Analysis
        adx = indicators.get('adx', 0)
        if adx > 25:
            if current_price > indicators.get('sma_20', current_price):
                bullish_signals += 1
                reasoning.append(f"Strong uptrend confirmed - ADX: {adx:.1f}")
            else:
                bearish_signals += 1
                reasoning.append(f"Strong downtrend confirmed - ADX: {adx:.1f}")
        
        aroon = indicators.get('aroon', {})
        aroon_osc = aroon.get('aroon_oscillator', 0)
        if aroon_osc > 50:
            bullish_signals += 1
            reasoning.append(f"Aroon indicates uptrend - Oscillator: {aroon_osc:.1f}")
        elif aroon_osc < -50:
            bearish_signals += 1
            reasoning.append(f"Aroon indicates downtrend - Oscillator: {aroon_osc:.1f}")
        
        # Volume-based Indicators
        mfi = indicators.get('mfi', 50)
        if mfi < 20:
            bullish_signals += 2
            reasoning.append(f"MFI oversold at {mfi:.1f} - Strong buy signal")
        elif mfi > 80:
            bearish_signals += 2
            reasoning.append(f"MFI overbought at {mfi:.1f} - Strong sell signal")
        
        vwap = indicators.get('vwap', current_price)
        if current_price > vwap * 1.01:
            bullish_signals += 1
            reasoning.append(f"Price above VWAP - Bullish bias")
        elif current_price < vwap * 0.99:
            bearish_signals += 1
            reasoning.append(f"Price below VWAP - Bearish bias")
        
        # Pivot Points Analysis
        pivot_points = indicators.get('pivot_points', {})
        if pivot_points:
            pivot = pivot_points.get('pivot', current_price)
            r1 = pivot_points.get('r1', current_price)
            s1 = pivot_points.get('s1', current_price)
            
            if current_price > r1:
                bullish_signals += 1
                reasoning.append("Price above R1 resistance - Bullish breakout")
            elif current_price < s1:
                bearish_signals += 1
                reasoning.append("Price below S1 support - Bearish breakdown")
        
        # Fibonacci Analysis
        fib_levels = indicators.get('fibonacci_levels', {})
        if fib_levels:
            fib_618 = fib_levels.get('fib_61.8', current_price)
            fib_382 = fib_levels.get('fib_38.2', current_price)
            
            # Check if price is near key Fibonacci levels
            if abs(current_price - fib_618) / current_price < 0.005:
                bullish_signals += 1
                reasoning.append("Price near 61.8% Fibonacci support")
            elif abs(current_price - fib_382) / current_price < 0.005:
                bullish_signals += 1
                reasoning.append("Price near 38.2% Fibonacci support")
        
        # Fear & Greed Index
        fear_greed = indicators.get('fear_greed', 50)
        if fear_greed < 25:
            bullish_signals += 2
            reasoning.append(f"Extreme fear detected - F&G: {fear_greed:.1f} (Contrarian buy)")
        elif fear_greed > 75:
            bearish_signals += 1
            reasoning.append(f"Extreme greed detected - F&G: {fear_greed:.1f} (Caution)")
        
        # Bull/Bear Power Analysis
        bull_bear = indicators.get('bull_bear_power', {})
        bull_power = bull_bear.get('bull_power', 0)
        bear_power = bull_bear.get('bear_power', 0)
        
        if bull_power > 0 and bear_power > 0:
            bullish_signals += 2
            reasoning.append("Both bull and bear power positive - Strong bullish momentum")
        elif bull_power > abs(bear_power):
            bullish_signals += 1
            reasoning.append("Bull power dominates - Bullish bias")
        elif abs(bear_power) > bull_power:
            bearish_signals += 1
            reasoning.append("Bear power dominates - Bearish bias")
        elif patterns.get('breakout_potential', {}).get('direction') == 'DOWN':
            bearish_signals += 1
            reasoning.append("Potential downward breakout detected")
        
        # Calculate confidence and action
        total_signals = bullish_signals + bearish_signals
        if total_signals == 0:
            confidence = 0
            action = "HOLD"
        else:
            signal_strength = abs(bullish_signals - bearish_signals)
            confidence = min(signal_strength / total_signals * 100, 95)
            
            if bullish_signals > bearish_signals + 1:
                action = "LONG"
            elif bearish_signals > bullish_signals + 1:
                action = "SHORT"
            else:
                action = "HOLD"
        
        return {
            "action": action,
            "confidence": confidence,
            "bullish_signals": bullish_signals,
            "bearish_signals": bearish_signals,
            "reasoning": reasoning,
            "signal_strength": signal_strength if total_signals > 0 else 0
        }
    
    # Helper methods for indicator calculations
    def _calculate_rsi(self, prices: pd.Series, period: int = 14) -> float:
        delta = prices.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
        rs = gain / loss
        rsi = 100 - (100 / (1 + rs))
        return rsi.iloc[-1] if not pd.isna(rsi.iloc[-1]) else 50
    
    def _calculate_macd(self, prices: pd.Series, fast=12, slow=26, signal=9) -> Tuple[float, float, float]:
        ema_fast = prices.ewm(span=fast).mean()
        ema_slow = prices.ewm(span=slow).mean()
        macd_line = ema_fast - ema_slow
        signal_line = macd_line.ewm(span=signal).mean()
        histogram = macd_line - signal_line
        
        return (
            macd_line.iloc[-1] if not pd.isna(macd_line.iloc[-1]) else 0,
            signal_line.iloc[-1] if not pd.isna(signal_line.iloc[-1]) else 0,
            histogram.iloc[-1] if not pd.isna(histogram.iloc[-1]) else 0
        )
    
    def _calculate_bollinger_bands(self, prices: pd.Series, period: int = 20, std_dev: int = 2) -> Tuple[float, float, float]:
        sma = prices.rolling(period).mean()
        std = prices.rolling(period).std()
        upper = sma + (std * std_dev)
        lower = sma - (std * std_dev)
        
        return (
            upper.iloc[-1] if not pd.isna(upper.iloc[-1]) else prices.iloc[-1],
            sma.iloc[-1] if not pd.isna(sma.iloc[-1]) else prices.iloc[-1],
            lower.iloc[-1] if not pd.isna(lower.iloc[-1]) else prices.iloc[-1]
        )
    
    def _get_bb_position(self, price: float, upper: float, lower: float) -> str:
        if price > upper:
            return "ABOVE_UPPER"
        elif price < lower:
            return "BELOW_LOWER"
        else:
            return "WITHIN_BANDS"
    
    def _calculate_stochastic(self, df: pd.DataFrame, period: int = 14) -> float:
        low_min = df['low'].rolling(period).min()
        high_max = df['high'].rolling(period).max()
        k_percent = 100 * ((df['close'] - low_min) / (high_max - low_min))
        return k_percent.iloc[-1] if not pd.isna(k_percent.iloc[-1]) else 50
    
    def _calculate_williams_r(self, df: pd.DataFrame, period: int = 14) -> float:
        high_max = df['high'].rolling(period).max()
        low_min = df['low'].rolling(period).min()
        williams_r = -100 * ((high_max - df['close']) / (high_max - low_min))
        return williams_r.iloc[-1] if not pd.isna(williams_r.iloc[-1]) else -50
    
    def _find_resistance_levels(self, highs: np.ndarray, closes: np.ndarray) -> List[float]:
        """Find resistance levels using local maxima"""
        resistance_levels = []
        for i in range(2, len(highs) - 2):
            if highs[i] > highs[i-1] and highs[i] > highs[i+1] and highs[i] > highs[i-2] and highs[i] > highs[i+2]:
                resistance_levels.append(highs[i])
        
        # Remove levels too close to each other
        resistance_levels = sorted(set(resistance_levels))
        filtered_levels = []
        for level in resistance_levels:
            if not any(abs(level - existing) / existing < 0.005 for existing in filtered_levels):
                filtered_levels.append(level)
        
        return sorted(filtered_levels)[-5:]  # Return top 5 resistance levels
    
    def _find_support_levels(self, lows: np.ndarray, closes: np.ndarray) -> List[float]:
        """Find support levels using local minima"""
        support_levels = []
        for i in range(2, len(lows) - 2):
            if lows[i] < lows[i-1] and lows[i] < lows[i+1] and lows[i] < lows[i-2] and lows[i] < lows[i+2]:
                support_levels.append(lows[i])
        
        # Remove levels too close to each other
        support_levels = sorted(set(support_levels))
        filtered_levels = []
        for level in support_levels:
            if not any(abs(level - existing) / existing < 0.005 for existing in filtered_levels):
                filtered_levels.append(level)
        
        return sorted(filtered_levels)[-5:]  # Return top 5 support levels
    
    def _detect_trend(self, df: pd.DataFrame) -> str:
        """Detect overall trend"""
        closes = df['close'].values[-20:]  # Last 20 periods
        if len(closes) < 10:
            return "INSUFFICIENT_DATA"
        
        # Linear regression to detect trend
        x = np.arange(len(closes))
        slope = np.polyfit(x, closes, 1)[0]
        
        if slope > closes[-1] * 0.001:  # 0.1% slope threshold
            return "UPTREND"
        elif slope < -closes[-1] * 0.001:
            return "DOWNTREND"
        else:
            return "SIDEWAYS"
    
    def _detect_candlestick_patterns(self, df: pd.DataFrame) -> List[str]:
        """Detect basic candlestick patterns"""
        patterns = []
        if len(df) < 3:
            return patterns
        
        last_3 = df.tail(3)
        
        # Doji pattern
        for i, row in last_3.iterrows():
            body_size = abs(row['close'] - row['open'])
            wick_size = row['high'] - row['low']
            if body_size < wick_size * 0.1:
                patterns.append("DOJI")
                break
        
        # Hammer/Hanging Man
        last_candle = df.iloc[-1]
        body_size = abs(last_candle['close'] - last_candle['open'])
        lower_wick = min(last_candle['open'], last_candle['close']) - last_candle['low']
        upper_wick = last_candle['high'] - max(last_candle['open'], last_candle['close'])
        
        if lower_wick > body_size * 2 and upper_wick < body_size * 0.5:
            patterns.append("HAMMER")
        
        return patterns
    
    def _detect_breakout_potential(self, df: pd.DataFrame) -> Dict:
        """Detect potential breakouts"""
        if len(df) < 20:
            return {}
        
        recent_highs = df['high'].tail(10).max()
        recent_lows = df['low'].tail(10).min()
        current_price = df['close'].iloc[-1]
        
        # Check if price is near recent highs or lows
        distance_to_high = (recent_highs - current_price) / current_price
        distance_to_low = (current_price - recent_lows) / current_price
        
        if distance_to_high < 0.01:  # Within 1% of recent high
            return {"direction": "UP", "probability": 0.7}
        elif distance_to_low < 0.01:  # Within 1% of recent low
            return {"direction": "DOWN", "probability": 0.7}
        
        return {}
    
    def _detect_divergence(self, df: pd.DataFrame) -> Dict:
        """Detect price-RSI divergence"""
        if len(df) < 30:
            return {}
        
        # Calculate RSI for divergence detection
        rsi_values = []
        for i in range(14, len(df)):
            rsi = self._calculate_rsi(df['close'].iloc[:i+1], 14)
            rsi_values.append(rsi)
        
        if len(rsi_values) < 10:
            return {}
        
        # Simple divergence detection (last 10 periods)
        price_trend = df['close'].tail(10).iloc[-1] - df['close'].tail(10).iloc[0]
        rsi_trend = rsi_values[-1] - rsi_values[-10]
        
        if price_trend > 0 and rsi_trend < 0:
            return {"type": "BEARISH_DIVERGENCE", "strength": "MODERATE"}
        elif price_trend < 0 and rsi_trend > 0:
            return {"type": "BULLISH_DIVERGENCE", "strength": "MODERATE"}
        
        return {}
    
    def get_analysis_history(self) -> List[Dict]:
        """Get recent analysis history"""
        return self.analysis_history[-20:]  # Last 20 analyses 
    
    # Advanced Indicator Calculations
    def _calculate_cci(self, df: pd.DataFrame, period: int = 20) -> float:
        """Calculate Commodity Channel Index"""
        typical_price = (df['high'] + df['low'] + df['close']) / 3
        sma_tp = typical_price.rolling(period).mean()
        mad = typical_price.rolling(period).apply(lambda x: np.mean(np.abs(x - x.mean())))
        cci = (typical_price - sma_tp) / (0.015 * mad)
        return cci.iloc[-1] if not pd.isna(cci.iloc[-1]) else 0
    
    def _calculate_roc(self, prices: pd.Series, period: int = 12) -> float:
        """Calculate Rate of Change"""
        roc = ((prices - prices.shift(period)) / prices.shift(period)) * 100
        return roc.iloc[-1] if not pd.isna(roc.iloc[-1]) else 0
    
    def _calculate_momentum(self, prices: pd.Series, period: int = 10) -> float:
        """Calculate Momentum"""
        momentum = prices - prices.shift(period)
        return momentum.iloc[-1] if not pd.isna(momentum.iloc[-1]) else 0
    
    def _calculate_atr(self, df: pd.DataFrame, period: int = 14) -> float:
        """Calculate Average True Range"""
        high_low = df['high'] - df['low']
        high_close = np.abs(df['high'] - df['close'].shift())
        low_close = np.abs(df['low'] - df['close'].shift())
        true_range = np.maximum(high_low, np.maximum(high_close, low_close))
        atr = pd.Series(true_range).rolling(period).mean()
        return atr.iloc[-1] if not pd.isna(atr.iloc[-1]) else 0
    
    def _calculate_volatility(self, prices: pd.Series, period: int = 20) -> float:
        """Calculate Price Volatility (Standard Deviation)"""
        returns = prices.pct_change()
        volatility = returns.rolling(period).std() * np.sqrt(252)  # Annualized
        return volatility.iloc[-1] if not pd.isna(volatility.iloc[-1]) else 0
    
    def _calculate_adx(self, df: pd.DataFrame, period: int = 14) -> float:
        """Calculate Average Directional Index"""
        high_diff = df['high'].diff()
        low_diff = df['low'].diff()
        
        plus_dm = np.where((high_diff > low_diff) & (high_diff > 0), high_diff, 0)
        minus_dm = np.where((low_diff > high_diff) & (low_diff > 0), low_diff, 0)
        
        atr = self._calculate_atr(df, period)
        if atr == 0:
            return 0
            
        plus_di = 100 * (pd.Series(plus_dm).rolling(period).mean() / atr)
        minus_di = 100 * (pd.Series(minus_dm).rolling(period).mean() / atr)
        
        dx = 100 * np.abs(plus_di - minus_di) / (plus_di + minus_di)
        adx = dx.rolling(period).mean()
        
        return adx.iloc[-1] if not pd.isna(adx.iloc[-1]) else 0
    
    def _calculate_aroon(self, df: pd.DataFrame, period: int = 14) -> Dict:
        """Calculate Aroon Up and Aroon Down"""
        if len(df) < period:
            return {'aroon_up': 50, 'aroon_down': 50, 'aroon_oscillator': 0}
            
        aroon_up = []
        aroon_down = []
        
        for i in range(period, len(df)):
            high_period = df['high'].iloc[i-period:i+1]
            low_period = df['low'].iloc[i-period:i+1]
            
            high_idx = high_period.idxmax()
            low_idx = low_period.idxmin()
            
            periods_since_high = i - high_period.index.get_loc(high_idx)
            periods_since_low = i - low_period.index.get_loc(low_idx)
            
            aroon_up.append(((period - periods_since_high) / period) * 100)
            aroon_down.append(((period - periods_since_low) / period) * 100)
        
        return {
            'aroon_up': aroon_up[-1] if aroon_up else 50,
            'aroon_down': aroon_down[-1] if aroon_down else 50,
            'aroon_oscillator': (aroon_up[-1] - aroon_down[-1]) if aroon_up and aroon_down else 0
        }
    
    def _calculate_obv(self, df: pd.DataFrame) -> float:
        """Calculate On-Balance Volume"""
        obv = [0]
        for i in range(1, len(df)):
            if df['close'].iloc[i] > df['close'].iloc[i-1]:
                obv.append(obv[-1] + df['volume'].iloc[i])
            elif df['close'].iloc[i] < df['close'].iloc[i-1]:
                obv.append(obv[-1] - df['volume'].iloc[i])
            else:
                obv.append(obv[-1])
        return obv[-1]
    
    def _calculate_mfi(self, df: pd.DataFrame, period: int = 14) -> float:
        """Calculate Money Flow Index"""
        typical_price = (df['high'] + df['low'] + df['close']) / 3
        money_flow = typical_price * df['volume']
        
        positive_flow = []
        negative_flow = []
        
        for i in range(1, len(df)):
            if typical_price.iloc[i] > typical_price.iloc[i-1]:
                positive_flow.append(money_flow.iloc[i])
                negative_flow.append(0)
            elif typical_price.iloc[i] < typical_price.iloc[i-1]:
                positive_flow.append(0)
                negative_flow.append(money_flow.iloc[i])
            else:
                positive_flow.append(0)
                negative_flow.append(0)
        
        positive_mf = pd.Series(positive_flow).rolling(period).sum()
        negative_mf = pd.Series(negative_flow).rolling(period).sum()
        
        # Avoid division by zero
        negative_mf = negative_mf.replace(0, 1)
        mfi = 100 - (100 / (1 + (positive_mf / negative_mf)))
        return mfi.iloc[-1] if not pd.isna(mfi.iloc[-1]) else 50
    
    def _calculate_vwap(self, df: pd.DataFrame) -> float:
        """Calculate Volume Weighted Average Price"""
        typical_price = (df['high'] + df['low'] + df['close']) / 3
        vwap = (typical_price * df['volume']).cumsum() / df['volume'].cumsum()
        return vwap.iloc[-1] if not pd.isna(vwap.iloc[-1]) else df['close'].iloc[-1]
    
    def _calculate_pivot_points(self, df: pd.DataFrame) -> Dict:
        """Calculate Pivot Points"""
        if len(df) < 2:
            return {}
        
        prev_high = df['high'].iloc[-2]
        prev_low = df['low'].iloc[-2]
        prev_close = df['close'].iloc[-2]
        
        pivot = (prev_high + prev_low + prev_close) / 3
        r1 = 2 * pivot - prev_low
        s1 = 2 * pivot - prev_high
        r2 = pivot + (prev_high - prev_low)
        s2 = pivot - (prev_high - prev_low)
        
        return {
            'pivot': pivot,
            'r1': r1, 'r2': r2,
            's1': s1, 's2': s2
        }
    
    def _calculate_fibonacci_retracements(self, df: pd.DataFrame) -> Dict:
        """Calculate Fibonacci Retracement Levels"""
        if len(df) < 20:
            return {}
        
        recent_data = df.tail(20)
        high = recent_data['high'].max()
        low = recent_data['low'].min()
        diff = high - low
        
        return {
            'high': high,
            'low': low,
            'fib_23.6': high - 0.236 * diff,
            'fib_38.2': high - 0.382 * diff,
            'fib_50.0': high - 0.5 * diff,
            'fib_61.8': high - 0.618 * diff,
            'fib_78.6': high - 0.786 * diff
        }
    
    def _calculate_fear_greed_index(self, df: pd.DataFrame) -> float:
        """Calculate a simplified Fear & Greed Index based on price action"""
        if len(df) < 20:
            return 50
        
        # Price momentum (25% weight)
        price_change = (df['close'].iloc[-1] - df['close'].iloc[-10]) / df['close'].iloc[-10]
        momentum_score = min(max((price_change * 100 + 50), 0), 100)
        
        # Volatility (25% weight)
        volatility = df['close'].pct_change().tail(10).std()
        volatility_score = min(max(100 - (volatility * 1000), 0), 100)
        
        # Volume (25% weight)
        avg_volume = df['volume'].tail(20).mean()
        current_volume = df['volume'].iloc[-1]
        volume_score = min(max((current_volume / avg_volume) * 50, 0), 100)
        
        # RSI (25% weight)
        rsi = self._calculate_rsi(df['close'], 14)
        rsi_score = rsi
        
        fear_greed = (momentum_score + volatility_score + volume_score + rsi_score) / 4
        return fear_greed
    
    def _calculate_bull_bear_power(self, df: pd.DataFrame) -> Dict:
        """Calculate Bull and Bear Power"""
        ema_13 = df['close'].ewm(span=13).mean()
        bull_power = df['high'] - ema_13
        bear_power = df['low'] - ema_13
        
        return {
            'bull_power': bull_power.iloc[-1] if not pd.isna(bull_power.iloc[-1]) else 0,
            'bear_power': bear_power.iloc[-1] if not pd.isna(bear_power.iloc[-1]) else 0,
            'power_balance': (bull_power.iloc[-1] + bear_power.iloc[-1]) if not pd.isna(bull_power.iloc[-1]) and not pd.isna(bear_power.iloc[-1]) else 0
        }