from fastapi import FastAPI, HTTPException, WebSocket, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, List
from contextlib import asynccontextmanager
import json
import asyncio
from datetime import datetime
import websockets
import logging
import os
from services.mexc_service import MexcService
from services.trading_strategy import TradingStrategy
from services.ai_analysis import AITradingAnalysis
from services.mexc_websocket import mexc_ws_service
from services.database_service import DatabaseService
import time

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# We'll initialize the app after defining lifespan function

# Store for active WebSocket connections
active_connections: List[WebSocket] = []

# Background task reference
ai_analysis_task_ref = None

# Trading state
trading_state = {
    "is_trading": False,
    "api_key": None,
    "api_secret": None,
    "initial_balance": None,
    "current_balance": None,
    "trades": [],
    "last_price": None,
    "mexc_service": None,
    "trading_strategy": None,
    "ai_analysis": AITradingAnalysis(),
    "database_service": DatabaseService(),
    "auto_analysis_enabled": True,  # Start AI analysis by default
    "auto_trading_enabled": False  # Auto trading is paused by default
}

# Removed candle aggregation - focusing on real-time WebSocket data

# Removed candle aggregation functions - using real-time WebSocket data instead

class TradingCredentials(BaseModel):
    api_key: str
    api_secret: str

# WebSocket callback functions for real-time data
async def handle_ticker_update(data):
    """Handle ticker updates from WebSocket - Real-time price data for fast trading decisions"""
    try:
        if 'c' in data:  # Current price
            price = float(data['c'])
            timestamp = time.time()
            
            # Update global trading state with latest price
            trading_state["last_price"] = price
            
            # Broadcast real-time price to connected WebSocket clients
            broadcast_data = {
                "type": "price_update",
                "data": {
                    "price": price,
                    "timestamp": timestamp,
                    "symbol": data.get('s', 'BTCUSDT'),
                    "volume": data.get('v', 0),
                    "change": data.get('P', 0),
                    "high": data.get('h', 0),
                    "low": data.get('l', 0)
                }
            }
            asyncio.create_task(broadcast_to_websockets(broadcast_data))
        else:
            logger.debug(f"Ticker data missing 'c' field: {data}")
    except Exception as e:
        logger.error(f"Error handling ticker update: {e}")

async def handle_trade_update(data):
    """Handle trade updates from WebSocket - Immediate trade execution data"""
    try:
        if 'p' in data:  # Trade price
            price = float(data['p'])
            volume = float(data.get('q', 0))  # Trade quantity
            timestamp = time.time()
            
            # Update global trading state with latest trade price
            trading_state["last_price"] = price
            
            # Broadcast real-time trade data to connected WebSocket clients
            broadcast_data = {
                "type": "trade_update",
                "data": {
                    "price": price,
                    "volume": volume,
                    "timestamp": timestamp,
                    "symbol": data.get('s', 'BTCUSDT'),
                    "side": data.get('m', False)  # True = buyer is market maker
                }
            }
            asyncio.create_task(broadcast_to_websockets(broadcast_data))
    except Exception as e:
        logger.error(f"Error handling trade update: {e}")

async def broadcast_to_websockets(data):
    """Broadcast data to all connected WebSocket clients"""
    if active_connections:
        for connection in active_connections:
            try:
                await connection.send_json(data)
            except Exception as e:
                logger.error(f"Error broadcasting to WebSocket client: {e}")

