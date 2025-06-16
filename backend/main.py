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

            # Get klines for technical analysis (using 15m for consistency with AI analysis)
            klines = trading_state["mexc_service"].get_klines(interval='15m', limit=100)
            indicators = trading_state["trading_strategy"].calculate_indicators(klines)

            # Check if we should trade (only if auto trading is enabled)
            should_trade, action, confidence = trading_state["trading_strategy"].should_trade()
            
            # Debug logging for technical indicators
            if trading_state["auto_trading_enabled"]:
                logger.info(f"Technical Indicators (15m) - Action: {action}, Confidence: {confidence:.2f}, Should Trade: {should_trade}")
                logger.info(f"DEBUG: Using klines data length: {len(klines)}, timeframe: 15m")

            if should_trade and trading_state["auto_trading_enabled"]:
                logger.info(f"🚀 ATTEMPTING TO EXECUTE TRADE: {action} at price {price}")
                
                try:
                    # Get current balance
                    balance = trading_state["mexc_service"].get_account_balance()
                    usdt_balance = float(next((asset['free'] for asset in balance['balances'] if asset['asset'] == 'USDT'), 0))
                    btc_balance = float(next((asset['free'] for asset in balance['balances'] if asset['asset'] == 'BTC'), 0))
                    
                    logger.info(f"💰 Current Balance - USDT: {usdt_balance}, BTC: {btc_balance}")

                    if action == 'BUY' and usdt_balance > 0:
                        # Calculate quantity based on USDT balance
                        raw_quantity = (usdt_balance * 0.95) / price  # Use 95% of balance
                        quantity = round(raw_quantity, 6)  # MEXC requires max 6 decimal places
                        
                        # Check minimum order size (0.000001 BTC minimum on MEXC)
                        if quantity < 0.000001:
                            logger.warning(f"⚠️ Order quantity {quantity} below minimum (0.000001 BTC). USDT balance: {usdt_balance}")
                            continue
                        
                        logger.info(f"📊 BUY Order Details - Raw: {raw_quantity}, Rounded: {quantity}, Price: {price}, Value: ${quantity * price:.2f}")
                        
                        # Use MARKET order for immediate execution
                        order = trading_state["mexc_service"].place_order('BUY', quantity, order_type='MARKET')
                        logger.info(f"✅ BUY ORDER PLACED: {order}")
                        
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
                        # Round BTC balance to 6 decimal places for MEXC
                        quantity = round(btc_balance, 6)
                        
                        # Check minimum order size
                        if quantity < 0.000001:
                            logger.warning(f"⚠️ SELL quantity {quantity} below minimum (0.000001 BTC). BTC balance: {btc_balance}")
                            continue
                            
                        logger.info(f"📊 SELL Order Details - Original: {btc_balance}, Rounded: {quantity}, Price: {price}, Value: ${quantity * price:.2f}")
                        
                        # Use MARKET order for immediate execution
                        order = trading_state["mexc_service"].place_order('SELL', quantity, order_type='MARKET')
                        logger.info(f"✅ SELL ORDER PLACED: {order}")
                        
                        # Log trade to database
                        await trading_state["database_service"].log_trade(
                            action="SELL",
                            price=price,
                            quantity=quantity,
                            balance_before=usdt_balance + (btc_balance * price),
                            balance_after=(usdt_balance + (btc_balance * price)),
                            order_id=order.get('orderId') if order else None,
                            metadata={"confidence": confidence, "indicators": indicators}
                        )
                        
                        trading_state["trades"].append({
                            "type": "SELL",
                            "price": price,
                            "quantity": quantity,
                            "timestamp": datetime.now().isoformat()
                        })
                        trading_state["trading_strategy"].update_position('SELL')
                    
                    else:
                        logger.warning(f"⚠️ Cannot execute {action} - USDT Balance: {usdt_balance}, BTC Balance: {btc_balance}")
                        
                except Exception as e:
                    logger.error(f"❌ TRADE EXECUTION FAILED: {e}")
                    logger.error(f"🔍 Error details: action={action}, price={price}, confidence={confidence}")

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
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001", 
        "https://trejder.vercel.app",
        "https://*.vercel.app",
        "*"  # Allow all for development
    ],
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

