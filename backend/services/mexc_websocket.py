import asyncio
import json
import websockets
import logging
from typing import Callable, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

class MexcWebSocketService:
    def __init__(self):
        self.ws_url = "wss://wbs.mexc.com/ws"
        self.connection = None
        self.is_connected = False
        self.callbacks = {}
        
    async def connect(self):
        """Connect to MEXC WebSocket"""
        try:
            self.connection = await websockets.connect(self.ws_url)
            self.is_connected = True
            logger.info("Connected to MEXC WebSocket")
            
            # Start listening for messages
            asyncio.create_task(self._listen())
            
        except Exception as e:
            logger.error(f"Failed to connect to MEXC WebSocket: {e}")
            self.is_connected = False
            
    async def disconnect(self):
        """Disconnect from WebSocket"""
        if self.connection:
            await self.connection.close()
            self.is_connected = False
            logger.info("Disconnected from MEXC WebSocket")
            
    async def _listen(self):
        """Listen for incoming WebSocket messages"""
        try:
            async for message in self.connection:
                data = json.loads(message)
                await self._handle_message(data)
        except websockets.exceptions.ConnectionClosed:
            logger.warning("WebSocket connection closed")
            self.is_connected = False
        except Exception as e:
            logger.error(f"Error in WebSocket listener: {e}")
            
    async def _handle_message(self, data):
        """Handle incoming WebSocket messages"""
        try:
            logger.info(f"Received WebSocket message: {data}")
            
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
            
    async def subscribe_ticker(self, symbol: str, callback: Callable):
        """Subscribe to real-time ticker updates (price changes every ~100ms)"""
        stream_name = f"{symbol.lower()}@ticker"
        self.callbacks[stream_name] = callback
        
        subscribe_msg = {
            "method": "SUBSCRIPTION",
            "params": [stream_name],
            "id": 1
        }
        
        if self.is_connected:
            await self.connection.send(json.dumps(subscribe_msg))
            logger.info(f"Subscribed to ticker stream: {stream_name}")
            
    async def subscribe_kline(self, symbol: str, interval: str, callback: Callable):
        """Subscribe to real-time kline updates"""
        stream_name = f"{symbol.lower()}@kline_{interval}"
        self.callbacks[stream_name] = callback
        
        subscribe_msg = {
            "method": "SUBSCRIPTION", 
            "params": [stream_name],
            "id": 2
        }
        
        if self.is_connected:
            await self.connection.send(json.dumps(subscribe_msg))
            logger.info(f"Subscribed to kline stream: {stream_name}")
            
    async def subscribe_trade(self, symbol: str, callback: Callable):
        """Subscribe to real-time trade updates (every trade execution)"""
        stream_name = f"{symbol.lower()}@trade"
        self.callbacks[stream_name] = callback
        
        subscribe_msg = {
            "method": "SUBSCRIPTION",
            "params": [stream_name], 
            "id": 3
        }
        
        if self.is_connected:
            await self.connection.send(json.dumps(subscribe_msg))
            logger.info(f"Subscribed to trade stream: {stream_name}")
            
    async def subscribe_depth(self, symbol: str, callback: Callable, levels: int = 20):
        """Subscribe to real-time order book depth updates"""
        stream_name = f"{symbol.lower()}@depth{levels}"
        self.callbacks[stream_name] = callback
        
        subscribe_msg = {
            "method": "SUBSCRIPTION",
            "params": [stream_name],
            "id": 4
        }
        
        if self.is_connected:
            await self.connection.send(json.dumps(subscribe_msg))
            logger.info(f"Subscribed to depth stream: {stream_name}")

    async def unsubscribe(self, stream_name: str):
        """Unsubscribe from a stream"""
        if stream_name in self.callbacks:
            del self.callbacks[stream_name]
            
        unsubscribe_msg = {
            "method": "UNSUBSCRIPTION",
            "params": [stream_name],
            "id": 5
        }
        
        if self.is_connected:
            await self.connection.send(json.dumps(unsubscribe_msg))
            logger.info(f"Unsubscribed from stream: {stream_name}")
            
    def get_status(self):
        """Get current WebSocket status"""
        return {
            "is_connected": self.is_connected,
            "active_streams": list(self.callbacks.keys()),
            "data_frequencies": {
                "ticker": "~100ms (price changes)",
                "trades": "Immediate (every execution)",
                "klines": "On candle close",
                "depth": "On order book changes"
            },
            "rate_limits": {
                "websocket": "No rate limits (real-time)",
                "rest_api": "500 requests per 10 seconds"
            }
        }

# Global WebSocket service instance
mexc_ws_service = MexcWebSocketService() 