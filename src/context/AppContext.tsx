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
import { api, getAuthToken, setAuthToken, resolveApiUrl } from '../services/api';

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
  triggerRefresh: () => void;
  isRealtimeConnected: boolean;
  lastTickTimestamp: string;
  latestTicks: Record<string, Partial<MarketInstrument>>;

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
  openClientDetail: (client: Client) => void;
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

  const queueTickUpdates = useCallback((rawTicks: any[]) => {
    if (!rawTicks || rawTicks.length === 0) return;
    for (const t of rawTicks) {
      if (t && t.symbol) {
        pendingTicksRef.current[t.symbol] = {
          lastPrice: Number(t.lastPrice ?? t.price ?? 0),
          change: Number(t.change ?? 0),
          changePercent: Number(t.changePercent ?? 0),
          bid: Number(t.bid ?? 0),
          ask: Number(t.ask ?? 0),
          high: Number(t.highPrice ?? t.high ?? 0),
          low: Number(t.lowPrice ?? t.low ?? 0),
        };
      }
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
          reconnectAttempts = 0;
          setIsRealtimeConnected(true);
          setIsLiveMode(true);
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

        eventSource.addEventListener('clients_updated', () => {
          triggerRefresh(false);
        });

        eventSource.addEventListener('client_updated', () => {
          triggerRefresh(false);
        });

        eventSource.addEventListener('trade_executed', () => {
          triggerRefresh(false);
        });

        eventSource.addEventListener('fund_created', () => {
          triggerRefresh(false);
        });

        eventSource.addEventListener('fund_updated', () => {
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
          setIsRealtimeConnected(false);
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
        setIsRealtimeConnected(false);
        if (!isDisposed) {
          clearTimeout(reconnectTimer);
          const delay = Math.min(1000 * Math.pow(1.5, reconnectAttempts) + Math.random() * 400, 10000);
          reconnectAttempts++;
          reconnectTimer = setTimeout(connectSSE, delay);
        }
      }
    }

    connectSSE();

    return () => {
      isDisposed = true;
      clearTimeout(reconnectTimer);
      clearTimeout(tickFlushTimerRef.current);
      eventSource?.close();
    };
  }, [showToast, triggerRefresh, currentUser, queueTickUpdates]);

  // Adaptive real-time polling:
  // When live push stream is active, relax polling to 30s to prevent query congestion.
  // When disconnected or recovering, fallback to 10s polling.
  useEffect(() => {
    const pollInterval = isRealtimeConnected ? 30000 : 10000;
    const poll = setInterval(() => {
      triggerRefresh(false);
    }, pollInterval);
    return () => clearInterval(poll);
  }, [isRealtimeConnected, triggerRefresh]);

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

  const openClientDetail = useCallback((client: Client) => {
    setSelectedClientForDetail(client);
  }, []);

  const closeClientDetail = useCallback(() => {
    setSelectedClientForDetail(null);
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
    isSearchOpen,
    globalSearchQuery,
    isNotificationsOpen,
    unreadNotificationsCount,
    isMobileMenuOpen,
    orderModalState,
    openOrderModal,
    closeOrderModal,
    selectedClientForDetail,
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