async def update_market_data():
    """Background task to update market data"""
    while trading_state["is_trading"]:
        try:
            # Get latest price
            price = trading_state["mexc_service"].get_btc_price()
            trading_state["last_price"] = price

            # Log price to database (every 10th update to avoid spam)
            if hasattr(update_market_data, 'price_log_counter'):
                update_market_data.price_log_counter += 1
            else:
                update_market_data.price_log_counter = 1
            
            if update_market_data.price_log_counter % 10 == 0:
                await trading_state["database_service"].log_price(price)

            # Get klines for technical analysis
            klines = trading_state["mexc_service"].get_klines(interval='1m', limit=100)
            indicators = trading_state["trading_strategy"].calculate_indicators(klines)

            # Check if we should trade (only if auto trading is enabled)
            should_trade, action, confidence = trading_state["trading_strategy"].should_trade()

            if should_trade and trading_state["auto_trading_enabled"]:
                # Get current balance
                balance = trading_state["mexc_service"].get_account_balance()
                usdt_balance = float(next((asset['free'] for asset in balance['balances'] if asset['asset'] == 'USDT'), 0))
                btc_balance = float(next((asset['free'] for asset in balance['balances'] if asset['asset'] == 'BTC'), 0))

                if action == 'BUY' and usdt_balance > 0:
                    # Calculate quantity based on USDT balance
                    quantity = (usdt_balance * 0.95) / price  # Use 95% of balance
                    order = trading_state["mexc_service"].place_order('BUY', quantity, price=price)
                    logger.info(f"Placed BUY order: {order}")
                    
                    # Log trade to database
                    await trading_state["database_service"].log_trade(
                        action="BUY",
                        price=price,
                        quantity=quantity,
                        balance_before=usdt_balance + (btc_balance * price),
                        balance_after=(usdt_balance * 0.05) + ((btc_balance + quantity) * price),
                        order_id=order.get('orderId') if order else None,
                        metadata={"confidence": confidence, "indicators": indicators}
                    )
                    
                    trading_state["trades"].append({
                        "type": "BUY",
                        "price": price,
                        "quantity": quantity,
                        "timestamp": datetime.now().isoformat()
                    })
                    trading_state["trading_strategy"].update_position('BUY')

                elif action == 'SELL' and btc_balance > 0:
                    order = trading_state["mexc_service"].place_order('SELL', btc_balance, price=price)
                    logger.info(f"Placed SELL order: {order}")
                    
                    # Log trade to database
                    await trading_state["database_service"].log_trade(
                        action="SELL",
                        price=price,
                        quantity=btc_balance,
                        balance_before=usdt_balance + (btc_balance * price),
                        balance_after=(usdt_balance + (btc_balance * price)),
                        order_id=order.get('orderId') if order else None,
                        metadata={"confidence": confidence, "indicators": indicators}
                    )
                    
                    trading_state["trades"].append({
                        "type": "SELL",
                        "price": price,
                        "quantity": btc_balance,
                        "timestamp": datetime.now().isoformat()
                    })
                    trading_state["trading_strategy"].update_position('SELL')

            # Update current balance
            balance = trading_state["mexc_service"].get_account_balance()
            usdt_balance = float(next((asset['free'] for asset in balance['balances'] if asset['asset'] == 'USDT'), 0))
            btc_balance = float(next((asset['free'] for asset in balance['balances'] if asset['asset'] == 'BTC'), 0))
            trading_state["current_balance"] = usdt_balance + (btc_balance * price)

            # Broadcast update to all connected clients
            for connection in active_connections:
                try:
                    await connection.send_json({
                        "type": "trading_update",
                        "data": {
                            "last_price": price,
                            "current_balance": trading_state["current_balance"],
                            "initial_balance": trading_state["initial_balance"],
                            "indicators": indicators,
                            "timestamp": datetime.now().isoformat()
                        }
                    })
                except Exception as e:
                    logger.error(f"Error sending update to client: {e}")

        except Exception as e:
            logger.error(f"Error in market data update: {e}")

        await asyncio.sleep(1)  # Update every second

