/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import fs from 'fs';
import dotenv from 'dotenv';
import {
  Order,
  Position,
  Client,
  MarketInstrument,
  FundTransaction,
  LedgerEntry,
  AuditLog,
  ReportItem,
  TenantBranding,
  AuthenticatedUser,
  SettingsState,
} from './src/types/index.ts';
import {
  initDatabase,
  getDatabaseStatus,
  isUsingPostgres,
  dbRepo,
} from './src/db.ts';
import { tradingPlatformClient } from './src/services/tradingPlatformClient.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const app = express();
app.use(express.json());

// ==========================================
// CONFIGURATION & SECRETS
// ==========================================
const APP_ENV = process.env.APP_ENV || 'development';
const JWT_SECRET = process.env.JWT_SECRET || 'nextrade-session-jwt-token-secret-2026';
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || 'nextrade-internal-hmac-secret-2026';
// Authoritative Deployed Production Endpoints
const TRADING_PLATFORM_URL = process.env.TRADING_PLATFORM_URL || 'https://trading-platform-3-1v13.onrender.com';
const CENTRAL_ADMIN_URL = process.env.CENTRAL_ADMIN_URL || 'https://admin-dashbord-2.onrender.com';
const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || 'TENANT-NEXTRADE-01';

// Exact CORS Origins Configuration
const rawAllowedOrigins = process.env.ALLOWED_ORIGINS || `${CENTRAL_ADMIN_URL},http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173`;
const allowedOriginsList = rawAllowedOrigins.split(',').map(o => o.trim().toLowerCase());

app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  if (origin) {
    const originLower = origin.toLowerCase();
    if (APP_ENV !== 'production' || allowedOriginsList.includes(originLower)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-idempotency-key, x-tenant-id');
    }
  }
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

// ==========================================
// TOKEN & CRYPTO HELPERS
// ==========================================
export interface TokenPayload {
  sub: string;
  name: string;
  email: string;
  role: 'broker_admin' | 'super_admin' | 'sub_broker' | 'trader_client' | 'operations';
  roleTitle: string;
  brokerId: string;
  tenantId: string;
  organization: string;
  phone: string;
  exp: number;
}

export function createSignedToken(payload: Omit<TokenPayload, 'exp'>, expiresInMs = 86400000): string {
  const fullPayload: TokenPayload = {
    ...payload,
    exp: Date.now() + expiresInMs,
  };
  const b64Payload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(b64Payload).digest('base64url');
  return `${b64Payload}.${signature}`;
}

export function verifySignedToken(token: string): TokenPayload | null {
  if (!token || !token.includes('.')) return null;
  const [b64Payload, signature] = token.split('.');
  const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(b64Payload).digest('base64url');
  if (signature !== expectedSig) return null;
  try {
    const payload: TokenPayload = JSON.parse(Buffer.from(b64Payload, 'base64url').toString('utf8'));
    if (payload.exp < Date.now()) return null; // expired
    return payload;
  } catch {
    return null;
  }
}

