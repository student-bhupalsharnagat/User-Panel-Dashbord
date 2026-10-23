/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
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

  const updateUserSettings = useCallback((newSettings: Partial<SettingsState>) => {
    setSettings((prev) => (prev ? { ...prev, ...newSettings } : (newSettings as SettingsState)));
    if (newSettings.displayName) {
      setCurrentUser((prev) => {
        if (!prev) return prev;
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
  const triggerRefresh = useCallback(() => {
    const now = Date.now();
    if (now - lastRefreshTimestampRef.current < 1500) return;
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
        if (data.user) {
          setCurrentUser(data.user);
          if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.setItem('nextrade_auth_user', JSON.stringify(data.user));
          }
        }
        if (data.tenant) setTenantBranding(data.tenant);
        if (data.settings) {
          setSettings(data.settings);
          if (data.settings.compactTableDensity !== undefined) {
            setIsCompactMode(Boolean(data.settings.compactTableDensity));
          }
          if (data.settings.displayName && data.user) {
            data.user.name = data.settings.displayName;
          }
        }
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
      const targetRole = role || (currentUser?.role === 'broker_admin' ? 'super_admin' : 'broker_admin');
      const res = await api.switchRole(targetRole);
      if (res && res.user) {
        setCurrentUser(res.user);
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem('nextrade_auth_user', JSON.stringify(res.user));
        }
        triggerRefresh();
        const roleMsg = targetRole === 'trader_client'
          ? 'Switched active role to Trader Client (Aarav Mehta)'
          : targetRole === 'super_admin'
            ? 'Switched role to Central Super Admin'
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

  // Real-time EventSource connection
  useEffect(() => {
    let eventSource: EventSource | null = null;
    try {
      const token = getAuthToken();
      const ssePath = token ? `/api/realtime/stream?token=${encodeURIComponent(token)}` : '/api/realtime/stream';
      eventSource = new EventSource(resolveApiUrl(ssePath));
      
      eventSource.addEventListener('connected', () => {
        setIsRealtimeConnected(true);
        setIsLiveMode(true);
      });

      eventSource.addEventListener('tick', (e: MessageEvent) => {
        try {
          const t = JSON.parse(e.data);
          if (t && t.symbol) {
            setLatestTicks((prev) => ({
              ...prev,
              [t.symbol]: {
                lastPrice: Number(t.lastPrice ?? t.price ?? 0),
                change: Number(t.change ?? 0),
                changePercent: Number(t.changePercent ?? 0),
                bid: Number(t.bid ?? 0),
                ask: Number(t.ask ?? 0),
                high: Number(t.highPrice ?? t.high ?? 0),
                low: Number(t.lowPrice ?? t.low ?? 0),
              },
            }));
          }
        } catch {}
        setLastTickTimestamp('Live streaming');
        setIsLiveMode(true);
      });

      eventSource.addEventListener('market_tick', (e: MessageEvent) => {
        try {
          const parsed = JSON.parse(e.data);
          const rawTicks = Array.isArray(parsed.ticks) ? parsed.ticks : (Array.isArray(parsed) ? parsed : []);
          if (rawTicks.length > 0) {
            setLatestTicks((prev) => {
              const next = { ...prev };
              for (const t of rawTicks) {
                if (t.symbol) {
                  next[t.symbol] = {
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
              return next;
            });
          }
        } catch {}
        setLastTickTimestamp('Live streaming');
        setIsLiveMode(true);
      });

      eventSource.addEventListener('client_created', () => {
        triggerRefresh();
      });

      eventSource.addEventListener('clients_updated', () => {
        triggerRefresh();
      });

      eventSource.addEventListener('client_updated', () => {
        triggerRefresh();
      });

      eventSource.addEventListener('trade_executed', () => {
        triggerRefresh();
      });

      eventSource.addEventListener('fund_created', () => {
        triggerRefresh();
      });

      eventSource.addEventListener('fund_updated', () => {
        triggerRefresh();
      });

      eventSource.addEventListener('order_placed', (e) => {
        try {
          const order = JSON.parse(e.data);
          showToast(`Order ${order.id}: ${order.side} ${order.quantity} ${order.instrument} ${order.status}`, order.status === 'Executed' ? 'success' : 'info');
          triggerRefresh();
        } catch {}
      });

      eventSource.addEventListener('order_update', () => {
        triggerRefresh();
      });

      eventSource.addEventListener('position_update', () => {
        triggerRefresh();
      });

      eventSource.addEventListener('wallet_update', () => {
        triggerRefresh();
      });

      eventSource.addEventListener('order_cancelled', (e) => {
        try {
          const order = JSON.parse(e.data);
          showToast(`Order ${order.id} cancelled`, 'info');
          triggerRefresh();
        } catch {}
      });

      eventSource.addEventListener('fund_approved', (e) => {
        try {
          const txn = JSON.parse(e.data);
          showToast(`Funds Approved: ₹${txn.amount.toLocaleString('en-IN')} for ${txn.clientName}`, 'success');
          triggerRefresh();
        } catch {}
      });

      eventSource.addEventListener('fund_rejected', (e) => {
        try {
          const txn = JSON.parse(e.data);
          showToast(`Funds Rejected: ${txn.id} (${txn.clientName})`, 'error');
          triggerRefresh();
        } catch {}
      });

      eventSource.addEventListener('position_squared_off', () => {
        triggerRefresh();
      });

      eventSource.addEventListener('emergency_alert', (e: MessageEvent) => {
        try {
          const alert = JSON.parse(e.data);
          showToast(`Emergency Broadcast: ${alert.reason || 'Trading status update'}`, 'error');
          triggerRefresh();
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
      };
    } catch {
      setIsRealtimeConnected(false);
    }

    return () => {
      eventSource?.close();
    };
  }, [showToast, triggerRefresh, currentUser]);

  // Continuous real-time authoritative polling: refreshes data every 5s
  // so any new user, deposit, position, or order on Trading Platform shows up immediately
  useEffect(() => {
    const poll = setInterval(() => {
      triggerRefresh();
    }, 5000);
    return () => clearInterval(poll);
  }, [triggerRefresh]);

  // Modal actions
  const openOrderModal = (instrument?: MarketInstrument | null, side: 'BUY' | 'SELL' = 'BUY', existingOrder?: Order | null) => {
    setOrderModalState({
      isOpen: true,
      instrument: instrument || null,
      defaultSide: side,
      existingOrder: existingOrder || null,
    });
  };

  const closeOrderModal = () => {
    setOrderModalState({ isOpen: false });
  };

  const openClientDetail = (client: Client) => {
    setSelectedClientForDetail(client);
  };

  const closeClientDetail = () => {
    setSelectedClientForDetail(null);
  };

  const openFundActionModal = (transaction: FundTransaction, actionType: 'approve' | 'reject') => {
    setFundActionModal({ isOpen: true, transaction, actionType });
  };

  const closeFundActionModal = () => {
    setFundActionModal({ isOpen: false, transaction: null, actionType: 'approve' });
  };

  const openSquareOffModal = (position: Position) => {
    setSquareOffModal({ isOpen: true, position });
  };

  const closeSquareOffModal = () => {
    setSquareOffModal({ isOpen: false, position: null });
  };

  const openReportPreview = (report: ReportItem, period?: string) => {
    setReportPreviewModal({ isOpen: true, report, period });
  };

  const closeReportPreview = () => {
    setReportPreviewModal({ isOpen: false, report: null });
  };

  return (
    <AppContext.Provider
      value={{
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
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
