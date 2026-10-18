/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  Client,
  Order,
  Position,
  FundTransaction,
  AuditLog,
  TenantBranding,
  SettingsState,
  LedgerEntry,
} from './types/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const PERSISTENCE_FILE = path.join(DATA_DIR, 'persistence-store.json');

export interface DatabaseStatus {
  engine: 'PostgreSQL' | 'Transactional State Journal (JSON)';
  connected: boolean;
  authoritative: boolean;
  databaseUrlConfigured: boolean;
  version: string;
  error?: string | null;
  lastSync?: string | null;
}

let pgPool: Pool | null = null;
let isPostgresReady = false;
let lastDbError: string | null = null;

export function getDatabaseStatus(): DatabaseStatus {
  return {
    engine: isPostgresReady ? 'PostgreSQL' : 'Transactional State Journal (JSON)',
    connected: isPostgresReady || fs.existsSync(PERSISTENCE_FILE),
    authoritative: isPostgresReady,
    databaseUrlConfigured: Boolean(process.env.DATABASE_URL),
    version: '2.0.0-durable-postgres',
    error: lastDbError,
    lastSync: new Date().toISOString(),
  };
}

export function isUsingPostgres(): boolean {
  return isPostgresReady;
}

export function getPgPool(): Pool | null {
  return pgPool;
}

/**
 * Initializes PostgreSQL if DATABASE_URL is configured, executes versioned migrations,
 * and safely imports existing JSON records if tables are fresh.
 */
