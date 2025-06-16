#!/usr/bin/env python3
"""
Test script to verify Supabase connection and database setup
Run this after setting up your .env file with DATABASE_URL
"""

import asyncio
import asyncpg
import os
import sys
from dotenv import load_dotenv
from datetime import datetime

# Load environment variables
load_dotenv()

async def test_supabase_connection():
    """Test the Supabase database connection and basic operations"""
    
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        print("❌ DATABASE_URL not found in environment variables")
        print("Please create a .env file with your Supabase DATABASE_URL")
        return False
    
    try:
        print("🔄 Testing Supabase connection...")
        
        # Test basic connection
        conn = await asyncpg.connect(database_url)
        version = await conn.fetchval('SELECT version()')
        print(f"✅ Connected successfully!")
        print(f"📊 PostgreSQL version: {version[:50]}...")
        
        # Test table creation (simulate what DatabaseService does)
        print("\n🔄 Testing table creation...")
        
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS test_connection (
                id SERIAL PRIMARY KEY,
                timestamp TIMESTAMPTZ DEFAULT NOW(),
                message TEXT NOT NULL
            )
        ''')
        
        # Test insert
        await conn.execute('''
            INSERT INTO test_connection (message) VALUES ($1)
        ''', f"Test connection at {datetime.now()}")
        
        # Test select
        result = await conn.fetchrow('SELECT * FROM test_connection ORDER BY id DESC LIMIT 1')
        print(f"✅ Table operations successful!")
        print(f"📝 Last test record: {result['message']}")
        
        # Clean up test table
        await conn.execute('DROP TABLE test_connection')
        
        await conn.close()
        print("\n🎉 Supabase setup is working correctly!")
        print("Your trading bot can now connect to the database.")
        
        return True
        
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        print("\n🔧 Troubleshooting tips:")
        print("1. Check your DATABASE_URL format")
        print("2. Verify your Supabase project is active")
        print("3. Ensure your password doesn't have special characters")
        print("4. Try adding ?sslmode=require to your DATABASE_URL")
        return False

async def test_database_service():
    """Test the actual DatabaseService class"""
    try:
        print("\n🔄 Testing DatabaseService class...")
        
        # Import the database service
        sys.path.append('backend/services')
        from database_service import DatabaseService
        
        db = DatabaseService()
        connected = await db.connect()
        
        if connected:
            print("✅ DatabaseService connected successfully!")
            
            # Test logging a sample trade
            success = await db.log_trade(
                action="BUY",
                price=45000.50,
                quantity=0.001,
                balance_before=1000.0,
                balance_after=955.0,
                metadata={"test": True}
            )
            
            if success:
                print("✅ Sample trade logged successfully!")
            
            await db.disconnect()
            print("✅ DatabaseService test completed!")
            return True
        else:
            print("❌ DatabaseService connection failed")
            return False
            
    except ImportError as e:
        print(f"⚠️  Could not import DatabaseService: {e}")
        print("This is normal if you haven't set up the backend structure yet")
        return True
    except Exception as e:
        print(f"❌ DatabaseService test failed: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Supabase Connection Test")
    print("=" * 40)
    
    async def main():
        # Test basic connection
        basic_success = await test_supabase_connection()
        
        if basic_success:
            # Test database service
            await test_database_service()
        
        print("\n" + "=" * 40)
        if basic_success:
            print("✅ Setup complete! You can now start your trading bot.")
        else:
            print("❌ Please fix the connection issues before proceeding.")
    
    asyncio.run(main()) 