import hmac
import hashlib
import time
import requests
from typing import Dict, Optional, List
import json
from datetime import datetime
import urllib.parse

class MexcService:
    def __init__(self, api_key: str, api_secret: str):
        self.api_key = api_key
        self.api_secret = api_secret
        self.base_url = "https://api.mexc.com"
        self.ws_base_url = "wss://wbs.mexc.com/ws"
        
    def _generate_signature(self, params: Dict) -> str:
        """Generate signature for authenticated requests"""
        query_string = urllib.parse.urlencode(params)
        signature = hmac.new(
            self.api_secret.encode('utf-8'),
            query_string.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        return signature

    def _make_request(self, method: str, endpoint: str, params: Optional[Dict] = None, signed: bool = False) -> Dict:
        """Make HTTP request to MEXC API"""
        url = f"{self.base_url}{endpoint}"
        headers = {}
        
        if signed:
            if params is None:
                params = {}
            params['timestamp'] = int(time.time() * 1000)
            params['signature'] = self._generate_signature(params)
            headers['X-MEXC-APIKEY'] = self.api_key

        try:
            if method == 'GET':
                response = requests.get(url, params=params, headers=headers)
            elif method == 'POST':
                # For POST requests (like orders), send as form data, not JSON
                headers['Content-Type'] = 'application/x-www-form-urlencoded'
                response = requests.post(url, data=params, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, params=params, headers=headers)
            else:
                raise ValueError(f"Unsupported method: {method}")

            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            # Log the response content for debugging
            if hasattr(e, 'response') and e.response is not None:
                try:
                    error_content = e.response.json()
                    raise Exception(f"API request failed: {str(e)} - Response: {error_content}")
                except:
                    raise Exception(f"API request failed: {str(e)} - Response: {e.response.text}")
            raise Exception(f"API request failed: {str(e)}")

    def get_btc_price(self) -> float:
        """Get current BTC price"""
        endpoint = "/api/v3/ticker/price"
        params = {'symbol': 'BTCUSDC'}
        response = self._make_request('GET', endpoint, params)
        return float(response['price'])

    def get_account_balance(self) -> Dict:
        """Get account balance"""
        endpoint = "/api/v3/account"
        return self._make_request('GET', endpoint, signed=True)

    def place_order(self, side: str, quantity: float, price: Optional[float] = None, order_type: str = 'LIMIT', quote_qty: Optional[float] = None) -> Dict:
        """
        Place a new order
        :param side: 'BUY' or 'SELL'
        :param quantity: Order quantity
        :param price: Order price (required for LIMIT orders)
        :param order_type: 'LIMIT', 'MARKET', 'LIMIT_MAKER', 'IMMEDIATE_OR_CANCEL', 'FILL_OR_KILL'
        :param quote_qty: Quote asset quantity (for MARKET BUY orders)
        """
        endpoint = "/api/v3/order"
        params = {
            'symbol': 'BTCUSDC',
            'side': side,
            'type': order_type,
            'recvWindow': 5000  # Add recvWindow for better API reliability
        }
        
        # For MARKET BUY orders with quote_qty, use quoteOrderQty
        if order_type == 'MARKET' and side == 'BUY' and quote_qty is not None:
            params['quoteOrderQty'] = str(quote_qty)  # MEXC requires string format
        else:
            # Default behavior for all other orders
            params['quantity'] = str(quantity)  # MEXC requires string format
            
        if order_type == 'LIMIT':
            if price is None:
                raise ValueError("Price is required for LIMIT orders")
            params['price'] = str(price)  # MEXC requires string format
            params['timeInForce'] = 'GTC'

        # Debug logging for order parameters
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"🔍 MEXC Order Request - Endpoint: {endpoint}")
        logger.info(f"🔍 MEXC Order Params: {params}")
        
        return self._make_request('POST', endpoint, params, signed=True)

    def get_klines(self, interval: str = '1m', limit: int = 100) -> List:
        """
        Get kline/candlestick data
        :param interval: Kline interval ('1m', '5m', '15m', '30m', '60m', '4h', '1d', '1W', '1M')
        :param limit: Number of klines to get (max 1000)
        """
        endpoint = "/api/v3/klines"
        params = {
            'symbol': 'BTCUSDC',
            'interval': interval,
            'limit': min(limit, 1000)  # MEXC has a limit of 1000
        }
        return self._make_request('GET', endpoint, params)

    def get_open_orders(self) -> List:
        """Get all open orders"""
        endpoint = "/api/v3/openOrders"
        params = {'symbol': 'BTCUSDC'}
        return self._make_request('GET', endpoint, params, signed=True)

    def cancel_order(self, order_id: str) -> Dict:
        """Cancel an order"""
        endpoint = "/api/v3/order"
        params = {
            'symbol': 'BTCUSDC',
            'orderId': order_id
        }
        return self._make_request('DELETE', endpoint, params, signed=True)

    def get_order_status(self, order_id: str) -> Dict:
        """Get order status"""
        endpoint = "/api/v3/order"
        params = {
            'symbol': 'BTCUSDC',
            'orderId': order_id
        }
        return self._make_request('GET', endpoint, params, signed=True)

    def get_trade_history(self, limit: int = 500) -> List:
        """Get account trade history"""
        endpoint = "/api/v3/myTrades"
        params = {
            'symbol': 'BTCUSDC',
            'limit': min(limit, 1000)  # MEXC has a limit of 1000
        }
        return self._make_request('GET', endpoint, params, signed=True)

    def get_exchange_info(self) -> Dict:
        """Get exchange information including trading rules"""
        endpoint = "/api/v3/exchangeInfo"
        return self._make_request('GET', endpoint)

    def get_24hr_ticker(self) -> Dict:
        """Get 24hr price change statistics"""
        endpoint = "/api/v3/ticker/24hr"
        params = {'symbol': 'BTCUSDC'}
        return self._make_request('GET', endpoint, params)

    def get_order_book(self, limit: int = 100) -> Dict:
        """Get order book"""
        endpoint = "/api/v3/depth"
        params = {
            'symbol': 'BTCUSDC',
            'limit': min(limit, 5000)  # MEXC has a limit of 5000
        }
        return self._make_request('GET', endpoint, params) 