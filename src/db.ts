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
export async function initDatabase(appEnv: string = 'development'): Promise<boolean> {
  const databaseUrl = process.env.DATABASE_URL;
  const isProduction = process.env.NODE_ENV === 'production' || appEnv === 'production';

  if (!databaseUrl) {
    if (isProduction) {
      lastDbError = 'CRITICAL: DATABASE_URL is required in production environment. Refusing silent fallback to JSON snapshot.';
      console.error(`[Database Error] ${lastDbError}`);
      throw new Error(`[Database Error] ${lastDbError}`);
    }
    console.log('[Database] No DATABASE_URL provided. Operating in local development storage mode (JSON snapshot).');
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

    // Seed/migrate existing JSON data safely if DB is fresh
    await migrateFromJsonIfEmpty(pgPool);

    isPostgresReady = true;
    lastDbError = null;
    return true;
  } catch (err: any) {
    lastDbError = `PostgreSQL Connection/Migration Failed: ${err.message}`;
    console.error(`[Database Error] ${lastDbError}`);
    if (isProduction) {
      // In production, do not silently fallback
      isPostgresReady = false;
      throw new Error(`[Database Error] ${lastDbError}. Refusing silent fallback to JSON snapshot in production.`);
    }
    console.warn('[Database] Falling back to JSON journal for local development only.');
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

    await client.query('COMMIT');
  } catch (err: any) {
    await client.query('ROLLBACK');
    throw err;
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

    // 3. Clients
    if (Array.isArray(store.clients)) {
      for (const c of store.clients) {
        await client.query(`
          INSERT INTO user_panel_clients (
            id, name, email, phone, pan, status, is_demo, ledger_balance, open_pnl,
            peak_ledger, margin_used, income, margin_available, broker_id, broker_name,
            kyc_status, kyc_documents, created_date, last_active, risk_limit, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW())
          ON CONFLICT (id) DO NOTHING;
        `, [
          c.id, c.name, c.email, c.phone, c.pan || 'ABCDE1234F', c.status || 'Active',
          Boolean(c.isDemo), c.ledgerBalance || 0, c.openPnL || 0, c.peakLedger || c.ledgerBalance || 0,
          c.marginUsed || 0, c.income || 0, c.marginAvailable || c.ledgerBalance || 0,
          c.brokerId || 'BRK-ROHAN-01', c.brokerName || 'Rohan Sen', c.kycStatus || 'Verified',
          JSON.stringify(c.kycDocuments || []), c.createdDate || '', c.lastActive || 'Just now',
          c.riskLimit || (c.ledgerBalance * 2) || 0
        ]);
      }
    }

    // 4. Orders
    if (Array.isArray(store.orders)) {
      for (const o of store.orders) {
        await client.query(`
          INSERT INTO user_panel_orders (
            id, client_id, client_name, instrument, exchange, side, type, quantity,
            order_price, executed_qty, avg_price, status, created, broker_id, rejection_reason, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
          ON CONFLICT (id) DO NOTHING;
        `, [
          o.id, o.clientId, o.clientName, o.instrument, o.exchange || 'NSE', o.side, o.type,
          o.quantity, String(o.orderPrice || 0), o.executedQty || 0, o.avgPrice || 0,
          o.status, o.created || '', o.brokerId || 'BRK-ROHAN-01', o.rejectionReason || null
        ]);
      }
    }

    // 5. Positions
    if (Array.isArray(store.positions)) {
      for (const p of store.positions) {
        await client.query(`
          INSERT INTO user_panel_positions (
            id, client_id, client_name, instrument, exchange, product, buy_qty, sell_qty,
            net_qty, avg_price, current_price, realised_pnl, unrealised_pnl, total_pnl, margin_used, broker_id, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
          ON CONFLICT (id) DO NOTHING;
        `, [
          p.id, p.clientId, p.clientName, p.instrument, p.exchange || 'NSE', p.product || 'MIS',
          p.buyQty || 0, p.sellQty || 0, p.netQty || 0, p.avgPrice || 0, p.currentPrice || 0,
          p.realisedPnL || 0, p.unrealisedPnL || 0, p.totalPnL || 0, p.marginUsed || 0, p.brokerId || 'BRK-ROHAN-01'
        ]);
      }
    }

    // 6. Fund transactions
    if (Array.isArray(store.fundTransactions)) {
      for (const f of store.fundTransactions) {
        await client.query(`
          INSERT INTO user_panel_fund_transactions (
            id, client_id, client_name, type, amount, method, request_date, reference_id,
            status, verification, proof_document, approved_by, rejection_reason, broker_id, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
          ON CONFLICT (id) DO NOTHING;
        `, [
          f.id, f.clientId, f.clientName, f.type, f.amount, f.method || 'Bank transfer',
          f.requestDate || '', f.referenceId || '', f.status, f.verification || '',
          f.proofDocument || null, f.approvedBy || null, f.rejectionReason || null, f.brokerId || 'BRK-ROHAN-01'
        ]);
      }
    }

    // 7. Ledger
    if (Array.isArray(store.ledgerEntries)) {
      for (const l of store.ledgerEntries) {
        await client.query(`
          INSERT INTO user_panel_ledger_entries (
            id, client_id, date, reference_id, description, debit, credit, running_balance, status, type, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
          ON CONFLICT (id) DO NOTHING;
        `, [
          l.id, 'NT10482', l.date || '', l.referenceId || '', l.description || '',
          l.debit || 0, l.credit || 0, l.runningBalance || 0, l.status || 'Completed', l.type || 'Trade Settlement'
        ]);
      }
    }

    // 8. Audit logs
    if (Array.isArray(store.auditLogs)) {
      for (const a of store.auditLogs) {
        await client.query(`
          INSERT INTO user_panel_audit_logs (
            id, timestamp, user_name, role, action, related_entity, ip_address, result, details, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
          ON CONFLICT (id) DO NOTHING;
        `, [
          a.id, a.timestamp || '', a.user || '', a.role || '', a.action || '',
          a.relatedEntity || '', a.ipAddress || '', a.result || 'Success', a.details || ''
        ]);
      }
    }

    // 9. Instruments
    if (Array.isArray(store.instruments)) {
      for (const i of store.instruments) {
        await client.query(`
          INSERT INTO user_panel_instruments (
            symbol, name, exchange, last_price, change, change_percent, bid, ask, volume,
            high, low, type, contract_expiry, lot_size, tick_size, status, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
          ON CONFLICT (symbol) DO NOTHING;
        `, [
          i.symbol, i.name, i.exchange || 'NSE', i.lastPrice || 0, i.change || 0, i.changePercent || 0,
          i.bid || 0, i.ask || 0, i.volume || '', i.high || 0, i.low || 0, i.type || 'Equity',
          i.contractExpiry || 'EQ', i.lotSize || 1, i.tickSize || 0.05, i.status || 'Enabled'
        ]);
      }
    }

    await client.query('COMMIT');
    console.log('[Database Migration] Successfully migrated initial records to PostgreSQL tables.');
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
    query += ' ORDER BY created_at DESC';
    const { rows } = await pgPool.query(query, params);
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      email: r.email,
      phone: r.phone,
      pan: r.pan,
      status: r.status,
      isDemo: r.is_demo,
      ledgerBalance: parseFloat(r.ledger_balance),
      openPnL: parseFloat(r.open_pnl),
      peakLedger: parseFloat(r.peak_ledger),
      marginUsed: parseFloat(r.margin_used),
      income: parseFloat(r.income),
      marginAvailable: parseFloat(r.margin_available),
      brokerId: r.broker_id,
      brokerName: r.broker_name,
      kycStatus: r.kyc_status,
      kycDocuments: r.kyc_documents,
      createdDate: r.created_date,
      lastActive: r.last_active,
      riskLimit: parseFloat(r.risk_limit),
    }));
  },

  async insertClient(client: Client): Promise<void> {
    if (!pgPool || !isPostgresReady) return;
    await pgPool.query(`
      INSERT INTO user_panel_clients (
        id, name, email, phone, pan, status, is_demo, ledger_balance, open_pnl,
        peak_ledger, margin_used, income, margin_available, broker_id, broker_name,
        kyc_status, kyc_documents, created_date, last_active, risk_limit, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW());
    `, [
      client.id, client.name, client.email, client.phone, client.pan, client.status,
      client.isDemo, client.ledgerBalance, client.openPnL, client.peakLedger,
      client.marginUsed, client.income, client.marginAvailable, client.brokerId,
      client.brokerName, client.kycStatus, JSON.stringify(client.kycDocuments),
      client.createdDate, client.lastActive, client.riskLimit
    ]);
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
    query += ' ORDER BY created_at DESC';
    const { rows } = await pgPool.query(query, params);
    return rows.map(r => ({
      id: r.id,
      clientId: r.client_id,
      clientName: r.client_name,
      instrument: r.instrument,
      exchange: r.exchange,
      side: r.side,
      type: r.type,
      quantity: parseFloat(r.quantity),
      orderPrice: isNaN(Number(r.order_price)) ? r.order_price : parseFloat(r.order_price),
      executedQty: parseFloat(r.executed_qty),
      avgPrice: parseFloat(r.avg_price),
      status: r.status,
      created: r.created,
      brokerId: r.broker_id,
      rejectionReason: r.rejection_reason,
    }));
  },

  async insertOrder(order: Order): Promise<void> {
    if (!pgPool || !isPostgresReady) return;
    await pgPool.query(`
      INSERT INTO user_panel_orders (
        id, client_id, client_name, instrument, exchange, side, type, quantity,
        order_price, executed_qty, avg_price, status, created, broker_id, rejection_reason, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW());
    `, [
      order.id, order.clientId, order.clientName, order.instrument, order.exchange,
      order.side, order.type, order.quantity, String(order.orderPrice),
      order.executedQty, order.avgPrice, order.status, order.created,
      order.brokerId, order.rejectionReason || null
    ]);
  },

  async updateOrderStatus(id: string, status: string, rejectionReason?: string): Promise<void> {
    if (!pgPool || !isPostgresReady) return;
    await pgPool.query(
      'UPDATE user_panel_orders SET status = $1, rejection_reason = $2 WHERE id = $3',
      [status, rejectionReason || null, id]
    );
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
    const { rows } = await pgPool.query(query, params);
    return rows.map(r => ({
      id: r.id,
      clientId: r.client_id,
      clientName: r.client_name,
      instrument: r.instrument,
      exchange: r.exchange,
      product: r.product,
      buyQty: parseFloat(r.buy_qty),
      sellQty: parseFloat(r.sell_qty),
      netQty: parseFloat(r.net_qty),
      avgPrice: parseFloat(r.avg_price),
      currentPrice: parseFloat(r.current_price),
      realisedPnL: parseFloat(r.realised_pnl),
      unrealisedPnL: parseFloat(r.unrealised_pnl),
      totalPnL: parseFloat(r.total_pnl),
      marginUsed: parseFloat(r.margin_used),
      brokerId: r.broker_id,
    }));
  },

  async upsertPosition(position: Position): Promise<void> {
    if (!pgPool || !isPostgresReady) return;
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
  },

  async deletePosition(id: string): Promise<void> {
    if (!pgPool || !isPostgresReady) return;
    await pgPool.query('DELETE FROM user_panel_positions WHERE id = $1', [id]);
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
    query += ' ORDER BY created_at DESC';
    const { rows } = await pgPool.query(query, params);
    return rows.map(r => ({
      id: r.id,
      clientId: r.client_id,
      clientName: r.client_name,
      type: r.type,
      amount: parseFloat(r.amount),
      method: r.method,
      requestDate: r.request_date,
      referenceId: r.reference_id,
      status: r.status,
      verification: r.verification,
      proofDocument: r.proof_document,
      approvedBy: r.approved_by,
      rejectionReason: r.rejection_reason,
      brokerId: r.broker_id,
    }));
  },

  async updateFundStatus(id: string, status: string, verification: string, approvedBy?: string, reason?: string): Promise<void> {
    if (!pgPool || !isPostgresReady) return;
    await pgPool.query(`
      UPDATE user_panel_fund_transactions
      SET status = $1, verification = $2, approved_by = $3, rejection_reason = $4
      WHERE id = $5;
    `, [status, verification, approvedBy || null, reason || null, id]);
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
