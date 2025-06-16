import axios from 'axios';
import config from '../config';

// MEXC API service for frontend operations
class MexcApiService {
  constructor() {
    this.baseURL = 'https://api.mexc.com';
  }

  // Fetch all USDT trading pairs from MEXC
  async fetchUSDTTradingPairs() {
    try {
      // Use our backend as proxy to avoid CORS issues
      const response = await axios.get(`${config.API_URL}/api/mexc/symbols`);
      
      if (response.data && response.data.symbols) {
        // Filter for USDT pairs and format them
        const usdtPairs = response.data.symbols
          .filter(symbol => symbol.symbol.endsWith('USDT'))
          .map(symbol => ({
            symbol: symbol.symbol,
            baseAsset: symbol.baseAsset,
            quoteAsset: symbol.quoteAsset,
            status: symbol.status
          }))
          .filter(pair => pair.status === 'ENABLED')
          .sort((a, b) => a.symbol.localeCompare(b.symbol));

        return usdtPairs;
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching MEXC trading pairs:', error);
      // Return default pairs if API fails
      return [
        { symbol: 'BTC/USDT', baseAsset: 'BTC', quoteAsset: 'USDT', status: 'ENABLED' },
        { symbol: 'ETH/USDT', baseAsset: 'ETH', quoteAsset: 'USDT', status: 'ENABLED' },
        { symbol: 'BNB/USDT', baseAsset: 'BNB', quoteAsset: 'USDT', status: 'ENABLED' },
        { symbol: 'ADA/USDT', baseAsset: 'ADA', quoteAsset: 'USDT', status: 'ENABLED' },
        { symbol: 'DOT/USDT', baseAsset: 'DOT', quoteAsset: 'USDT', status: 'ENABLED' },
        { symbol: 'LINK/USDT', baseAsset: 'LINK', quoteAsset: 'USDT', status: 'ENABLED' },
        { symbol: 'LTC/USDT', baseAsset: 'LTC', quoteAsset: 'USDT', status: 'ENABLED' },
        { symbol: 'XRP/USDT', baseAsset: 'XRP', quoteAsset: 'USDT', status: 'ENABLED' },
      ];
    }
  }

  // Fetch account balance using API keys
  async fetchAccountBalance(apiKey, apiSecret) {
    try {
      const response = await axios.post(`${config.API_URL}/api/mexc/account-balance`, {
        api_key: apiKey,
        api_secret: apiSecret
      });

      if (response.data && response.data.balances) {
        // Find USDT balance
        const usdtBalance = response.data.balances.find(
          balance => balance.asset === 'USDT'
        );

        return {
          success: true,
          usdtBalance: usdtBalance ? parseFloat(usdtBalance.free) : 0,
          totalUsdValue: response.data.total_usd_value || 0,
          usdBreakdown: response.data.usd_breakdown || { usdt: 0, crypto: 0 },
          allBalances: response.data.balances,
          usdBalances: response.data.usd_balances || []
        };
      }

      return {
        success: false,
        error: 'Invalid response format',
        usdtBalance: 0,
        totalUsdValue: 0
      };
    } catch (error) {
      console.error('Error fetching account balance:', error);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        usdtBalance: 0,
        totalUsdValue: 0
      };
    }
  }

  // Test API connection
  async testApiConnection(apiKey, apiSecret) {
    try {
      const response = await axios.post(`${config.API_URL}/api/mexc/test-connection`, {
        api_key: apiKey,
        api_secret: apiSecret
      });

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error testing API connection:', error);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }
}

export default new MexcApiService(); 