import axios from 'axios';
import config from '../config';

// MEXC API service for frontend operations
class MexcApiService {
  constructor() {
    this.baseURL = 'https://api.mexc.com';
  }

  // Fetch all USDC trading pairs from MEXC
  async fetchUSDCTradingPairs() {
    try {
      // Use our backend as proxy to avoid CORS issues
      const response = await axios.get(`${config.API_URL}/api/mexc/symbols`);
      
      if (response.data && response.data.symbols) {
        // Filter for USDC pairs and format them
        const usdcPairs = response.data.symbols
          .filter(symbol => symbol.symbol.endsWith('USDC'))
          .map(symbol => ({
            symbol: symbol.symbol,
            baseAsset: symbol.baseAsset,
            quoteAsset: symbol.quoteAsset,
            status: symbol.status
          }))
          .filter(pair => pair.status === 'ENABLED')
          .sort((a, b) => a.symbol.localeCompare(b.symbol));

        return usdcPairs;
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching MEXC trading pairs:', error);
      // Return default pairs if API fails
      return [
        { symbol: 'BTC/USDC', baseAsset: 'BTC', quoteAsset: 'USDC', status: 'ENABLED' },
        { symbol: 'ETH/USDC', baseAsset: 'ETH', quoteAsset: 'USDC', status: 'ENABLED' },
        { symbol: 'BNB/USDC', baseAsset: 'BNB', quoteAsset: 'USDC', status: 'ENABLED' },
        { symbol: 'ADA/USDC', baseAsset: 'ADA', quoteAsset: 'USDC', status: 'ENABLED' },
        { symbol: 'DOT/USDC', baseAsset: 'DOT', quoteAsset: 'USDC', status: 'ENABLED' },
        { symbol: 'LINK/USDC', baseAsset: 'LINK', quoteAsset: 'USDC', status: 'ENABLED' },
        { symbol: 'LTC/USDC', baseAsset: 'LTC', quoteAsset: 'USDC', status: 'ENABLED' },
        { symbol: 'XRP/USDC', baseAsset: 'XRP', quoteAsset: 'USDC', status: 'ENABLED' },
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
        // Find USDC balance
        const usdcBalance = response.data.balances.find(
          balance => balance.asset === 'USDC'
        );

        return {
          success: true,
          usdcBalance: usdcBalance ? parseFloat(usdcBalance.free) : 0,
          totalUsdValue: response.data.total_usd_value || 0,
          usdBreakdown: response.data.usd_breakdown || { usdc: 0, crypto: 0 },
          allBalances: response.data.balances,
          usdBalances: response.data.usd_balances || []
        };
      }

      return {
        success: false,
        error: 'Invalid response format',
        usdcBalance: 0,
        totalUsdValue: 0
      };
    } catch (error) {
      console.error('Error fetching account balance:', error);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        usdcBalance: 0,
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