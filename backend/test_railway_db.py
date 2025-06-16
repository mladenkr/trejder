#!/usr/bin/env python3
"""
Database connection test for Railway deployment
This script will be used to test Supabase connectivity from Railway servers
"""
import asyncio
import asyncpg
import os
import sys
from datetime import datetime

async def test_database_connection():
    """Test database connection and log results"""
    print(f"🧪 Database Connection Test - {datetime.now()}")
    print("=" * 50)
    
    # Check environment variables
    database_url = os.environ.get('DATABASE_URL')
    railway_env = os.environ.get('RAILWAY_ENVIRONMENT')
    
    print(f"🌐 Environment: {railway_env or 'Local'}")
    print(f"🔗 Database URL configured: {'Yes' if database_url else 'No'}")
    
    if database_url:
        # Mask sensitive parts of URL for logging
        masked_url = database_url[:30] + "..." + database_url[-20:] if len(database_url) > 50 else database_url
        print(f"🔍 URL format: {masked_url}")
    else:
        print("❌ DATABASE_URL environment variable not found!")
        return False
    
    print("\n📡 Testing connection...")
    
    try:
        # Test connection with timeout
        conn = await asyncpg.connect(
            database_url,
            timeout=30,
            command_timeout=10
        )
        
        # Test basic query
        version = await conn.fetchval('SELECT version()')
        print(f"✅ Connection successful!")
        print(f"📊 PostgreSQL version: {version[:60]}...")
        
        # Test table creation (basic functionality)
        try:
            await conn.execute('''
                CREATE TABLE IF NOT EXISTS connection_test (
                    id SERIAL PRIMARY KEY,
                    timestamp TIMESTAMPTZ DEFAULT NOW(),
                    message TEXT
                )
            ''')
            
            await conn.execute('''
                INSERT INTO connection_test (message) 
                VALUES ('Railway connection test successful')
            ''')
            
            count = await conn.fetchval('SELECT COUNT(*) FROM connection_test')
            print(f"📝 Database write test: ✅ ({count} test records)")
            
        except Exception as e:
            print(f"⚠️  Database write test failed: {e}")
        
        await conn.close()
        print("🔐 Connection closed successfully")
        return True
        
    except asyncio.TimeoutError:
        print("❌ Connection timeout - Database server unreachable")
        return False
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        print(f"🔍 Error type: {type(e).__name__}")
        
        # Provide specific troubleshooting for common errors
        error_str = str(e).lower()
        if "network is unreachable" in error_str:
            print("💡 This suggests a network connectivity issue")
        elif "authentication failed" in error_str:
            print("💡 Check your database password in the DATABASE_URL")
        elif "does not exist" in error_str:
            print("💡 Check your database hostname and name")
        elif "ssl" in error_str:
            print("💡 Try adding '?sslmode=require' to your DATABASE_URL")
        
        return False

if __name__ == "__main__":
    success = asyncio.run(test_database_connection())
    sys.exit(0 if success else 1) 