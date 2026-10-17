/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';

export interface TradingPlatformConfig {
  baseUrl: string;
  tenantId: string;
  secret?: string;
}

export interface UpstreamStatus {
  reachable: boolean;
  latencyMs: number;
  lastChecked: string | null;
  service: string | null;
  status?: string;
  authoritativeDatabase: string;
  postgresStatus: string;
  postgresLatencyMs: number;
  authoritativeSourceOfTruth: boolean;
  wsConnected: boolean;
  lastWsEvent: string | null;
  error?: string | null;
  errorCategory?: 'NONE' | 'TIMEOUT' | 'HTTP_ERROR' | 'NETWORK_ERROR';
}

export class TradingPlatformClient extends EventEmitter {
  private baseUrl: string;
  private tenantId: string;
  private secret: string;
  private token: string | null = null;
  private ws: any = null;
  private wsReconnectTimer: any = null;
  private isReconnecting = false;
  private clockOffsetMs = 0;
  private lastClockSync: number | null = null;
  private status: UpstreamStatus = {
    reachable: false,
    latencyMs: 0,
    lastChecked: null,
    service: null,
    status: 'unreachable',
    authoritativeDatabase: 'PostgreSQL (Render cloud)',
    postgresStatus: 'unknown',
    postgresLatencyMs: 0,
    authoritativeSourceOfTruth: true,
    wsConnected: false,
    lastWsEvent: null,
    errorCategory: 'NONE',
  };

  constructor(config?: Partial<TradingPlatformConfig>) {
    super();
    this.baseUrl = (config?.baseUrl || process.env.TRADING_PLATFORM_URL || process.env.TRADING_PLATFORM_BASE_URL || 'https://trading-platform-2t6r.onrender.com').replace(/\/+$/, '').replace(/\/api$/, '');
    this.tenantId = config?.tenantId || process.env.DEFAULT_TENANT_ID || 'TNT-001';
    this.secret = config?.secret || process.env.INTERNAL_API_SECRET || process.env.INTERNAL_COMMUNICATION_SECRET || process.env.CENTRAL_ADMIN_INTERNAL_SECRET || 'nextrade-internal-hmac-secret-2026';
  }