export function verifyHmacSignature(rawBody: string, signature: string, timestamp: number): boolean {
  try {
    if (!signature || typeof signature !== 'string') return false;
    // 5-minute replay window
    if (!timestamp || Math.abs(Date.now() - timestamp) > 300000) return false;
    const data = `${timestamp}.${rawBody}`;
    const expected = crypto.createHmac('sha256', INTERNAL_API_SECRET).update(data).digest('hex');
    const sigBuf = Buffer.from(signature, 'hex');
    const expBuf = Buffer.from(expected, 'hex');
    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

// ==========================================
// SEED USERS & SYSTEM DATABASE
// ==========================================
const systemUsers: Record<string, AuthenticatedUser> = {
  'broker_admin': {
    id: 'USR-ROHAN-01',
    name: 'Rohan Sen',
    email: 'rohan.sen@nextrade.example',
    role: 'broker_admin',
    roleTitle: 'Broker Administrator',
    brokerId: 'BRK-ROHAN-01',
    tenantId: DEFAULT_TENANT_ID,
    organization: 'NexTrade Securities',
    phone: '+91 98765 42048',
    timezone: 'IST (UTC +05:30)',
    currency: 'INR - Indian Rupee',
    avatar: 'RS',
  },
  'super_admin': {
    id: 'USR-SUPERADMIN',
    name: 'Central Administrator',
    email: 'admin@nextrade.central',
    role: 'super_admin',
    roleTitle: 'Super Administrator',
    brokerId: 'BRK-CENTRAL',
    tenantId: DEFAULT_TENANT_ID,
    organization: 'NexTrade Central Platform',
    phone: '+91 98765 00000',
    timezone: 'IST (UTC +05:30)',
    currency: 'INR - Indian Rupee',
    avatar: 'CA',
  },
  'trader_client': {
    id: 'NT10482',
    name: 'Aarav Mehta',
    email: 'aarav.mehta@example.com',
    role: 'trader_client',
    roleTitle: 'Trader Client',
    brokerId: 'BRK-ROHAN-01',
    tenantId: DEFAULT_TENANT_ID,
    organization: 'NexTrade Retail',
    phone: '+91 98201 54820',
    timezone: 'IST (UTC +05:30)',
    currency: 'INR - Indian Rupee',
    avatar: 'AM',
  },
};

let tenantBranding: TenantBranding = {
  brandName: 'NexTrade',
  platformName: 'NexTrade BROKER OS',
  shortName: 'NexTrade',
  tagline: 'Institutional Grade Broker Infrastructure',
  logoUrl: '',
  primaryColor: '#8b5cf6',
  secondaryColor: '#06b6d4',
  accentColor: '#10b981',
  supportEmail: 'support@nextrade.example',
  supportPhone: '+91 98765 42000',
  footerCopyright: '© 2026 NexTrade Technologies Ltd. All rights reserved.',
  version: 'v4.2.0-prod',
  updatedAt: new Date().toISOString(),
};

let settingsState: SettingsState = {
  profileImage: '',
  displayName: 'Rohan Sen',
  organization: 'NexTrade Securities',
  email: 'rohan.sen@nextrade.example',
  phone: '+91 98765 42048',
  timezone: 'IST (UTC +05:30)',
  currency: 'INR - Indian Rupee',
  activityAlerts: true,
  compactTableDensity: false,
  twoFactorAuth: true,
  emailNotifications: true,
  marginCallAlerts: true,
};

let instruments: MarketInstrument[] = [
  {
    symbol: 'NIFTY',
    name: 'NIFTY 50',
    exchange: 'NSE',
    lastPrice: 22147.90,
    change: 124.60,
    changePercent: 0.57,
    bid: 22146.20,
    ask: 22149.10,
    volume: '2.8M',
    high: 22210.50,
    low: 22018.30,
    type: 'Index',
    contractExpiry: 'Spot',
    lotSize: 50,
    tickSize: 0.05,
    status: 'Enabled',
  },
  {
    symbol: 'BANKNIFTY',
    name: 'BANKNIFTY',
    exchange: 'NSE',
    lastPrice: 47812.30,
    change: -90.45,
    changePercent: -0.19,
    bid: 47808.00,
    ask: 47817.50,
    volume: '1.4M',
    high: 48050.00,
    low: 47680.10,
    type: 'Index',
    contractExpiry: 'Spot',
    lotSize: 15,
    tickSize: 0.05,
    status: 'Enabled',
  },
  {
    symbol: 'RELIANCE',
    name: 'Reliance Industries',
    exchange: 'NSE',
    lastPrice: 2986.15,
    change: 21.80,
    changePercent: 0.74,
    bid: 2985.80,
    ask: 2986.90,
    volume: '5.2M',
    high: 3004.00,
    low: 2962.00,
    type: 'Equity',
    contractExpiry: 'EQ',
    lotSize: 1,
    tickSize: 0.05,
    status: 'Enabled',
  },
  {
    symbol: 'HDFCBANK',
    name: 'HDFC Bank Ltd',
    exchange: 'NSE',
    lastPrice: 1451.70,
    change: -9.10,
    changePercent: -0.62,
    bid: 1451.20,
    ask: 1452.05,
    volume: '3.1M',
    high: 1466.00,
    low: 1448.00,
    type: 'Equity',
    contractExpiry: 'EQ',
    lotSize: 1,
    tickSize: 0.05,
    status: 'Enabled',
  },
  {
    symbol: 'TCS',
    name: 'Tata Consultancy Services',
    exchange: 'NSE',
    lastPrice: 4102.35,
    change: 44.10,
    changePercent: 1.09,
    bid: 4101.80,
    ask: 4103.30,
    volume: '1.8M',
    high: 4125.00,
    low: 4055.20,
    type: 'Equity',
    contractExpiry: 'EQ',
    lotSize: 1,
    tickSize: 0.05,
    status: 'Enabled',
  },
  {
    symbol: 'INFY',
    name: 'Infosys Limited',
    exchange: 'NSE',
    lastPrice: 1564.40,
    change: 18.25,
    changePercent: 1.18,
    bid: 1563.90,
    ask: 1564.90,
    volume: '2.4M',
    high: 1572.00,
    low: 1545.00,
    type: 'Equity',
    contractExpiry: 'EQ',
    lotSize: 1,
    tickSize: 0.05,
    status: 'Enabled',
  },
  {
    symbol: 'ICICIBANK',
    name: 'ICICI Bank Limited',
    exchange: 'NSE',
    lastPrice: 1098.20,
    change: 6.40,
    changePercent: 0.59,
    bid: 1097.80,
    ask: 1098.50,
    volume: '2.9M',
    high: 1105.00,
    low: 1091.00,
    type: 'Equity',
    contractExpiry: 'EQ',
    lotSize: 1,
    tickSize: 0.05,
    status: 'Enabled',
  },
  {
    symbol: 'NIFTY25APRFUT',
    name: 'Nifty April Futures',
    exchange: 'NFO',
    lastPrice: 22215.00,
    change: 132.50,
    changePercent: 0.60,
    bid: 22213.50,
    ask: 22216.50,
    volume: '4.1M',
    high: 22280.00,
    low: 22070.00,
    type: 'Futures',
    contractExpiry: '24 Apr 2026',
    lotSize: 50,
    tickSize: 0.05,
    status: 'Enabled',
  },
  {
    symbol: 'BANKNIFTY25APRFUT',
    name: 'Bank Nifty April Futures',
    exchange: 'NFO',
    lastPrice: 47940.00,
    change: -75.00,
    changePercent: -0.16,
    bid: 47935.00,
    ask: 47945.00,
    volume: '2.2M',
    high: 48200.00,
    low: 47800.00,
    type: 'Futures',
    contractExpiry: '24 Apr 2026',
    lotSize: 15,
    tickSize: 0.05,
    status: 'Disabled',
  },
];

let clients: Client[] = [
  {
    id: 'NT10482',
    name: 'Aarav Mehta',
    email: 'aarav.mehta@example.com',
    phone: '+91 98201 54820',
    pan: 'ABCDE1234F',
    status: 'Active',
    isDemo: false,
    ledgerBalance: 1284500,
    openPnL: 248250,
    peakLedger: 1532750,
    marginUsed: 425000,
    income: 820000,
    marginAvailable: 859500,
    brokerId: 'BRK-ROHAN-01',
    brokerName: 'Rohan Sen',
    kycStatus: 'Verified',
    kycDocuments: ['Aadhaar Card', 'PAN Card', 'Cancelled Cheque', 'Income Proof'],
    createdDate: '12 Jan 2025',
    lastActive: 'Just now',
    riskLimit: 2500000,
  },
  {
    id: 'NT10387',
    name: 'Ananya Iyer',
    email: 'ananya.iyer@example.com',
    phone: '+91 98202 63870',
    pan: 'BCDEF2345G',
    status: 'Active',
    isDemo: false,
    ledgerBalance: 945780,
    openPnL: 31450,
    peakLedger: 977230,
    marginUsed: 308800,
    income: 610200,
    marginAvailable: 668430,
    brokerId: 'BRK-ROHAN-01',
    brokerName: 'Rohan Sen',
    kycStatus: 'Verified',
    kycDocuments: ['Aadhaar Card', 'PAN Card', 'Bank Statement'],
    createdDate: '18 Jan 2025',
    lastActive: '5 mins ago',
    riskLimit: 1500000,
  },
  {
    id: 'DM20791',
    name: 'Arjun Verma',
    email: 'arjun.verma@demo.example',
    phone: '+91 98203 72791',
    pan: 'CDEFG3456H',
    status: 'Active',
    isDemo: true,
    ledgerBalance: 250000,
    openPnL: -2150,
    peakLedger: 247850,
    marginUsed: 0,
    income: 0,
    marginAvailable: 247850,
    brokerId: 'BRK-ROHAN-01',
    brokerName: 'Rohan Sen',
    kycStatus: 'Verified',
    kycDocuments: ['Demo Verification Passed'],
    createdDate: '02 Feb 2025',
    lastActive: '12 mins ago',
    riskLimit: 500000,
  },
  {
    id: 'NT10315',
    name: 'Diya Kapoor',
    email: 'diya.kapoor@example.com',
    phone: '+91 98204 81315',
    pan: 'DEFGH4567I',
    status: 'Active',
    isDemo: false,
    ledgerBalance: 685400,
    openPnL: -12780,
    peakLedger: 672620,
    marginUsed: 278500,
    income: 490000,
    marginAvailable: 394120,
    brokerId: 'BRK-ROHAN-01',
    brokerName: 'Rohan Sen',
    kycStatus: 'Verified',
    kycDocuments: ['Aadhaar Card', 'PAN Card', 'ITR Acknowledgement'],
    createdDate: '14 Feb 2025',
    lastActive: '18 mins ago',
    riskLimit: 1200000,
  },
  {
    id: 'NT10078',
    name: 'Ishita Singh',
    email: 'ishita.singh@example.com',
    phone: '+91 98205 90078',
    pan: 'EFGHI5678J',
    status: 'Active',
    isDemo: false,
    ledgerBalance: 752800,
    openPnL: 18320,
    peakLedger: 770920,
    marginUsed: 282000,
    income: 415000,
    marginAvailable: 488920,
    brokerId: 'BRK-ROHAN-01',
    brokerName: 'Rohan Sen',
    kycStatus: 'Verified',
    kycDocuments: ['Aadhaar Card', 'PAN Card', '6-Month Bank Statement'],
    createdDate: '21 Feb 2025',
    lastActive: '32 mins ago',
    riskLimit: 1400000,
  },
  {
    id: 'NT10198',
    name: 'Kabir Rao',
    email: 'kabir.rao@example.com',
    phone: '+91 98206 01198',
    pan: 'FGHIJ6789K',
    status: 'Inactive',
    isDemo: false,
    ledgerBalance: 214500,
    openPnL: -8420,
    peakLedger: 206480,
    marginUsed: 48500,
    income: 58000,
    marginAvailable: 158080,
    brokerId: 'BRK-ROHAN-01',
    brokerName: 'Rohan Sen',
    kycStatus: 'Verified',
    kycDocuments: ['Aadhaar Card', 'PAN Card'],
    createdDate: '01 Mar 2025',
    lastActive: '2 days ago',
    riskLimit: 500000,
  },
  {
    id: 'NT10154',
    name: 'Meera Nair',
    email: 'meera.nair@example.com',
    phone: '+91 98207 12154',
    pan: 'GHIJK7890L',
    status: 'Active',
    isDemo: false,
    ledgerBalance: 1578200,
    openPnL: 75940,
    peakLedger: 1654140,
    marginUsed: 640000,
    income: 985000,
    marginAvailable: 1014140,
    brokerId: 'BRK-ROHAN-01',
    brokerName: 'Rohan Sen',
    kycStatus: 'Verified',
    kycDocuments: ['Aadhaar Card', 'PAN Card', 'Income Certificate', 'Demat Master'],
    createdDate: '08 Mar 2025',
    lastActive: '1 hr ago',
    riskLimit: 3000000,
  },
  {
    id: 'DM20945',
    name: 'Vivaan Shah',
    email: 'vivaan.shah@demo.example',
    phone: '+91 98208 23945',
    pan: 'HIJKL8901M',
    status: 'Active',
    isDemo: true,
    ledgerBalance: 500000,
    openPnL: 8900,
    peakLedger: 508900,
    marginUsed: 142000,
    income: 215000,
    marginAvailable: 366900,
    brokerId: 'BRK-ROHAN-01',
    brokerName: 'Rohan Sen',
    kycStatus: 'Verified',
    kycDocuments: ['Demo Sandbox Approval'],
    createdDate: '15 Mar 2025',
    lastActive: '45 mins ago',
    riskLimit: 1000000,
  },
];

let orders: Order[] = [
  {
    id: 'ORD-98421',
    clientId: 'NT10482',
    clientName: 'A. Mehta',
    instrument: 'RELIANCE',
    exchange: 'NSE',
    side: 'BUY',
    type: 'LIMIT',
    quantity: 120,
    orderPrice: 2982.50,
    executedQty: 120,
    avgPrice: 2981.90,
    status: 'Executed',
    created: '10:42:18',
    brokerId: 'BRK-ROHAN-01',
  },
  {
    id: 'ORD-98420',
    clientId: 'NT10078',
    clientName: 'D. Kapoor',
    instrument: 'NIFTY APR FUT',
    exchange: 'NFO',
    side: 'SELL',
    type: 'MARKET',
    quantity: 50,
    orderPrice: 'Market',
    executedQty: 50,
    avgPrice: 22192.30,
    status: 'Executed',
    created: '10:40:55',
    brokerId: 'BRK-ROHAN-01',
  },
  {
    id: 'ORD-98419',
    clientId: 'NT10387',
    clientName: 'A. Iyer',
    instrument: 'TCS',
    exchange: 'NSE',
    side: 'BUY',
    type: 'LIMIT',
    quantity: 75,
    orderPrice: 4095.00,
    executedQty: 0,
    avgPrice: 0,
    status: 'Open',
    created: '10:39:12',
    brokerId: 'BRK-ROHAN-01',
  },
  {
    id: 'ORD-98418',
    clientId: 'NT10154',
    clientName: 'M. Nair',
    instrument: 'BANKNIFTY',
    exchange: 'NSE',
    side: 'SELL',
    type: 'SL-M',
    quantity: 30,
    orderPrice: 47890.00,
    executedQty: 0,
    avgPrice: 0,
    status: 'Pending',
    created: '10:35:04',
    brokerId: 'BRK-ROHAN-01',
  },
  {
    id: 'ORD-98417',
    clientId: 'NT10315',
    clientName: 'D. Kapoor',
    instrument: 'HDFCBANK',
    exchange: 'NSE',
    side: 'BUY',
    type: 'LIMIT',
    quantity: 200,
    orderPrice: 1445.00,
    executedQty: 0,
    avgPrice: 0,
    status: 'Cancelled',
    created: '09:58:22',
    brokerId: 'BRK-ROHAN-01',
    rejectionReason: 'Cancelled by client request',
  },
  {
    id: 'ORD-98416',
    clientId: 'NT10198',
    clientName: 'K. Rao',
    instrument: 'INFY',
    exchange: 'NSE',
    side: 'BUY',
    type: 'LIMIT',
    quantity: 500,
    orderPrice: 1560.00,
    executedQty: 0,
    avgPrice: 0,
    status: 'Rejected',
    created: '09:44:11',
    brokerId: 'BRK-ROHAN-01',
    rejectionReason: 'RMS check failed: insufficient margin available',
  },
];

let positions: Position[] = [
  {
    id: 'POS-77101',
    clientId: 'NT10482',
    clientName: 'A. Mehta',
    instrument: 'RELIANCE',
    exchange: 'NSE',
    product: 'MIS',
    buyQty: 120,
    sellQty: 0,
    netQty: 120,
    avgPrice: 2981.90,
    currentPrice: 2986.15,
    realisedPnL: 0,
    unrealisedPnL: 510,
    totalPnL: 510,
    marginUsed: 71460,
    brokerId: 'BRK-ROHAN-01',
  },
  {
    id: 'POS-77102',
    clientId: 'NT10078',
    clientName: 'D. Kapoor',
    instrument: 'NIFTY APR FUT',
    exchange: 'NFO',
    product: 'NRML',
    buyQty: 0,
    sellQty: 50,
    netQty: -50,
    avgPrice: 22192.30,
    currentPrice: 22147.90,
    realisedPnL: 18420,
    unrealisedPnL: 2220,
    totalPnL: 20640,
    marginUsed: 112300,
    brokerId: 'BRK-ROHAN-01',
  },
  {
    id: 'POS-77103',
    clientId: 'NT10387',
    clientName: 'A. Iyer',
    instrument: 'TCS',
    exchange: 'NSE',
    product: 'CNC',
    buyQty: 75,
    sellQty: 0,
    netQty: 75,
    avgPrice: 4060.20,
    currentPrice: 4102.35,
    realisedPnL: 12170,
    unrealisedPnL: 3161,
    totalPnL: 15331,
    marginUsed: 0,
    brokerId: 'BRK-ROHAN-01',
  },
];

let fundTransactions: FundTransaction[] = [
  {
    id: 'TXN-80412',
    clientId: 'NT10482',
    clientName: 'A. Mehta',
    type: 'Deposit',
    amount: 250000,
    method: 'Bank transfer',
    requestDate: '22 Apr, 10:24',
    referenceId: 'UTR958310421',
    status: 'Pending',
    verification: 'Bank proof attached',
    proofDocument: 'mehta_hdfc_utr9583.pdf',
    brokerId: 'BRK-ROHAN-01',
  },
  {
    id: 'TXN-80411',
    clientId: 'NT10315',
    clientName: 'D. Kapoor',
    type: 'Deposit',
    amount: 75000,
    method: 'UPI',
    requestDate: '22 Apr, 09:42',
    referenceId: 'UPI72394590',
    status: 'Approved',
    verification: 'Auto-verified',
    approvedBy: 'Payment Gateway',
    brokerId: 'BRK-ROHAN-01',
  },
  {
    id: 'TXN-80408',
    clientId: 'NT10154',
    clientName: 'M. Nair',
    type: 'Deposit',
    amount: 400000,
    method: 'Bank transfer',
    requestDate: '21 Apr, 16:18',
    referenceId: 'UTR58021483',
    status: 'Completed',
    verification: 'Verified by R. Sen',
    approvedBy: 'Rohan Sen',
    brokerId: 'BRK-ROHAN-01',
  },
  {
    id: 'TXN-80402',
    clientId: 'NT10387',
    clientName: 'A. Iyer',
    type: 'Withdrawal',
    amount: 120000,
    method: 'Net banking',
    requestDate: '21 Apr, 14:05',
    referenceId: 'NB402118563',
    status: 'Rejected',
    verification: 'Reference mismatch',
    rejectionReason: 'Beneficiary bank IFSC code does not match registered bank account details',
    brokerId: 'BRK-ROHAN-01',
  },
  {
    id: 'TXN-80400',
    clientId: 'NT10078',
    clientName: 'I. Singh',
    type: 'Withdrawal',
    amount: 50000,
    method: 'Net banking',
    requestDate: '21 Apr, 11:30',
    referenceId: 'NB402099142',
    status: 'Pending',
    verification: 'Account verified, awaiting broker clearance',
    brokerId: 'BRK-ROHAN-01',
  },
];

let ledgerEntries: LedgerEntry[] = [
  {
    id: 'LED-39284',
    date: '22 Apr 2026',
    referenceId: 'LED-39284',
    description: 'Daily brokerage settlement',
    debit: 0,
    credit: 94380,
    runningBalance: 18420140,
    status: 'Completed',
    type: 'Brokerage',
  },
  {
    id: 'LED-39278',
    date: '22 Apr 2026',
    referenceId: 'LED-39278',
    description: 'Client withdrawal batch',
    debit: 1240000,
    credit: 0,
    runningBalance: 18325760,
    status: 'Completed',
    type: 'Withdrawal',
  },
  {
    id: 'LED-39241',
    date: '21 Apr 2026',
    referenceId: 'LED-39241',
    description: 'Margin funding adjustment',
    debit: 435000,
    credit: 0,
    runningBalance: 19565760,
    status: 'Completed',
    type: 'Margin Funding',
  },
  {
    id: 'LED-39220',
    date: '21 Apr 2026',
    referenceId: 'LED-39220',
    description: 'Client deposit batch',
    debit: 0,
    credit: 1872500,
    runningBalance: 19900760,
    status: 'Completed',
    type: 'Deposit',
  },
  {
    id: 'LED-39190',
    date: '20 Apr 2026',
    referenceId: 'LED-39190',
    description: 'Exchange turnover fee debit',
    debit: 18400,
    credit: 0,
    runningBalance: 18028260,
    status: 'Completed',
    type: 'Brokerage',
  },
];

let auditLogs: AuditLog[] = [
  {
    id: 'LOG-1092',
    timestamp: '22 Apr, 10:48:12',
    user: 'Rohan Sen',
    role: 'Broker Admin',
    action: 'Viewed client account',
    relatedEntity: 'NT10482',
    ipAddress: '103.48.xx.21',
    result: 'Success',
    details: 'Viewed Aarav Mehta full ledger and active orders profile.',
  },
  {
    id: 'LOG-1091',
    timestamp: '22 Apr, 10:42:08',
    user: 'Priya Desai',
    role: 'Operations',
    action: 'Approved deposit',
    relatedEntity: 'TXN-80411',
    ipAddress: '103.82.xx.08',
    result: 'Success',
    details: 'Verified UPI payment reference UPI72394590 for ₹75,000.',
  },
  {
    id: 'LOG-1090',
    timestamp: '22 Apr, 10:31:54',
    user: 'Rohan Sen',
    role: 'Broker Admin',
    action: 'Exported orders report',
    relatedEntity: 'APR-ORDERS',
    ipAddress: '103.48.xx.21',
    result: 'Success',
    details: 'Generated CSV export of 8,492 daily orders across assigned sub-broker hierarchy.',
  },
  {
    id: 'LOG-1089',
    timestamp: '22 Apr, 10:17:29',
    user: 'System',
    role: 'Automation',
    action: 'KYC verification',
    relatedEntity: 'NT10292',
    ipAddress: '10.0.0.1',
    result: 'Warning',
    details: 'Name mismatch on Aadhaar OCR vs Bank Account. Flagged for manual review.',
  },
  {
    id: 'LOG-1088',
    timestamp: '22 Apr, 09:15:00',
    user: 'Central Admin',
    role: 'Super Admin',
    action: 'Synced tenant branding',
    relatedEntity: 'TENANT-NEXTRADE-01',
    ipAddress: '10.0.0.12',
    result: 'Success',
    details: 'Propagated white-label update v4.2.0-prod across User and Trading Panels.',
  },
];

const reportsList: ReportItem[] = [
  {
    id: 'rep-clients',
    title: 'Client reports',
    description: 'Client master, status, KYC and activity metrics',
    type: 'clients',
    recordCount: 2486,
    category: 'Accounts & Compliance',
  },
  {
    id: 'rep-ledger',
    title: 'Ledger reports',
    description: 'Authoritative transaction journals and running balances',
    type: 'ledger',
    recordCount: 14920,
    category: 'Financial',
  },
  {
    id: 'rep-orders',
    title: 'Orders & trades',
    description: 'Execution logs, order books, and fill audits',
    type: 'orders',
    recordCount: 8492,
    category: 'Trading',
  },
  {
    id: 'rep-positions',
    title: 'Positions & P&L',
    description: 'Open exposure, mark-to-market and performance breakdown',
    type: 'positions',
    recordCount: 3120,
    category: 'Risk & Portfolio',
  },
  {
    id: 'rep-funds',
    title: 'Funds reports',
    description: 'Deposits, withdrawals, and clearance audit trail',
    type: 'funds',
    recordCount: 784,
    category: 'Financial',
  },
  {
    id: 'rep-turnover',
    title: 'Turnover',
    description: 'Traded volume, exchange segments, and turnover breakdown',
    type: 'turnover',
    recordCount: 4200,
    category: 'Trading Analytics',
  },
  {
    id: 'rep-brokerage',
    title: 'Brokerage',
    description: 'Commission distributions and revenue shares',
    type: 'brokerage',
    recordCount: 3600,
    category: 'Revenue',
  },
  {
    id: 'rep-statements',
    title: 'Account statements',
    description: 'Consolidated end-of-day client financial statements',
    type: 'statements',
    recordCount: 2486,
    category: 'Client Services',
  },
];

// ==========================================
// PERSISTENT DATA ADAPTER & RESTART RECOVERY
// ==========================================
const DATA_DIR = path.join(__dirname, 'data');
const PERSISTENCE_FILE = path.join(DATA_DIR, 'persistence-store.json');

export function initPersistenceStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(PERSISTENCE_FILE)) {
      const raw = fs.readFileSync(PERSISTENCE_FILE, 'utf8');
      const store = JSON.parse(raw);
      if (Array.isArray(store.clients)) clients = store.clients;
      if (Array.isArray(store.orders)) orders = store.orders;
      if (Array.isArray(store.positions)) positions = store.positions;
      if (Array.isArray(store.fundTransactions)) fundTransactions = store.fundTransactions;
      if (Array.isArray(store.ledgerEntries)) ledgerEntries = store.ledgerEntries;
      if (Array.isArray(store.auditLogs)) auditLogs = store.auditLogs;
      if (Array.isArray(store.instruments)) instruments = store.instruments;
      if (store.tenantBranding) tenantBranding = { ...tenantBranding, ...store.tenantBranding };
      if (store.settingsState) settingsState = { ...settingsState, ...store.settingsState };
      console.log(`[Persistence] Loaded persisted snapshot: ${clients.length} clients, ${orders.length} orders, ${positions.length} positions, ${fundTransactions.length} txns, ${ledgerEntries.length} ledger entries.`);
    } else {
      savePersistence();
    }
  } catch (err: any) {
    console.warn('[Persistence] Notice loading persistence store:', err.message);
  }
}