@app.get("/api/trading-performance")
async def get_trading_performance():
    """Get comprehensive trading performance metrics"""
    try:
        # Get trading stats from database
        db_stats = await trading_state["database_service"].get_trading_stats()
        
        # Get real-time total account balance if API credentials are available
        current_balance = trading_state.get("current_balance", 0)
        current_price = trading_state.get("last_price", 0)
        
        # If trading is active and we have API credentials, fetch real-time balance
        if (trading_state.get("is_trading", False) and 
            trading_state.get("api_key") and 
            trading_state.get("api_secret")):
            try:
                mexc_service = MexcService(trading_state["api_key"], trading_state["api_secret"])
                balance = mexc_service.get_account_balance()
                
                # Calculate total account value (USDT + crypto holdings)
                total_usd_value = 0
                for asset_balance in balance.get('balances', []):
                    asset = asset_balance['asset']
                    free = float(asset_balance['free'])
                    locked = float(asset_balance['locked'])
                    total_asset = free + locked
                    
                    if total_asset > 0:
                        if asset == 'USDT':
                            total_usd_value += total_asset
                        else:
                            try:
                                if asset == 'BTC':
                                    btc_price = mexc_service.get_btc_price()
                                    total_usd_value += total_asset * btc_price
                                    current_price = btc_price  # Update current price
                                else:
                                    price_response = mexc_service._make_request('GET', '/api/v3/ticker/price', {'symbol': f'{asset}USDT'})
                                    asset_price = float(price_response['price'])
                                    total_usd_value += total_asset * asset_price
                            except:
                                pass  # Skip assets we can't price
                
                current_balance = total_usd_value
                # Update the trading state with real-time balance
                trading_state["current_balance"] = current_balance
                trading_state["last_price"] = current_price
                
            except Exception as e:
                logger.warning(f"Could not fetch real-time balance: {e}")
        
        # Calculate performance metrics
        performance_data = {
            "initial_balance": trading_state.get("initial_balance", 0),
            "current_balance": current_balance,
            "current_price": current_price,
            "total_trades": len(trading_state.get("trades", [])),
            "database_stats": db_stats,
            "trading_started": trading_state.get("is_trading", False)
        }
        
        # Calculate performance percentages
        initial_balance = performance_data["initial_balance"] or 0
        current_balance = performance_data["current_balance"] or 0
        
        if initial_balance > 0:
            total_return = ((current_balance - initial_balance) / initial_balance) * 100
            performance_data["total_return_percent"] = round(total_return, 2)
        else:
            performance_data["total_return_percent"] = 0
        
        # Get performance metrics from database for different time periods
        if trading_state["database_service"].pool:
            try:
                async with trading_state["database_service"].pool.acquire() as conn:
                    # Get 24h performance
                    result_24h = await conn.fetchrow('''
                        SELECT 
                            MIN(balance_after) as min_balance_24h,
                            MAX(balance_after) as max_balance_24h,
                            COUNT(*) as trades_24h
                        FROM trading_history 
                        WHERE timestamp > NOW() - INTERVAL '24 hours'
                          AND balance_after IS NOT NULL
                    ''')
                    
                    # Get 1 week performance  
                    result_1w = await conn.fetchrow('''
                        SELECT 
                            MIN(balance_after) as min_balance_1w,
                            MAX(balance_after) as max_balance_1w,
                            COUNT(*) as trades_1w
                        FROM trading_history 
                        WHERE timestamp > NOW() - INTERVAL '1 week'
                          AND balance_after IS NOT NULL
                    ''')
                    
                    # Get first trade balance for overall calculation
                    first_trade = await conn.fetchrow('''
                        SELECT balance_before, timestamp as start_time
                        FROM trading_history 
                        WHERE balance_before IS NOT NULL
                        ORDER BY timestamp ASC 
                        LIMIT 1
                    ''')
                    
                    # Get latest trade balance
                    latest_trade = await conn.fetchrow('''
                        SELECT balance_after, timestamp as latest_time
                        FROM trading_history 
                        WHERE balance_after IS NOT NULL
                        ORDER BY timestamp DESC 
                        LIMIT 1
                    ''')
                    
                    # Calculate 24h performance
                    if result_24h and result_24h['min_balance_24h'] is not None and result_24h['max_balance_24h'] is not None and float(result_24h['min_balance_24h']) > 0:
                        performance_24h = ((float(result_24h['max_balance_24h']) - float(result_24h['min_balance_24h'])) / float(result_24h['min_balance_24h'])) * 100
                        performance_data["performance_24h"] = round(performance_24h, 2)
                        performance_data["trades_24h"] = result_24h['trades_24h'] or 0
                    else:
                        performance_data["performance_24h"] = 0
                        performance_data["trades_24h"] = result_24h['trades_24h'] if result_24h else 0
                    
                    # Calculate 1 week performance
                    if result_1w and result_1w['min_balance_1w'] is not None and result_1w['max_balance_1w'] is not None and float(result_1w['min_balance_1w']) > 0:
                        performance_1w = ((float(result_1w['max_balance_1w']) - float(result_1w['min_balance_1w'])) / float(result_1w['min_balance_1w'])) * 100
                        performance_data["performance_1w"] = round(performance_1w, 2)
                        performance_data["trades_1w"] = result_1w['trades_1w'] or 0
                    else:
                        performance_data["performance_1w"] = 0
                        performance_data["trades_1w"] = result_1w['trades_1w'] if result_1w else 0
                    
                    # Calculate overall performance from first to latest trade
                    if (first_trade and latest_trade and 
                        first_trade['balance_before'] is not None and 
                        latest_trade['balance_after'] is not None and 
                        float(first_trade['balance_before']) > 0):
                        overall_performance = ((float(latest_trade['balance_after']) - float(first_trade['balance_before'])) / float(first_trade['balance_before'])) * 100
                        performance_data["overall_performance"] = round(overall_performance, 2)
                        performance_data["trading_start_time"] = first_trade['start_time'].isoformat()
                        performance_data["latest_trade_time"] = latest_trade['latest_time'].isoformat()
                    else:
                        performance_data["overall_performance"] = 0
                        performance_data["trading_start_time"] = None
                        performance_data["latest_trade_time"] = None
                        
            except Exception as e:
                logger.error(f"Error fetching performance metrics from database: {e}")
                performance_data["performance_24h"] = 0
                performance_data["performance_1w"] = 0
                performance_data["overall_performance"] = 0
                performance_data["trades_24h"] = 0
                performance_data["trades_1w"] = 0
        else:
            # No database connection - use basic metrics
            performance_data["performance_24h"] = 0
            performance_data["performance_1w"] = 0
            performance_data["overall_performance"] = performance_data["total_return_percent"]
            performance_data["trades_24h"] = 0
            performance_data["trades_1w"] = 0
        
        return performance_data
        
    except Exception as e:
        logger.error(f"Error getting trading performance: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get performance metrics: {str(e)}")

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

