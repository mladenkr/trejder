# Deployment Guide for Trejder Bitcoin Trading Bot

## Architecture Overview

For a 24/7 Bitcoin trading bot, we recommend a **hybrid deployment approach**:

- **Frontend**: Vercel (Free) - Static React app
- **Backend**: Railway/Render (Free tier) - 24/7 Python trading bot
- **Database**: PlanetScale/Supabase (Free tier) - Trading history

## Option 1: Frontend on Vercel + Backend on Railway (Recommended)

### Step 1: Deploy Frontend to Vercel

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm install -g vercel
   ```

2. **Deploy from GitHub**:
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository: `https://github.com/mladenkr/trejder`
   - Set **Root Directory** to `frontend`
   - Add environment variables:
     - `REACT_APP_API_URL`: Your backend URL (e.g., `https://your-app.railway.app`)
     - `REACT_APP_WS_URL`: Your WebSocket URL (e.g., `wss://your-app.railway.app`)

3. **Or deploy via CLI**:
   ```bash
   cd frontend
   npx vercel --prod
   ```

### Step 2: Deploy Backend to Railway

1. **Create Railway account**: [railway.app](https://railway.app)

2. **Deploy from GitHub**:
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository
   - Set **Root Directory** to `backend`
   - Add environment variables:
     - `MEXC_API_KEY`: Your MEXC API key
     - `MEXC_API_SECRET`: Your MEXC API secret
     - `PORT`: 8000

3. **Create railway.json** in project root:
   ```json
   {
     "$schema": "https://railway.app/railway.schema.json",
     "build": {
       "builder": "NIXPACKS"
     },
     "deploy": {
       "startCommand": "cd backend && python main.py",
       "restartPolicyType": "ON_FAILURE",
       "restartPolicyMaxRetries": 10
     }
   }
   ```

### Step 3: Update Frontend Configuration

Update your Vercel environment variables with the Railway backend URL:
- `REACT_APP_API_URL`: `https://your-railway-app.railway.app`
- `REACT_APP_WS_URL`: `wss://your-railway-app.railway.app`

## Option 2: Full Vercel Deployment (Limited 24/7 capability)

### Pros:
- ✅ Completely free
- ✅ Easy deployment
- ✅ Great for development/testing

### Cons:
- ❌ Serverless functions have execution time limits (10s free, 60s pro)
- ❌ No persistent WebSocket connections
- ❌ Not suitable for continuous trading

### Setup:
1. Move backend API endpoints to `frontend/api/` directory
2. Convert to Vercel serverless functions
3. Use external cron services for scheduled trading

## Option 3: GitHub Actions + Vercel (Scheduled Trading)

Perfect for **periodic trading** (every 5-15 minutes):

1. **Frontend on Vercel** (as above)
2. **Trading logic in GitHub Actions**:
   ```yaml
   # .github/workflows/trading.yml
   name: Bitcoin Trading Bot
   on:
     schedule:
       - cron: '*/5 * * * *'  # Every 5 minutes
   jobs:
     trade:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v2
         - name: Setup Python
           uses: actions/setup-python@v2
           with:
             python-version: '3.9'
         - name: Install dependencies
           run: pip install -r requirements.txt
         - name: Run trading bot
           env:
             MEXC_API_KEY: ${{ secrets.MEXC_API_KEY }}
             MEXC_API_SECRET: ${{ secrets.MEXC_API_SECRET }}
           run: python backend/trading_scheduler.py
   ```

## Free Hosting Alternatives

### Backend Hosting (24/7):
1. **Railway** - 500 hours/month free
2. **Render** - 750 hours/month free
3. **Fly.io** - Limited free tier
4. **Heroku** - No longer free
5. **PythonAnywhere** - Limited free tier

### Database Options:
1. **Supabase** - 500MB free PostgreSQL (Recommended)
2. **PlanetScale** - 1GB free MySQL
3. **MongoDB Atlas** - 512MB free
4. **Firebase** - 1GB free NoSQL

### Step 3: Set up Supabase Database (Recommended)

1. **Create Supabase Account**: Go to [supabase.com](https://supabase.com)
2. **Create New Project**: 
   - Click "New Project"
   - Choose organization
   - Enter project name: `trejder-btc-bot`
   - Set database password (save this!)
   - Select region closest to your Railway deployment
3. **Get Database URL**:
   - Go to Settings → Database
   - Copy the "Connection string" (URI format)
   - It looks like: `postgresql://postgres:[password]@[host]:5432/postgres`
4. **Add to Railway Environment Variables**:
   - `DATABASE_URL`: Your Supabase connection string

## Environment Variables

### Frontend (.env):
```
REACT_APP_API_URL=https://your-backend-url.com
REACT_APP_WS_URL=wss://your-backend-url.com
```

### Backend:
```
MEXC_API_KEY=your_mexc_api_key
MEXC_API_SECRET=your_mexc_api_secret
DATABASE_URL=your_database_connection_string
PORT=8000
```

## Security Considerations

1. **Never commit API keys** to GitHub
2. **Use environment variables** for all secrets
3. **Enable CORS** properly for your frontend domain
4. **Use HTTPS/WSS** in production
5. **Implement rate limiting** to avoid API limits

## Monitoring & Maintenance

1. **Set up alerts** for trading bot failures
2. **Monitor API usage** to avoid rate limits
3. **Regular backups** of trading history
4. **Log rotation** to prevent storage issues

## Cost Breakdown (Monthly)

### Free Tier:
- Vercel: $0 (Frontend)
- Railway: $0 (500 hours)
- PlanetScale: $0 (1GB)
- **Total: $0/month**

### Paid Tier (for serious trading):
- Vercel Pro: $20 (Better performance)
- Railway Pro: $5 (Always-on)
- Database: $10-25
- **Total: $35-50/month**

## Getting Started

1. **Choose your deployment strategy** (Option 1 recommended)
2. **Set up accounts** on chosen platforms
3. **Configure environment variables**
4. **Deploy and test** with small amounts first
5. **Monitor and optimize** performance

Remember: **Always test with small amounts first** and never trade with money you can't afford to lose! 