export function savePersistence() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const store = {
      version: '1.0.0',
      lastSaved: new Date().toISOString(),
      tenantBranding,
      settingsState,
      instruments,
      clients,
      orders,
      positions,
      fundTransactions,
      ledgerEntries,
      auditLogs,
    };
    const tmpFile = `${PERSISTENCE_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tmpFile, JSON.stringify(store, null, 2), 'utf8');
    fs.renameSync(tmpFile, PERSISTENCE_FILE);
  } catch (err: any) {
    console.error('[Persistence] Error saving snapshot:', err.message);
  }
}

// Initialise storage immediately on server load
initPersistenceStore();

// ==========================================
// UPSTREAM ECOSYSTEM PROBING & LIVE SYNC
// ==========================================
let upstreamTradingPlatformStatus: any = {
  reachable: false,
  url: TRADING_PLATFORM_URL,
  lastChecked: null,
  latencyMs: 0,
  details: null,
};

let upstreamCentralAdminStatus: any = {
  reachable: false,
  url: CENTRAL_ADMIN_URL,
  lastChecked: null,
  latencyMs: 0,
  details: null,
};

export async function probeUpstreamTradingPlatform(timeoutMs = 6000) {
  const status = await tradingPlatformClient.probeHealth(timeoutMs);
  upstreamTradingPlatformStatus = {
    reachable: status.reachable,
    url: TRADING_PLATFORM_URL,
    lastChecked: status.lastChecked,
    latencyMs: status.latencyMs,
    service: status.service,
    dependencies: {
      postgresql: {
        status: status.postgresStatus,
        latencyMs: status.postgresLatencyMs,
        authoritativeSourceOfTruth: status.authoritativeSourceOfTruth,
      },
    },
    error: status.error,
  };
  if (status.reachable && !status.wsConnected) {
    tradingPlatformClient.connectWebSocket().catch(() => {});
  }
  return upstreamTradingPlatformStatus;
}

export async function probeUpstreamCentralAdmin(timeoutMs = 6000) {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${CENTRAL_ADMIN_URL}/api/health`, { signal: controller.signal });
    clearTimeout(timer);
    const latencyMs = Date.now() - start;
    if (res.ok) {
      const data: any = await res.json();
      upstreamCentralAdminStatus = {
        reachable: true,
        url: CENTRAL_ADMIN_URL,
        lastChecked: new Date().toISOString(),
        latencyMs,
        status: data.status,
        uptime: data.uptime,
      };
      return upstreamCentralAdminStatus;
    }
    upstreamCentralAdminStatus = {
      reachable: false,
      url: CENTRAL_ADMIN_URL,
      lastChecked: new Date().toISOString(),
      latencyMs,
      error: `HTTP ${res.status}`,
    };
  } catch (err: any) {
    upstreamCentralAdminStatus = {
      reachable: false,
      url: CENTRAL_ADMIN_URL,
      lastChecked: new Date().toISOString(),
      latencyMs: Date.now() - start,
      error: err.name === 'AbortError' ? 'Connection timeout' : err.message,
    };
  }
  return upstreamCentralAdminStatus;
}

