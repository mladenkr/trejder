import asyncio
import json
import websockets
import logging
import aiohttp
from typing import Callable, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

class MexcWebSocketService:
    def __init__(self):
        self.ws_url = "wss://wbs.mexc.com/ws"
        self.rest_url = "https://api.mexc.com/api/v3"
        self.connection = None
        self.is_connected = False
        self.callbacks = {}
        self.fallback_mode = False
        self.polling_tasks = {}
        
    async def connect(self):
        """Connect to MEXC WebSocket with fallback to REST API"""
        try:
            # Try WebSocket connection first
            self.connection = await websockets.connect(
                self.ws_url,
                timeout=10,
                ping_interval=20,
                ping_timeout=10
            )
            self.is_connected = True
            self.fallback_mode = False
            logger.info("Connected to MEXC WebSocket")
            
            # Start listening for messages
            asyncio.create_task(self._listen())
            
        except Exception as e:
            logger.warning(f"WebSocket connection failed: {e}")
            logger.info("Switching to REST API fallback mode")
            self.fallback_mode = True
            self.is_connected = True  # Consider connected in fallback mode
            
    async def disconnect(self):
        """Disconnect from WebSocket and stop polling tasks"""
        if self.connection:
            await self.connection.close()
            
        # Stop all polling tasks
        for task in self.polling_tasks.values():
            task.cancel()
        self.polling_tasks.clear()
        
        self.is_connected = False
        self.fallback_mode = False
        logger.info("Disconnected from MEXC services")
            
    async def _listen(self):
        """Listen for incoming WebSocket messages"""
        try:
            async for message in self.connection:
                data = json.loads(message)
                await self._handle_message(data)
        except websockets.exceptions.ConnectionClosed:
            logger.warning("WebSocket connection closed, switching to fallback mode")
            self.fallback_mode = True
            await self._start_fallback_polling()
        except Exception as e:
            logger.error(f"Error in WebSocket listener: {e}")
            self.fallback_mode = True
            await self._start_fallback_polling()
            
    async def _handle_message(self, data):
        """Handle incoming WebSocket messages"""
        try:
            logger.info(f"Received WebSocket message: {data}")
            
            # Check for subscription errors (blocked connections)
            if isinstance(data, dict) and 'msg' in data and 'Blocked!' in str(data.get('msg', '')):
                logger.warning(f"WebSocket blocked by MEXC: {data}")
                logger.info("Switching to REST API fallback mode")
                self.fallback_mode = True
                await self._start_fallback_polling()
                return
            
            # Handle different message types from MEXC
            if isinstance(data, dict):
                # Handle stream data format
                if 'stream' in data and 'data' in data:
                    stream_name = data['stream']
                    stream_data = data['data']
                    logger.info(f"Processing stream: {stream_name} with data: {stream_data}")
                    
                    # Route to appropriate callback
                    if stream_name in self.callbacks:
                        await self.callbacks[stream_name](stream_data)
                    else:
                        logger.warning(f"No callback found for stream: {stream_name}")
                
                # Handle direct ticker format (MEXC sometimes sends direct data)
                elif 'c' in data and 's' in data:  # Current price and symbol
                    logger.info(f"Processing direct ticker data: {data}")
                    # This is ticker data
                    for callback_name, callback in self.callbacks.items():
                        if '@ticker' in callback_name:
                            await callback(data)
                            break
                
                # Handle trade data format
                elif 'p' in data and 'q' in data and 's' in data:  # Price, quantity, symbol
                    logger.info(f"Processing direct trade data: {data}")
                    # This is trade data
                    for callback_name, callback in self.callbacks.items():
                        if '@trade' in callback_name:
                            await callback(data)
                            break
                else:
                    logger.info(f"Unhandled message format: {data}")
                            
        except Exception as e:
            logger.error(f"Error handling WebSocket message: {e}")
    
    async def _start_fallback_polling(self):
        """Start REST API polling for active subscriptions"""
        logger.info("Starting REST API fallback polling")
        
        for stream_name, callback in self.callbacks.items():
            if '@ticker' in stream_name:
                symbol = stream_name.split('@')[0].upper()
                task = asyncio.create_task(self._poll_ticker(symbol, callback))
                self.polling_tasks[stream_name] = task
            elif '@trade' in stream_name:
                symbol = stream_name.split('@')[0].upper()
                task = asyncio.create_task(self._poll_trades(symbol, callback))
                self.polling_tasks[stream_name] = task
    
    async def _poll_ticker(self, symbol: str, callback: Callable):
        """Poll ticker data via REST API"""
        while self.fallback_mode and self.is_connected:
            try:
                async with aiohttp.ClientSession() as session:
                    url = f"{self.rest_url}/ticker/24hr?symbol={symbol}"
                    async with session.get(url) as response:
                        if response.status == 200:
                            data = await response.json()
                            # Convert REST format to WebSocket format
                            ticker_data = {
                                's': data.get('symbol'),
                                'c': data.get('lastPrice'),
                                'o': data.get('openPrice'),
                                'h': data.get('highPrice'),
                                'l': data.get('lowPrice'),
                                'v': data.get('volume'),
                                'q': data.get('quoteVolume'),
                                'P': data.get('priceChangePercent')
                            }
                            await callback(ticker_data)
                        else:
                            logger.warning(f"REST API error for ticker: {response.status}")
                            
                await asyncio.sleep(2)  # Poll every 2 seconds
                
            except Exception as e:
                logger.error(f"Error polling ticker data: {e}")
                await asyncio.sleep(5)
    
    async def _poll_trades(self, symbol: str, callback: Callable):
        """Poll recent trades via REST API"""
        last_trade_id = None
        
        while self.fallback_mode and self.is_connected:
            try:
                async with aiohttp.ClientSession() as session:
                    url = f"{self.rest_url}/trades?symbol={symbol}&limit=10"
                    async with session.get(url) as response:
                        if response.status == 200:
                            trades = await response.json()
                            
                            # Only send new trades
                            for trade in trades:
                                if last_trade_id is None or trade['id'] > last_trade_id:
                                    trade_data = {
                                        's': symbol,
                                        'p': trade['price'],
                                        'q': trade['qty'],
                                        't': trade['time'],
                                        'T': trade['time'],
                                        'm': trade['isBuyerMaker']
                                    }
                                    await callback(trade_data)
                                    last_trade_id = trade['id']
                        else:
                            logger.warning(f"REST API error for trades: {response.status}")
                            
                await asyncio.sleep(1)  # Poll every 1 second for trades
                
            except Exception as e:
                logger.error(f"Error polling trade data: {e}")
                await asyncio.sleep(5)
            
    async def subscribe_ticker(self, symbol: str, callback: Callable):
        """Subscribe to real-time ticker updates (price changes every ~100ms)"""
        stream_name = f"{symbol.lower()}@ticker"
        self.callbacks[stream_name] = callback
        
        if self.fallback_mode:
            # Start polling immediately in fallback mode
            task = asyncio.create_task(self._poll_ticker(symbol.upper(), callback))
            self.polling_tasks[stream_name] = task
            logger.info(f"Started REST API polling for ticker: {symbol}")
        elif self.is_connected:
            # Use WebSocket subscription
            subscribe_msg = {
                "method": "SUBSCRIPTION",
                "params": [stream_name],
                "id": 1
            }
            await self.connection.send(json.dumps(subscribe_msg))
            logger.info(f"Subscribed to ticker stream: {stream_name}")
            
    async def subscribe_kline(self, symbol: str, interval: str, callback: Callable):
        """Subscribe to real-time kline updates"""
        stream_name = f"{symbol.lower()}@kline_{interval}"
        self.callbacks[stream_name] = callback
        
        if not self.fallback_mode and self.is_connected:
            subscribe_msg = {
                "method": "SUBSCRIPTION", 
                "params": [stream_name],
                "id": 2
            }
            await self.connection.send(json.dumps(subscribe_msg))
            logger.info(f"Subscribed to kline stream: {stream_name}")
        else:
            logger.info(f"Kline subscription queued for fallback mode: {stream_name}")
            
    async def subscribe_trade(self, symbol: str, callback: Callable):
        """Subscribe to real-time trade updates (every trade execution)"""
        stream_name = f"{symbol.lower()}@trade"
        self.callbacks[stream_name] = callback
        
        if self.fallback_mode:
            # Start polling immediately in fallback mode
            task = asyncio.create_task(self._poll_trades(symbol.upper(), callback))
            self.polling_tasks[stream_name] = task
            logger.info(f"Started REST API polling for trades: {symbol}")
        elif self.is_connected:
            subscribe_msg = {
                "method": "SUBSCRIPTION",
                "params": [stream_name], 
                "id": 3
            }
            await self.connection.send(json.dumps(subscribe_msg))
            logger.info(f"Subscribed to trade stream: {stream_name}")
            
    async def subscribe_depth(self, symbol: str, callback: Callable, levels: int = 20):
        """Subscribe to real-time order book depth updates"""
        stream_name = f"{symbol.lower()}@depth{levels}"
        self.callbacks[stream_name] = callback
        
        if not self.fallback_mode and self.is_connected:
            subscribe_msg = {
                "method": "SUBSCRIPTION",
                "params": [stream_name],
                "id": 4
            }
            await self.connection.send(json.dumps(subscribe_msg))
            logger.info(f"Subscribed to depth stream: {stream_name}")
        else:
            logger.info(f"Depth subscription queued for fallback mode: {stream_name}")

    async def unsubscribe(self, stream_name: str):
        """Unsubscribe from a stream"""
        if stream_name in self.callbacks:
            del self.callbacks[stream_name]
            
        # Cancel polling task if exists
        if stream_name in self.polling_tasks:
            self.polling_tasks[stream_name].cancel()
            del self.polling_tasks[stream_name]
            
        if not self.fallback_mode and self.is_connected:
            unsubscribe_msg = {
                "method": "UNSUBSCRIPTION",
                "params": [stream_name],
                "id": 5
            }
            await self.connection.send(json.dumps(unsubscribe_msg))
            
        logger.info(f"Unsubscribed from stream: {stream_name}")
            
    def get_status(self):
        """Get current WebSocket status"""
        return {
            "is_connected": self.is_connected,
            "fallback_mode": self.fallback_mode,
            "connection_type": "REST API Polling" if self.fallback_mode else "WebSocket",
            "active_streams": list(self.callbacks.keys()),
            "active_polling_tasks": len(self.polling_tasks),
            "data_frequencies": {
                "ticker": "2 seconds (REST fallback)" if self.fallback_mode else "~100ms (WebSocket)",
                "trades": "1 second (REST fallback)" if self.fallback_mode else "Immediate (WebSocket)",
                "klines": "REST API only",
                "depth": "WebSocket only"
            },
            "rate_limits": {
                "websocket": "No rate limits (real-time)",
                "rest_api": "500 requests per 10 seconds"
            }
        }

# Global WebSocket service instance
mexc_ws_service = MexcWebSocketService() 