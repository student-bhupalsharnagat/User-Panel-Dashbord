/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'events';

export interface TradingPlatformConfig {
  baseUrl: string;
  tenantId: string;
}

export interface UpstreamStatus {
  reachable: boolean;
  latencyMs: number;
  lastChecked: string | null;
  service: string | null;
  authoritativeDatabase: string;
  postgresStatus: string;
  postgresLatencyMs: number;
  authoritativeSourceOfTruth: boolean;
  wsConnected: boolean;
  lastWsEvent: string | null;
  error?: string | null;
}

export class TradingPlatformClient extends EventEmitter {
  private baseUrl: string;
  private tenantId: string;
  private token: string | null = null;
  private ws: any = null;
  private wsReconnectTimer: any = null;
  private isReconnecting = false;
  private status: UpstreamStatus = {
    reachable: false,
    latencyMs: 0,
    lastChecked: null,
    service: null,
    authoritativeDatabase: 'PostgreSQL (Render cloud)',
    postgresStatus: 'unknown',
    postgresLatencyMs: 0,
    authoritativeSourceOfTruth: true,
    wsConnected: false,
    lastWsEvent: null,
  };

  constructor(config?: Partial<TradingPlatformConfig>) {
    super();
    this.baseUrl = (config?.baseUrl || process.env.TRADING_PLATFORM_URL || 'https://trading-platform-3-1v13.onrender.com').replace(/\/$/, '');
    this.tenantId = config?.tenantId || process.env.DEFAULT_TENANT_ID || 'vertex-default';
  }

  public getStatus(): UpstreamStatus {
    return { ...this.status };
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Acquire or refresh session token from Trading Platform
   */
  public async authenticate(): Promise<string | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/auth/demo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      headers['x-tenant-id'] = this.tenantId;
    }
    return headers;
  }

  /**
   * Probe platform health & authoritative PostgreSQL engine status
   */
  public async probeHealth(timeoutMs = 5000): Promise<UpstreamStatus> {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(`${this.baseUrl}/health`, { signal: controller.signal });
      clearTimeout(timer);
      const latencyMs = Date.now() - start;

      if (res.ok) {
        const data: any = await res.json();
        this.status = {
          reachable: true,
          latencyMs,
          lastChecked: new Date().toISOString(),
          service: data.service || 'VERTEX Multi-Tenant Trading Platform Engine',
          authoritativeDatabase: 'PostgreSQL (Render cloud)',
          postgresStatus: data.dependencies?.postgresql?.status || 'healthy',
          postgresLatencyMs: data.dependencies?.postgresql?.latencyMs || 0,
          authoritativeSourceOfTruth: data.dependencies?.postgresql?.authoritativeSourceOfTruth ?? true,
          wsConnected: this.status.wsConnected,
          lastWsEvent: this.status.lastWsEvent,
          error: null,
        };
        return this.status;
      }

      this.status = {
        ...this.status,
        reachable: false,
        latencyMs,
        lastChecked: new Date().toISOString(),
        error: `HTTP ${res.status}`,
      };
    } catch (err: any) {
      this.status = {
        ...this.status,
        reachable: false,
        latencyMs: Date.now() - start,
        lastChecked: new Date().toISOString(),
        error: err.name === 'AbortError' ? 'Connection timeout' : err.message,
      };
    }
    return this.status;
  }

  /**
   * Fetch live market instruments quote catalog
   */
  public async fetchInstruments(): Promise<any[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/trading/instruments`, {
        headers: { 'Accept': 'application/json' },
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
      const res = await fetch(`${this.baseUrl}/api/trading/portfolio`, { headers });
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
      const res = await fetch(`${this.baseUrl}/api/trading/trades`, { headers });
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
      const res = await fetch(`${this.baseUrl}/api/trading/orders`, {
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
      const res = await fetch(`${this.baseUrl}/api/trading/order/cancel`, {
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
      const res = await fetch(`${this.baseUrl}/api/trading/position/close`, {
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
      return; // Already connecting or connected
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
      // Use global WebSocket available in Node 22
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
      await this.connectWebSocket();
    }, 7000);
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