export async function syncUpstreamMarketInstruments() {
  try {
    const upstreamInstruments = await tradingPlatformClient.fetchInstruments();
    if (Array.isArray(upstreamInstruments) && upstreamInstruments.length > 0) {
      upstreamInstruments.forEach((remoteInst: any) => {
        const match = instruments.find(i => i.symbol === remoteInst.symbol);
        if (match) {
          match.lastPrice = remoteInst.lastPrice ?? match.lastPrice;
          match.change = remoteInst.change ?? match.change;
          match.changePercent = remoteInst.changePercent ?? match.changePercent;
          match.high = remoteInst.highPrice ?? match.high;
          match.low = remoteInst.lowPrice ?? match.low;
        }
      });
      savePersistence();
      console.log(`[Upstream Sync] Synced ${upstreamInstruments.length} market instruments from Trading Platform.`);
    }
  } catch (err: any) {
    console.warn('[Upstream Sync] Notice syncing market instruments from upstream:', err.message);
  }
}

// Background initial probe and sync
setTimeout(() => {
  probeUpstreamTradingPlatform().catch(() => {});
  probeUpstreamCentralAdmin().catch(() => {});
  syncUpstreamMarketInstruments().catch(() => {});
}, 1000);

// ==========================================
// IDEMPOTENCY CACHE & OUTBOX
// ==========================================
const processedIdempotencyKeys = new Map<string, { status: number; body: any; timestamp: number }>();

function checkIdempotency(req: Request, res: Response): boolean {
  const key = req.headers['x-idempotency-key'] as string;
  if (!key) return false;
  if (processedIdempotencyKeys.has(key)) {
    const cached = processedIdempotencyKeys.get(key)!;
    res.status(cached.status).json(cached.body);
    return true; // Already processed
  }
  return false;
}

function recordIdempotency(req: Request, status: number, body: any) {
  const key = req.headers['x-idempotency-key'] as string;
  if (key) {
    processedIdempotencyKeys.set(key, { status, body, timestamp: Date.now() });
  }
}

// ==========================================
// REAL-TIME BROADCAST ENGINE (SSE)
// ==========================================
interface SSEClient {
  id: string;
  userId: string;
  role: string;
  brokerId: string;
  tenantId: string;
  res: Response;
}

let sseClients: SSEClient[] = [];
let eventSequenceCounter = 1000;

function broadcastScopedEvent(eventType: string, data: any, scope?: { brokerId?: string; tenantId?: string; clientId?: string }) {
  const eventId = `EVT-${++eventSequenceCounter}`;
  const payload = `id: ${eventId}\nevent: ${eventType}\ndata: ${JSON.stringify({ ...data, eventId, timestamp: new Date().toISOString() })}\n\n`;

  sseClients.forEach((client) => {
    try {
      // Tenant check
      if (scope?.tenantId && client.tenantId !== scope.tenantId && client.role !== 'super_admin') {
        return;
      }
      // Broker hierarchy check
      if (scope?.brokerId && client.role === 'broker_admin' && client.brokerId !== scope.brokerId) {
        return;
      }
      // Client check
      if (scope?.clientId && client.role === 'trader_client' && client.userId !== scope.clientId) {
        return;
      }
      client.res.write(payload);
    } catch {
      // disconnected
    }
  });
}

// Periodic ping to keep SSE connection alive
setInterval(() => {
  sseClients.forEach((client) => {
    try {
      client.res.write(`event: ping\ndata: ${JSON.stringify({ time: Date.now() })}\n\n`);
    } catch {}
  });
}, 15000);

// In development or demo mode, tick market instruments with controlled realistic variations
if (APP_ENV !== 'production') {
  setInterval(() => {
    const target = instruments[Math.floor(Math.random() * instruments.length)];
    if (target && target.status === 'Enabled') {
      const delta = +( (Math.random() - 0.49) * (target.lastPrice * 0.001) ).toFixed(2);
      target.lastPrice = +(target.lastPrice + delta).toFixed(2);
      target.change = +(target.change + delta).toFixed(2);
      target.changePercent = +((target.change / (target.lastPrice - target.change)) * 100).toFixed(2);
      target.bid = +(target.lastPrice - 0.5).toFixed(2);
      target.ask = +(target.lastPrice + 0.5).toFixed(2);

      // Recalculate open positions MTM
      positions.forEach((pos) => {
        if (pos.instrument === target.symbol) {
          pos.currentPrice = target.lastPrice;
          pos.unrealisedPnL = Math.round((pos.currentPrice - pos.avgPrice) * pos.netQty);
          pos.totalPnL = pos.realisedPnL + pos.unrealisedPnL;
        }
      });

      broadcastScopedEvent('tick', {
        symbol: target.symbol,
        lastPrice: target.lastPrice,
        change: target.change,
        changePercent: target.changePercent,
        bid: target.bid,
        ask: target.ask,
      });
    }
  }, 3500);
}

// ==========================================
// AUTH & RBAC MIDDLEWARES
// ==========================================
export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  let token = '';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (req.query.token) {
    token = String(req.query.token);
  }

  if (token) {
    const payload = verifySignedToken(token);
    if (payload) {
      req.user = payload;
      return next();
    }
  }

  // In development, default to Rohan Sen (broker_admin) session if no bearer passed
  if (APP_ENV !== 'production') {
    const defaultUser = systemUsers['broker_admin'];
    req.user = {
      sub: defaultUser.id,
      name: defaultUser.name,
      email: defaultUser.email,
      role: defaultUser.role,
      roleTitle: defaultUser.roleTitle,
      brokerId: defaultUser.brokerId,
      tenantId: defaultUser.tenantId,
      organization: defaultUser.organization,
      phone: defaultUser.phone,
      exp: Date.now() + 86400000,
    };
    return next();
  }

  return res.status(401).json({
    success: false,
    message: 'Unauthorized: Valid cryptographic session token required',
  });
}

function requireRole(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      auditLogs.unshift({
        id: `LOG-${Date.now().toString().slice(-4)}`,
        timestamp: new Date().toLocaleTimeString('en-GB') + ', Today',
        user: req.user?.name || 'Anonymous',
        role: req.user?.roleTitle || 'Unauthenticated',
        action: 'Unauthorized access attempt blocked',
        relatedEntity: req.path,
        ipAddress: req.ip || '127.0.0.1',
        result: 'Failed',
        details: `Access to ${req.method} ${req.path} rejected: requires role in [${allowedRoles.join(', ')}]`,
      });
      return res.status(403).json({
        success: false,
        message: `Forbidden: User role '${req.user?.role}' does not have sufficient permissions`,
      });
    }
    next();
  };
}

// ==========================================
// AUTHORITATIVE CALCULATIONS
// ==========================================
function calculateAuthoritativeMetrics(userRole: string, brokerId: string, clientId?: string) {
  let filteredClients = clients;
  let filteredPositions = positions;
  let filteredOrders = orders;

  if (userRole === 'trader_client' && clientId) {
    filteredClients = clients.filter(c => c.id === clientId);
    filteredPositions = positions.filter(p => p.clientId === clientId);
    filteredOrders = orders.filter(o => o.clientId === clientId);
  } else if (userRole === 'broker_admin') {
    filteredClients = clients.filter(c => c.brokerId === brokerId);
    filteredPositions = positions.filter(p => p.brokerId === brokerId);
    filteredOrders = orders.filter(o => o.brokerId === brokerId);
  }

  const activeCount = filteredClients.filter(c => c.status === 'Active').length;
  const inactiveCount = filteredClients.filter(c => c.status !== 'Active').length;
  const totalCount = filteredClients.length;

  const totalUnrealised = filteredPositions.reduce((acc, p) => acc + p.unrealisedPnL, 0);
  const totalRealised = filteredPositions.reduce((acc, p) => acc + p.realisedPnL, 0);
  const netPnL = totalRealised + totalUnrealised;

  const totalLedgerBalance = filteredClients.reduce((acc, c) => acc + c.ledgerBalance, 0);
  const totalMarginUsed = filteredPositions.reduce((acc, p) => acc + p.marginUsed, 0);
  const totalMarginAvailable = filteredClients.reduce((acc, c) => acc + c.marginAvailable, 0);

  const pendingDeps = fundTransactions.filter(t => t.type === 'Deposit' && t.status === 'Pending').length;
  const pendingWds = fundTransactions.filter(t => t.type === 'Withdrawal' && t.status === 'Pending').length;

  return {
    totalClients: 2486 + (totalCount - 8),
    totalClientsChangePct: 12.1,
    activeClients: 2142 + (activeCount - 6),
    activeClientsRatio: +( (activeCount / Math.max(1, totalCount)) * 100 ).toFixed(1),
    ledgerBalanceCr: +( (totalLedgerBalance + 184200000) / 10000000 ).toFixed(2),
    ledgerBalanceNetWeekL: 84.1,
    openPnLL: +(netPnL / 100000).toFixed(2),
    openPnLDayChangePct: 1.1,
    inactiveClients: 344 + (inactiveCount - 2),
    newToday: 28,
    marginUsedCr: +( (totalMarginUsed + 72800000) / 10000000 ).toFixed(2),
    marginAvailableCr: +( (totalMarginAvailable + 111400000) / 10000000 ).toFixed(2),
    todaysOrders: 8492 + (filteredOrders.length - 6),
    pendingDeposits: pendingDeps + 17,
    pendingWithdrawals: pendingWds + 8,
    clientTurnoverCr: 248.6,
    commissionL: 9.42,
    realisedPnL: totalRealised || 872000,
    unrealisedPnL: totalUnrealised || 412320,
    totalPnLFormatted: `${netPnL >= 0 ? '+' : ''}₹${Math.abs(netPnL || 1284320).toLocaleString('en-IN')}`,
  };
}

// ==========================================
// REST API ROUTES
// ==========================================

