import asyncio
import asyncpg
import json
import logging
from datetime import datetime
from typing import List, Dict, Optional
import os

logger = logging.getLogger(__name__)

class DatabaseService:
    def __init__(self):
        self.database_url = os.environ.get('DATABASE_URL')
        self.pool = None
        
    async def connect(self):
        """Connect to PostgreSQL database"""
        try:
            if not self.database_url:
                logger.warning("DATABASE_URL not set - database features disabled")
                return False
                
            self.pool = await asyncpg.create_pool(
                self.database_url,
                min_size=1,
                max_size=10,
                command_timeout=60
            )
            
            # Create tables if they don't exist
            await self._create_tables()
            logger.info("Connected to database successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to connect to database: {e}")
            return False
    
    async def disconnect(self):
        """Disconnect from database"""
        if self.pool:
            await self.pool.close()
            logger.info("Disconnected from database")
    
    async def _create_tables(self):
        """Create necessary tables"""
        async with self.pool.acquire() as conn:
            # Trading history table
            await conn.execute('''
                CREATE TABLE IF NOT EXISTS trading_history (
                    id SERIAL PRIMARY KEY,
                    timestamp TIMESTAMPTZ DEFAULT NOW(),
                    action VARCHAR(10) NOT NULL,
                    symbol VARCHAR(20) DEFAULT 'BTCUSDT',
                    price DECIMAL(20, 8) NOT NULL,
                    quantity DECIMAL(20, 8) NOT NULL,
                    total_value DECIMAL(20, 8) NOT NULL,
                    balance_before DECIMAL(20, 8),
                    balance_after DECIMAL(20, 8),
                    order_id VARCHAR(100),
                    status VARCHAR(20) DEFAULT 'completed',
                    metadata JSONB
                )
            ''')
            
            # Price history table
            await conn.execute('''
                CREATE TABLE IF NOT EXISTS price_history (
                    id SERIAL PRIMARY KEY,
                    timestamp TIMESTAMPTZ DEFAULT NOW(),
                    symbol VARCHAR(20) DEFAULT 'BTCUSDT',
                    price DECIMAL(20, 8) NOT NULL,
                    volume DECIMAL(20, 8),
                    high_24h DECIMAL(20, 8),
                    low_24h DECIMAL(20, 8),
                    change_24h DECIMAL(10, 4),
                    source VARCHAR(20) DEFAULT 'mexc'
                )
            ''')
            
            # AI analysis history table
            await conn.execute('''
                CREATE TABLE IF NOT EXISTS ai_analysis (
                    id SERIAL PRIMARY KEY,
                    timestamp TIMESTAMPTZ DEFAULT NOW(),
                    symbol VARCHAR(20) DEFAULT 'BTCUSDT',
                    current_price DECIMAL(20, 8) NOT NULL,
                    recommendation VARCHAR(20) NOT NULL,
                    confidence DECIMAL(5, 2) NOT NULL,
                    reasoning TEXT,
                    technical_indicators JSONB,
                    market_sentiment VARCHAR(20),
                    risk_level VARCHAR(20),
                    metadata JSONB
                )
            ''')
            
            # System logs table
            await conn.execute('''
                CREATE TABLE IF NOT EXISTS system_logs (
                    id SERIAL PRIMARY KEY,
                    timestamp TIMESTAMPTZ DEFAULT NOW(),
                    level VARCHAR(10) NOT NULL,
                    service VARCHAR(50) NOT NULL,
                    message TEXT NOT NULL,
                    metadata JSONB
                )
            ''')
            
            # Create indexes for better performance
            await conn.execute('CREATE INDEX IF NOT EXISTS idx_trading_history_timestamp ON trading_history(timestamp)')
            await conn.execute('CREATE INDEX IF NOT EXISTS idx_price_history_timestamp ON price_history(timestamp)')
            await conn.execute('CREATE INDEX IF NOT EXISTS idx_ai_analysis_timestamp ON ai_analysis(timestamp)')
            await conn.execute('CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON system_logs(timestamp)')
            
            logger.info("Database tables created/verified successfully")
    
    async def log_trade(self, action: str, price: float, quantity: float, 
                       balance_before: float = None, balance_after: float = None,
                       order_id: str = None, metadata: dict = None):
        """Log a trading transaction"""
        if not self.pool:
            return False
            
        try:
            async with self.pool.acquire() as conn:
                await conn.execute('''
                    INSERT INTO trading_history 
                    (action, price, quantity, total_value, balance_before, balance_after, order_id, metadata)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ''', action, price, quantity, price * quantity, balance_before, balance_after, order_id, json.dumps(metadata) if metadata else None)
                
            logger.info(f"Logged trade: {action} {quantity} BTC at ${price}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to log trade: {e}")
            return False
    
    async def log_price(self, price: float, volume: float = None, 
                       high_24h: float = None, low_24h: float = None, change_24h: float = None):
        """Log price data"""
        if not self.pool:
            return False
            
        try:
            async with self.pool.acquire() as conn:
                await conn.execute('''
                    INSERT INTO price_history (price, volume, high_24h, low_24h, change_24h)
                    VALUES ($1, $2, $3, $4, $5)
                ''', price, volume, high_24h, low_24h, change_24h)
                
            return True
            
        except Exception as e:
            logger.error(f"Failed to log price: {e}")
            return False
    
    async def log_ai_analysis(self, current_price: float, recommendation: str, 
                             confidence: float, reasoning: str = None,
                             technical_indicators: dict = None, metadata: dict = None):
        """Log AI analysis results"""
        if not self.pool:
            return False
            
        try:
            async with self.pool.acquire() as conn:
                await conn.execute('''
                    INSERT INTO ai_analysis 
                    (current_price, recommendation, confidence, reasoning, technical_indicators, metadata)
                    VALUES ($1, $2, $3, $4, $5, $6)
                ''', current_price, recommendation, confidence, reasoning, 
                json.dumps(technical_indicators) if technical_indicators else None,
                json.dumps(metadata) if metadata else None)
                
            logger.info(f"Logged AI analysis: {recommendation} ({confidence}% confidence)")
            return True
            
        except Exception as e:
            logger.error(f"Failed to log AI analysis: {e}")
            return False
    
    async def log_system_event(self, level: str, service: str, message: str, metadata: dict = None):
        """Log system events"""
        if not self.pool:
            return False
            
        try:
            async with self.pool.acquire() as conn:
                await conn.execute('''
                    INSERT INTO system_logs (level, service, message, metadata)
                    VALUES ($1, $2, $3, $4)
                ''', level, service, message, json.dumps(metadata) if metadata else None)
                
            return True
            
        except Exception as e:
            logger.error(f"Failed to log system event: {e}")
            return False
    
    async def get_trading_history(self, limit: int = 100, offset: int = 0) -> List[Dict]:
        """Get trading history"""
        if not self.pool:
            return []
            
        try:
            async with self.pool.acquire() as conn:
                rows = await conn.fetch('''
                    SELECT * FROM trading_history 
                    ORDER BY timestamp DESC 
                    LIMIT $1 OFFSET $2
                ''', limit, offset)
                
                return [dict(row) for row in rows]
                
        except Exception as e:
            logger.error(f"Failed to get trading history: {e}")
            return []
    
    async def get_price_history(self, hours: int = 24, limit: int = 1000) -> List[Dict]:
        """Get price history"""
        if not self.pool:
            return []
            
        try:
            async with self.pool.acquire() as conn:
                rows = await conn.fetch('''
                    SELECT * FROM price_history 
                    WHERE timestamp > NOW() - INTERVAL '%s hours'
                    ORDER BY timestamp DESC 
                    LIMIT $1
                ''', hours, limit)
                
                return [dict(row) for row in rows]
                
        except Exception as e:
            logger.error(f"Failed to get price history: {e}")
            return []
    
    async def get_ai_analysis_history(self, limit: int = 50) -> List[Dict]:
        """Get AI analysis history"""
        if not self.pool:
            return []
            
        try:
            async with self.pool.acquire() as conn:
                rows = await conn.fetch('''
                    SELECT * FROM ai_analysis 
                    ORDER BY timestamp DESC 
                    LIMIT $1
                ''', limit)
                
                return [dict(row) for row in rows]
                
        except Exception as e:
            logger.error(f"Failed to get AI analysis history: {e}")
            return []
    
    async def get_system_logs(self, level: str = None, service: str = None, 
                             hours: int = 24, limit: int = 500) -> List[Dict]:
        """Get system logs"""
        if not self.pool:
            return []
            
        try:
            query = '''
                SELECT * FROM system_logs 
                WHERE timestamp > NOW() - INTERVAL '%s hours'
            ''' % hours
            
            params = []
            param_count = 0
            
            if level:
                param_count += 1
                query += f' AND level = ${param_count}'
                params.append(level)
                
            if service:
                param_count += 1
                query += f' AND service = ${param_count}'
                params.append(service)
            
            param_count += 1
            query += f' ORDER BY timestamp DESC LIMIT ${param_count}'
            params.append(limit)
            
            async with self.pool.acquire() as conn:
                rows = await conn.fetch(query, *params)
                return [dict(row) for row in rows]
                
        except Exception as e:
            logger.error(f"Failed to get system logs: {e}")
            return []
    
    async def get_trading_stats(self) -> Dict:
        """Get trading statistics"""
        if not self.pool:
            return {}
            
        try:
            async with self.pool.acquire() as conn:
                # Total trades
                total_trades = await conn.fetchval('SELECT COUNT(*) FROM trading_history')
                
                # Trades by action
                buy_trades = await conn.fetchval("SELECT COUNT(*) FROM trading_history WHERE action = 'BUY'")
                sell_trades = await conn.fetchval("SELECT COUNT(*) FROM trading_history WHERE action = 'SELL'")
                
                # Total volume
                total_volume = await conn.fetchval('SELECT SUM(total_value) FROM trading_history') or 0
                
                # Latest price
                latest_price = await conn.fetchval('SELECT price FROM price_history ORDER BY timestamp DESC LIMIT 1')
                
                # Performance (last 24h)
                performance_24h = await conn.fetchval('''
                    SELECT 
                        (MAX(price) - MIN(price)) / MIN(price) * 100 as change_percent
                    FROM price_history 
                    WHERE timestamp > NOW() - INTERVAL '24 hours'
                ''') or 0
                
                return {
                    'total_trades': total_trades,
                    'buy_trades': buy_trades,
                    'sell_trades': sell_trades,
                    'total_volume': float(total_volume),
                    'latest_price': float(latest_price) if latest_price else None,
                    'performance_24h': float(performance_24h),
                    'database_connected': True
                }
                
        except Exception as e:
            logger.error(f"Failed to get trading stats: {e}")
            return {'database_connected': False, 'error': str(e)}

# Global database service instance
db_service = DatabaseService() 