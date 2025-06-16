# BTC Trading Bot (Trejder)

A real-time Bitcoin trading bot that uses the MEXC exchange API for automated trading based on technical analysis.

## Features

- Real-time BTC price monitoring
- Technical analysis using multiple indicators (RSI, MACD, Bollinger Bands, Moving Averages)
- Automated trading based on technical signals
- Real-time trading status and performance monitoring
- Interactive price chart with candlestick data
- Trading logs and history
- Secure API key management

## Prerequisites

- Python 3.8+
- Node.js 14+
- MEXC exchange account with API access

## Setup

1. Clone the repository:
```bash
git clone https://github.com/mladenkr/trejder.git
cd trejder
```

2. Set up the backend:
```bash
# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

3. Set up the frontend:
```bash
cd frontend
npm install
```

## Running the Application

1. Start the backend server:
```bash
# From the project root
python backend/main.py
```

2. Start the frontend development server:
```bash
# From the frontend directory
npm start
```

3. Open your browser and navigate to `http://localhost:3000`

## Usage

1. Enter your MEXC API key and secret in the API Configuration section
2. Click "Start Trading" to begin automated trading
3. Monitor the trading status, price chart, and logs in real-time
4. Click "Stop Trading" to stop the automated trading

## Security Notes

- Never share your API keys
- The application stores API keys only in memory during runtime
- All API communications are encrypted
- The application only requests necessary trading permissions

## Technical Indicators Used

- RSI (Relative Strength Index)
- MACD (Moving Average Convergence Divergence)
- Bollinger Bands
- Simple Moving Averages (20 and 50 periods)

## Disclaimer

This trading bot is for educational purposes only. Cryptocurrency trading involves significant risk. Use at your own risk and never trade with money you cannot afford to lose.
