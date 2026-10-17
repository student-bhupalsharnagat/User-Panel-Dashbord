/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'broker_admin' | 'super_admin' | 'sub_broker' | 'master' | 'trader_client' | 'operations';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roleTitle: string;
  brokerId: string;
  tenantId: string;
  organization: string;
  phone: string;
  timezone: string;
  currency: string;
  avatar: string;
}

export interface MetricSummary {
  totalClients: number;
  totalClientsChangePct: number;
  activeClients: number;
  activeClientsRatio: number;
  ledgerBalanceCr: number;
  ledgerBalanceNetWeekL: number;
  openPnLL: number;
  openPnLDayChangePct: number;
  inactiveClients: number;
  newToday: number;
  marginUsedCr: number;
  marginAvailableCr: number;
  todaysOrders: number;
  pendingDeposits: number;
  pendingWithdrawals: number;
  clientTurnoverCr: number;
  commissionL: number;
  realisedPnL: number;
  unrealisedPnL: number;
  totalPnLFormatted: string;
}

export interface TurnoverTrendPoint {
  date: string;
  turnoverCr: number;
  volume: number;
}

export interface AccountActivityBar {
  day: string;
  depositsCr: number;
  withdrawalsCr: number;
}

export interface OperationsQueueItem {
  id: string;
  title: string;
  count: number;
  statusType: 'deposit' | 'withdrawal' | 'kyc' | 'orders';
  color: string;
}

export interface MarketInstrument {
  symbol: string;
  name: string;
  exchange: 'NSE' | 'BSE' | 'NFO' | 'MCX';
  lastPrice: number;
  change: number;
  changePercent: number;
  bid: number;
  ask: number;
  volume: string;
  high: number;
  low: number;
  type: 'Equity' | 'Futures' | 'Index' | 'Options';
  contractExpiry?: string;
  lotSize: number;
  tickSize: number;
  status: 'Enabled' | 'Disabled' | 'Halted';
  lastUpdated?: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  pan: string;
  status: 'Active' | 'Inactive' | 'Suspended';
  isDemo: boolean;
  ledgerBalance: number;
  openPnL: number;
  peakLedger: number;
  marginUsed: number;
  income: number;
  marginAvailable: number;
  brokerId: string;
  brokerName: string;
  kycStatus: 'Verified' | 'Pending' | 'Rejected';
  kycDocuments: string[];
  createdDate: string;
  lastActive: string;
  riskLimit: number;
}

export interface Order {
  id: string;
  clientId: string;
  clientName: string;
  instrument: string;
  exchange: string;
  side: 'BUY' | 'SELL';
  type: 'LIMIT' | 'MARKET' | 'SL-M';
  quantity: number;
  orderPrice: number | 'Market';
  executedQty: number;
  avgPrice: number;
  status: 'Executed' | 'Open' | 'Pending' | 'Rejected' | 'Cancelled';
  created: string;
  brokerId: string;
  rejectionReason?: string;
}

export interface Position {
  id: string;
  clientId: string;
  clientName: string;
  instrument: string;
  exchange: string;
  product: 'MIS' | 'NRML' | 'CNC';
  buyQty: number;
  sellQty: number;
  netQty: number;
  avgPrice: number;
  currentPrice: number;
  realisedPnL: number;
  unrealisedPnL: number;
  totalPnL: number;
  marginUsed: number;
  brokerId: string;
}

export interface FundTransaction {
  id: string;
  clientId: string;
  clientName: string;
  type: 'Deposit' | 'Withdrawal';
  amount: number;
  method: 'Bank transfer' | 'UPI' | 'Net banking';
  requestDate: string;
  referenceId: string;
  status: 'Pending' | 'Approved' | 'Completed' | 'Rejected';
  verification: string;
  proofDocument?: string;
  approvedBy?: string;
  rejectionReason?: string;
  brokerId: string;
}

export interface LedgerEntry {
  id: string;
  date: string;
  referenceId: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
  status: 'Completed' | 'Pending';
  type: 'Brokerage' | 'Deposit' | 'Withdrawal' | 'Margin Funding' | 'Trade Settlement';
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  role: string;
  action: string;
  relatedEntity: string;
  ipAddress: string;
  result: 'Success' | 'Warning' | 'Failed';
  details: string;
}

export interface ReportItem {
  id: string;
  title: string;
  description: string;
  type: 'clients' | 'ledger' | 'orders' | 'positions' | 'funds' | 'turnover' | 'brokerage' | 'statements';
  recordCount: number;
  category: string;
}

export interface AnalyticsData {
  monthlyTurnoverCr: number;
  turnoverChangePct: number;
  commissionEarnedL: number;
  commissionChangePct: number;
  orderExecutionRate: number;
  executionImprovementPct: number;
  netPnLL: number;
  netPnLChangePct: number;
  turnoverTrend: Array<{ day: string; volumeCr: number }>;
  commissionEarnings: Array<{ day: string; netL: number }>;
  activeCount: number;
  inactiveCount: number;
  orderBreakdown: {
    executed: number;
    open: number;
    rejected: number;
    cancelled: number;
  };
  instrumentShares: Array<{ symbol: string; sharePercent: number }>;
}

export interface SettingsState {
  profileImage: string;
  displayName: string;
  organization: string;
  email: string;
  phone: string;
  timezone: string;
  currency: string;
  activityAlerts: boolean;
  compactTableDensity: boolean;
  twoFactorAuth: boolean;
  emailNotifications: boolean;
  marginCallAlerts: boolean;
}

export interface TenantBranding {
  brandName: string;
  platformName: string;
  shortName: string;
  tagline: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  supportEmail: string;
  supportPhone: string;
  footerCopyright: string;
  version: string;
  updatedAt: string;
}

export type NavigationTab = 
  | 'dashboard'
  | 'market_watch'
  | 'clients'
  | 'client_details'
  | 'orders'
  | 'positions'
  | 'funds'
  | 'account_ledger'
  | 'analytics'
  | 'action_logs'
  | 'reports'
  | 'instruments'
  | 'settings';
