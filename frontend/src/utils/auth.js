// Simple encryption utility for credentials
const ENCRYPTION_KEY = 'btc-trader-secure-key-2024';

// Simple XOR encryption
const encrypt = (text, key) => {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return btoa(result); // Base64 encode
};

const decrypt = (encryptedText, key) => {
  try {
    const text = atob(encryptedText); // Base64 decode
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
  } catch (error) {
    console.error('Decryption failed:', error);
    return null;
  }
};

// Encrypted credentials (encrypted with ENCRYPTION_KEY)
const ENCRYPTED_CREDENTIALS = {
  username: 'DxUQWREA', // 'master' encrypted
  password: 'FQNQQxsF'  // 'ww3now' encrypted
};

// Authentication function
export const validateCredentials = (username, password) => {
  const decryptedUsername = decrypt(ENCRYPTED_CREDENTIALS.username, ENCRYPTION_KEY);
  const decryptedPassword = decrypt(ENCRYPTED_CREDENTIALS.password, ENCRYPTION_KEY);
  
  return username === decryptedUsername && password === decryptedPassword;
};

// Session management
export const createSession = () => {
  const sessionData = {
    isAuthenticated: true,
    timestamp: Date.now(),
    sessionId: Math.random().toString(36).substr(2, 9)
  };
  
  localStorage.setItem('adminSession', btoa(JSON.stringify(sessionData)));
  return sessionData;
};

export const validateSession = () => {
  try {
    const sessionData = localStorage.getItem('adminSession');
    if (!sessionData) return false;
    
    const session = JSON.parse(atob(sessionData));
    const now = Date.now();
    const sessionAge = now - session.timestamp;
    const twentyFourHours = 24 * 60 * 60 * 1000;
    
    // Session expires after 24 hours
    if (sessionAge > twentyFourHours) {
      destroySession();
      return false;
    }
    
    return session.isAuthenticated;
  } catch (error) {
    console.error('Session validation failed:', error);
    destroySession();
    return false;
  }
};

export const destroySession = () => {
  localStorage.removeItem('adminSession');
  localStorage.removeItem('isAdminLoggedIn'); // Clean up old session storage
  localStorage.removeItem('loginTimestamp'); // Clean up old session storage
};

// Generate encrypted credentials (for development use only)
export const generateEncryptedCredentials = (username, password) => {
  return {
    username: encrypt(username, ENCRYPTION_KEY),
    password: encrypt(password, ENCRYPTION_KEY)
  };
};

// API Key storage functions
export const saveApiCredentials = (apiKey, apiSecret) => {
  try {
    const credentials = {
      apiKey: encrypt(apiKey, ENCRYPTION_KEY),
      apiSecret: encrypt(apiSecret, ENCRYPTION_KEY),
      timestamp: Date.now()
    };
    localStorage.setItem('mexcApiCredentials', btoa(JSON.stringify(credentials)));
    return true;
  } catch (error) {
    console.error('Failed to save API credentials:', error);
    return false;
  }
};

export const loadApiCredentials = () => {
  try {
    const credentialsData = localStorage.getItem('mexcApiCredentials');
    if (!credentialsData) return null;
    
    const credentials = JSON.parse(atob(credentialsData));
    const decryptedApiKey = decrypt(credentials.apiKey, ENCRYPTION_KEY);
    const decryptedApiSecret = decrypt(credentials.apiSecret, ENCRYPTION_KEY);
    
    if (!decryptedApiKey || !decryptedApiSecret) {
      clearApiCredentials();
      return null;
    }
    
    return {
      apiKey: decryptedApiKey,
      apiSecret: decryptedApiSecret,
      timestamp: credentials.timestamp
    };
  } catch (error) {
    console.error('Failed to load API credentials:', error);
    clearApiCredentials();
    return null;
  }
};

export const clearApiCredentials = () => {
  localStorage.removeItem('mexcApiCredentials');
};

export default {
  validateCredentials,
  createSession,
  validateSession,
  destroySession,
  generateEncryptedCredentials,
  saveApiCredentials,
  loadApiCredentials,
  clearApiCredentials
}; 