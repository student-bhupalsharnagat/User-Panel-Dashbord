/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AuthenticatedUser,
  Client,
  FundTransaction,
  LedgerEntry,
  MarketInstrument,
  MetricSummary,
  OperationsQueueItem,
  Order,
  Position,
  ReportItem,
  SettingsState,
  TenantBranding,
  TurnoverTrendPoint,
  AccountActivityBar,
  AuditLog,
  AnalyticsData,
} from '../types';

const RAW_API_BASE = (
  typeof import.meta !== 'undefined' && ((import.meta as any).env?.VITE_API_URL || (import.meta as any).env?.VITE_API_BASE_URL)
    ? ((import.meta as any).env.VITE_API_URL || (import.meta as any).env.VITE_API_BASE_URL)
    : ''
).replace(/\/+$/, '');

// Safeguard: Never target localhost or obsolete onrender domains in production bundle
const isProd = typeof import.meta !== 'undefined' && Boolean((import.meta as any).env?.PROD);
export const API_BASE = (isProd && (
  RAW_API_BASE.includes('localhost') ||
  RAW_API_BASE.includes('127.0.0.1') ||
  RAW_API_BASE.includes('user-panel-dashbord.onrender.com') ||
  RAW_API_BASE.includes('trading-platform-3-1v13') ||
  RAW_API_BASE.includes('admin-dashbord-2')
))
  ? ''
  : RAW_API_BASE;

export const API_BASE_URL = API_BASE;

export function resolveApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (API_BASE.endsWith('/api') && cleanPath.startsWith('/api/')) {
    return `${API_BASE}${cleanPath.substring(4)}`;
  }
  return `${API_BASE}${cleanPath}`;
}

export const buildApiUrl = resolveApiUrl;

let currentAuthToken = '';

export function setAuthToken(token: string) {
  currentAuthToken = token;
}

export function getAuthToken(): string {
  if (currentAuthToken) return currentAuthToken;
  if (typeof window !== 'undefined' && window.localStorage) {
    return (
      localStorage.getItem('token') ||
      localStorage.getItem('admin_token') ||
      localStorage.getItem('broker_token') ||
      localStorage.getItem('authToken') ||
      localStorage.getItem('access_token') ||
      ''
    );
  }
  return '';
}