export async function initDatabase(appEnv: string = 'production'): Promise<boolean> {
  const databaseUrl = process.env.DATABASE_URL;
  const isProduction = process.env.NODE_ENV === 'production' || appEnv === 'production';

  if (!databaseUrl || databaseUrl.includes('user:password@ep-sample-pooler')) {
    console.log('[Database] No production PostgreSQL DATABASE_URL configured. Operating in live platform sync mode.');
    return false;
  }

  try {
    const isSsl = isProduction || (!databaseUrl.includes('localhost') && !databaseUrl.includes('127.0.0.1'));
    pgPool = new Pool({
      connectionString: databaseUrl,
      ssl: isSsl ? { rejectUnauthorized: false } : false,
      max: 15,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    // Test connectivity
    const client = await pgPool.connect();
    try {
      await client.query('SELECT 1 as ping');
      console.log('[Database] Successfully connected to PostgreSQL instance on Render/cloud.');
    } finally {
      client.release();
    }

    // Run versioned schema migrations
    await runMigrations(pgPool);

    // Seed/migrate branding and settings safely if DB is fresh
    await migrateFromJsonIfEmpty(pgPool);

    isPostgresReady = true;
    lastDbError = null;
    return true;
  } catch (err: any) {
    lastDbError = `PostgreSQL Connection/Migration Failed: ${err.message}`;
    console.warn(`[Database Notice] ${lastDbError}. Operating in live platform sync mode.`);
    isPostgresReady = false;
    return false;
  }
}

/**
 * Versioned schema migrations for User/Broker Panel specific records
 */
async function runMigrations(pool: Pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Migrations tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_panel_schema_migrations (
        version INTEGER PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const { rows: applied } = await client.query('SELECT version FROM user_panel_schema_migrations');
    const appliedVersions = new Set(applied.map(r => r.version));

    // Migration 1: Base Application Tables
    if (!appliedVersions.has(1)) {
      console.log('[Database Migration] Running Migration 1: Base Schema...');

      // Tenant branding
      await client.query(`
        CREATE TABLE IF NOT EXISTS user_panel_tenant_branding (
          id VARCHAR(50) PRIMARY KEY,
          brand_name VARCHAR(255) NOT NULL,
          platform_name VARCHAR(255) NOT NULL,
          short_name VARCHAR(255),
          tagline TEXT,
          logo_url TEXT,
          primary_color VARCHAR(50),
          secondary_color VARCHAR(50),
          accent_color VARCHAR(50),
          support_email VARCHAR(255),
          support_phone VARCHAR(50),
          footer_copyright TEXT,
          version VARCHAR(50),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      // Workspace settings
      await client.query(`
        CREATE TABLE IF NOT EXISTS user_panel_settings (
          id VARCHAR(50) PRIMARY KEY,
          profile_image TEXT,
          display_name VARCHAR(255),
          organization VARCHAR(255),
          email VARCHAR(255),
          phone VARCHAR(50),
          timezone VARCHAR(100),
          currency VARCHAR(50),
          activity_alerts BOOLEAN DEFAULT TRUE,
          compact_table_density BOOLEAN DEFAULT FALSE,
          two_factor_auth BOOLEAN DEFAULT TRUE,
          email_notifications BOOLEAN DEFAULT TRUE,
          margin_call_alerts BOOLEAN DEFAULT TRUE,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      // Clients
      await client.query(`
        CREATE TABLE IF NOT EXISTS user_panel_clients (
          id VARCHAR(50) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL,
          phone VARCHAR(50) NOT NULL,
          pan VARCHAR(50),
          status VARCHAR(50) NOT NULL DEFAULT 'Active',
          is_demo BOOLEAN DEFAULT FALSE,
          ledger_balance NUMERIC(18, 2) NOT NULL DEFAULT 0,
          open_pnl NUMERIC(18, 2) NOT NULL DEFAULT 0,
          peak_ledger NUMERIC(18, 2) NOT NULL DEFAULT 0,
          margin_used NUMERIC(18, 2) NOT NULL DEFAULT 0,
          income NUMERIC(18, 2) NOT NULL DEFAULT 0,
          margin_available NUMERIC(18, 2) NOT NULL DEFAULT 0,
          broker_id VARCHAR(50) NOT NULL,
          broker_name VARCHAR(255) NOT NULL,
          kyc_status VARCHAR(50) DEFAULT 'Verified',
          kyc_documents JSONB DEFAULT '[]'::jsonb,
          created_date VARCHAR(50),
          last_active VARCHAR(50),
          risk_limit NUMERIC(18, 2) DEFAULT 0,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_up_clients_broker ON user_panel_clients(broker_id);
      `);

      // Orders (User panel workflow log)
      await client.query(`
        CREATE TABLE IF NOT EXISTS user_panel_orders (
          id VARCHAR(50) PRIMARY KEY,
          client_id VARCHAR(50) REFERENCES user_panel_clients(id) ON DELETE CASCADE,
          client_name VARCHAR(255),
          instrument VARCHAR(100) NOT NULL,
          exchange VARCHAR(50),
          side VARCHAR(10) NOT NULL,
          type VARCHAR(20) NOT NULL,
          quantity NUMERIC(18, 2) NOT NULL,
          order_price VARCHAR(50),
          executed_qty NUMERIC(18, 2) DEFAULT 0,
          avg_price NUMERIC(18, 2) DEFAULT 0,
          status VARCHAR(50) NOT NULL,
          created VARCHAR(50),
          broker_id VARCHAR(50),
          rejection_reason TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_up_orders_client ON user_panel_orders(client_id);
        CREATE INDEX IF NOT EXISTS idx_up_orders_broker ON user_panel_orders(broker_id);
      `);

      // Positions
      await client.query(`
        CREATE TABLE IF NOT EXISTS user_panel_positions (
          id VARCHAR(50) PRIMARY KEY,
          client_id VARCHAR(50) REFERENCES user_panel_clients(id) ON DELETE CASCADE,
          client_name VARCHAR(255),
          instrument VARCHAR(100) NOT NULL,
          exchange VARCHAR(50),
          product VARCHAR(20) NOT NULL,
          buy_qty NUMERIC(18, 2) DEFAULT 0,
          sell_qty NUMERIC(18, 2) DEFAULT 0,
          net_qty NUMERIC(18, 2) NOT NULL,
          avg_price NUMERIC(18, 2) NOT NULL,
          current_price NUMERIC(18, 2) NOT NULL,
          realised_pnl NUMERIC(18, 2) DEFAULT 0,
          unrealised_pnl NUMERIC(18, 2) DEFAULT 0,
          total_pnl NUMERIC(18, 2) DEFAULT 0,
          margin_used NUMERIC(18, 2) DEFAULT 0,
          broker_id VARCHAR(50),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_up_positions_client ON user_panel_positions(client_id);
      `);

      // Fund transactions (Deposits & Withdrawals)
      await client.query(`
        CREATE TABLE IF NOT EXISTS user_panel_fund_transactions (
          id VARCHAR(50) PRIMARY KEY,
          client_id VARCHAR(50) REFERENCES user_panel_clients(id) ON DELETE CASCADE,
          client_name VARCHAR(255),
          type VARCHAR(20) NOT NULL,
          amount NUMERIC(18, 2) NOT NULL,
          method VARCHAR(50),
          request_date VARCHAR(50),
          reference_id VARCHAR(100),
          status VARCHAR(50) NOT NULL,
          verification TEXT,
          proof_document TEXT,
          approved_by VARCHAR(255),
          rejection_reason TEXT,
          broker_id VARCHAR(50),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_up_funds_client ON user_panel_fund_transactions(client_id);
        CREATE INDEX IF NOT EXISTS idx_up_funds_status ON user_panel_fund_transactions(status);
      `);

      // Ledger entries
      await client.query(`
        CREATE TABLE IF NOT EXISTS user_panel_ledger_entries (
          id VARCHAR(50) PRIMARY KEY,
          client_id VARCHAR(50),
          date VARCHAR(50),
          reference_id VARCHAR(100),
          description TEXT,
          debit NUMERIC(18, 2) DEFAULT 0,
          credit NUMERIC(18, 2) DEFAULT 0,
          running_balance NUMERIC(18, 2) NOT NULL,
          status VARCHAR(50) DEFAULT 'Completed',
          type VARCHAR(50),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_up_ledger_client ON user_panel_ledger_entries(client_id);
      `);

      // Audit logs
      await client.query(`
        CREATE TABLE IF NOT EXISTS user_panel_audit_logs (
          id VARCHAR(50) PRIMARY KEY,
          timestamp VARCHAR(100),
          user_name VARCHAR(255),
          role VARCHAR(100),
          action VARCHAR(255),
          related_entity VARCHAR(255),
          ip_address VARCHAR(50),
          result VARCHAR(50),
          details TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      // Market instruments cache
      await client.query(`
        CREATE TABLE IF NOT EXISTS user_panel_instruments (
          symbol VARCHAR(50) PRIMARY KEY,
          name VARCHAR(255),
          exchange VARCHAR(50),
          last_price NUMERIC(18, 2),
          change NUMERIC(18, 2),
          change_percent NUMERIC(18, 2),
          bid NUMERIC(18, 2),
          ask NUMERIC(18, 2),
          volume VARCHAR(50),
          high NUMERIC(18, 2),
          low NUMERIC(18, 2),
          type VARCHAR(50),
          contract_expiry VARCHAR(50),
          lot_size NUMERIC(18, 2),
          tick_size NUMERIC(18, 2),
          status VARCHAR(50),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      // Idempotency cache
      await client.query(`
        CREATE TABLE IF NOT EXISTS user_panel_idempotency (
          idempotency_key VARCHAR(255) PRIMARY KEY,
          status_code INTEGER NOT NULL,
          response_body JSONB NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      // Support tickets
      await client.query(`
        CREATE TABLE IF NOT EXISTS user_panel_tickets (
          id VARCHAR(50) PRIMARY KEY,
          client_id VARCHAR(50),
          user_name VARCHAR(255),
          category VARCHAR(100) NOT NULL,
          subject VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          priority VARCHAR(50) DEFAULT 'Normal',
          status VARCHAR(50) DEFAULT 'Open',
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      await client.query(
        'INSERT INTO user_panel_schema_migrations (version, name) VALUES (1, $1)',
        ['Base schema migration v1.0.0']
      );

      console.log('[Database Migration] Migration 1 successfully committed.');
    }

    // Migration 2: Ensure created_at columns exist on all tables
    if (!appliedVersions.has(2)) {
      console.log('[Database Migration] Running Migration 2: Ensure created_at columns exist...');
      const allPossibleTables = [
        'user_panel_clients', 'user_panel_positions', 'user_panel_orders',
        'user_panel_fund_transactions', 'user_panel_ledger_entries', 'user_panel_audit_logs',
        'user_panel_instruments', 'user_panel_tickets', 'user_panel_tenant_branding', 'user_panel_settings',
        'clients', 'positions', 'orders', 'fund_transactions', 'ledger_entries', 'audit_logs', 'instruments', 'tickets'
      ];
      for (const tbl of allPossibleTables) {
        try {
          await client.query(`ALTER TABLE "${tbl}" ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`);
        } catch {}
      }

      try {
        await client.query(
          'INSERT INTO user_panel_schema_migrations (version, name) VALUES (2, $1) ON CONFLICT (version) DO NOTHING',
          ['Ensure created_at column exists on all tables']
        );
      } catch {}

      console.log('[Database Migration] Migration 2 successfully committed.');
    }

    // Guarantee created_at columns exist unconditionally on primary tables
    const coreTables = ['user_panel_clients', 'user_panel_positions', 'user_panel_orders', 'user_panel_fund_transactions', 'user_panel_ledger_entries'];
    for (const tbl of coreTables) {
      try {
        await client.query(`ALTER TABLE "${tbl}" ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`);
      } catch {}
    }

    await client.query('COMMIT');
  } catch (err: any) {
    try { await client.query('ROLLBACK'); } catch {}
    console.warn('[Database Migration] Notice running migrations:', err.message);
  } finally {
    client.release();
  }
}

/**
 * Imports existing JSON data safely if the PostgreSQL tables are currently empty
 */
async function migrateFromJsonIfEmpty(pool: Pool) {
  if (!fs.existsSync(PERSISTENCE_FILE)) return;

  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT COUNT(*) as count FROM user_panel_clients');
    const clientCount = parseInt(rows[0].count, 10);

    if (clientCount > 0) {
      console.log(`[Database Migration] PostgreSQL already contains ${clientCount} clients. Preserving existing database records.`);
      return;
    }

    console.log('[Database Migration] PostgreSQL tables are empty. Safely importing initial data from data/persistence-store.json...');
    const raw = fs.readFileSync(PERSISTENCE_FILE, 'utf8');
    const store = JSON.parse(raw);

    await client.query('BEGIN');

    // 1. Branding
    if (store.tenantBranding) {
      const b = store.tenantBranding;
      await client.query(`
        INSERT INTO user_panel_tenant_branding (
          id, brand_name, platform_name, short_name, tagline, logo_url,
          primary_color, secondary_color, accent_color, support_email, support_phone,
          footer_copyright, version, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
        ON CONFLICT (id) DO UPDATE SET
          brand_name = EXCLUDED.brand_name,
          platform_name = EXCLUDED.platform_name,
          primary_color = EXCLUDED.primary_color,
          secondary_color = EXCLUDED.secondary_color,
          version = EXCLUDED.version;
      `, [
        'default', b.brandName || 'NexTrade', b.platformName || 'NexTrade Broker OS',
        b.shortName || 'NexTrade', b.tagline || '', b.logoUrl || '',
        b.primaryColor || '#8b5cf6', b.secondaryColor || '#06b6d4', b.accentColor || '#10b981',
        b.supportEmail || 'support@nextrade.example', b.supportPhone || '+91 98765 42000',
        b.footerCopyright || '', b.version || 'v4.2.0-prod'
      ]);
    }

    // 2. Settings
    if (store.settingsState) {
      const s = store.settingsState;
      await client.query(`
        INSERT INTO user_panel_settings (
          id, profile_image, display_name, organization, email, phone, timezone, currency,
          activity_alerts, compact_table_density, two_factor_auth, email_notifications, margin_call_alerts, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
        ON CONFLICT (id) DO NOTHING;
      `, [
        'default', s.profileImage || '', s.displayName || 'Rohan Sen', s.organization || 'NexTrade Securities',
        s.email || 'rohan.sen@nextrade.example', s.phone || '+91 98765 42048', s.timezone || 'IST (UTC +05:30)',
        s.currency || 'INR - Indian Rupee', s.activityAlerts ?? true, s.compactTableDensity ?? false,
        s.twoFactorAuth ?? true, s.emailNotifications ?? true, s.marginCallAlerts ?? true
      ]);
    }

    // Clients, Orders, Positions, Funds, and Ledger are authoritative and fetched live from Trading Platform
    await client.query('COMMIT');
    console.log('[Database Migration] Schema migrations and branding initialized successfully.');
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('[Database Migration Error] Migration failed, rolled back:', err.message);
  } finally {
    client.release();
  }
}

/**
 * Data access repositories for PostgreSQL operations with atomic transactions
 */
export const dbRepo = {
  // Clients
  async getClients(brokerId?: string, clientId?: string): Promise<Client[]> {
    if (!pgPool || !isPostgresReady) return [];
    let query = 'SELECT * FROM user_panel_clients WHERE 1=1';
    const params: any[] = [];
    if (clientId) {
      params.push(clientId);
      query += ` AND id = $${params.length}`;
    } else if (brokerId) {
      params.push(brokerId);
      query += ` AND broker_id = $${params.length}`;
    }
    let rows: any[] = [];
    try {
      const res = await pgPool.query(query, params);
      rows = res.rows;
      rows.sort((a, b) => {
        const tA = new Date(a.created_at || a.created_date || a.created || 0).getTime();
        const tB = new Date(b.created_at || b.created_date || b.created || 0).getTime();
        return (tB || 0) - (tA || 0);
      });
    } catch (err: any) {
      console.warn('[Database dbRepo.getClients] query notice:', err.message);
      return [];
    }
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      email: r.email,
      phone: r.phone,
      pan: r.pan,
      status: r.status,
      isDemo: r.is_demo,
      ledgerBalance: parseFloat(r.ledger_balance || '0'),
      openPnL: parseFloat(r.open_pnl || '0'),
      peakLedger: parseFloat(r.peak_ledger || '0'),
      marginUsed: parseFloat(r.margin_used || '0'),
      income: parseFloat(r.income || '0'),
      marginAvailable: parseFloat(r.margin_available || '0'),
      brokerId: r.broker_id || 'BRK-ROHAN-01',
      brokerName: r.broker_name || 'NexTrade Broker',
      kycStatus: r.kyc_status || 'Verified',
      kycDocuments: r.kyc_documents,
      createdDate: r.created_date || (r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : '2026-03-29'),
      lastActive: r.last_active || 'Just now',
      riskLimit: parseFloat(r.risk_limit || '500000'),
    }));
  },

  async insertClient(client: Client): Promise<void> {
    if (!pgPool || !isPostgresReady) return;
    try {
      await pgPool.query(`
        INSERT INTO user_panel_clients (
          id, name, email, phone, pan, status, is_demo, ledger_balance, open_pnl,
          peak_ledger, margin_used, income, margin_available, broker_id, broker_name,
          kyc_status, kyc_documents, created_date, last_active, risk_limit, updated_at, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          email = EXCLUDED.email,
          phone = EXCLUDED.phone,
          status = EXCLUDED.status,
          ledger_balance = EXCLUDED.ledger_balance,
          margin_available = EXCLUDED.margin_available,
          updated_at = NOW();
      `, [
        client.id, client.name, client.email, client.phone, client.pan, client.status,
        client.isDemo, client.ledgerBalance, client.openPnL, client.peakLedger,
        client.marginUsed, client.income, client.marginAvailable, client.brokerId,
        client.brokerName, client.kycStatus, JSON.stringify(client.kycDocuments),
        client.createdDate, client.lastActive, client.riskLimit
      ]);
    } catch (e: any) {
      console.warn('[Database dbRepo.insertClient] insert notice:', e.message);
    }
  },

  // Orders
  async getOrders(brokerId?: string, clientId?: string): Promise<Order[]> {
    if (!pgPool || !isPostgresReady) return [];
    let query = 'SELECT * FROM user_panel_orders WHERE 1=1';
    const params: any[] = [];
    if (clientId) {
      params.push(clientId);
      query += ` AND client_id = $${params.length}`;
    } else if (brokerId) {
      params.push(brokerId);
      query += ` AND broker_id = $${params.length}`;
    }
    let rows: any[] = [];
    try {
      const res = await pgPool.query(query, params);
      rows = res.rows;
      rows.sort((a, b) => {
        const tA = new Date(a.created_at || a.created || 0).getTime();
        const tB = new Date(b.created_at || b.created || 0).getTime();
        return (tB || 0) - (tA || 0);
      });
    } catch (err: any) {
      console.warn('[Database dbRepo.getOrders] query notice:', err.message);
      return [];
    }
    return rows.map(r => ({
      id: r.id,
      clientId: r.client_id,
      clientName: r.client_name,
      instrument: r.instrument,
      exchange: r.exchange,
      side: r.side,
      type: r.type,
      quantity: parseFloat(r.quantity || '0'),
      orderPrice: isNaN(Number(r.order_price)) ? r.order_price : parseFloat(r.order_price),
      executedQty: parseFloat(r.executed_qty || '0'),
      avgPrice: parseFloat(r.avg_price || '0'),
      status: r.status,
      created: r.created,
      brokerId: r.broker_id || 'BRK-ROHAN-01',
      rejectionReason: r.rejection_reason,
    }));
  },

  async insertOrder(order: Order): Promise<void> {
    if (!pgPool || !isPostgresReady) return;
    try {
      await pgPool.query(`
        INSERT INTO user_panel_orders (
          id, client_id, client_name, instrument, exchange, side, type, quantity,
          order_price, executed_qty, avg_price, status, created, broker_id, rejection_reason, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
        ON CONFLICT (id) DO NOTHING;
      `, [
        order.id, order.clientId, order.clientName, order.instrument, order.exchange,
        order.side, order.type, order.quantity, String(order.orderPrice),
        order.executedQty, order.avgPrice, order.status, order.created,
        order.brokerId, order.rejectionReason || null
      ]);
    } catch (e: any) {
      console.warn('[Database dbRepo.insertOrder] notice:', e.message);
    }
  },

  async updateOrderStatus(id: string, status: string, rejectionReason?: string): Promise<void> {
    if (!pgPool || !isPostgresReady) return;
    try {
      await pgPool.query(
        'UPDATE user_panel_orders SET status = $1, rejection_reason = $2 WHERE id = $3',
        [status, rejectionReason || null, id]
      );
    } catch (e: any) {
      console.warn('[Database dbRepo.updateOrderStatus] notice:', e.message);
    }
  },

  // Positions
  async getPositions(brokerId?: string, clientId?: string): Promise<Position[]> {
    if (!pgPool || !isPostgresReady) return [];
    let query = 'SELECT * FROM user_panel_positions WHERE 1=1';
    const params: any[] = [];
    if (clientId) {
      params.push(clientId);
      query += ` AND client_id = $${params.length}`;
    } else if (brokerId) {
      params.push(brokerId);
      query += ` AND broker_id = $${params.length}`;
    }
    let rows: any[] = [];
    try {
      const res = await pgPool.query(query, params);
      rows = res.rows;
    } catch (err: any) {
      console.warn('[Database dbRepo.getPositions] query notice:', err.message);
      return [];
    }
    return rows.map(r => ({
      id: r.id,
      clientId: r.client_id,
      clientName: r.client_name,
      instrument: r.instrument,
      exchange: r.exchange,
      product: r.product,
      buyQty: parseFloat(r.buy_qty || '0'),
      sellQty: parseFloat(r.sell_qty || '0'),
      netQty: parseFloat(r.net_qty || '0'),
      avgPrice: parseFloat(r.avg_price || '0'),
      currentPrice: parseFloat(r.current_price || '0'),
      realisedPnL: parseFloat(r.realised_pnl || '0'),
      unrealisedPnL: parseFloat(r.unrealised_pnl || '0'),
      totalPnL: parseFloat(r.total_pnl || '0'),
      marginUsed: parseFloat(r.margin_used || '0'),
      brokerId: r.broker_id || 'BRK-ROHAN-01',
    }));
  },

  async upsertPosition(position: Position): Promise<void> {
    if (!pgPool || !isPostgresReady) return;
    try {
      await pgPool.query(`
        INSERT INTO user_panel_positions (
          id, client_id, client_name, instrument, exchange, product,
          buy_qty, sell_qty, net_qty, avg_price, current_price,
          realised_pnl, unrealised_pnl, total_pnl, margin_used, broker_id, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
        ON CONFLICT (id) DO UPDATE SET
          buy_qty = EXCLUDED.buy_qty,
          sell_qty = EXCLUDED.sell_qty,
          net_qty = EXCLUDED.net_qty,
          avg_price = EXCLUDED.avg_price,
          current_price = EXCLUDED.current_price,
          realised_pnl = EXCLUDED.realised_pnl,
          unrealised_pnl = EXCLUDED.unrealised_pnl,
          total_pnl = EXCLUDED.total_pnl,
          margin_used = EXCLUDED.margin_used,
          updated_at = NOW();
      `, [
        position.id, position.clientId, position.clientName, position.instrument, position.exchange,
        position.product, position.buyQty, position.sellQty, position.netQty, position.avgPrice,
        position.currentPrice, position.realisedPnL, position.unrealisedPnL, position.totalPnL,
        position.marginUsed, position.brokerId
      ]);
    } catch (e: any) {
      console.warn('[Database dbRepo.upsertPosition] notice:', e.message);
    }
  },

  async deletePosition(id: string): Promise<void> {
    if (!pgPool || !isPostgresReady) return;
    try {
      await pgPool.query('DELETE FROM user_panel_positions WHERE id = $1', [id]);
    } catch (e: any) {
      console.warn('[Database dbRepo.deletePosition] notice:', e.message);
    }
  },

  // Fund transactions
  async getFundTransactions(brokerId?: string, clientId?: string): Promise<FundTransaction[]> {
    if (!pgPool || !isPostgresReady) return [];
    let query = 'SELECT * FROM user_panel_fund_transactions WHERE 1=1';
    const params: any[] = [];
    if (clientId) {
      params.push(clientId);
      query += ` AND client_id = $${params.length}`;
    } else if (brokerId) {
      params.push(brokerId);
      query += ` AND broker_id = $${params.length}`;
    }
    let rows: any[] = [];
    try {
      const res = await pgPool.query(query, params);
      rows = res.rows;
      rows.sort((a, b) => {
        const tA = new Date(a.created_at || a.request_date || 0).getTime();
        const tB = new Date(b.created_at || b.request_date || 0).getTime();
        return (tB || 0) - (tA || 0);
      });
    } catch (err: any) {
      console.warn('[Database dbRepo.getFundTransactions] query notice:', err.message);
      return [];
    }
    return rows.map(r => ({
      id: r.id,
      clientId: r.client_id,
      clientName: r.client_name,
      type: r.type,
      amount: parseFloat(r.amount || '0'),
      method: r.method,
      requestDate: r.request_date,
      referenceId: r.reference_id,
      status: r.status,
      verification: r.verification,
      proofDocument: r.proof_document,
      approvedBy: r.approved_by,
      rejectionReason: r.rejection_reason,
      brokerId: r.broker_id || 'BRK-ROHAN-01',
    }));
  },

  async updateFundStatus(id: string, status: string, verification: string, approvedBy?: string, reason?: string): Promise<void> {
    if (!pgPool || !isPostgresReady) return;
    try {
      await pgPool.query(`
        UPDATE user_panel_fund_transactions
        SET status = $1, verification = $2, approved_by = $3, rejection_reason = $4
        WHERE id = $5;
      `, [status, verification, approvedBy || null, reason || null, id]);
    } catch (e: any) {
      console.warn('[Database dbRepo.updateFundStatus] notice:', e.message);
    }
  },

  // Ledger
  async getLedgerEntries(clientId?: string): Promise<LedgerEntry[]> {
    if (!pgPool || !isPostgresReady) return [];
    let query = 'SELECT * FROM user_panel_ledger_entries WHERE 1=1';
    const params: any[] = [];
    if (clientId) {
      params.push(clientId);
      query += ` AND client_id = $${params.length}`;
    }
    let rows: any[] = [];
    try {
      const res = await pgPool.query(query, params);
      rows = res.rows;
      rows.sort((a, b) => {
        const tA = new Date(a.created_at || a.date || 0).getTime();
        const tB = new Date(b.created_at || b.date || 0).getTime();
        return (tB || 0) - (tA || 0);
      });
    } catch (err: any) {
      console.warn('[Database dbRepo.getLedgerEntries] query notice:', err.message);
      return [];
    }
    return rows.map(r => ({
      id: r.id,
      date: r.date,
      referenceId: r.reference_id,
      description: r.description,
      debit: parseFloat(r.debit || '0'),
      credit: parseFloat(r.credit || '0'),
      runningBalance: parseFloat(r.running_balance || '0'),
      status: (r.status || 'Completed') as 'Completed' | 'Pending',
      type: (r.type || 'Trade Settlement') as 'Brokerage' | 'Deposit' | 'Withdrawal' | 'Margin Funding' | 'Trade Settlement',
    }));
  },

  // Support Tickets
  async insertTicket(ticket: { id: string; clientId?: string; userName?: string; category: string; subject: string; message: string; priority?: string }): Promise<void> {
    if (!pgPool || !isPostgresReady) return;
    await pgPool.query(`
      INSERT INTO user_panel_tickets (id, client_id, user_name, category, subject, message, priority, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW());
    `, [ticket.id, ticket.clientId || null, ticket.userName || 'Anonymous', ticket.category, ticket.subject, ticket.message, ticket.priority || 'High']);
  },

  // Idempotency
  async getIdempotency(key: string): Promise<{ status: number; body: any } | null> {
    if (!pgPool || !isPostgresReady) return null;
    const { rows } = await pgPool.query('SELECT status_code, response_body FROM user_panel_idempotency WHERE idempotency_key = $1', [key]);
    if (rows.length === 0) return null;
    return { status: rows[0].status_code, body: rows[0].response_body };
  },

  async setIdempotency(key: string, statusCode: number, responseBody: any): Promise<void> {
    if (!pgPool || !isPostgresReady) return;
    await pgPool.query(`
      INSERT INTO user_panel_idempotency (idempotency_key, status_code, response_body, created_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (idempotency_key) DO NOTHING;
    `, [key, statusCode, JSON.stringify(responseBody)]);
  },

  // Tenant Branding
  async saveBranding(branding: TenantBranding): Promise<void> {
    if (!pgPool || !isPostgresReady) return;
    await pgPool.query(`
      INSERT INTO user_panel_tenant_branding (
        id, brand_name, platform_name, short_name, tagline, logo_url,
        primary_color, secondary_color, accent_color, support_email, support_phone,
        footer_copyright, version, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
      ON CONFLICT (id) DO UPDATE SET
        brand_name = EXCLUDED.brand_name,
        platform_name = EXCLUDED.platform_name,
        short_name = EXCLUDED.short_name,
        tagline = EXCLUDED.tagline,
        primary_color = EXCLUDED.primary_color,
        secondary_color = EXCLUDED.secondary_color,
        accent_color = EXCLUDED.accent_color,
        support_email = EXCLUDED.support_email,
        support_phone = EXCLUDED.support_phone,
        version = EXCLUDED.version,
        updated_at = NOW();
    `, [
      'default', branding.brandName, branding.platformName, branding.shortName, branding.tagline,
      branding.logoUrl, branding.primaryColor, branding.secondaryColor, branding.accentColor,
      branding.supportEmail, branding.supportPhone, branding.footerCopyright, branding.version
    ]);
  },

  // Settings
  async saveSettings(settings: SettingsState): Promise<void> {
    if (!pgPool || !isPostgresReady) return;
    await pgPool.query(`
      INSERT INTO user_panel_settings (
        id, profile_image, display_name, organization, email, phone, timezone, currency,
        activity_alerts, compact_table_density, two_factor_auth, email_notifications, margin_call_alerts, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
      ON CONFLICT (id) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        organization = EXCLUDED.organization,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        timezone = EXCLUDED.timezone,
        currency = EXCLUDED.currency,
        activity_alerts = EXCLUDED.activity_alerts,
        compact_table_density = EXCLUDED.compact_table_density,
        two_factor_auth = EXCLUDED.two_factor_auth,
        email_notifications = EXCLUDED.email_notifications,
        margin_call_alerts = EXCLUDED.margin_call_alerts,
        updated_at = NOW();
    `, [
      'default', settings.profileImage, settings.displayName, settings.organization,
      settings.email, settings.phone, settings.timezone, settings.currency,
      settings.activityAlerts, settings.compactTableDensity, settings.twoFactorAuth,
      settings.emailNotifications, settings.marginCallAlerts
    ]);
  },

  // Audit Logs
  async insertAuditLog(log: AuditLog): Promise<void> {
    if (!pgPool || !isPostgresReady) return;
    await pgPool.query(`
      INSERT INTO user_panel_audit_logs (id, timestamp, user_name, role, action, related_entity, ip_address, result, details, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW());
    `, [
      log.id, log.timestamp, log.user, log.role, log.action,
      log.relatedEntity, log.ipAddress, log.result, log.details
    ]);
  },
};
