# Supabase Setup Guide for BTC Trader

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up
2. Create a new project:
   - Project name: `btc-trader`
   - Database password: Choose a strong password and save it!
   - Region: Choose closest to your location

## Step 2: Get Connection Details

After project creation, go to **Settings > Database** and copy:

### Required Environment Variables

Create a `.env` file in your project root with:

```bash
# Supabase Database Connection
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres

# Supabase API Configuration (optional, for future features)
SUPABASE_URL=https://[YOUR-PROJECT-REF].supabase.co
SUPABASE_ANON_KEY=[YOUR-ANON-KEY]
SUPABASE_SERVICE_ROLE_KEY=[YOUR-SERVICE-ROLE-KEY]

# MEXC API Configuration
MEXC_API_KEY=your_mexc_api_key_here
MEXC_SECRET_KEY=your_mexc_secret_key_here

# Other Configuration
ENVIRONMENT=production
LOG_LEVEL=INFO
```

### Where to find these values:

1. **DATABASE_URL**: Settings > Database > Connection string > URI
2. **SUPABASE_URL**: Settings > API > Project URL
3. **SUPABASE_ANON_KEY**: Settings > API > Project API keys > anon public
4. **SUPABASE_SERVICE_ROLE_KEY**: Settings > API > Project API keys > service_role (keep this secret!)

## Step 3: Test Database Connection

Run this command to test your database connection:

```bash
python3 -c "
import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

async def test_connection():
    try:
        conn = await asyncpg.connect(os.environ['DATABASE_URL'])
        result = await conn.fetchval('SELECT version()')
        print(f'✅ Connected successfully!')
        print(f'PostgreSQL version: {result}')
        await conn.close()
    except Exception as e:
        print(f'❌ Connection failed: {e}')

asyncio.run(test_connection())
"
```

Or simply run the test script:

```bash
python3 test_supabase.py
```

## Step 4: Initialize Database Tables

Your database service will automatically create the required tables when it connects. The tables include:

- `trading_history` - All buy/sell transactions
- `price_history` - Historical price data
- `ai_analysis` - AI trading recommendations
- `system_logs` - Application logs

## Step 5: Deploy Environment Variables

### For Railway (Backend):
1. Go to your Railway project dashboard
2. Go to Variables tab
3. Add the `DATABASE_URL` variable

### For Vercel (Frontend - if needed):
1. Go to your Vercel project dashboard
2. Go to Settings > Environment Variables
3. Add any frontend-specific variables

## Step 6: Verify Setup

Once deployed, check your Railway logs to see:
```
INFO - Connected to database successfully
INFO - Database tables created/verified successfully
```

## Supabase Dashboard Features

You can use the Supabase dashboard to:
- View your data in real-time (Table Editor)
- Run SQL queries (SQL Editor)
- Monitor database performance (Database > Logs)
- Set up Row Level Security (Authentication > Policies)

## Troubleshooting

### Connection Issues:
- Ensure your IP is whitelisted (Supabase allows all by default)
- Check if DATABASE_URL is correctly formatted
- Verify password doesn't contain special characters that need URL encoding

### SSL Issues:
If you get SSL errors, try adding `?sslmode=require` to your DATABASE_URL

## Next Steps

After setup:
1. Your trading bot will start logging all activities to Supabase
2. You can view trading history in the Supabase dashboard
3. Set up monitoring and alerts using Supabase's built-in tools 