@app.get("/api/mexc/symbols")
async def get_mexc_symbols():
    """Get all trading symbols from MEXC"""
    try:
        mexc_service = MexcService("", "")  # Public data doesn't need auth
        exchange_info = mexc_service.get_exchange_info()
        return {
            "success": True,
            "symbols": exchange_info.get('symbols', [])
        }
    except Exception as e:
        logger.error(f"Error fetching MEXC symbols: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch symbols: {str(e)}")

@app.post("/api/mexc/account-balance")
async def get_mexc_account_balance(credentials: TradingCredentials):
    """Get account balance from MEXC using provided API credentials"""
    try:
        mexc_service = MexcService(credentials.api_key, credentials.api_secret)
        balance = mexc_service.get_account_balance()
        
        # Calculate total account value in USD
        total_usd_value = 0
        usd_balances = []
        
        for asset_balance in balance.get('balances', []):
            asset = asset_balance['asset']
            free = float(asset_balance['free'])
            locked = float(asset_balance['locked'])
            total_asset = free + locked
            
            if total_asset > 0:
                if asset == 'USDT':
                    # USDT is already in USD
                    usd_value = total_asset
                else:
                    # Get price for other assets in USDT
                    try:
                        if asset == 'BTC':
                            btc_price = mexc_service.get_btc_price()
                            usd_value = total_asset * btc_price
                        else:
                            # Try to get price for other assets
                            price_response = mexc_service._make_request('GET', '/api/v3/ticker/price', {'symbol': f'{asset}USDT'})
                            asset_price = float(price_response['price'])
                            usd_value = total_asset * asset_price
                    except:
                        # If we can't get price, assume 0 value for now
                        usd_value = 0
                
                total_usd_value += usd_value
                usd_balances.append({
                    'asset': asset,
                    'free': str(free),
                    'locked': str(locked),
                    'total': str(total_asset),
                    'usd_value': usd_value
                })
        
        return {
            "success": True,
            "balances": balance.get('balances', []),
            "usd_balances": usd_balances,
            "total_usd_value": total_usd_value,
            "usd_breakdown": {
                "usdt": next((b['usd_value'] for b in usd_balances if b['asset'] == 'USDT'), 0),
                "crypto": total_usd_value - next((b['usd_value'] for b in usd_balances if b['asset'] == 'USDT'), 0)
            }
        }
    except Exception as e:
        logger.error(f"Error fetching MEXC account balance: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to fetch balance: {str(e)}")

@app.post("/api/mexc/test-connection")
async def test_mexc_connection(credentials: TradingCredentials):
    """Test MEXC API connection with provided credentials"""
    try:
        mexc_service = MexcService(credentials.api_key, credentials.api_secret)
        # Try to get account info as a connection test
        account_info = mexc_service.get_account_balance()
        return {
            "success": True,
            "message": "Connection successful",
            "account_type": account_info.get('accountType', 'SPOT'),
            "can_trade": account_info.get('canTrade', False),
            "can_withdraw": account_info.get('canWithdraw', False),
            "can_deposit": account_info.get('canDeposit', False)
        }
    except Exception as e:
        logger.error(f"Error testing MEXC connection: {e}")
        return {
            "success": False,
            "error": str(e),
            "message": "Connection failed"
        }

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
    uvicorn.run(app, host="0.0.0.0", port=8000) # Railway deployment trigger 2025-06-16T23:52:04 CEST