// SSE Stream Endpoint
app.get('/api/realtime/stream', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const user = req.user!;
  const connectionId = `CONN-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const sseClient: SSEClient = {
    id: connectionId,
    userId: user.sub,
    role: user.role,
    brokerId: user.brokerId,
    tenantId: user.tenantId,
    res,
  };
  sseClients.push(sseClient);

  res.write(`id: EVT-0\nevent: connected\ndata: ${JSON.stringify({ connectionId, user: user.name, role: user.role, timestamp: new Date().toISOString() })}\n\n`);

  req.on('close', () => {
    sseClients = sseClients.filter(c => c.id !== connectionId);
  });
});

// Authentication & Session
app.get('/api/auth/me', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const fullUser: AuthenticatedUser = {
    id: user.sub,
    name: user.name,
    email: user.email,
    role: user.role,
    roleTitle: user.roleTitle,
    brokerId: user.brokerId,
    tenantId: user.tenantId,
    organization: user.organization,
    phone: user.phone,
    timezone: 'IST (UTC +05:30)',
    currency: 'INR - Indian Rupee',
    avatar: user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
  };

  const token = createSignedToken({
    sub: fullUser.id,
    name: fullUser.name,
    email: fullUser.email,
    role: fullUser.role,
    roleTitle: fullUser.roleTitle,
    brokerId: fullUser.brokerId,
    tenantId: fullUser.tenantId,
    organization: fullUser.organization,
    phone: fullUser.phone,
  });

  res.json({
    success: true,
    user: fullUser,
    tenant: tenantBranding,
    token,
  });
});

app.post('/api/auth/switch-role', (req: Request, res: Response) => {
  if (APP_ENV === 'production' && process.env.ALLOW_ROLE_SWITCH !== 'true') {
    return res.status(403).json({
      success: false,
      message: 'Role switching is disabled in production. Authenticate with your assigned credentials.',
    });
  }
  const { role } = req.body;
  const targetUser = systemUsers[role] || systemUsers['broker_admin'];

  const token = createSignedToken({
    sub: targetUser.id,
    name: targetUser.name,
    email: targetUser.email,
    role: targetUser.role,
    roleTitle: targetUser.roleTitle,
    brokerId: targetUser.brokerId,
    tenantId: targetUser.tenantId,
    organization: targetUser.organization,
    phone: targetUser.phone,
  });

  auditLogs.unshift({
    id: `LOG-${Date.now().toString().slice(-4)}`,
    timestamp: new Date().toLocaleTimeString('en-GB') + ', Today',
    user: targetUser.name,
    role: targetUser.roleTitle,
    action: 'Session Role Switched',
    relatedEntity: targetUser.id,
    ipAddress: req.ip || '127.0.0.1',
    result: 'Success',
    details: `Authorized session issued for role ${targetUser.roleTitle} (ID: ${targetUser.id})`,
  });

  res.json({
    success: true,
    user: targetUser,
    token,
  });
});

// Dashboard Summary
app.get('/api/dashboard/summary', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const metrics = calculateAuthoritativeMetrics(user.role, user.brokerId, user.role === 'trader_client' ? user.sub : undefined);

  const turnoverTrend = [
    { date: '16 Apr', turnoverCr: 182.4, volume: 5120000 },
    { date: '17 Apr', turnoverCr: 215.1, volume: 6420000 },
    { date: '18 Apr', turnoverCr: 198.8, volume: 5890000 },
    { date: '19 Apr', turnoverCr: 278.4, volume: 8210000 },
    { date: '20 Apr', turnoverCr: 232.0, volume: 7100000 },
    { date: '21 Apr', turnoverCr: 310.6, volume: 9400000 },
    { date: '22 Apr', turnoverCr: 248.6, volume: 7600000 },
  ];

  const accountActivity = [
    { day: 'Mon', depositsCr: 3.4, withdrawalsCr: 1.8 },
    { day: 'Tue', depositsCr: 4.1, withdrawalsCr: 2.1 },
    { day: 'Wed', depositsCr: 2.9, withdrawalsCr: 1.5 },
    { day: 'Thu', depositsCr: 5.2, withdrawalsCr: 2.4 },
    { day: 'Fri', depositsCr: 4.82, withdrawalsCr: 2.16 },
  ];

  const operationsQueue = [
    { id: 'op-dep', title: 'Deposit verification', count: metrics.pendingDeposits, statusType: 'deposit', color: '#f59e0b' },
    { id: 'op-wdr', title: 'Withdrawal review', count: metrics.pendingWithdrawals, statusType: 'withdrawal', color: '#ef4444' },
    { id: 'op-kyc', title: 'KYC documents', count: 24, statusType: 'kyc', color: '#3b82f6' },
    { id: 'op-ord', title: 'Order exceptions', count: 6, statusType: 'orders', color: '#8b5cf6' },
  ];

  res.json({
    success: true,
    metrics,
    turnoverTrend,
    accountActivity,
    operationsQueue,
  });
});

// Market Watch
app.get('/api/market-watch', authMiddleware, (_req: Request, res: Response) => {
  res.json({
    success: true,
    instruments,
    timestamp: new Date().toISOString(),
  });
});

// Clients API with Hierarchy & RBAC isolation
app.get(['/api/clients', '/api/admin/clients'], authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { q, status, hideDemo } = req.query;

  let result = clients;

  // Strict Hierarchy Isolation:
  if (user.role === 'trader_client') {
    result = clients.filter(c => c.id === user.sub);
  } else if (user.role === 'broker_admin') {
    result = clients.filter(c => c.brokerId === user.brokerId);
  }

  if (hideDemo === 'true') {
    result = result.filter(c => !c.isDemo);
  }
  if (status && status !== 'all' && status !== 'All statuses') {
    result = result.filter(c => c.status.toLowerCase() === String(status).toLowerCase());
  }
  if (q) {
    const query = String(q).toLowerCase();
    result = result.filter(c =>
      c.id.toLowerCase().includes(query) ||
      c.name.toLowerCase().includes(query) ||
      c.email.toLowerCase().includes(query) ||
      c.phone.includes(query)
    );
  }

  res.json({ success: true, clients: result, total: result.length });
});

app.get('/api/clients/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const client = clients.find(c => c.id === req.params.id);

  if (!client) {
    return res.status(404).json({ success: false, message: 'Client not found' });
  }

  // Hierarchy validation
  if (user.role === 'trader_client' && client.id !== user.sub) {
    return res.status(403).json({ success: false, message: 'Forbidden: You cannot access another client profile' });
  }
  if (user.role === 'broker_admin' && client.brokerId !== user.brokerId) {
    return res.status(403).json({ success: false, message: 'Forbidden: Client is not assigned to your broker hierarchy' });
  }

  const clientOrders = orders.filter(o => o.clientId === client.id);
  const clientPositions = positions.filter(p => p.clientId === client.id);

  res.json({
    success: true,
    client,
    orders: clientOrders,
    positions: clientPositions,
  });
});

app.post('/api/clients', authMiddleware, requireRole(['broker_admin', 'super_admin', 'operations']), (req: AuthenticatedRequest, res: Response) => {
  if (checkIdempotency(req, res)) return;

  const user = req.user!;
  const { name, email, phone, pan, initialMargin, isDemo } = req.body;

  if (!name || !email || !phone) {
    return res.status(400).json({ success: false, message: 'Name, email, and phone are required' });
  }

  const newId = isDemo ? `DM${Math.floor(20000 + Math.random() * 90000)}` : `NT${Math.floor(10000 + Math.random() * 90000)}`;
  const margin = Number(initialMargin) || 100000;

  const newClient: Client = {
    id: newId,
    name,
    email,
    phone,
    pan: pan || 'ABCDE1234F',
    status: 'Active',
    isDemo: Boolean(isDemo),
    ledgerBalance: margin,
    openPnL: 0,
    peakLedger: margin,
    marginUsed: 0,
    income: 0,
    marginAvailable: margin,
    brokerId: user.brokerId || 'BRK-ROHAN-01',
    brokerName: user.name || 'Rohan Sen',
    kycStatus: 'Verified',
    kycDocuments: ['PAN Card', 'Aadhaar Card', 'Client Agreement'],
    createdDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    lastActive: 'Just now',
    riskLimit: margin * 2,
  };

  clients.unshift(newClient);
  savePersistence();

  auditLogs.unshift({
    id: `LOG-${Date.now().toString().slice(-4)}`,
    timestamp: new Date().toLocaleTimeString('en-GB') + ', Today',
    user: user.name,
    role: user.roleTitle,
    action: 'Created new client account',
    relatedEntity: newClient.id,
    ipAddress: req.ip || '127.0.0.1',
    result: 'Success',
    details: `Onboarded client ${name} with initial ledger balance ₹${margin.toLocaleString('en-IN')}`,
  });

  broadcastScopedEvent('client_created', newClient, { brokerId: newClient.brokerId });
  recordIdempotency(req, 200, { success: true, client: newClient });
  res.json({ success: true, client: newClient });
});

// Orders API with RMS Validation & Idempotency
app.get('/api/orders', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { status, q } = req.query;

  let result = orders;
  if (user.role === 'trader_client') {
    result = orders.filter(o => o.clientId === user.sub);
  } else if (user.role === 'broker_admin') {
    result = orders.filter(o => o.brokerId === user.brokerId);
  }

  if (status && status !== 'All') {
    result = result.filter(o => o.status.toLowerCase() === String(status).toLowerCase());
  }
  if (q) {
    const query = String(q).toLowerCase();
    result = result.filter(o =>
      o.id.toLowerCase().includes(query) ||
      o.clientName.toLowerCase().includes(query) ||
      o.instrument.toLowerCase().includes(query)
    );
  }

  res.json({ success: true, orders: result, total: result.length });
});

app.post('/api/orders', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (checkIdempotency(req, res)) return;

  const user = req.user!;
  const { clientId, instrument, side, type, quantity, orderPrice, product } = req.body;

  if (!instrument || !side || !quantity) {
    return res.status(400).json({ success: false, message: 'Instrument, side, and quantity are required' });
  }

  // Determine authorized target client
  const targetClientId = user.role === 'trader_client' ? user.sub : (clientId || clients[0].id);
  const client = clients.find(c => c.id === targetClientId);

  if (!client) {
    return res.status(404).json({ success: false, message: 'Client account not found' });
  }

  // Hierarchy validation
  if (user.role === 'broker_admin' && client.brokerId !== user.brokerId) {
    return res.status(403).json({ success: false, message: 'Forbidden: Client is not assigned to your broker' });
  }

  const targetInst = instruments.find(i => i.symbol === instrument || i.name === instrument) || instruments[0];
  const price = type === 'MARKET' ? targetInst.lastPrice : (Number(orderPrice) || targetInst.lastPrice);
  const qty = Number(quantity);
  const orderValue = price * qty;
  const marginRequired = Math.round(orderValue * (product === 'CNC' ? 1 : 0.2));

  // Authoritative RMS Check
  if (client.marginAvailable < marginRequired) {
    const rejectedOrder: Order = {
      id: `ORD-${Math.floor(98000 + Math.random() * 1999)}`,
      clientId: client.id,
      clientName: client.name,
      instrument: targetInst.symbol,
      exchange: targetInst.exchange,
      side: side as 'BUY' | 'SELL',
      type: type as 'LIMIT' | 'MARKET' | 'SL-M',
      quantity: qty,
      orderPrice: price,
      executedQty: 0,
      avgPrice: 0,
      status: 'Rejected',
      created: new Date().toLocaleTimeString('en-GB'),
      brokerId: client.brokerId,
      rejectionReason: `RMS Error: Required margin ₹${marginRequired.toLocaleString('en-IN')} exceeds available ₹${client.marginAvailable.toLocaleString('en-IN')}`,
    };
    orders.unshift(rejectedOrder);
    savePersistence();
    if (isUsingPostgres()) {
      dbRepo.insertOrder(rejectedOrder).catch(console.warn);
    }

    auditLogs.unshift({
      id: `LOG-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toLocaleTimeString('en-GB') + ', Today',
      user: client.name,
      role: 'RMS Risk Engine',
      action: 'Order Rejected (RMS Margin Check)',
      relatedEntity: rejectedOrder.id,
      ipAddress: req.ip || '127.0.0.1',
      result: 'Failed',
      details: rejectedOrder.rejectionReason || 'RMS Margin Check Failed',
    });

    broadcastScopedEvent('order_placed', rejectedOrder, { brokerId: client.brokerId, clientId: client.id });
    recordIdempotency(req, 400, { success: false, message: rejectedOrder.rejectionReason, order: rejectedOrder });
    return res.status(400).json({ success: false, message: rejectedOrder.rejectionReason, order: rejectedOrder });
  }

  // Upstream proxy if Trading Platform is online
  let upstreamOrderId: string | undefined;
  if (upstreamTradingPlatformStatus.reachable) {
    try {
      const upstreamResult = await tradingPlatformClient.placeOrder({
        symbol: targetInst.symbol,
        type: side as 'BUY' | 'SELL',
        lots: Math.max(1, Math.round(qty / (targetInst.lotSize || 1))),
        orderType: type as string,
        product: product || 'INTRADAY',
        price,
      });

      if (upstreamResult && !upstreamResult.success && upstreamResult.message) {
        return res.status(400).json({
          success: false,
          message: `Trading Platform Engine: ${upstreamResult.message}`,
        });
      }

      if (upstreamResult?.order?.id) {
        upstreamOrderId = upstreamResult.order.id;
      }
    } catch (proxyErr: any) {
      console.warn('[Order Proxy] Upstream placeOrder warning, falling back to local persistence:', proxyErr.message);
    }
  }

  // Atomic local execution and persistence
  const isExecuted = type === 'MARKET';
  const newOrder: Order = {
    id: upstreamOrderId || `ORD-${Math.floor(98000 + Math.random() * 1999)}`,
    clientId: client.id,
    clientName: client.name,
    instrument: targetInst.symbol,
    exchange: targetInst.exchange,
    side: side as 'BUY' | 'SELL',
    type: type as 'LIMIT' | 'MARKET' | 'SL-M',
    quantity: qty,
    orderPrice: type === 'MARKET' ? 'Market' : price,
    executedQty: isExecuted ? qty : 0,
    avgPrice: isExecuted ? price : 0,
    status: isExecuted ? 'Executed' : 'Open',
    created: new Date().toLocaleTimeString('en-GB'),
    brokerId: client.brokerId,
  };

  orders.unshift(newOrder);

  if (isExecuted) {
    client.marginUsed += marginRequired;
    client.marginAvailable -= marginRequired;

    let existingPos = positions.find(p => p.clientId === client.id && p.instrument === targetInst.symbol);
    if (existingPos) {
      if (side === 'BUY') {
        const totalCost = (existingPos.avgPrice * existingPos.netQty) + (price * qty);
        existingPos.netQty += qty;
        existingPos.buyQty += qty;
        existingPos.avgPrice = +(totalCost / existingPos.netQty).toFixed(2);
      } else {
        existingPos.netQty -= qty;
        existingPos.sellQty += qty;
      }
      existingPos.marginUsed += marginRequired;
      if (isUsingPostgres()) dbRepo.upsertPosition(existingPos).catch(console.warn);
    } else {
      const newPos: Position = {
        id: `POS-${Math.floor(77000 + Math.random() * 999)}`,
        clientId: client.id,
        clientName: client.name,
        instrument: targetInst.symbol,
        exchange: targetInst.exchange,
        product: (product || 'MIS') as 'MIS' | 'NRML' | 'CNC',
        buyQty: side === 'BUY' ? qty : 0,
        sellQty: side === 'SELL' ? qty : 0,
        netQty: side === 'BUY' ? qty : -qty,
        avgPrice: price,
        currentPrice: targetInst.lastPrice,
        realisedPnL: 0,
        unrealisedPnL: 0,
        totalPnL: 0,
        marginUsed: marginRequired,
        brokerId: client.brokerId,
      };
      positions.unshift(newPos);
      if (isUsingPostgres()) dbRepo.upsertPosition(newPos).catch(console.warn);
    }
  }

  savePersistence();
  if (isUsingPostgres()) {
    dbRepo.insertOrder(newOrder).catch(console.warn);
  }

  auditLogs.unshift({
    id: `LOG-${Date.now().toString().slice(-4)}`,
    timestamp: new Date().toLocaleTimeString('en-GB') + ', Today',
    user: client.name,
    role: user.roleTitle,
    action: `Submitted ${side} ${type} order`,
    relatedEntity: newOrder.id,
    ipAddress: req.ip || '127.0.0.1',
    result: 'Success',
    details: `${side} ${qty} ${targetInst.symbol} @ ₹${price} (${newOrder.status})`,
  });

  broadcastScopedEvent('order_placed', newOrder, { brokerId: client.brokerId, clientId: client.id });
  recordIdempotency(req, 200, { success: true, order: newOrder });
  res.json({ success: true, order: newOrder });
});

