/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef, useMemo } from 'react';
import {
  AuthenticatedUser,
  Client,
  FundTransaction,
  MarketInstrument,
  MetricSummary,
  NavigationTab,
  Order,
  Position,
  ReportItem,
  SettingsState,
  TenantBranding,
} from '../types';
import { api, getAuthToken, setAuthToken, resolveApiUrl, API_BASE } from '../services/api';
import { parseCleanNumber, updateLivePrices } from '../utils/cleanNumber';

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  time?: string;
}

interface AppContextType {
  // Navigation
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  
  // User & Tenant & Auth
  currentUser: AuthenticatedUser | null;
  isAuthenticated: boolean;
  login: (identifier: string, password: string) => Promise<any>;
  register: (formData: any) => Promise<any>;
  logout: () => Promise<void>;
  switchRole: (role?: string) => Promise<void>;
  tenantBranding: TenantBranding | null;
  updateBranding: (branding: Partial<TenantBranding>) => Promise<void>;
  
  // Settings & Profile
  settings: SettingsState | null;
  updateUserSettings: (newSettings: Partial<SettingsState>) => void;

  // Filter for Orders navigation
  ordersFilter: { status?: string; query?: string } | null;
  setOrdersFilter: (filter: { status?: string; query?: string } | null) => void;

  // Filter for Funds navigation
  fundsFilter: { query?: string; tab?: 'Deposits' | 'Withdrawals' } | null;
  setFundsFilter: (filter: { query?: string; tab?: 'Deposits' | 'Withdrawals' } | null) => void;

  // Filter for Positions navigation
  positionsFilter: { query?: string } | null;
  setPositionsFilter: (filter: { query?: string } | null) => void;
  
  // Data Modes
  isLiveMode: boolean;
  setIsLiveMode: (live: boolean) => void;
  isCompactMode: boolean;
  setIsCompactMode: (compact: boolean) => void;

  // Real-time state & Refresh
  refreshTrigger: number;
  triggerRefresh: (force?: boolean) => void;
  isRealtimeConnected: boolean;
  lastTickTimestamp: string;
  latestTicks: Record<string, Partial<MarketInstrument>>;
  marketWatchLtpMap: Record<string, number>;
  livePositionsMtm: Record<string, { ltp: number; unrealisedPnL: number; totalPnL: number }>;
  liveClientsMtm: Record<string, { openPnL: number; marginAvailable: number; marginUsed: number }>;

  // Global Search
  isSearchOpen: boolean;
  setIsSearchOpen: (open: boolean) => void;
  globalSearchQuery: string;
  setGlobalSearchQuery: (query: string) => void;

  // Notifications Drawer
  isNotificationsOpen: boolean;
  setIsNotificationsOpen: (open: boolean) => void;
  unreadNotificationsCount: number;

  // Mobile navigation drawer
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;

  // Modals & Drawers
  orderModalState: {
    isOpen: boolean;
    instrument?: MarketInstrument | null;
    defaultSide?: 'BUY' | 'SELL';
    existingOrder?: Order | null;
  };
  openOrderModal: (instrument?: MarketInstrument | null, side?: 'BUY' | 'SELL', existingOrder?: Order | null) => void;
  closeOrderModal: () => void;

  selectedClientForDetail: Client | null;
  clientDetailInitialTab?: 'overview' | 'positions' | 'orders' | 'ledger' | 'kyc';
  openClientDetail: (client: Client, initialTab?: 'overview' | 'positions' | 'orders' | 'ledger' | 'kyc') => void;
  closeClientDetail: () => void;

  isAddClientOpen: boolean;
  setIsAddClientOpen: (open: boolean) => void;

  fundActionModal: {
    isOpen: boolean;
    transaction: FundTransaction | null;
    actionType: 'approve' | 'reject';
  };
  openFundActionModal: (transaction: FundTransaction, actionType: 'approve' | 'reject') => void;
  closeFundActionModal: () => void;

  squareOffModal: {
    isOpen: boolean;
    position: Position | null;
  };
  openSquareOffModal: (position: Position) => void;
  closeSquareOffModal: () => void;

  reportPreviewModal: {
    isOpen: boolean;
    report: ReportItem | null;
    period?: string;
  };
  openReportPreview: (report: ReportItem, period?: string) => void;
  closeReportPreview: () => void;

  isSupportModalOpen: boolean;
  setIsSupportModalOpen: (open: boolean) => void;