function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `IDEMP-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  const headers = new Headers(init.headers || {});
  
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Set default content type if body is present
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const url = typeof input === 'string' ? resolveApiUrl(input) : input;

  try {
    const res = await fetch(url, {
      ...init,
      headers,
    });
    return res;
  } catch (err) {
    // If external host is unreachable, fallback to relative local route
    if (typeof input === 'string' && !input.startsWith('http')) {
      return fetch(input, { ...init, headers });
    }
    throw err;
  }
}

function normalizeClients(data: any): Client[] {
  let list: any[] = [];
  if (Array.isArray(data)) {
    list = data;
  } else if (Array.isArray(data?.clients)) {
    list = data.clients;
  } else if (Array.isArray(data?.data)) {
    list = data.data;
  } else if (Array.isArray(data?.items)) {
    list = data.items;
  }

  return list.map((item: any) => ({
    id: String(item.id || item._id || item.clientId || `CLI-${Math.random().toString(36).slice(2, 7).toUpperCase()}`),
    name: String(item.name || item.fullName || item.username || 'Unnamed Client'),
    email: String(item.email || ''),
    phone: String(item.phone || item.mobile || ''),
    pan: String(item.pan || 'N/A'),
    status: (item.status === 'Active' || item.status === 'Inactive' || item.status === 'Suspended')
      ? item.status
      : (item.isActive === false ? 'Inactive' : 'Active'),
    isDemo: item.isDemo !== undefined ? Boolean(item.isDemo) : Boolean(item.accountType === 'demo' || item.type === 'demo'),
    ledgerBalance: Number(item.ledgerBalance ?? item.balance ?? 0),
    openPnL: Number(item.openPnL ?? item.pnl ?? 0),
    peakLedger: Number(item.peakLedger ?? item.ledgerBalance ?? 0),
    marginUsed: Number(item.marginUsed ?? 0),
    income: Number(item.income ?? 0),
    marginAvailable: Number(item.marginAvailable ?? item.availableMargin ?? (item.ledgerBalance ?? 0)),
    brokerId: String(item.brokerId || 'BRK-01'),
    brokerName: String(item.brokerName || 'Apex Capital Partners'),
    kycStatus: (item.kycStatus === 'Verified' || item.kycStatus === 'Pending' || item.kycStatus === 'Rejected')
      ? item.kycStatus
      : 'Verified',
    kycDocuments: Array.isArray(item.kycDocuments) ? item.kycDocuments : ['PAN_Card.pdf'],
    createdDate: String(item.createdDate || item.createdAt || new Date().toISOString().slice(0, 10)),
    lastActive: String(item.lastActive || item.updatedAt || 'Just now'),
    riskLimit: Number(item.riskLimit ?? 500000),
  }));
}

export const api = {
  // Auth & Roles
  async getMe(): Promise<{ user: AuthenticatedUser; tenant: TenantBranding; token: string }> {
    const res = await authenticatedFetch('/api/auth/me');
    if (!res.ok && res.status === 401) {
      throw new Error('Unauthorized');
    }
    const data = await res.json();
    if (data.token) {
      setAuthToken(data.token);
    }
    return { user: data.user, tenant: data.tenant, token: data.token };
  },

  async switchRole(role: string): Promise<{ user: AuthenticatedUser; token: string }> {
    const res = await fetch(resolveApiUrl('/api/auth/switch-role'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    const data = await res.json();
    if (data.token) {
      setAuthToken(data.token);
    }
    return { user: data.user, token: data.token };
  },

  // Dashboard Summary
  async getDashboardSummary(): Promise<{
    metrics: MetricSummary;
    turnoverTrend: TurnoverTrendPoint[];
    accountActivity: AccountActivityBar[];
    operationsQueue: OperationsQueueItem[];
  }> {
    const res = await authenticatedFetch('/api/dashboard/summary');
    const data = await res.json();
    return {
      metrics: data.metrics,
      turnoverTrend: data.turnoverTrend,
      accountActivity: data.accountActivity,
      operationsQueue: data.operationsQueue,
    };
  },

  // Market Watch
  async getMarketWatch(): Promise<MarketInstrument[]> {
    const res = await authenticatedFetch('/api/market-watch');
    const data = await res.json();
    return data.instruments;
  },

  // Clients
  async getClients(params?: { q?: string; status?: string; hideDemo?: boolean; accountType?: string }): Promise<Client[]> {
    const query = new URLSearchParams();
    if (params?.q) query.set('q', params.q);
    if (params?.status && params.status !== 'All statuses') query.set('status', params.status);
    if (params?.hideDemo) query.set('hideDemo', 'true');
    if (params?.accountType) query.set('accountType', params.accountType);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    let res = await authenticatedFetch(`/api/clients${queryString}`);
    if (!res.ok) {
      res = await authenticatedFetch(`/api/admin/clients${queryString}`);
    }
    if (!res.ok) {
      throw new Error(`Failed to fetch clients: ${res.statusText}`);
    }
    const data = await res.json();
    return normalizeClients(data);
  },

  async fetchClients(params?: { q?: string; status?: string; hideDemo?: boolean; accountType?: string }): Promise<Client[]> {
    return this.getClients(params);
  },

  async getClientById(id: string): Promise<{ client: Client; orders: Order[]; positions: Position[] }> {
    const res = await authenticatedFetch(`/api/clients/${id}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Client query failed');
    return data;
  },

  async createClient(clientData: Partial<Client> & { initialMargin?: number }): Promise<Client> {
    const res = await authenticatedFetch('/api/clients', {
      method: 'POST',
      headers: {
        'X-Idempotency-Key': generateIdempotencyKey(),
      },
      body: JSON.stringify(clientData),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Failed to create client');
    return data.client;
  },

  // Orders
  async getOrders(params?: { status?: string; q?: string }): Promise<Order[]> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.q) query.set('q', params.q);

    const res = await authenticatedFetch(`/api/orders?${query.toString()}`);
    const data = await res.json();
    return data.orders;
  },

  async placeOrder(orderData: {
    clientId?: string;
    instrument: string;
    side: 'BUY' | 'SELL';
    type: 'LIMIT' | 'MARKET' | 'SL-M';
    quantity: number;
    orderPrice?: number | string;
    product?: 'MIS' | 'NRML' | 'CNC';
  }): Promise<Order> {
    const res = await authenticatedFetch('/api/orders', {
      method: 'POST',
      headers: {
        'X-Idempotency-Key': generateIdempotencyKey(),
      },
      body: JSON.stringify(orderData),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Order failed');
    return data.order;
  },

  async cancelOrder(id: string): Promise<Order> {
    const res = await authenticatedFetch(`/api/orders/${id}/cancel`, {
      method: 'PATCH',
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Failed to cancel order');
    return data.order;
  },

  // Positions
  async getPositions(): Promise<{ positions: Position[]; summary: any }> {
    const res = await authenticatedFetch('/api/positions');
    const data = await res.json();
    return { positions: data.positions, summary: data.summary };
  },

  async squareOffPosition(id: string): Promise<{ pnl: number }> {
    const res = await authenticatedFetch(`/api/positions/${id}/square-off`, {
      method: 'POST',
      headers: {
        'X-Idempotency-Key': generateIdempotencyKey(),
      },
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Failed to square off position');
    return data;
  },

  // Funds
  async getFunds(type?: string): Promise<FundTransaction[]> {
    const query = new URLSearchParams();
    if (type) query.set('type', type);
    const res = await authenticatedFetch(`/api/funds?${query.toString()}`);
    const data = await res.json();
    return data.transactions;
  },

  async approveFund(id: string): Promise<FundTransaction> {
    const res = await authenticatedFetch(`/api/funds/${id}/approve`, {
      method: 'POST',
      headers: {
        'X-Idempotency-Key': generateIdempotencyKey(),
      },
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Approval failed');
    return data.transaction;
  },

  async rejectFund(id: string, reason: string): Promise<FundTransaction> {
    const res = await authenticatedFetch(`/api/funds/${id}/reject`, {
      method: 'POST',
      headers: {
        'X-Idempotency-Key': generateIdempotencyKey(),
      },
      body: JSON.stringify({ reason }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Rejection failed');
    return data.transaction;
  },

  // Ledger
  async getLedger(): Promise<{ summary: any; entries: LedgerEntry[] }> {
    const res = await authenticatedFetch('/api/ledger');
    const data = await res.json();
    return { summary: data.summary, entries: data.entries };
  },

  // Analytics
  async getAnalytics(): Promise<AnalyticsData> {
    const res = await authenticatedFetch('/api/analytics');
    const data = await res.json();
    return data.data;
  },

  // Action / Audit Logs
  async getAuditLogs(): Promise<AuditLog[]> {
    const res = await authenticatedFetch('/api/audit-logs');
    const data = await res.json();
    return data.logs;
  },

  // Reports
  async getReports(): Promise<ReportItem[]> {
    const res = await authenticatedFetch('/api/reports');
    const data = await res.json();
    return data.reports;
  },

  async getReportPreview(id: string): Promise<{ report: ReportItem; data: any[] }> {
    const res = await authenticatedFetch(`/api/reports/preview/${id}`);
    const data = await res.json();
    return { report: data.report, data: data.data };
  },

  // Instruments
  async getInstruments(): Promise<MarketInstrument[]> {
    const res = await authenticatedFetch('/api/instruments');
    const data = await res.json();
    return data.instruments;
  },

  async toggleInstrument(symbol: string): Promise<MarketInstrument> {
    const res = await authenticatedFetch(`/api/instruments/${symbol}/toggle`, {
      method: 'PATCH',
    });
    const data = await res.json();
    return data.instrument;
  },

  // Settings
  async getSettings(): Promise<SettingsState> {
    const res = await authenticatedFetch('/api/settings');
    const data = await res.json();
    return data.settings;
  },

  async updateSettings(settings: Partial<SettingsState>): Promise<SettingsState> {
    const res = await authenticatedFetch('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify(settings),
    });
    const data = await res.json();
    return data.settings;
  },

  // White-label Branding
  async getBranding(): Promise<TenantBranding> {
    const res = await fetch(resolveApiUrl('/api/tenant/branding'));
    const data = await res.json();
    return data.branding;
  },

  async updateBranding(branding: Partial<TenantBranding>): Promise<TenantBranding> {
    const res = await authenticatedFetch('/api/whitelabel/publish', {
      method: 'POST',
      body: JSON.stringify(branding),
    });
    const data = await res.json();
    return data.branding;
  },

  // Support Tickets (Persistent server-dispatched workflow)
  async submitTicket(ticketData: {
    category: string;
    subject: string;
    message: string;
    priority?: string;
  }): Promise<{ success: boolean; id: string; message: string }> {
    const res = await authenticatedFetch('/api/tickets', {
      method: 'POST',
      body: JSON.stringify(ticketData),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Failed to submit support ticket');
    return data;
  },
};