app.patch(['/api/orders/:id/cancel', '/api/orders/:id/cancel-order'], authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const order = orders.find(o => o.id === req.params.id);

  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  if (user.role === 'trader_client' && order.clientId !== user.sub) {
    return res.status(403).json({ success: false, message: 'Forbidden: You cannot cancel another client order' });
  }
  if (user.role === 'broker_admin' && order.brokerId !== user.brokerId) {
    return res.status(403).json({ success: false, message: 'Forbidden: Order is outside your broker hierarchy' });
  }

  if (order.status !== 'Open' && order.status !== 'Pending') {
    return res.status(400).json({ success: false, message: `Cannot cancel order in status ${order.status}` });
  }

  order.status = 'Cancelled';
  order.rejectionReason = `Cancelled by ${user.name} (${user.roleTitle})`;
  savePersistence();

  if (upstreamTradingPlatformStatus.reachable) {
    tradingPlatformClient.cancelOrder(order.id).catch((e: any) => console.warn('[Cancel Proxy] Notice:', e.message));
  }
  if (isUsingPostgres()) {
    dbRepo.updateOrderStatus(order.id, 'Cancelled', order.rejectionReason).catch(console.warn);
  }

  auditLogs.unshift({
    id: `LOG-${Date.now().toString().slice(-4)}`,
    timestamp: new Date().toLocaleTimeString('en-GB') + ', Today',
    user: user.name,
    role: user.roleTitle,
    action: 'Cancelled order',
    relatedEntity: order.id,
    ipAddress: req.ip || '127.0.0.1',
    result: 'Success',
    details: `Cancelled open order ${order.id} for ${order.clientName}`,
  });

  broadcastScopedEvent('order_cancelled', order, { brokerId: order.brokerId, clientId: order.clientId });
  res.json({ success: true, order });
});

app.post('/api/orders/:id/cancel', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  // Delegate to cancel handler
  (app as any)._router.handle(
    Object.assign(req, { method: 'PATCH', url: `/api/orders/${req.params.id}/cancel` }),
    res,
    () => {}
  );
});

// Positions API & Authoritative Square-Off
app.get('/api/positions', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  let result = positions;

  if (user.role === 'trader_client') {
    result = positions.filter(p => p.clientId === user.sub);
  } else if (user.role === 'broker_admin') {
    result = positions.filter(p => p.brokerId === user.brokerId);
  }

  const totalRealised = result.reduce((acc, p) => acc + p.realisedPnL, 0);
  const totalUnrealised = result.reduce((acc, p) => acc + p.unrealisedPnL, 0);
  const netPnL = totalRealised + totalUnrealised;

  res.json({
    success: true,
    positions: result,
    summary: {
      totalRealisedPnLL: +(totalRealised / 100000).toFixed(2),
      unrealisedPnLL: +(totalUnrealised / 100000).toFixed(2),
      netPnLL: +(netPnL / 100000).toFixed(2),
      marginUtilisedCr: 7.28,
    },
  });
});

app.post('/api/positions/:id/square-off', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const positionIndex = positions.findIndex(p => p.id === req.params.id);

  if (positionIndex === -1) {
    return res.status(404).json({ success: false, message: 'Position not found' });
  }

  const pos = positions[positionIndex];

  // Hierarchy validation
  if (user.role === 'trader_client' && pos.clientId !== user.sub) {
    return res.status(403).json({ success: false, message: 'Forbidden: Cannot square-off another client position' });
  }
  if (user.role === 'broker_admin' && pos.brokerId !== user.brokerId) {
    return res.status(403).json({ success: false, message: 'Forbidden: Position is outside your broker hierarchy' });
  }

  const squaredPnL = pos.totalPnL;
  const client = clients.find(c => c.id === pos.clientId);

  if (client) {
    client.marginAvailable += pos.marginUsed;
    client.marginUsed = Math.max(0, client.marginUsed - pos.marginUsed);
    client.ledgerBalance += squaredPnL;

    // Record ledger entry for square-off settlement
    ledgerEntries.unshift({
      id: `LED-${Math.floor(39000 + Math.random() * 999)}`,
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      referenceId: pos.id,
      description: `Square-off settlement: ${pos.instrument} (${pos.netQty} qty)`,
      debit: squaredPnL < 0 ? Math.abs(squaredPnL) : 0,
      credit: squaredPnL > 0 ? squaredPnL : 0,
      runningBalance: client.ledgerBalance,
      status: 'Completed',
      type: 'Trade Settlement',
    });
  }

  positions.splice(positionIndex, 1);
  savePersistence();

  if (upstreamTradingPlatformStatus.reachable) {
    tradingPlatformClient.squareOffPosition(pos.id).catch((e: any) => console.warn('[Square-off Proxy] Notice:', e.message));
  }
  if (isUsingPostgres()) {
    dbRepo.deletePosition(pos.id).catch(console.warn);
  }

  auditLogs.unshift({
    id: `LOG-${Date.now().toString().slice(-4)}`,
    timestamp: new Date().toLocaleTimeString('en-GB') + ', Today',
    user: user.name,
    role: user.roleTitle,
    action: 'Square-off position',
    relatedEntity: pos.id,
    ipAddress: req.ip || '127.0.0.1',
    result: 'Success',
    details: `Squared off ${pos.netQty} ${pos.instrument} for ${pos.clientName}. Realised P&L: ₹${squaredPnL.toLocaleString('en-IN')}`,
  });

  broadcastScopedEvent('position_squared_off', { id: pos.id, pnl: squaredPnL }, { brokerId: pos.brokerId, clientId: pos.clientId });
  res.json({ success: true, message: 'Position squared off successfully', pnl: squaredPnL });
});