  // Toasts
  toasts: ToastItem[];
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const saved = localStorage.getItem('nextrade_auth_user');
        const token = getAuthToken();
        if (saved && token) {
          return JSON.parse(saved);
        }
      } catch {}
    }
    return null;
  });
  const [tenantBranding, setTenantBranding] = useState<TenantBranding | null>(null);
  const [settings, setSettings] = useState<SettingsState | null>(null);
  const [ordersFilter, setOrdersFilter] = useState<{ status?: string; query?: string } | null>(null);
  const [fundsFilter, setFundsFilter] = useState<{ query?: string; tab?: 'Deposits' | 'Withdrawals' } | null>(null);
  const [positionsFilter, setPositionsFilter] = useState<{ query?: string } | null>(null);

  const updateUserSettings = useCallback((newSettings: Partial<SettingsState>) => {
    setSettings((prev) => (prev ? { ...prev, ...newSettings } : (newSettings as SettingsState)));
    if (newSettings.displayName) {
      setCurrentUser((prev) => {
        if (!prev) return prev;
        if (prev.role !== 'broker_admin') return prev;
        const updated = { ...prev, name: newSettings.displayName! };
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem('nextrade_auth_user', JSON.stringify(updated));
        }
        return updated;
      });
    }
  }, []);

  const isAuthenticated = Boolean(currentUser && getAuthToken());
  
  const [isLiveMode, setIsLiveMode] = useState<boolean>(true);
  const [isCompactMode, setIsCompactModeState] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem('nextrade_compact_mode') === 'true';
    }
    return false;
  });

  const setIsCompactMode = useCallback((compact: boolean) => {
    setIsCompactModeState(compact);
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('nextrade_compact_mode', String(compact));
    }
  }, []);
  
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState<boolean>(false);
  const [lastTickTimestamp, setLastTickTimestamp] = useState<string>('Just now');
  const [latestTicks, setLatestTicks] = useState<Record<string, Partial<MarketInstrument>>>({});
  const [marketWatchLtpMap, setMarketWatchLtpMap] = useState<Record<string, number>>({});
  const [livePositionsMtm, setLivePositionsMtm] = useState<Record<string, { ltp: number; unrealisedPnL: number; totalPnL: number }>>({});
  const [liveClientsMtm, setLiveClientsMtm] = useState<Record<string, { openPnL: number; marginAvailable: number; marginUsed: number }>>({});
  const lastSyncTimestampRef = useRef<number>(Date.now());
  const isWsConnectedRef = useRef<boolean>(false);

  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState<string>('');
  
  const [isNotificationsOpen, setIsNotificationsOpen] = useState<boolean>(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(4);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  const handleSetActiveTab = useCallback((tab: NavigationTab) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  }, []);

  // Modals state
  const [orderModalState, setOrderModalState] = useState<{
    isOpen: boolean;
    instrument?: MarketInstrument | null;
    defaultSide?: 'BUY' | 'SELL';
    existingOrder?: Order | null;
  }>({ isOpen: false });

  const [selectedClientForDetail, setSelectedClientForDetail] = useState<Client | null>(null);
  const [clientDetailInitialTab, setClientDetailInitialTab] = useState<'overview' | 'positions' | 'orders' | 'ledger' | 'kyc'>('overview');
  const [isAddClientOpen, setIsAddClientOpen] = useState<boolean>(false);

  const [fundActionModal, setFundActionModal] = useState<{
    isOpen: boolean;
    transaction: FundTransaction | null;
    actionType: 'approve' | 'reject';
  }>({ isOpen: false, transaction: null, actionType: 'approve' });

  const [squareOffModal, setSquareOffModal] = useState<{
    isOpen: boolean;
    position: Position | null;
  }>({ isOpen: false, position: null });

  const [reportPreviewModal, setReportPreviewModal] = useState<{
    isOpen: boolean;
    report: ReportItem | null;
    period?: string;
  }>({ isOpen: false, report: null });

  const [isSupportModalOpen, setIsSupportModalOpen] = useState<boolean>(false);

  // Toasts
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = `${Date.now()}-${Math.random()}`;
    const newToast: ToastItem = {
      id,
      type,
      message,
      time: new Date().toLocaleTimeString('en-GB'),
    };
    setToasts((prev) => [newToast, ...prev].slice(0, 5));

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const lastRefreshTimestampRef = useRef<number>(0);
  const triggerRefresh = useCallback((force: boolean = false) => {
    const now = Date.now();
    if (!force && now - lastRefreshTimestampRef.current < 500) return;
    lastRefreshTimestampRef.current = now;
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  // Fetch public White-Label Branding immediately on mount (works on Login screen before auth)
  useEffect(() => {
    api.getWhiteLabelConfig()
      .then(({ branding }) => {
        if (branding) {
          setTenantBranding((prev) => ({ ...(prev || {}), ...branding }));
          if (typeof document !== 'undefined' && branding.brandName) {
            document.title = `${branding.brandName} — Broker OS`;
          }
        }
      })
      .catch(() => {});
  }, []);

  // Fetch Authoritative Bootstrap Feed (User, Tenant, Instruments) on mount
  useEffect(() => {
    const token = getAuthToken();
    if (!token && !currentUser) {
      return;
    }

    api.getBootstrap()
      .then((data) => {
        if (data.settings) {
          setSettings(data.settings);
          if (data.settings.compactTableDensity !== undefined) {
            setIsCompactMode(Boolean(data.settings.compactTableDensity));
          }
        }
        if (data.user) {
          const finalName = (data.user.role === 'broker_admin' && data.settings?.displayName) ? data.settings.displayName : data.user.name;
          const userWithUpdatedName = { ...data.user, name: finalName };
          setCurrentUser(userWithUpdatedName);
          if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.setItem('nextrade_auth_user', JSON.stringify(userWithUpdatedName));
          }
        }
        if (data.tenant) setTenantBranding(data.tenant);
        if (Array.isArray(data.instruments) && data.instruments.length > 0) {
          const ticksMap: Record<string, Partial<MarketInstrument>> = {};
          for (const inst of data.instruments) {
            ticksMap[inst.symbol] = {
              lastPrice: inst.lastPrice,
              change: inst.change,
              changePercent: inst.changePercent,
              bid: inst.bid,
              ask: inst.ask,
              high: inst.high,
              low: inst.low,
            };
          }
          setLatestTicks((prev) => ({ ...prev, ...ticksMap }));
        }
      })
      .catch((err) => {
        console.warn('Initial bootstrap notice, falling back to getMe:', err.message);
        api.getMe()
          .then(({ user, tenant }) => {
            setCurrentUser(user);
            setTenantBranding(tenant);
            if (typeof window !== 'undefined' && window.localStorage) {
              localStorage.setItem('nextrade_auth_user', JSON.stringify(user));
            }
          })
          .catch((e) => {
            console.error('Failed to fetch user:', e);
            if (e.message && e.message.includes('Unauthorized')) {
              setCurrentUser(null);
              setAuthToken('');
            }
          });
      });
  }, []);

  // Direct login handler
  const login = async (identifier: string, password: string) => {
    const res = await api.login(identifier, password);
    setCurrentUser(res.user);
    if (res.tenant) setTenantBranding(res.tenant);
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('nextrade_auth_user', JSON.stringify(res.user));
    }
    showToast(`Welcome back, ${res.user.name}`, 'success');
    triggerRefresh();
    api.getBootstrap().then((data) => {
      if (data.tenant) setTenantBranding(data.tenant);
    }).catch(() => {});
    return res;
  };

  // Direct signup handler
  const register = async (formData: any) => {
    const res = await api.register(formData);
    setCurrentUser(res.user);
    if (res.tenant) setTenantBranding(res.tenant);
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('nextrade_auth_user', JSON.stringify(res.user));
    }
    showToast(`Account created! Welcome to NexTrade, ${res.user.name}`, 'success');
    triggerRefresh();
    api.getBootstrap().then((data) => {
      if (data.tenant) setTenantBranding(data.tenant);
    }).catch(() => {});
    return res;
  };

  // Logout handler
  const logout = async () => {
    try {
      await api.logout();
    } catch {}
    setCurrentUser(null);
    setLivePositionsMtm({});
    setLiveClientsMtm({});
    setAuthToken('');
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem('nextrade_auth_user');
      localStorage.removeItem('nextrade_auth_token');
      localStorage.removeItem('token');
      localStorage.removeItem('admin_token');
      localStorage.removeItem('broker_token');
    }
    showToast('Logged out of session', 'info');
  };

  // Switch role handler
  const switchRole = async (role?: string) => {
    try {
      const targetRole = role || (currentUser?.role === 'broker_admin' ? 'sub_broker' : (currentUser?.role === 'sub_broker' ? 'trader_client' : 'broker_admin'));
      const res = await api.switchRole(targetRole);
      if (res && res.user) {
        setCurrentUser(res.user);
        setLivePositionsMtm({});
        setLiveClientsMtm({});
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem('nextrade_auth_user', JSON.stringify(res.user));
        }
        triggerRefresh();
        api.getBootstrap().then((bData) => {
          if (bData.settings) setSettings(bData.settings);
        }).catch(() => {});
        const roleMsg = targetRole === 'trader_client'
          ? 'Switched active role to Trader Client (Aarav Mehta)'
          : targetRole === 'super_admin'
            ? 'Switched role to Central Super Admin'
            : targetRole === 'master' || targetRole === 'master_admin'
              ? 'Switched role to Master Admin (Vikramaditya)'
              : targetRole === 'sub_broker'
                ? 'Switched role to Sub-Broker'
                : `Switched active workspace role to ${res.user.roleTitle || 'Administrator'}`;
        showToast(roleMsg, 'info');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to switch role', 'error');
    }
  };

  const updateBranding = async (branding: Partial<TenantBranding>) => {
    try {
      const updated = await api.updateBranding(branding);
      setTenantBranding(updated);
      showToast('Central Admin branding propagated successfully', 'success');
    } catch (err: any) {
      showToast('Failed to update branding', 'error');
    }
  };

  // Keyboard shortcut for Command+K search palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setIsSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Batched tick buffer to eliminate React state thrashing under high-frequency market ticks
  const pendingTicksRef = useRef<Record<string, Partial<MarketInstrument>>>({});
  const tickFlushTimerRef = useRef<any>(null);

  const currentUserRef = useRef<AuthenticatedUser | null>(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const handleMtmBatch = useCallback((data: any) => {
    const isFullSnapshot = Array.isArray(data);
    const deltas = isFullSnapshot ? data : (Array.isArray(data?.deltas) ? data.deltas : []);
    const u = currentUserRef.current;
    const role = (u?.role || '').toLowerCase().replace(/[\s\-_/]+/g, '_');

    const matchesScope = (d: any) => {
      if (!u || !role || role === 'super_admin') return true;
      if (role === 'trader_client' || role === 'client') {
        const cId = u.clientId || u.client_id || u.id;
        return !d.clientId || d.clientId === cId;
      }
      if (role === 'sub_broker') {
        const sId = u.subBrokerId || u.sub_broker_id || u.id;
        return !d.subBrokerId || d.subBrokerId === sId || d.subBrokerId === 'SUB-BRK-001';
      }
      if (role === 'broker_admin' || role === 'operations' || role === 'staff_ops') {
        const bId = u.brokerId || u.broker_id;
        return !bId || !d.brokerId || d.brokerId === bId;
      }
      if (role === 'master' || role === 'master_admin') {
        const mId = u.masterId || u.master_id || u.id;
        return !mId || !d.masterId || d.masterId === mId || (u.brokerId && d.brokerId === u.brokerId);
      }
      return true;
    };

    if (isFullSnapshot) {
      const nextMap: Record<string, { ltp: number; unrealisedPnL: number; totalPnL: number }> = {};
      for (const d of deltas) {
        if (!matchesScope(d)) continue;
        const id = d.positionId || d.id;
        if (id && Number(d.netQty ?? 1) !== 0) {
          nextMap[String(id)] = {
            ltp: parseCleanNumber(d.ltp ?? d.currentPrice),
            unrealisedPnL: parseCleanNumber(d.unrealisedPnL ?? d.unrealizedPnl ?? d.pnl),
            totalPnL: parseCleanNumber(d.totalPnL ?? d.pnl),
          };
        }
      }
      setLivePositionsMtm(nextMap);
    } else if (deltas.length > 0) {
      const mtmMap: Record<string, { ltp: number; unrealisedPnL: number; totalPnL: number }> = {};
      for (const d of deltas) {
        if (!matchesScope(d)) continue;
        const id = d.positionId || d.id;
        if (id) {
          mtmMap[String(id)] = {
            ltp: parseCleanNumber(d.ltp ?? d.currentPrice),
            unrealisedPnL: parseCleanNumber(d.unrealisedPnL ?? d.unrealizedPnl ?? d.pnl),
            totalPnL: parseCleanNumber(d.totalPnL ?? d.pnl),
          };
        }
      }
      setLivePositionsMtm((prev) => ({ ...prev, ...mtmMap }));
    }
  }, []);

  const handleClientsMtm = useCallback((data: any) => {
    const list = Array.isArray(data) ? data : (Array.isArray(data?.clients) ? data.clients : []);
    if (list.length > 0) {
      const cMap: Record<string, { openPnL: number; marginAvailable: number; marginUsed: number }> = {};
      for (const c of list) {
        const id = c.id || c.clientId || c.clientCode;
        if (id) {
          cMap[String(id)] = {
            openPnL: parseCleanNumber(c.openPnL ?? c.todays_pl ?? c.pnl),
            marginAvailable: parseCleanNumber(c.marginAvailable ?? c.available_margin ?? c.equity),
            marginUsed: parseCleanNumber(c.marginUsed ?? c.margin),
          };
        }
      }
      setLiveClientsMtm((prev) => ({ ...prev, ...cMap }));
    }
  }, []);

  const queueTickUpdates = useCallback((rawTicks: any[]) => {
    if (!rawTicks || rawTicks.length === 0) return;
    const ltpBatch: Record<string, number> = {};
    for (const t of rawTicks) {
      if (t && t.symbol) {
        const lastPrice = parseCleanNumber(t.lastPrice ?? t.price ?? t.ltp ?? 0);
        const change = parseCleanNumber(t.change ?? 0);
        const changePercent = parseCleanNumber(t.changePercent ?? 0);
        const bid = parseCleanNumber(t.bid ?? (lastPrice > 0 ? +(lastPrice - 0.5).toFixed(2) : 0));
        const ask = parseCleanNumber(t.ask ?? (lastPrice > 0 ? +(lastPrice + 0.5).toFixed(2) : 0));
        const high = parseCleanNumber(t.highPrice ?? t.high ?? lastPrice);
        const low = parseCleanNumber(t.lowPrice ?? t.low ?? lastPrice);
        const tickObj = {
          lastPrice,
          change,
          changePercent,
          bid,
          ask,
          high,
          low,
        };
        const sym = String(t.symbol);
        pendingTicksRef.current[sym] = tickObj;
        pendingTicksRef.current[sym.toUpperCase()] = tickObj;
        pendingTicksRef.current[sym.toUpperCase().replace(/[\s_\-/]/g, '')] = tickObj;
        if (lastPrice > 0) {
          ltpBatch[sym] = lastPrice;
          ltpBatch[sym.toUpperCase()] = lastPrice;
          ltpBatch[sym.toUpperCase().replace(/[\s_\-/]/g, '')] = lastPrice;
        }
      }
    }

    if (Object.keys(ltpBatch).length > 0) {
      updateLivePrices(ltpBatch);
      setMarketWatchLtpMap((prev) => ({ ...prev, ...ltpBatch }));
    }

    if (!tickFlushTimerRef.current) {
      tickFlushTimerRef.current = setTimeout(() => {
        tickFlushTimerRef.current = null;
        const batch = pendingTicksRef.current;
        pendingTicksRef.current = {};
        if (Object.keys(batch).length > 0) {
          setLatestTicks((prev) => ({ ...prev, ...batch }));
          setLastTickTimestamp('Live streaming');
          setIsLiveMode(true);
        }
      }, 80); // 80ms throttle delivers smooth 60fps UI updates without rendering freezes
    }
  }, []);

  // Real-time EventSource connection with auto-reconnect & exponential backoff
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimer: any = null;
    let reconnectAttempts = 0;
    let isDisposed = false;

    function connectSSE() {
      if (isDisposed) return;
      try {
        const token = getAuthToken();
        const ssePath = token ? `/api/realtime/stream?token=${encodeURIComponent(token)}` : '/api/realtime/stream';
        eventSource = new EventSource(resolveApiUrl(ssePath));

        eventSource.addEventListener('connected', () => {
          if (reconnectAttempts > 0) {
            triggerRefresh(false);
          }
          reconnectAttempts = 0;
          setIsRealtimeConnected(true);
          setIsLiveMode(true);
        });

        eventSource.addEventListener('upstream_reconnected', () => {
          setIsRealtimeConnected(true);
          triggerRefresh(false);
        });

        eventSource.addEventListener('ping', () => {
          setIsRealtimeConnected(true);
          setIsLiveMode(true);
        });

        eventSource.addEventListener('tick', (e: MessageEvent) => {
          try {
            const t = JSON.parse(e.data);
            if (t && t.symbol) {
              queueTickUpdates([t]);
            }
          } catch {}
        });

        eventSource.addEventListener('market_tick', (e: MessageEvent) => {
          try {
            const parsed = JSON.parse(e.data);
            const rawTicks = Array.isArray(parsed.ticks) ? parsed.ticks : (Array.isArray(parsed) ? parsed : []);
            if (rawTicks.length > 0) {
              queueTickUpdates(rawTicks);
            }
          } catch {}
        });

        eventSource.addEventListener('client_created', () => {
          triggerRefresh(false);
        });

        eventSource.addEventListener('client.registered', () => {
          triggerRefresh(false);
        });

        eventSource.addEventListener('broker.added', () => {
          triggerRefresh(false);
        });

        eventSource.addEventListener('clients_updated', () => {
          triggerRefresh(false);
        });

        eventSource.addEventListener('client_updated', () => {
          triggerRefresh(false);
        });

        eventSource.addEventListener('trade_executed', () => {
          triggerRefresh(false);
        });

        eventSource.addEventListener('trade.executed', () => {
          triggerRefresh(false);
        });

        eventSource.addEventListener('fund_created', () => {
          triggerRefresh(false);
        });

        eventSource.addEventListener('fund_updated', () => {
          triggerRefresh(false);
        });

        eventSource.addEventListener('fund.transaction_updated', () => {
          triggerRefresh(false);
        });

        eventSource.addEventListener('risk.alert_triggered', () => {
          triggerRefresh(false);
        });

        eventSource.addEventListener('order_placed', (e) => {
          try {
            const order = JSON.parse(e.data);
            showToast(`Order ${order.id}: ${order.side} ${order.quantity} ${order.instrument} ${order.status}`, order.status === 'Executed' ? 'success' : 'info');
            triggerRefresh(false);
          } catch {}
        });

        eventSource.addEventListener('order_update', () => {
          triggerRefresh(false);
        });

        eventSource.addEventListener('position_update', () => {
          triggerRefresh(false);
        });

        eventSource.addEventListener('position.updated', () => {
          triggerRefresh(false);
        });

        eventSource.addEventListener('portfolio.mtm', () => {
          triggerRefresh(false);
        });

        eventSource.addEventListener('positions.live_mtm', (e: MessageEvent) => {
          try {
            const parsed = JSON.parse(e.data);
            handleMtmBatch(parsed.data || parsed.payload || parsed);
          } catch {}
        });

        eventSource.addEventListener('positions.mtm_batch', (e: MessageEvent) => {
          try {
            const parsed = JSON.parse(e.data);
            handleMtmBatch(parsed.data || parsed.payload || parsed);
          } catch {}
        });

        eventSource.addEventListener('clients.live_mtm', (e: MessageEvent) => {
          try {
            const parsed = JSON.parse(e.data);
            handleClientsMtm(parsed.data || parsed.payload || parsed);
          } catch {}
        });

        const handleTickEvent = (e: MessageEvent) => {
          try {
            const parsed = JSON.parse(e.data);
            const rawTicks = Array.isArray(parsed.ticks)
              ? parsed.ticks
              : Array.isArray(parsed)
              ? parsed
              : [parsed.data || parsed.payload || parsed];
            if (rawTicks.length > 0) {
              queueTickUpdates(rawTicks);
            }
          } catch {}
        };

        eventSource.addEventListener('market.ticks', handleTickEvent);
        eventSource.addEventListener('market_tick', handleTickEvent);
        eventSource.addEventListener('market_ticks', handleTickEvent);
        eventSource.addEventListener('tick', handleTickEvent);
        eventSource.addEventListener('price.update', handleTickEvent);
        eventSource.addEventListener('price_update', handleTickEvent);
        eventSource.addEventListener('price_tick', handleTickEvent);

        eventSource.addEventListener('order.created', () => {
          triggerRefresh(false);
        });

        eventSource.addEventListener('fund.updated', () => {
          triggerRefresh(false);
        });

        eventSource.addEventListener('ledger.updated', () => {
          triggerRefresh(false);
        });

        eventSource.addEventListener('ledger_update', () => {
          triggerRefresh(false);
        });

        eventSource.addEventListener('wallet_update', () => {
          triggerRefresh(false);
        });

        eventSource.addEventListener('order_cancelled', (e) => {
          try {
            const order = JSON.parse(e.data);
            showToast(`Order ${order.id} cancelled`, 'info');
            triggerRefresh(false);
          } catch {}
        });

        eventSource.addEventListener('fund_approved', (e) => {
          try {
            const txn = JSON.parse(e.data);
            showToast(`Funds Approved: ₹${txn.amount.toLocaleString('en-IN')} for ${txn.clientName}`, 'success');
            triggerRefresh(false);
          } catch {}
        });

        eventSource.addEventListener('fund_rejected', (e) => {
          try {
            const txn = JSON.parse(e.data);
            showToast(`Funds Rejected: ${txn.id} (${txn.clientName})`, 'error');
            triggerRefresh(false);
          } catch {}
        });

        eventSource.addEventListener('position_squared_off', () => {
          triggerRefresh(false);
        });

        eventSource.addEventListener('emergency_alert', (e: MessageEvent) => {
          try {
            const alert = JSON.parse(e.data);
            showToast(`Emergency Broadcast: ${alert.reason || 'Trading status update'}`, 'error');
            triggerRefresh(false);
          } catch {}
        });

        eventSource.addEventListener('branding_update', (e: MessageEvent) => {
          try {
            const branding = JSON.parse(e.data);
            if (branding) setTenantBranding((prev) => ({ ...(prev || {}), ...branding }));
          } catch {}
        });

        eventSource.addEventListener('branding_updated', (e: MessageEvent) => {
          try {
            const branding = JSON.parse(e.data);
            if (branding) setTenantBranding((prev) => ({ ...(prev || {}), ...branding }));
          } catch {}
        });

        eventSource.onerror = () => {
          if (!isWsConnectedRef.current && Date.now() - lastSyncTimestampRef.current > 10000) {
            setIsRealtimeConnected(false);
          }
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          if (!isDisposed) {
            clearTimeout(reconnectTimer);
            const delay = Math.min(1000 * Math.pow(1.5, reconnectAttempts) + Math.random() * 400, 10000);
            reconnectAttempts++;
            reconnectTimer = setTimeout(connectSSE, delay);
          }
        };
      } catch {
        if (!isWsConnectedRef.current && Date.now() - lastSyncTimestampRef.current > 10000) {
          setIsRealtimeConnected(false);
        }
        if (!isDisposed) {
          clearTimeout(reconnectTimer);
          const delay = Math.min(1000 * Math.pow(1.5, reconnectAttempts) + Math.random() * 400, 10000);
          reconnectAttempts++;
          reconnectTimer = setTimeout(connectSSE, delay);
        }
      }
    }

    connectSSE();

    let ws: WebSocket | null = null;
    let wsReconnectTimer: any = null;
    let wsReconnectAttempts = 0;

    function getWebSocketUrl(): string {
      const token = getAuthToken();
      const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
      if (API_BASE && /^https?:\/\//i.test(API_BASE)) {
        const url = new URL(API_BASE);
        const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${protocol}//${url.host}/ws${tokenParam}`;
      }
      if (typeof window !== 'undefined' && window.location) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${protocol}//${window.location.host}/ws${tokenParam}`;
      }
      return 'ws://localhost:4000/ws';
    }

    function connectWS() {
      if (isDisposed) return;
      try {
        const wsUrl = getWebSocketUrl();
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          isWsConnectedRef.current = true;
          lastSyncTimestampRef.current = Date.now();
          setIsRealtimeConnected(true);
          if (wsReconnectAttempts > 0) {
            triggerRefresh(false);
          }
          wsReconnectAttempts = 0;
        };

        ws.onmessage = (event) => {
          isWsConnectedRef.current = true;
          lastSyncTimestampRef.current = Date.now();
          setIsRealtimeConnected(true);
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'heartbeat') {
              try { ws?.send(JSON.stringify({ type: 'pong' })); } catch {}
              return;
            }
            const evtType = msg.eventType || msg.type || msg.event || '';
            if (
              evtType === 'tick' ||
              evtType === 'market.ticks' ||
              evtType === 'market_tick' ||
              evtType === 'price.update' ||
              evtType === 'price_update' ||
              evtType === 'price_tick'
            ) {
              const ticks = Array.isArray(msg.data?.ticks)
                ? msg.data.ticks
                : Array.isArray(msg.data)
                ? msg.data
                : msg.data
                ? [msg.data]
                : Array.isArray(msg.payload?.ticks)
                ? msg.payload.ticks
                : Array.isArray(msg.payload)
                ? msg.payload
                : [msg.payload || msg];
              queueTickUpdates(ticks);
            } else if (
              evtType === 'positions.live_mtm' ||
              evtType === 'positions.mtm_batch'
            ) {
              handleMtmBatch(Array.isArray(msg.payload) ? msg.payload : (msg.data || msg.payload || msg));
            } else if (evtType === 'clients.live_mtm') {
              handleClientsMtm(Array.isArray(msg.payload) ? msg.payload : (msg.data || msg.payload || msg));
            } else if (
              evtType === 'position.updated' ||
              evtType === 'position_update' ||
              evtType === 'position_squared_off' ||
              evtType === 'portfolio.mtm' ||
              evtType === 'order.created' ||
              evtType === 'order_placed' ||
              evtType === 'order_update' ||
              evtType === 'trade.executed' ||
              evtType === 'trade_executed' ||
              evtType === 'client.registered' ||
              evtType === 'client.created' ||
              evtType === 'client_created' ||
              evtType === 'clients_updated' ||
              evtType === 'client_updated' ||
              evtType === 'broker.added' ||
              evtType === 'fund.transaction_updated' ||
              evtType === 'fund.updated' ||
              evtType === 'fund_updated' ||
              evtType === 'fund_created' ||
              evtType === 'fund_approved' ||
              evtType === 'fund_rejected' ||
              evtType === 'ledger.updated' ||
              evtType === 'ledger_update' ||
              evtType === 'wallet.updated' ||
              evtType === 'wallet_update' ||
              evtType === 'risk.alert_triggered' ||
              evtType === 'risk.margin_breach'
            ) {
              triggerRefresh(false);
            } else if (evtType === 'branding_updated' || evtType === 'branding_update') {
              const branding = msg.data || msg.payload;
              if (branding && typeof branding === 'object') {
                setTenantBranding((prev) => ({ ...(prev || {}), ...branding }));
              }
            } else if (evtType === 'connected') {
              setIsRealtimeConnected(true);
            }
          } catch {}
        };

        ws.onerror = () => {
          // Handled via onclose
        };

        ws.onclose = () => {
          isWsConnectedRef.current = false;
          if (Date.now() - lastSyncTimestampRef.current > 10000) {
            setIsRealtimeConnected(false);
          }
          if (ws) {
            try { ws.close(); } catch {}
            ws = null;
          }
          if (!isDisposed) {
            clearTimeout(wsReconnectTimer);
            const delay = Math.min(1000 * Math.pow(1.5, wsReconnectAttempts) + Math.random() * 400, 15000);
            wsReconnectAttempts++;
            wsReconnectTimer = setTimeout(connectWS, delay);
          }
        };
      } catch {
        if (!isDisposed) {
          clearTimeout(wsReconnectTimer);
          const delay = Math.min(1000 * Math.pow(1.5, wsReconnectAttempts) + Math.random() * 400, 15000);
          wsReconnectAttempts++;
          wsReconnectTimer = setTimeout(connectWS, delay);
        }
      }
    }

    connectWS();

    return () => {
      isDisposed = true;
      clearTimeout(reconnectTimer);
      clearTimeout(wsReconnectTimer);
      clearTimeout(tickFlushTimerRef.current);
      eventSource?.close();
      if (ws) {
        try { ws.close(); } catch {}
        ws = null;
      }
    };
  }, [showToast, triggerRefresh, currentUser, queueTickUpdates]);

  // High-frequency silent background polling with live connectivity health check:
  // Set to 2500ms (2.5 seconds) so active positions, orders, funds, and ledger reflect immediately
  useEffect(() => {
    const pollInterval = 2500;
    const poll = setInterval(async () => {
      triggerRefresh(false);
      try {
        const res = await fetch(`${API_BASE}/api/health`, { method: 'GET' });
        if (res.ok) {
          lastSyncTimestampRef.current = Date.now();
          setIsRealtimeConnected(true);
        } else if (!isWsConnectedRef.current && Date.now() - lastSyncTimestampRef.current > 10000) {
          setIsRealtimeConnected(false);
        }
      } catch {
        if (!isWsConnectedRef.current && Date.now() - lastSyncTimestampRef.current > 10000) {
          setIsRealtimeConnected(false);
        }
      }
    }, pollInterval);
    return () => clearInterval(poll);
  }, [triggerRefresh]);

  // Memoized modal actions
  const openOrderModal = useCallback((instrument?: MarketInstrument | null, side: 'BUY' | 'SELL' = 'BUY', existingOrder?: Order | null) => {
    setOrderModalState({
      isOpen: true,
      instrument: instrument || null,
      defaultSide: side,
      existingOrder: existingOrder || null,
    });
  }, []);

  const closeOrderModal = useCallback(() => {
    setOrderModalState({ isOpen: false });
  }, []);

  const openClientDetail = useCallback((client: Client, initialTab?: 'overview' | 'positions' | 'orders' | 'ledger' | 'kyc') => {
    setSelectedClientForDetail(client);
    setClientDetailInitialTab(initialTab || 'overview');
  }, []);

  const closeClientDetail = useCallback(() => {
    setSelectedClientForDetail(null);
    setClientDetailInitialTab('overview');
  }, []);

  const openFundActionModal = useCallback((transaction: FundTransaction, actionType: 'approve' | 'reject') => {
    setFundActionModal({ isOpen: true, transaction, actionType });
  }, []);

  const closeFundActionModal = useCallback(() => {
    setFundActionModal({ isOpen: false, transaction: null, actionType: 'approve' });
  }, []);

  const openSquareOffModal = useCallback((position: Position) => {
    setSquareOffModal({ isOpen: true, position });
  }, []);

  const closeSquareOffModal = useCallback(() => {
    setSquareOffModal({ isOpen: false, position: null });
  }, []);

  const openReportPreview = useCallback((report: ReportItem, period?: string) => {
    setReportPreviewModal({ isOpen: true, report, period });
  }, []);

  const closeReportPreview = useCallback(() => {
    setReportPreviewModal({ isOpen: false, report: null });
  }, []);

  const contextValue = useMemo(() => ({
    activeTab,
    setActiveTab: handleSetActiveTab,
    currentUser,
    isAuthenticated,
    login,
    register,
    logout,
    switchRole,
    tenantBranding,
    updateBranding,
    settings,
    updateUserSettings,
    ordersFilter,
    setOrdersFilter,
    fundsFilter,
    setFundsFilter,
    positionsFilter,
    setPositionsFilter,
    isLiveMode,
    setIsLiveMode,
    isCompactMode,
    setIsCompactMode,
    refreshTrigger,
    triggerRefresh,
    isRealtimeConnected,
    lastTickTimestamp,
    latestTicks,
    marketWatchLtpMap,
    livePositionsMtm,
    liveClientsMtm,
    isSearchOpen,
    setIsSearchOpen,
    globalSearchQuery,
    setGlobalSearchQuery,
    isNotificationsOpen,
    setIsNotificationsOpen,
    unreadNotificationsCount,
    isMobileMenuOpen,
    setIsMobileMenuOpen,
    orderModalState,
    openOrderModal,
    closeOrderModal,
    selectedClientForDetail,
    clientDetailInitialTab,
    openClientDetail,
    closeClientDetail,
    isAddClientOpen,
    setIsAddClientOpen,
    fundActionModal,
    openFundActionModal,
    closeFundActionModal,
    squareOffModal,
    openSquareOffModal,
    closeSquareOffModal,
    reportPreviewModal,
    openReportPreview,
    closeReportPreview,
    isSupportModalOpen,
    setIsSupportModalOpen,
    toasts,
    showToast,
    removeToast,
  }), [
    activeTab,
    handleSetActiveTab,
    currentUser,
    isAuthenticated,
    tenantBranding,
    settings,
    ordersFilter,
    fundsFilter,
    positionsFilter,
    isLiveMode,
    isCompactMode,
    refreshTrigger,
    triggerRefresh,
    isRealtimeConnected,
    lastTickTimestamp,
    latestTicks,
    marketWatchLtpMap,
    livePositionsMtm,
    liveClientsMtm,
    isSearchOpen,
    globalSearchQuery,
    isNotificationsOpen,
    unreadNotificationsCount,
    isMobileMenuOpen,
    orderModalState,
    openOrderModal,
    closeOrderModal,
    selectedClientForDetail,
    clientDetailInitialTab,
    openClientDetail,
    closeClientDetail,
    isAddClientOpen,
    fundActionModal,
    openFundActionModal,
    closeFundActionModal,
    squareOffModal,
    openSquareOffModal,
    closeSquareOffModal,
    reportPreviewModal,
    openReportPreview,
    closeReportPreview,
    isSupportModalOpen,
    toasts,
    showToast,
    removeToast,
    login,
    register,
    logout,
    switchRole,
    updateBranding,
    updateUserSettings,
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