async def ai_analysis_task():
    """Background task for AI analysis every minute"""
    while trading_state["auto_analysis_enabled"]:
        try:
            # Get 15m klines for analysis (better for swing trading)
            mexc_service = MexcService("", "")  # Public data doesn't need auth
            klines_15m = mexc_service.get_klines(interval='15m', limit=200)
            current_price = mexc_service.get_btc_price()
            
            # Perform AI analysis
            analysis = trading_state["ai_analysis"].analyze_market(klines_15m, current_price)
            
            # Log AI analysis to database
            ai_decision = analysis.get('ai_decision', {})
            reasoning = ai_decision.get('reasoning', [])
            # Convert reasoning list to string if needed
            reasoning_str = '; '.join(reasoning) if isinstance(reasoning, list) else str(reasoning)
            
            await trading_state["database_service"].log_ai_analysis(
                current_price=current_price,
                recommendation=ai_decision.get('action', 'HOLD'),
                confidence=analysis.get('confidence_score', 0),
                reasoning=reasoning_str,
                technical_indicators=analysis.get('indicators', {}),
                metadata=analysis
            )
            
            # Broadcast AI analysis to all connected clients
            for connection in active_connections:
                try:
                    await connection.send_json({
                        "type": "ai_analysis",
                        "data": analysis
                    })
                except Exception as e:
                    logger.error(f"Error sending AI analysis to client: {e}")
            
            logger.info(f"AI Analysis: {analysis.get('ai_decision', {}).get('action', 'HOLD')} - Confidence: {analysis.get('confidence_score', 0):.1f}%")
            
        except Exception as e:
            logger.error(f"Error in AI analysis: {e}")
        
        await asyncio.sleep(60)  # Analyze every minute

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Modern FastAPI lifespan event handler"""
    global ai_analysis_task_ref
    
    # Startup
    logger.info("🚀 Starting Bitcoin Trading Bot...")
    
    try:
        # Initialize database connection
        logger.info("📊 Connecting to Railway PostgreSQL database...")
        database_url = os.environ.get('DATABASE_URL')
        railway_env = os.environ.get('RAILWAY_ENVIRONMENT')
        
        logger.info(f"🌐 Environment: {railway_env or 'Local'}")
        logger.info(f"🔗 Database URL configured: {'Yes' if database_url else 'No'}")
        
        if database_url:
            # Log masked URL for debugging
            masked_url = database_url[:30] + "..." + database_url[-20:] if len(database_url) > 50 else database_url
            logger.info(f"🔍 Database URL format: {masked_url}")
        
        db_connected = await trading_state["database_service"].connect()
        if db_connected:
            logger.info("✅ Connected to Railway PostgreSQL database successfully")
            await trading_state["database_service"].log_system_event(
                "INFO", "startup", "Trading bot started successfully"
            )
        else:
            logger.warning("⚠️ Database connection failed - continuing without database logging")
            if not database_url:
                logger.error("❌ DATABASE_URL environment variable not set in Railway!")
            else:
                logger.error("❌ Database connection failed despite URL being configured")
        
        # Start WebSocket connection for real-time data
        logger.info("🔌 Connecting to MEXC WebSocket...")
        await mexc_ws_service.connect()
        
        # Subscribe to real-time BTC price updates
        await mexc_ws_service.subscribe_ticker("BTCUSDT", handle_ticker_update)
        
        # Subscribe to real-time trade updates for immediate price changes
        await mexc_ws_service.subscribe_trade("BTCUSDT", handle_trade_update)
        
        if mexc_ws_service.fallback_mode:
            logger.info("MEXC WebSocket in fallback mode - using REST API polling")
            logger.info("Data will be updated every 1-2 seconds instead of real-time")
        else:
            logger.info("WebSocket connections established successfully")
        
    except Exception as e:
        logger.error(f"Error setting up connections: {e}")
        logger.info("Application will continue with limited functionality")
    
    if trading_state["auto_analysis_enabled"]:
        ai_analysis_task_ref = asyncio.create_task(ai_analysis_task())
        logger.info("🤖 AI Analysis started automatically on server startup")
    
    yield  # Application runs here
    
    # Shutdown
    logger.info("🛑 Shutting down Bitcoin Trading Bot...")
    
    # Log shutdown event
    try:
        await trading_state["database_service"].log_system_event(
            "INFO", "shutdown", "Trading bot shutting down"
        )
        await trading_state["database_service"].disconnect()
        logger.info("📊 Database connection closed")
    except Exception as e:
        logger.error(f"Error during database shutdown: {e}")
    
    # Disconnect WebSocket
    await mexc_ws_service.disconnect()
    logger.info("🔌 WebSocket connections closed")
    
    if ai_analysis_task_ref:
        ai_analysis_task_ref.cancel()
        logger.info("🤖 AI Analysis task cancelled")

# Initialize FastAPI app with lifespan
app = FastAPI(lifespan=lifespan)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/start-trading")
async def start_trading(credentials: TradingCredentials, background_tasks: BackgroundTasks):
    if trading_state["is_trading"]:
        raise HTTPException(status_code=400, detail="Trading is already active")
    
    try:
        # Initialize MEXC service
        mexc_service = MexcService(credentials.api_key, credentials.api_secret)
        
        # Get initial balance
        balance = mexc_service.get_account_balance()
        usdt_balance = float(next((asset['free'] for asset in balance['balances'] if asset['asset'] == 'USDT'), 0))
        btc_balance = float(next((asset['free'] for asset in balance['balances'] if asset['asset'] == 'BTC'), 0))
        initial_price = mexc_service.get_btc_price()
        
        trading_state.update({
            "is_trading": True,
            "api_key": credentials.api_key,
            "api_secret": credentials.api_secret,
            "initial_balance": usdt_balance + (btc_balance * initial_price),
            "current_balance": usdt_balance + (btc_balance * initial_price),
            "mexc_service": mexc_service,
            "trading_strategy": TradingStrategy()
        })
        
        # Start background task for market data updates
        background_tasks.add_task(update_market_data)
        
        return {"status": "Trading started successfully"}
    except Exception as e:
        logger.error(f"Error starting trading: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/stop-trading")
async def stop_trading():
    if not trading_state["is_trading"]:
        raise HTTPException(status_code=400, detail="Trading is not active")
    
    trading_state["is_trading"] = False
    trading_state["api_key"] = None
    trading_state["api_secret"] = None
    trading_state["mexc_service"] = None
    trading_state["trading_strategy"] = None
    
    return {"status": "Trading stopped successfully"}

@app.get("/api/trading-status")
async def get_trading_status():
    return {
        "is_trading": trading_state["is_trading"],
        "initial_balance": trading_state["initial_balance"],
        "current_balance": trading_state["current_balance"],
        "trades": trading_state["trades"]
    }

@app.get("/api/klines")
async def get_klines(interval: str = "1m", limit: int = 100):
    """Get BTC/USDT kline data from MEXC API - Real-time WebSocket provides high-frequency price updates"""
    try:
        # Use MEXC API for all intervals (1m, 5m, 15m, etc.)
        mexc_service = MexcService("", "")
        klines = mexc_service.get_klines(interval=interval, limit=limit)
        
        # Convert MEXC kline format to lightweight-charts format
        chart_data = []
        for kline in klines:
            chart_data.append({
                "time": int(kline[0]) / 1000,  # Convert to seconds
                "open": float(kline[1]),
                "high": float(kline[2]),
                "low": float(kline[3]),
                "close": float(kline[4]),
                "volume": float(kline[5])
            })
        
        return {
            "success": True,
            "data": chart_data,
            "interval": interval,
            "source": "mexc_api",
            "note": "Real-time price updates available via WebSocket (~100ms frequency)"
        }
    except Exception as e:
        logger.error(f"Error fetching klines: {e}")
        return {
            "success": False,
            "error": str(e),
            "data": []
        }

@app.get("/api/trading-history")
async def get_trading_history():
    """Get trading history"""
    return trading_state["trades"]

@app.get("/api/settings")
async def get_settings():
    """Get trading settings"""
    return {
        "trading_pair": "BTC/USDT",
        "timeframe": "1m",
        "initial_balance": 1000,
        "max_position_size": 0.1,
        "stop_loss_percentage": 2,
        "take_profit_percentage": 4,
        "enable_indicators": True,
        "rsi_period": 14,
        "rsi_overbought": 70,
        "rsi_oversold": 30,
        "macd_fast": 12,
        "macd_slow": 26,
        "macd_signal": 9,
    }

@app.post("/api/settings")
async def save_settings(settings: dict):
    """Save trading settings"""
    # In a real application, you would save these to a database
    logger.info(f"Settings saved: {settings}")
    return {"status": "Settings saved successfully"}

@app.post("/api/start-ai-analysis")
async def start_ai_analysis():
    """Start AI analysis background task"""
    global ai_analysis_task_ref
    if trading_state["auto_analysis_enabled"] and ai_analysis_task_ref and not ai_analysis_task_ref.done():
        raise HTTPException(status_code=400, detail="AI analysis is already running")
    
    trading_state["auto_analysis_enabled"] = True
    ai_analysis_task_ref = asyncio.create_task(ai_analysis_task())
    
    return {"status": "AI analysis started"}

@app.post("/api/stop-ai-analysis")
async def stop_ai_analysis():
    """Stop AI analysis background task"""
    global ai_analysis_task_ref
    if not trading_state["auto_analysis_enabled"]:
        raise HTTPException(status_code=400, detail="AI analysis is not running")
    
    trading_state["auto_analysis_enabled"] = False
    if ai_analysis_task_ref:
        ai_analysis_task_ref.cancel()
        ai_analysis_task_ref = None
    
    return {"status": "AI analysis stopped"}

@app.get("/api/ai-analysis-status")
async def get_ai_analysis_status():
    """Get AI analysis status"""
    return {
        "is_running": trading_state["auto_analysis_enabled"],
        "last_analysis": trading_state["ai_analysis"].analysis_history[-1] if trading_state["ai_analysis"].analysis_history else None
    }

@app.get("/api/ai-analysis-history")
async def get_ai_analysis_history():
    """Get AI analysis history"""
    return trading_state["ai_analysis"].get_analysis_history()

@app.get("/api/manual-ai-analysis")
async def manual_ai_analysis():
    """Trigger manual AI analysis"""
    try:
        mexc_service = MexcService("", "")  # Public data doesn't need auth
        klines_15m = mexc_service.get_klines(interval='15m', limit=200)
        current_price = mexc_service.get_btc_price()
        
        analysis = trading_state["ai_analysis"].analyze_market(klines_15m, current_price)
        return analysis
    except Exception as e:
        logger.error(f"Error in manual AI analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/start-auto-trading")
async def start_auto_trading():
    """Start auto trading"""
    try:
        trading_state["auto_trading_enabled"] = True
        logger.info("Auto trading started")
        return {"status": "success", "message": "Auto trading started", "auto_trading_enabled": True}
    except Exception as e:
        logger.error(f"Error starting auto trading: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/pause-auto-trading")
async def pause_auto_trading():
    """Pause auto trading"""
    try:
        trading_state["auto_trading_enabled"] = False
        logger.info("Auto trading paused")
        return {"status": "success", "message": "Auto trading paused", "auto_trading_enabled": False}
    except Exception as e:
        logger.error(f"Error pausing auto trading: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/auto-trading-status")
async def get_auto_trading_status():
    """Get auto trading status"""
    return {
        "auto_trading_enabled": trading_state["auto_trading_enabled"],
        "is_trading": trading_state["is_trading"]
    }

@app.post("/api/set-update-frequency")
async def set_update_frequency(frequency: dict):
    """Set the update frequency for different data streams"""
    try:
        # Disconnect current streams
        await mexc_ws_service.disconnect()
        
        # Reconnect with new settings
        await mexc_ws_service.connect()
        
        # Subscribe based on requested frequency
        if frequency.get("enable_ticker", True):
            await mexc_ws_service.subscribe_ticker("BTCUSDT", handle_ticker_update)
            
        if frequency.get("enable_trades", True):
            await mexc_ws_service.subscribe_trade("BTCUSDT", handle_trade_update)
            
        if frequency.get("enable_klines", False):
            interval = frequency.get("kline_interval", "1m")
            await mexc_ws_service.subscribe_kline("BTCUSDT", interval, handle_kline_update)
            
        return {
            "status": "Update frequency configured",
            "settings": frequency,
            "info": {
                "ticker_updates": "~100ms (real-time price changes)",
                "trade_updates": "Immediate (every trade execution)",
                "kline_updates": f"Every {frequency.get('kline_interval', '1m')} candle close"
            }
        }
    except Exception as e:
        logger.error(f"Error setting update frequency: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def handle_kline_update(data):
    """Handle real-time kline updates from MEXC WebSocket"""
    try:
        # This gives us completed candle data
        kline_data = {
            "open_time": data['t'],
            "close_time": data['T'],
            "open": float(data['o']),
            "high": float(data['h']),
            "low": float(data['l']),
            "close": float(data['c']),
            "volume": float(data['v']),
            "is_closed": data['x']  # True when kline is closed
        }
        
        # Only process closed klines for analysis
        if kline_data["is_closed"]:
            # Broadcast kline update to all connected clients
            for connection in active_connections:
                try:
                    await connection.send_json({
                        "type": "kline_update",
                        "data": kline_data
                    })
                except Exception as e:
                    logger.error(f"Error sending kline update to client: {e}")
                    
    except Exception as e:
        logger.error(f"Error handling kline update: {e}")

@app.get("/api/websocket-status")
async def get_websocket_status():
    """Get WebSocket connection status and data frequency info"""
    status = mexc_ws_service.get_status()
    status["deployment_info"] = {
        "platform": "Railway" if "RAILWAY_ENVIRONMENT" in os.environ else "Local",
        "fallback_reason": "MEXC WebSocket blocked by hosting provider" if status["fallback_mode"] else None,
        "performance_impact": "Minimal - REST API provides same data with 1-2s delay" if status["fallback_mode"] else None
    }
    return status

@app.get("/api/connection-status")
async def get_connection_status():
    """Get detailed connection status for troubleshooting"""
    try:
        # Test MEXC REST API connectivity
        mexc_service = MexcService("", "")
        price = mexc_service.get_btc_price()
        rest_api_working = True
    except Exception as e:
        price = None
        rest_api_working = False
        
    return {
        "rest_api": {
            "working": rest_api_working,
            "last_price": price,
            "endpoint": "https://api.mexc.com/api/v3",
            "error": str(e) if not rest_api_working else None
        },
        "websocket": mexc_ws_service.get_status(),
        "server_info": {
            "platform": "Railway" if "RAILWAY_ENVIRONMENT" in os.environ else "Local",
            "timestamp": datetime.now().isoformat(),
            "environment": dict(os.environ) if "RAILWAY_ENVIRONMENT" in os.environ else "Local development"
        },
        "recommendations": {
            "fallback_mode": "Using REST API polling - performance impact is minimal",
            "data_frequency": "1-2 seconds instead of real-time WebSocket",
            "trading_impact": "No impact on trading functionality"
        } if mexc_ws_service.fallback_mode else None
    }

@app.get("/api/test-database")
async def test_database_connection():
    """Test database connection endpoint for Railway debugging"""
    import aiomysql
    
    database_url = os.environ.get('DATABASE_URL')
    railway_env = os.environ.get('RAILWAY_ENVIRONMENT')
    
    result = {
        "environment": railway_env or "Local",
        "database_url_configured": bool(database_url),
        "database_url_format": database_url[:30] + "..." + database_url[-20:] if database_url and len(database_url) > 50 else database_url,
        "connection_test": None,
        "error": None,
        "timestamp": datetime.now().isoformat(),
        "database_type": "MySQL/PlanetScale"
    }
    
    if not database_url:
        result["error"] = "DATABASE_URL environment variable not set"
        result["connection_test"] = False
        return result
    
    try:
        # Parse MySQL URL for connection test
        url_parts = database_url.replace('mysql://', '').split('/')
        auth_host = url_parts[0]
        database = url_parts[1].split('?')[0]
        
        auth, host_port = auth_host.split('@')
        username, password = auth.split(':')
        
        if ':' in host_port:
            host, port = host_port.split(':')
            port = int(port)
        else:
            host = host_port
            port = 3306
        
        # Test connection
        conn = await aiomysql.connect(
            host=host,
            port=port,
            user=username,
            password=password,
            db=database,
            autocommit=True
        )
        
        cursor = await conn.cursor()
        await cursor.execute('SELECT VERSION()')
        version = await cursor.fetchone()
        await cursor.close()
        conn.close()
        
        result["connection_test"] = True
        result["mysql_version"] = version[0][:50] + "..." if len(version[0]) > 50 else version[0]
        
    except Exception as e:
        result["connection_test"] = False
        result["error"] = str(e)
        result["error_type"] = type(e).__name__
    
    return result

# Removed candle aggregation endpoints - using real-time WebSocket data

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    try:
        while True:
            # Keep connection alive and handle any incoming messages
            data = await websocket.receive_text()
            # Process any incoming messages if needed
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        active_connections.remove(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 