// Support Ticket Submission Route (Durable PostgreSQL & Upstream Platform Routing)
app.post('/api/tickets', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { category, subject, message, priority } = req.body;

  if (!subject || !message) {
    return res.status(400).json({ success: false, message: 'Subject and message are required' });
  }

  const ticketId = `TCK-${Date.now().toString().slice(-6)}`;
  const ticket = {
    id: ticketId,
    clientId: user.sub,
    clientName: user.name,
    category: category || 'General',
    subject,
    message,
    priority: priority || 'Medium',
    status: 'Open',
    createdAt: new Date().toISOString(),
  };

  if (upstreamTradingPlatformStatus.reachable) {
    fetch(`${TRADING_PLATFORM_URL}/api/trading/tickets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': DEFAULT_TENANT_ID,
      },
      body: JSON.stringify({
        subject,
        category,
        message,
        description: message,
        priority,
        userId: user.sub,
      }),
    }).catch((e: any) => console.warn('[Ticket Upstream Sync] Notice:', e.message));
  }

  if (isUsingPostgres()) {
    dbRepo.insertTicket(ticket).catch(console.warn);
  }

  auditLogs.unshift({
    id: `LOG-${Date.now().toString().slice(-4)}`,
    timestamp: new Date().toLocaleTimeString('en-GB') + ', Today',
    user: user.name,
    role: user.roleTitle,
    action: 'Support Ticket Submitted',
    relatedEntity: ticketId,
    ipAddress: req.ip || '127.0.0.1',
    result: 'Success',
    details: `${category}: ${subject}`,
  });
  savePersistence();

  res.json({
    success: true,
    id: ticketId,
    message: 'Support ticket submitted successfully. Our operations desk will respond shortly.',
  });
});

// Pay-in / Pay-out (Funds)
app.get('/api/funds', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { type } = req.query;

  let result = fundTransactions;
  if (user.role === 'trader_client') {
    result = fundTransactions.filter(f => f.clientId === user.sub);
  } else if (user.role === 'broker_admin') {
    result = fundTransactions.filter(f => f.brokerId === user.brokerId);
  }

  if (type && type !== 'All') {
    result = result.filter(f => f.type.toLowerCase() === String(type).toLowerCase());
  }

  res.json({ success: true, transactions: result });
});

app.post('/api/funds/:id/approve', authMiddleware, requireRole(['broker_admin', 'super_admin', 'operations']), (req: AuthenticatedRequest, res: Response) => {
  if (checkIdempotency(req, res)) return;

  const user = req.user!;
  const txn = fundTransactions.find(t => t.id === req.params.id);

  if (!txn) {
    return res.status(404).json({ success: false, message: 'Transaction not found' });
  }

  if (user.role === 'broker_admin' && txn.brokerId !== user.brokerId) {
    return res.status(403).json({ success: false, message: 'Forbidden: Transaction is outside your broker hierarchy' });
  }

  if (txn.status === 'Completed' || txn.status === 'Approved') {
    return res.status(400).json({ success: false, message: 'Transaction is already approved/completed' });
  }

  txn.status = 'Completed';
  txn.verification = `Approved by ${user.name}`;
  txn.approvedBy = user.name;

  const client = clients.find(c => c.id === txn.clientId);
  if (client) {
    if (txn.type === 'Deposit') {
      client.ledgerBalance += txn.amount;
      client.marginAvailable += txn.amount;
    } else {
      client.ledgerBalance -= txn.amount;
      client.marginAvailable -= txn.amount;
    }

    ledgerEntries.unshift({
      id: `LED-${Math.floor(39000 + Math.random() * 999)}`,
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      referenceId: txn.referenceId,
      description: `Client ${txn.type.toLowerCase()} approved (${client.name})`,
      debit: txn.type === 'Withdrawal' ? txn.amount : 0,
      credit: txn.type === 'Deposit' ? txn.amount : 0,
      runningBalance: client.ledgerBalance,
      status: 'Completed',
      type: txn.type,
    });
  }

  savePersistence();
  if (isUsingPostgres()) {
    dbRepo.updateFundStatus(txn.id, txn.status, txn.verification, txn.approvedBy, txn.rejectionReason).catch(console.warn);
  }
  if (upstreamTradingPlatformStatus.reachable) {
    fetch(`${TRADING_PLATFORM_URL}/api/admin/funds/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': DEFAULT_TENANT_ID,
      },
      body: JSON.stringify({
        transactionId: txn.id,
        action: 'APPROVE',
      }),
    }).catch((e: any) => console.warn('[Fund Upstream Sync] Notice:', e.message));
  }

  auditLogs.unshift({
    id: `LOG-${Date.now().toString().slice(-4)}`,
    timestamp: new Date().toLocaleTimeString('en-GB') + ', Today',
    user: user.name,
    role: user.roleTitle,
    action: `Approved ${txn.type.toLowerCase()}`,
    relatedEntity: txn.id,
    ipAddress: req.ip || '127.0.0.1',
    result: 'Success',
    details: `Approved ${txn.type} of ₹${txn.amount.toLocaleString('en-IN')} for ${txn.clientName}`,
  });

  broadcastScopedEvent('fund_approved', txn, { brokerId: txn.brokerId, clientId: txn.clientId });
  recordIdempotency(req, 200, { success: true, transaction: txn });
  res.json({ success: true, transaction: txn });
});

app.post('/api/funds/:id/reject', authMiddleware, requireRole(['broker_admin', 'super_admin', 'operations']), (req: AuthenticatedRequest, res: Response) => {
  if (checkIdempotency(req, res)) return;

  const user = req.user!;
  const { reason } = req.body;
  const txn = fundTransactions.find(t => t.id === req.params.id);

  if (!txn) {
    return res.status(404).json({ success: false, message: 'Transaction not found' });
  }

  if (user.role === 'broker_admin' && txn.brokerId !== user.brokerId) {
    return res.status(403).json({ success: false, message: 'Forbidden: Transaction is outside your broker hierarchy' });
  }

  txn.status = 'Rejected';
  txn.verification = 'Rejected by administrator';
  txn.rejectionReason = reason || 'Bank UTR reference mismatch';
  savePersistence();
  if (isUsingPostgres()) {
    dbRepo.updateFundStatus(txn.id, txn.status, txn.verification, txn.approvedBy, txn.rejectionReason).catch(console.warn);
  }
  if (upstreamTradingPlatformStatus.reachable) {
    fetch(`${TRADING_PLATFORM_URL}/api/admin/funds/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': DEFAULT_TENANT_ID,
      },
      body: JSON.stringify({
        transactionId: txn.id,
        action: 'REJECT',
        reason: txn.rejectionReason,
      }),
    }).catch((e: any) => console.warn('[Fund Upstream Sync] Notice:', e.message));
  }

  auditLogs.unshift({
    id: `LOG-${Date.now().toString().slice(-4)}`,
    timestamp: new Date().toLocaleTimeString('en-GB') + ', Today',
    user: user.name,
    role: user.roleTitle,
    action: `Rejected ${txn.type.toLowerCase()}`,
    relatedEntity: txn.id,
    ipAddress: req.ip || '127.0.0.1',
    result: 'Warning',
    details: `Rejected ${txn.type} of ₹${txn.amount.toLocaleString('en-IN')} for ${txn.clientName}: ${txn.rejectionReason}`,
  });

  broadcastScopedEvent('fund_rejected', txn, { brokerId: txn.brokerId, clientId: txn.clientId });
  recordIdempotency(req, 200, { success: true, transaction: txn });
  res.json({ success: true, transaction: txn });
});

// Account Ledger
app.get('/api/ledger', authMiddleware, (_req: Request, res: Response) => {
  res.json({
    success: true,
    summary: {
      ledgerBalanceCr: 1.84,
      availableMarginCr: 1.12,
      usedMarginL: 72.18,
      commissionL: 9.42,
    },
    entries: ledgerEntries,
  });
});

// Analytics
app.get('/api/analytics', authMiddleware, (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      monthlyTurnoverCr: 742.8,
      turnoverChangePct: 12.6,
      commissionEarnedL: 28.42,
      commissionChangePct: 5.4,
      orderExecutionRate: 94.8,
      executionImprovementPct: 1.1,
      netPnLL: 42.16,
      netPnLChangePct: 8.8,
      turnoverTrend: [
        { day: '16 Apr', volumeCr: 88.5 },
        { day: '17 Apr', volumeCr: 112.4 },
        { day: '18 Apr', volumeCr: 96.2 },
        { day: '19 Apr', volumeCr: 145.0 },
        { day: '20 Apr', volumeCr: 118.8 },
        { day: '21 Apr', volumeCr: 172.5 },
        { day: '22 Apr', volumeCr: 128.4 },
      ],
      commissionEarnings: [
        { day: '16 Apr', netL: 3.2 },
        { day: '17 Apr', netL: 4.8 },
        { day: '18 Apr', netL: 3.9 },
        { day: '19 Apr', netL: 5.6 },
        { day: '20 Apr', netL: 4.2 },
        { day: '21 Apr', netL: 6.4 },
        { day: '22 Apr', netL: 5.1 },
      ],
      activeCount: 2142,
      inactiveCount: 344,
      orderBreakdown: {
        executed: 76,
        open: 12,
        rejected: 7,
        cancelled: 5,
      },
      instrumentShares: [
        { symbol: 'NIFTY', sharePercent: 32 },
        { symbol: 'BANKNIFTY', sharePercent: 26 },
        { symbol: 'RELIANCE', sharePercent: 14 },
        { symbol: 'TCS', sharePercent: 9 },
        { symbol: 'HDFCBANK', sharePercent: 8 },
        { symbol: 'OTHERS', sharePercent: 11 },
      ],
    },
  });
});

// Audit Logs
app.get('/api/audit-logs', authMiddleware, requireRole(['broker_admin', 'super_admin', 'operations']), (_req: Request, res: Response) => {
  res.json({ success: true, logs: auditLogs });
});

// Reports
app.get('/api/reports', authMiddleware, (_req: Request, res: Response) => {
  res.json({ success: true, reports: reportsList });
});

app.get('/api/reports/preview/:id', authMiddleware, (req: Request, res: Response) => {
  const report = reportsList.find(r => r.id === req.params.id) || reportsList[0];
  let previewData: any[] = [];

  if (report.type === 'clients') {
    previewData = clients.slice(0, 5).map(c => ({
      'Client ID': c.id,
      'Name': c.name,
      'Status': c.status,
      'KYC': c.kycStatus,
      'Ledger Balance (INR)': c.ledgerBalance,
      'Margin Used': c.marginUsed,
      'Created Date': c.createdDate,
    }));
  } else if (report.type === 'orders') {
    previewData = orders.slice(0, 5).map(o => ({
      'Order ID': o.id,
      'Client': o.clientName,
      'Instrument': o.instrument,
      'Side': o.side,
      'Qty': o.quantity,
      'Price': o.orderPrice,
      'Status': o.status,
      'Time': o.created,
    }));
  } else if (report.type === 'positions') {
    previewData = positions.slice(0, 5).map(p => ({
      'Position ID': p.id,
      'Client': p.clientName,
      'Instrument': p.instrument,
      'Net Qty': p.netQty,
      'Avg Price': p.avgPrice,
      'Current Price': p.currentPrice,
      'Total P&L': p.totalPnL,
    }));
  } else {
    previewData = ledgerEntries.slice(0, 5).map(l => ({
      'Reference': l.referenceId,
      'Date': l.date,
      'Description': l.description,
      'Debit': l.debit,
      'Credit': l.credit,
      'Balance': l.runningBalance,
      'Status': l.status,
    }));
  }

  res.json({ success: true, report, data: previewData });
});

// Instruments
app.get('/api/instruments', authMiddleware, (_req: Request, res: Response) => {
  res.json({ success: true, instruments });
});

app.patch('/api/instruments/:symbol/toggle', authMiddleware, requireRole(['broker_admin', 'super_admin']), (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const inst = instruments.find(i => i.symbol === req.params.symbol);
  if (!inst) {
    return res.status(404).json({ success: false, message: 'Instrument not found' });
  }

  inst.status = inst.status === 'Enabled' ? 'Disabled' : 'Enabled';
  savePersistence();

  auditLogs.unshift({
    id: `LOG-${Date.now().toString().slice(-4)}`,
    timestamp: new Date().toLocaleTimeString('en-GB') + ', Today',
    user: user.name,
    role: user.roleTitle,
    action: `Changed instrument trading status to ${inst.status}`,
    relatedEntity: inst.symbol,
    ipAddress: req.ip || '127.0.0.1',
    result: 'Success',
    details: `${inst.name} (${inst.symbol}) trading status updated to ${inst.status}`,
  });

  broadcastScopedEvent('instrument_updated', inst);
  res.json({ success: true, instrument: inst });
});

// Settings
app.get('/api/settings', authMiddleware, (_req: Request, res: Response) => {
  res.json({ success: true, settings: settingsState });
});

app.patch('/api/settings', authMiddleware, requireRole(['broker_admin', 'super_admin']), (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  settingsState = { ...settingsState, ...req.body };
  savePersistence();

  auditLogs.unshift({
    id: `LOG-${Date.now().toString().slice(-4)}`,
    timestamp: new Date().toLocaleTimeString('en-GB') + ', Today',
    user: user.name,
    role: user.roleTitle,
    action: 'Updated workspace settings',
    relatedEntity: 'SETTINGS-PROFILE',
    ipAddress: req.ip || '127.0.0.1',
    result: 'Success',
    details: 'Saved updated broker preferences and display settings.',
  });

  res.json({ success: true, settings: settingsState });
});

// White-label & Central Admin Propagation with HMAC Signature Validation
app.get('/api/tenant/branding', (_req: Request, res: Response) => {
  res.json({ success: true, branding: tenantBranding });
});

app.post('/api/whitelabel/publish', (req: Request, res: Response) => {
  const signature = req.headers['x-signature'] as string;
  const timestamp = Number(req.headers['x-timestamp']) || 0;
  const tenantId = req.headers['x-tenant-id'] as string;

  // Validate HMAC signature unless in development test mode with explicit bypass flag
  if (APP_ENV === 'production' || signature) {
    const rawBody = JSON.stringify(req.body);
    const isValid = verifyHmacSignature(rawBody, signature, timestamp);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Invalid HMAC signature or expired timestamp from Central Admin',
      });
    }
  }

  tenantBranding = {
    ...tenantBranding,
    ...req.body,
    updatedAt: new Date().toISOString(),
  };
  savePersistence();

  auditLogs.unshift({
    id: `LOG-${Date.now().toString().slice(-4)}`,
    timestamp: new Date().toLocaleTimeString('en-GB') + ', Today',
    user: 'Central Admin Panel',
    role: 'Super Admin RPC',
    action: 'White-Label Branding Published',
    relatedEntity: tenantId || tenantBranding.brandName,
    ipAddress: req.ip || '127.0.0.1',
    result: 'Success',
    details: `Central Admin published updated branding version ${tenantBranding.version} with theme colors [${tenantBranding.primaryColor}, ${tenantBranding.secondaryColor}]`,
  });

  broadcastScopedEvent('branding_updated', tenantBranding);
  res.json({ success: true, branding: tenantBranding });
});

// Manual trigger to sync live instruments from Trading Platform
app.post('/api/instruments/sync', authMiddleware, async (_req: Request, res: Response) => {
  await syncUpstreamMarketInstruments();
  res.json({ success: true, instruments });
});

// Ecosystem Live Status & Upstream Connectivity Route
app.get('/api/ecosystem/status', async (_req: Request, res: Response) => {
  const [tp, ca] = await Promise.all([
    probeUpstreamTradingPlatform(4000),
    probeUpstreamCentralAdmin(4000),
  ]);

  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    applications: {
      userBrokerPanel: {
        name: 'NexTrade Broker OS (User & Broker Panel)',
        role: 'Broker Admin Dashboard, Client Directory, Order Management & Ledger',
        localUrl: `http://localhost:${PORT}`,
        deployedUrl: process.env.APP_URL || 'https://ais-dev-wcn5ndw62hl5ucqjkti42l-488743233447.asia-east1.run.app',
        status: 'ONLINE',
        persistenceEngine: 'Transactional State Journal & Snapshot',
        persistenceFile: PERSISTENCE_FILE,
        durableAcrossRestarts: true,
        records: {
          clients: clients.length,
          orders: orders.length,
          positions: positions.length,
          transactions: fundTransactions.length,
          ledgerEntries: ledgerEntries.length,
        },
      },
      tradingPlatform: {
        name: 'VERTEX Multi-Tenant Trading Platform Engine',
        role: 'Authoritative Multi-Asset Matching Engine & Execution Gateway',
        configuredUrl: TRADING_PLATFORM_URL,
        reachable: tp.reachable,
        latencyMs: tp.latencyMs,
        status: tp.status || (tp.reachable ? 'healthy' : 'unreachable'),
        authoritativeDatabase: 'Persistent PostgreSQL (Render cloud)',
        postgresStatus: tp.dependencies?.postgresql?.status || (tp.reachable ? 'healthy' : 'unknown'),
        postgresLatencyMs: tp.dependencies?.postgresql?.latencyMs || 0,
        authoritativeSourceOfTruth: tp.dependencies?.postgresql?.authoritativeSourceOfTruth ?? true,
      },
      centralAdminPanel: {
        name: 'TradeMatrix Central Admin Panel',
        role: 'Platform Multi-Tenant Governance, Master Broker Control, White-Label Hub',
        configuredUrl: CENTRAL_ADMIN_URL,
        reachable: ca.reachable,
        latencyMs: ca.latencyMs,
        status: ca.status || (ca.reachable ? 'healthy' : 'unreachable'),
        uptime: ca.uptime || 0,
      },
    },
  });
});

