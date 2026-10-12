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

let currentAuthToken = '';

export function setAuthToken(token: string) {
  currentAuthToken = token;
}

export function getAuthToken(): string {
  return currentAuthToken;
}

function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `IDEMP-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers || {});
  
  if (currentAuthToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${currentAuthToken}`);
  }

  // Set default content type if body is present
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(input, {
    ...init,
    headers,
  });
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
    const res = await fetch('/api/auth/switch-role', {
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
  async getClients(params?: { q?: string; status?: string; hideDemo?: boolean }): Promise<Client[]> {
    const query = new URLSearchParams();
    if (params?.q) query.set('q', params.q);
    if (params?.status) query.set('status', params.status);
    if (params?.hideDemo) query.set('hideDemo', 'true');

    const res = await authenticatedFetch(`/api/clients?${query.toString()}`);
    const data = await res.json();
    return data.clients;
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
    const res = await fetch('/api/tenant/branding');
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
};