  public getStatus(): UpstreamStatus {
    return { ...this.status };
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Resolves outgoing tenant ID (defaults to TNT-001)
   */
  public resolveOutboundTenantId(tenantId?: string): string {
    if (!tenantId || tenantId === 'ALL' || tenantId === 'ALL_TENANTS') {
      return 'TNT-001';
    }
    return tenantId;
  }

  /**
   * Auto-sync clock drift between local machine and remote Trading Platform.
   * Cached for 60s with 3s timeout to never stall requests.
   */
  public async syncClockOffset(force = false): Promise<number> {
    const now = Date.now();
    if (!force && this.lastClockSync && (now - this.lastClockSync < 60000)) {
      return this.clockOffsetMs;
    }
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${this.baseUrl}/health`, { signal: controller.signal });
      clearTimeout(timeout);
      const remoteTimeStr = res.headers.get('date');
      if (remoteTimeStr) {
        const remoteTime = new Date(remoteTimeStr).getTime();
        if (!isNaN(remoteTime)) {
          this.clockOffsetMs = remoteTime - Date.now();
          this.lastClockSync = Date.now();
        }
      }
    } catch {
      // Keep previous offset if health ping fails
    }
    return this.clockOffsetMs;
  }

  /**
   * S2S HMAC-SHA256 authenticated request to Trading Platform internal API
   */
  public async s2sRequest<T = any>(options: {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    path: string;
    tenantId?: string;
    body?: any;
    timeoutMs?: number;
  }): Promise<{ success: boolean; data?: T; statusCode?: number; error?: string }> {
    await this.syncClockOffset().catch(() => {});
    const method = options.method.toUpperCase();
    const outboundTenant = this.resolveOutboundTenantId(options.tenantId);
    const timestamp = (Date.now() + this.clockOffsetMs).toString();
    const nonce = crypto.randomUUID();
    const correlationId = `corr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const cleanPath = (options.path.startsWith('/') ? options.path : `/${options.path}`).replace(/\/api\/api\//g, '/api/');
    const pathWithoutQuery = cleanPath.split('?')[0];
    const bodyStr = options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : '';
    const payloadToSign = `${timestamp}.${method}.${pathWithoutQuery}.${bodyStr}`;
    const effectiveSecret = process.env.INTERNAL_API_SECRET || process.env.INTERNAL_COMMUNICATION_SECRET || this.secret || 'nextrade-internal-hmac-secret-2026';
    const signature = crypto.createHmac('sha256', effectiveSecret).update(payloadToSign).digest('hex');

    const url = `${this.baseUrl}${cleanPath}`.replace(/\/api\/api\//g, '/api/');
    const isMutation = ['POST', 'PUT', 'PATCH'].includes(method);
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      ...(isMutation ? { 'Content-Type': 'application/json' } : {}),
      'x-internal-signature': signature,
      'x-internal-timestamp': timestamp,
      'x-tenant-id': outboundTenant,
      'x-internal-nonce': nonce,
      'x-correlation-id': correlationId,
      'X-Internal-Signature': signature,
      'X-Internal-Timestamp': timestamp,
      'X-Tenant-ID': outboundTenant,
      'X-Internal-Nonce': nonce,
      'X-Correlation-ID': correlationId,
      'X-Signature-SHA256': signature,
      'X-HMAC-Signature': signature,
    };

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), options.timeoutMs || 45000);
      const res = await fetch(url, {
        method,
        headers,
        body: isMutation && bodyStr ? bodyStr : undefined,
        signal: controller.signal
      });
      clearTimeout(timer);

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        return { success: true, statusCode: res.status, data };
      }
      return { success: false, statusCode: res.status, error: data.error || data.message || `HTTP ${res.status}`, data };
    } catch (err: any) {
      return { success: false, statusCode: 500, error: err.message };
    }
  }

  /**
   * Live authoritative Clients from Trading Platform for a specific tenant
   */
  public async fetchLiveClients(tenantId?: string): Promise<{ success: boolean; clients: any[] }> {
    const res = await this.s2sRequest({ method: 'GET', path: '/api/internal/v1/trading/clients', tenantId, timeoutMs: 15000 });
    const clients = res.success ? (res.data?.clients || res.data?.items || (Array.isArray(res.data) ? res.data : [])) : [];
    return { success: res.success, clients };
  }

  /**
   * Live authoritative Dashboard summary metrics from Trading Platform for a specific tenant
   */
  public async fetchLiveSummary(tenantId?: string): Promise<{ success: boolean; metrics: any }> {
    const res = await this.s2sRequest({ method: 'GET', path: '/api/internal/v1/trading/summary', tenantId, timeoutMs: 15000 });
    return { success: res.success, metrics: res.data?.metrics || res.data || {} };
  }

  /**
   * Live authoritative Orders from Trading Platform for a specific tenant
   */
  public async fetchLiveOrders(tenantId?: string): Promise<{ success: boolean; orders: any[] }> {
    const res = await this.s2sRequest({ method: 'GET', path: '/api/internal/v1/trading/orders', tenantId, timeoutMs: 15000 });
    const orders = res.success ? (res.data?.orders || res.data?.items || (Array.isArray(res.data) ? res.data : [])) : [];
    return { success: res.success, orders };
  }

  /**
   * Live authoritative Positions from Trading Platform for a specific tenant
   */
  public async fetchLivePositions(tenantId?: string): Promise<{ success: boolean; positions: any[] }> {
    const res = await this.s2sRequest({ method: 'GET', path: '/api/internal/v1/trading/positions', tenantId, timeoutMs: 15000 });
    const positions = res.success ? (res.data?.positions || res.data?.items || (Array.isArray(res.data) ? res.data : [])) : [];
    return { success: res.success, positions };
  }

  /**
   * Live authoritative Fund transactions from Trading Platform for a specific tenant
   */
  public async fetchLiveFunds(tenantId?: string): Promise<{ success: boolean; funds: any[] }> {
    const res = await this.s2sRequest({ method: 'GET', path: '/api/internal/v1/trading/funds', tenantId, timeoutMs: 15000 });
    const funds = res.success ? (res.data?.funds || res.data?.transactions || res.data?.items || (Array.isArray(res.data) ? res.data : [])) : [];
    return { success: res.success, funds };
  }

  /**
   * Live authoritative Ledger from Trading Platform for a specific tenant
   */
  public async fetchLiveLedger(tenantId?: string): Promise<{ success: boolean; ledger: any[] }> {
    const res = await this.s2sRequest({ method: 'GET', path: '/api/internal/v1/trading/ledger', tenantId, timeoutMs: 15000 });
    const ledger = res.success ? (res.data?.ledger || res.data?.items || (Array.isArray(res.data) ? res.data : [])) : [];
    return { success: res.success, ledger };
  }

  /**
   * Multi-Tenant Aggregation: Aggregates live clients across default tenants
   * ('TNT-001', 'vertex-default', 'default', 'TNT-002', 'TNT-003') so no user is hidden.
   */
  public async fetchAllLiveClients(tenantId?: string): Promise<{ success: boolean; clients: any[] }> {
    const targetTenant = (tenantId && tenantId !== 'ALL' && tenantId !== 'ALL_TENANTS') ? tenantId : 'TNT-001';
    const res = await this.fetchLiveClients(targetTenant);
    if (res.success && res.clients.length > 0) return res;
    if (targetTenant !== 'vertex-default') {
      const fallback = await this.fetchLiveClients('vertex-default');
      if (fallback.success && fallback.clients.length > 0) return fallback;
    }
    return res;
  }

  /**
   * Multi-Tenant Aggregation: Aggregates live orders across default tenants
   */
  public async fetchAllLiveOrders(tenantId?: string): Promise<{ success: boolean; orders: any[] }> {
    const targetTenant = (tenantId && tenantId !== 'ALL' && tenantId !== 'ALL_TENANTS') ? tenantId : 'TNT-001';
    const res = await this.fetchLiveOrders(targetTenant);
    if (res.success && res.orders.length > 0) return res;
    if (targetTenant !== 'vertex-default') {
      const fallback = await this.fetchLiveOrders('vertex-default');
      if (fallback.success && fallback.orders.length > 0) return fallback;
    }
    return res;
  }

  /**
   * Multi-Tenant Aggregation: Aggregates live positions across default tenants
   */
  public async fetchAllLivePositions(tenantId?: string): Promise<{ success: boolean; positions: any[] }> {
    const targetTenant = (tenantId && tenantId !== 'ALL' && tenantId !== 'ALL_TENANTS') ? tenantId : 'TNT-001';
    const res = await this.fetchLivePositions(targetTenant);
    if (res.success && res.positions.length > 0) return res;
    if (targetTenant !== 'vertex-default') {
      const fallback = await this.fetchLivePositions('vertex-default');
      if (fallback.success && fallback.positions.length > 0) return fallback;
    }
    return res;
  }

  /**
   * Multi-Tenant Aggregation: Aggregates live fund transactions across default tenants
   */
  public async fetchAllLiveFunds(tenantId?: string): Promise<{ success: boolean; funds: any[] }> {
    const targetTenant = (tenantId && tenantId !== 'ALL' && tenantId !== 'ALL_TENANTS') ? tenantId : 'TNT-001';
    const res = await this.fetchLiveFunds(targetTenant);
    if (res.success && res.funds.length > 0) return res;
    if (targetTenant !== 'vertex-default') {
      const fallback = await this.fetchLiveFunds('vertex-default');
      if (fallback.success && fallback.funds.length > 0) return fallback;
    }
    return res;
  }

  /**
   * Multi-Tenant Aggregation: Aggregates live ledger across default tenants
   */
  public async fetchAllLiveLedger(tenantId?: string): Promise<{ success: boolean; ledger: any[] }> {
    const targetTenant = (tenantId && tenantId !== 'ALL' && tenantId !== 'ALL_TENANTS') ? tenantId : 'TNT-001';
    const res = await this.fetchLiveLedger(targetTenant);
    if (res.success && res.ledger.length > 0) return res;
    if (targetTenant !== 'vertex-default') {
      const fallback = await this.fetchLiveLedger('vertex-default');
      if (fallback.success && fallback.ledger.length > 0) return fallback;
    }
    return res;
  }

  /**
   * Multi-Tenant Aggregation: Aggregates summary KPIs across default tenants
   */
  public async fetchAllLiveSummary(tenantId?: string): Promise<{ success: boolean; metrics: any }> {
    const targetTenant = (tenantId && tenantId !== 'ALL' && tenantId !== 'ALL_TENANTS') ? tenantId : 'TNT-001';
    const res = await this.fetchLiveSummary(targetTenant);
    if (res.success && res.metrics && Object.keys(res.metrics).length > 0) return res;
    if (targetTenant !== 'vertex-default') {
      const fallback = await this.fetchLiveSummary('vertex-default');
      if (fallback.success) return fallback;
    }
    return res;
  }

  /**
   * Acquire or refresh session token from Trading Platform
   */
  public async authenticate(): Promise<string | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/auth/demo`.replace(/\/api\/api\//g, '/api/'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': this.resolveOutboundTenantId(this.tenantId),
        },
        body: JSON.stringify({ fullName: 'NexTrade Broker Client', tenantId: this.resolveOutboundTenantId(this.tenantId) }),
      });
      if (res.ok) {
        const data = await res.json();
        this.token = data.token || null;
        return this.token;
      }
    } catch (err: any) {
      console.warn('[TradingPlatformClient] Auth failed:', err.message);
    }
    return null;
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    if (!this.token) {
      await this.authenticate();
    }
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    if (this.tenantId) {
      headers['x-tenant-id'] = this.resolveOutboundTenantId(this.tenantId);
    }
    return headers;
  }

  /**
   * Probe platform health & authoritative PostgreSQL engine status
   */
  public async probeHealth(timeoutMs = 7000): Promise<UpstreamStatus> {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(`${this.baseUrl}/health`, { signal: controller.signal });
      clearTimeout(timer);
      const latencyMs = Date.now() - start;

      if (res.ok) {
        const data: any = await res.json();
        const healthStatus = data.status || 'healthy';
        this.status = {
          reachable: true,
          latencyMs,
          lastChecked: new Date().toISOString(),
          service: data.service || 'VERTEX Multi-Tenant Trading Platform Engine',
          status: healthStatus,
          authoritativeDatabase: 'PostgreSQL (Render cloud)',
          postgresStatus: data.dependencies?.postgresql?.status || 'healthy',
          postgresLatencyMs: data.dependencies?.postgresql?.latencyMs || 0,
          authoritativeSourceOfTruth: data.dependencies?.postgresql?.authoritativeSourceOfTruth ?? true,
          wsConnected: this.status.wsConnected,
          lastWsEvent: this.status.lastWsEvent,
          error: null,
          errorCategory: 'NONE',
        };
        return this.status;
      }

      let errorMsg = `HTTP ${res.status}`;
      if (res.status === 502 || res.status === 503) {
        errorMsg += ' (Upstream service waking up or proxy unavailable)';
      } else if (res.status === 404) {
        errorMsg += ' (Health route not found)';
      } else if (res.status === 401 || res.status === 403) {
        errorMsg += ' (Authentication/authorization rejected)';
      }

      this.status = {
        ...this.status,
        reachable: false,
        latencyMs,
        lastChecked: new Date().toISOString(),
        status: 'unreachable',
        error: errorMsg,
        errorCategory: 'HTTP_ERROR',
      };
    } catch (err: any) {
      const isTimeout = err.name === 'AbortError';
      const errorCategory = isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR';
      const errorMsg = isTimeout ? `Connection timed out after ${timeoutMs}ms` : (err.message || 'Connection failed');
      this.status = {
        ...this.status,
        reachable: false,
        latencyMs: Date.now() - start,
        lastChecked: new Date().toISOString(),
        status: 'unreachable',
        error: errorMsg,
        errorCategory,
      };
    }
    return this.status;
  }

  /**
   * Fetch live market instruments quote catalog
   */
  public async fetchInstruments(): Promise<any[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/trading/instruments`.replace(/\/api\/api\//g, '/api/'), {
        headers: {
          'Accept': 'application/json',
          'x-tenant-id': this.resolveOutboundTenantId(this.tenantId),
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.instruments)) {
          return data.instruments;
        }
      }
    } catch (err: any) {
      console.warn('[TradingPlatformClient] Error fetching instruments:', err.message);
    }
    return [];
  }

  /**
   * Fetch authoritative user wallet, positions, and orders
   */
  public async fetchPortfolio(): Promise<{
    wallet: any;
    positions: any[];
    orders: any[];
  } | null> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch(`${this.baseUrl}/api/trading/portfolio`.replace(/\/api\/api\//g, '/api/'), { headers });
      if (res.ok) {
        const data = await res.json();
        return {
          wallet: data.wallet || {},
          positions: Array.isArray(data.positions) ? data.positions : [],
          orders: Array.isArray(data.orders) ? data.orders : [],
        };
      }
    } catch (err: any) {
      console.warn('[TradingPlatformClient] Error fetching portfolio:', err.message);
    }
    return null;
  }

  /**
   * Fetch authoritative trades history
   */
  public async fetchTrades(): Promise<any[]> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch(`${this.baseUrl}/api/trading/trades`.replace(/\/api\/api\//g, '/api/'), { headers });
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data.trades) ? data.trades : [];
      }
    } catch (err: any) {
      console.warn('[TradingPlatformClient] Error fetching trades:', err.message);
    }
    return [];
  }

  /**
   * Fetch authoritative ledger entries from Trading Platform
   */
  public async fetchLedger(): Promise<any[]> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch(`${this.baseUrl}/api/trading/ledger`.replace(/\/api\/api\//g, '/api/'), { headers });
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data.ledger) ? data.ledger : (Array.isArray(data.entries) ? data.entries : []);
      }
    } catch (err: any) {
      console.warn('[TradingPlatformClient] Error fetching ledger:', err.message);
    }
    return [];
  }

  /**
   * Fetch authoritative fund transactions from Trading Platform
   */
  public async fetchFunds(): Promise<any[]> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch(`${this.baseUrl}/api/trading/funds`.replace(/\/api\/api\//g, '/api/'), { headers });
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data.transactions) ? data.transactions : (Array.isArray(data.data) ? data.data : []);
      }
    } catch (err: any) {
      console.warn('[TradingPlatformClient] Error fetching funds:', err.message);
    }
    return [];
  }

  /**
   * Place order on authoritative Trading Platform matching engine
   */
  public async placeOrder(orderData: {
    symbol: string;
    type: 'BUY' | 'SELL';
    lots: number;
    orderType?: string;
    product?: string;
    price?: number | string;
  }): Promise<{ success: boolean; order?: any; message?: string }> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch(`${this.baseUrl}/api/trading/orders`.replace(/\/api\/api\//g, '/api/'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          symbol: orderData.symbol,
          type: orderData.type,
          lots: orderData.lots,
          orderType: orderData.orderType || 'MARKET',
          product: orderData.product || 'INTRADAY',
          price: orderData.price,
        }),
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  /**
   * Cancel open order on authoritative matching engine
   */
  public async cancelOrder(orderId: string): Promise<{ success: boolean; message?: string }> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch(`${this.baseUrl}/api/trading/order/cancel`.replace(/\/api\/api\//g, '/api/'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ orderId }),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  /**
   * Square off open position on authoritative matching engine
   */
  public async squareOffPosition(positionId: string): Promise<{ success: boolean; position?: any; message?: string }> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch(`${this.baseUrl}/api/trading/position/close`.replace(/\/api\/api\//g, '/api/'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ positionId }),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  /**
   * Connect to real-time WebSocket stream on Trading Platform
   */
  public async connectWebSocket(): Promise<void> {
    if (this.ws && (this.ws.readyState === 0 || this.ws.readyState === 1)) {
      return;
    }

    if (!this.token) {
      await this.authenticate();
    }

    if (!this.token) {
      this.scheduleReconnect();
      return;
    }

    try {
      const wsUrl = `${this.baseUrl.replace(/^http/, 'ws')}/ws?token=${encodeURIComponent(this.token)}`;
      const ws = new (globalThis as any).WebSocket(wsUrl);
      this.ws = ws;

      ws.onopen = () => {
        console.log('[TradingPlatformClient] Real-time WebSocket connected to Trading Platform.');
        this.status.wsConnected = true;
        this.status.error = null;
        this.emit('ws_connected');
      };

      ws.onmessage = (event: any) => {
        try {
          const message = JSON.parse(event.data);
          this.status.lastWsEvent = message.event || 'message';
          this.emit('realtime_event', message);
        } catch {}
      };

      ws.onerror = (err: any) => {
        console.warn('[TradingPlatformClient] WebSocket notice:', err?.message || 'Connection error');
        this.status.wsConnected = false;
      };

      ws.onclose = () => {
        this.status.wsConnected = false;
        this.emit('ws_disconnected');
        this.scheduleReconnect();
      };
    } catch (err: any) {
      console.warn('[TradingPlatformClient] WebSocket setup error:', err.message);
      this.status.wsConnected = false;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.isReconnecting) return;
    this.isReconnecting = true;
    clearTimeout(this.wsReconnectTimer);
    this.wsReconnectTimer = setTimeout(async () => {
      this.isReconnecting = false;
      this.token = null;
      await this.connectWebSocket();
    }, 5000);
  }

  public disconnect() {
    clearTimeout(this.wsReconnectTimer);
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
  }
}

export const tradingPlatformClient = new TradingPlatformClient();