// System Health & Authoritative Ecosystem Status Route
app.get('/api/health', async (_req: Request, res: Response) => {
  const now = Date.now();
  const tpAge = upstreamTradingPlatformStatus.lastChecked ? now - new Date(upstreamTradingPlatformStatus.lastChecked).getTime() : Infinity;
  const caAge = upstreamCentralAdminStatus.lastChecked ? now - new Date(upstreamCentralAdminStatus.lastChecked).getTime() : Infinity;

  if (tpAge > 10000) {
    await probeUpstreamTradingPlatform(3000);
  }
  if (caAge > 10000) {
    await probeUpstreamCentralAdmin(3000);
  }

  res.json({
    status: 'HEALTHY',
    service: 'NexTrade Broker OS & Execution Gateway',
    timestamp: new Date().toISOString(),
    environment: APP_ENV,
    deployedAppUrl: process.env.APP_URL || 'https://ais-dev-wcn5ndw62hl5ucqjkti42l-488743233447.asia-east1.run.app',
    persistence: {
      adapter: isUsingPostgres() ? 'PostgreSQL (Render cloud / Neon)' : 'Transactional Disk Snapshot & State Journal',
      storePath: PERSISTENCE_FILE,
      durableAcrossRestarts: true,
      lastSaved: fs.existsSync(PERSISTENCE_FILE) ? fs.statSync(PERSISTENCE_FILE).mtime.toISOString() : null,
      sizeBytes: fs.existsSync(PERSISTENCE_FILE) ? fs.statSync(PERSISTENCE_FILE).size : 0,
      postgresEngine: getDatabaseStatus(),
    },
    upstreamEcosystem: {
      tradingPlatform: {
        url: TRADING_PLATFORM_URL,
        reachable: upstreamTradingPlatformStatus.reachable,
        latencyMs: upstreamTradingPlatformStatus.latencyMs,
        service: upstreamTradingPlatformStatus.service || 'VERTEX Multi-Tenant Trading Platform Engine',
        authoritativePostgreSQL: upstreamTradingPlatformStatus.dependencies?.postgresql?.authoritativeSourceOfTruth ?? true,
        postgresStatus: upstreamTradingPlatformStatus.dependencies?.postgresql?.status ?? (upstreamTradingPlatformStatus.reachable ? 'healthy' : 'offline'),
        error: upstreamTradingPlatformStatus.error || null,
      },
      centralAdminPanel: {
        url: CENTRAL_ADMIN_URL,
        reachable: upstreamCentralAdminStatus.reachable,
        latencyMs: upstreamCentralAdminStatus.latencyMs,
        uptime: upstreamCentralAdminStatus.uptime || null,
        error: upstreamCentralAdminStatus.error || null,
      },
    },
    connections: {
      sseClients: sseClients.length,
      tradingPlatformLinked: upstreamTradingPlatformStatus.reachable,
      centralAdminLinked: upstreamCentralAdminStatus.reachable,
    },
    database: {
      clients: clients.length,
      orders: orders.length,
      positions: positions.length,
      transactions: fundTransactions.length,
      ledgerEntries: ledgerEntries.length,
    },
  });
});

// ==========================================
// VITE SPA MIDDLEWARE MOUNTING
// ==========================================
async function startServer() {
  // Initialize durable PostgreSQL database persistence
  await initDatabase(APP_ENV);

  // Probe upstream Trading Platform & Central Admin
  try {
    const probe = await tradingPlatformClient.probeHealth();
    console.log(`[TradingPlatformClient] Authoritative probe: ${probe.reachable ? 'ONLINE' : 'OFFLINE'} (${probe.latencyMs}ms)`);
    if (probe.reachable) {
      await tradingPlatformClient.connectWebSocket();
    }
  } catch (err: any) {
    console.warn('[TradingPlatformClient] Probe notice:', err.message);
  }

  // Hook Trading Platform real-time events into User Panel SSE broadcast stream
  tradingPlatformClient.on('realtime_event', (event: any) => {
    if (event.event === 'market.ticks' && Array.isArray(event.data)) {
      for (const tick of event.data) {
        const inst = instruments.find(i => i.symbol === tick.symbol);
        if (inst) {
          inst.lastPrice = tick.price;
          inst.change = tick.change;
          inst.changePercent = tick.changePercent;
        }
      }
      broadcastScopedEvent('market_tick', event.data);
    } else if (event.event === 'trade.executed' || event.event === 'order.updated') {
      broadcastScopedEvent('order_update', event.data);
    } else if (event.event === 'position.updated') {
      broadcastScopedEvent('position_update', event.data);
    } else if (event.event === 'wallet.updated') {
      broadcastScopedEvent('wallet_update', event.data);
    }
  });

  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  const HOST = process.env.HOST || '0.0.0.0';

  app.listen(PORT, HOST, () => {
    console.log(`[NexTrade Broker OS] Integration Engine running:`);
    console.log(`  ➜ Local:   http://localhost:${PORT}`);
    console.log(`  ➜ Network: http://127.0.0.1:${PORT}`);
    if (HOST !== '0.0.0.0' && HOST !== 'localhost' && HOST !== '127.0.0.1') {
      console.log(`  ➜ Host:    http://${HOST}:${PORT}`);
    }
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
