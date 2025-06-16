const config = {
  API_URL: process.env.REACT_APP_API_URL || 'https://trejder-production.up.railway.app',
  WS_URL: process.env.REACT_APP_WS_URL || 'wss://trejder-production.up.railway.app',
};

// Debug: Log environment variables
console.log('🔍 Environment Variables:', {
  API_URL: process.env.REACT_APP_API_URL,
  WS_URL: process.env.REACT_APP_WS_URL,
  Final_API_URL: config.API_URL,
  Final_WS_URL: config.WS_URL
});

export default config; 