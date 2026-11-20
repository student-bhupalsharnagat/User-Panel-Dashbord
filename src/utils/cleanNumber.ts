/**
 * Universal safe number parser and live LTP resolver
 * Strips commas, currency symbols (₹, $), and whitespace before numeric conversion.
 */

export function parseCleanNumber(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return (isNaN(val) || !isFinite(val)) ? 0 : val;
  const cleaned = String(val).replace(/[₹$,\s]/g, '').trim();
  const num = Number(cleaned);
  return (isNaN(num) || !isFinite(num)) ? 0 : num;
}

export const cleanNumber = parseCleanNumber;

export function safeRound(val: any, decimals = 2): number {
  const num = parseCleanNumber(val);
  const factor = Math.pow(10, decimals);
  return Math.round((num + Number.EPSILON) * factor) / factor;
}

export function formatINR(val: any, decimals = 2): string {
  const num = safeRound(val, decimals);
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatQty(val: any): string {
  const num = Math.round(parseCleanNumber(val));
  return num.toLocaleString('en-IN');
}

const AUTHORITATIVE_INSTRUMENT_PRICES: Record<string, number> = {
  'RELIANCE': 2954.49,
  'TCS': 4121.89,
  'HDFCBANK': 1678.50,
  'TATASTEEL': 154.20,
  'INFY': 1865.30,
  'SBIN': 812.40,
  'ICICIBANK': 1245.80,
  'BHARTIARTL': 1580.60,
  'ITC': 492.30,
  'LT': 3650.00,
  'NIFTY 50': 24971.53,
  'NIFTY50': 24971.53,
  'NIFTY_50': 24971.53,
  'BANKNIFTY': 51842.15,
  'BANK NIFTY': 51842.15,
  'FINNIFTY': 23890.40,
  'USD/INR': 83.92,
  'USDINR': 83.92,
  'EUR/INR': 91.45,
  'EURINR': 91.45,
  'GBP/INR': 108.30,
  'GBPINR': 108.30,
  'JPY/INR': 0.58,
  'JPYINR': 0.58,
  'GOLD FUT': 75420.00,
  'GOLD': 75420.00,
  'SILVER FUT': 89250.00,
  'SILVER': 89250.00,
  'CRUDEOIL': 6240.00,
  'BTC/USD': 68450.00,
  'ETH/USD': 3540.00,
};

export function liveLtpLookup(symbol: string): number {
  if (!symbol) return 0;
  const clean = symbol.trim().toUpperCase();
  if (AUTHORITATIVE_INSTRUMENT_PRICES[clean]) {
    return AUTHORITATIVE_INSTRUMENT_PRICES[clean];
  }
  const stripped = clean.replace(/[\s_\-/]/g, '');
  for (const [key, price] of Object.entries(AUTHORITATIVE_INSTRUMENT_PRICES)) {
    const keyStripped = key.replace(/[\s_\-/]/g, '');
    if (keyStripped === stripped || clean.includes(key) || key.includes(clean)) {
      return price;
    }
  }
  return 0;
}

export function updateLivePrice(symbol: string, price: number): void {
  if (!symbol || !price || isNaN(price) || price <= 0) return;
  const clean = symbol.trim().toUpperCase();
  AUTHORITATIVE_INSTRUMENT_PRICES[clean] = price;
  const stripped = clean.replace(/[\s_\-/]/g, '');
  AUTHORITATIVE_INSTRUMENT_PRICES[stripped] = price;
}

export function updateLivePrices(quotes: Record<string, number> | Array<{ symbol: string; ltp?: number; price?: number; lastPrice?: number }>): void {
  if (!quotes) return;
  if (Array.isArray(quotes)) {
    for (const q of quotes) {
      const p = parseCleanNumber(q.ltp ?? q.price ?? q.lastPrice);
      if (q.symbol && p > 0) updateLivePrice(q.symbol, p);
    }
  } else if (typeof quotes === 'object') {
    for (const [sym, val] of Object.entries(quotes)) {
      const p = parseCleanNumber(val);
      if (sym && p > 0) updateLivePrice(sym, p);
    }
  }
}

export function getAllLivePrices(): Record<string, number> {
  return { ...AUTHORITATIVE_INSTRUMENT_PRICES };
}

export function formatIndianPhone(phone?: string): string {
  if (!phone) return '—';
  const digitsOnly = phone.replace(/\D/g, '');
  const clean = digitsOnly.length === 12 && digitsOnly.startsWith('91')
    ? digitsOnly.slice(2)
    : (digitsOnly.length === 11 && digitsOnly.startsWith('0') ? digitsOnly.slice(1) : digitsOnly);
  if (clean.length === 10) {
    return `+91 ${clean.slice(0, 5)} ${clean.slice(5)}`;
  }
  return phone.startsWith('+91') ? phone : `+91 ${phone}`;
}

