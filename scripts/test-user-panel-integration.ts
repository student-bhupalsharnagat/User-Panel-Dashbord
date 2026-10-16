import dotenv from 'dotenv';
dotenv.config();

import { initDatabase, getDatabaseStatus, isUsingPostgres, dbRepo } from '../src/db.ts';
import { tradingPlatformClient } from '../src/services/tradingPlatformClient.ts';

async function runTests() {
  console.log('================================================================');
  console.log('   USER/BROKER PANEL PERSISTENCE & INTEGRATION TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${desc}`);
      failed++;
    }
  }

  // TEST 1: Database Persistence Layer
  console.log('--- TEST 1: Database Persistence & Repository Layer ---');
  const dbOk = await initDatabase('development');
  const status = getDatabaseStatus();
  assert(typeof status.engine === 'string', 'Database engine status reported');
  assert(status.connected === true, 'Database connectivity confirmed (PostgreSQL or fallback JSON journal)');
  assert(typeof status.version === 'string', 'Schema migration version verified');

  // Test Ticket insertion
  const testTicketId = `TEST-TCK-${Date.now()}`;
  try {
    await dbRepo.insertTicket({
      id: testTicketId,
      clientId: 'NT10482',
      userName: 'Aarav Mehta',
      category: 'Billing',
      subject: 'Test deposit verification',
      message: 'Automated integration check',
      priority: 'Low',
    });
    assert(true, 'Support ticket successfully persisted to database repository');
  } catch (err: any) {
    assert(false, `Ticket persistence failed: ${err.message}`);
  }

  // TEST 2: Trading Platform Client
  console.log('\n--- TEST 2: Trading Platform Ecosystem Connectivity ---');
  const tpStatus = await tradingPlatformClient.probeHealth(8000);
  console.log(`  Upstream Trading Platform: ${tpStatus.reachable ? 'REACHABLE' : 'OFFLINE'} (${tpStatus.latencyMs}ms)`);
  assert(typeof tpStatus.latencyMs === 'number', 'Latency measurement completed');
  assert(typeof tpStatus.authoritativeDatabase === 'string', 'Authoritative database target identified');

  if (tpStatus.reachable) {
    console.log('\n--- TEST 3: Live Trading Platform Endpoints & Normalization ---');
    const instruments = await tradingPlatformClient.fetchInstruments();
    assert(Array.isArray(instruments) && instruments.length >= 100, `Fetched ${instruments.length} live instruments (>= 100 catalog symbols)`);
    if (instruments[0]) {
      assert(typeof instruments[0].symbol === 'string' && typeof instruments[0].lastPrice === 'number', `Normalized instrument quote verified (${instruments[0].symbol}: ₹${instruments[0].lastPrice})`);
    }

    const token = await tradingPlatformClient.authenticate();
    assert(typeof token === 'string' && token.length > 0, 'Acquired session token from Trading Platform with tenant scoping');

    const portfolio = await tradingPlatformClient.fetchPortfolio();
    assert(portfolio !== null && typeof portfolio.wallet === 'object', 'Fetched authoritative portfolio wallet');
    assert(typeof portfolio?.wallet?.availableBalance === 'number' && portfolio.wallet.availableBalance > 0, `Authoritative wallet balance verified: ₹${portfolio?.wallet?.availableBalance?.toLocaleString('en-IN')}`);
    assert(Array.isArray(portfolio?.orders) && portfolio.orders.length > 0, `Authoritative matching engine orders verified (${portfolio?.orders?.length} orders)`);

    // Verify tenant scoping
    const tenantRes = await fetch(`${tradingPlatformClient.getBaseUrl()}/api/tenant/current`);
    const tenantData: any = await tenantRes.json();
    assert(tenantData.data?.tenant?.id === 'vertex-default', `Tenant contract matches authoritative configuration (${tenantData.data?.tenant?.id})`);

    // TEST 4: Probe Resilience, Timeout and Error Categorization
    console.log('\n--- TEST 4: Probe Error Categorization & Timeout Resilience ---');
    assert(tpStatus.status === 'healthy', `Probe reports valid upstream health status: ${tpStatus.status}`);
    assert(tpStatus.errorCategory === 'NONE', 'Healthy probe categorizes error as NONE');

    // Test timeout handling with 1ms probe
    const timeoutClient = new (tradingPlatformClient.constructor as any)({ baseUrl: tradingPlatformClient.getBaseUrl() });
    const timeoutProbe = await timeoutClient.probeHealth(1);
    assert(timeoutProbe.reachable === false, '1ms probe correctly reports unreachable');
    assert(timeoutProbe.errorCategory === 'TIMEOUT', `Timeout error properly categorized as TIMEOUT (${timeoutProbe.error})`);

    // TEST 5: Real-time WebSocket Stream & Event Reception
    console.log('\n--- TEST 5: Real-time WebSocket Stream & Event Reception ---');
    let wsEventReceived = false;
    let receivedEventName = '';
    let wsTenantId = '';
    const wsUrl = `${tradingPlatformClient.getBaseUrl().replace(/^http/, 'ws')}/ws?token=${encodeURIComponent(token)}`;

    await new Promise<void>((resolve) => {
      const ws = new (globalThis as any).WebSocket(wsUrl);
      const timer = setTimeout(() => {
        try { ws.close(); } catch {}
        resolve();
      }, 5000);

      ws.onmessage = (event: any) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg && msg.event) {
            wsEventReceived = true;
            receivedEventName = msg.event;
            wsTenantId = msg.tenantId;
            clearTimeout(timer);
            try { ws.close(); } catch {}
            resolve();
          }
        } catch {}
      };

      ws.onerror = () => {
        clearTimeout(timer);
        resolve();
      };
    });

    assert(wsEventReceived === true, `Received live WebSocket event from Trading Platform (${receivedEventName})`);
    assert(wsTenantId === 'vertex-default', `WebSocket event correctly isolated to tenant "${wsTenantId}"`);

    // TEST 6: Authoritative Ledger & Funds Read-Only Contract
    console.log('\n--- TEST 6: Authoritative Ledger & Financial Record Compatibility ---');
    const ledger = await tradingPlatformClient.fetchLedger();
    assert(Array.isArray(ledger), `Authoritative ledger fetched from Trading Platform (${ledger.length} entries)`);

    const funds = await tradingPlatformClient.fetchFunds();
    assert(Array.isArray(funds), `Authoritative fund transactions contract verified (${funds.length} records)`);

    // TEST 7: Tenant Isolation & Foreign Tenant Boundary Enforcement
    console.log('\n--- TEST 7: Tenant Scoping & Isolation Boundary Enforcement ---');
    const foreignTenantRes = await fetch(`${tradingPlatformClient.getBaseUrl()}/api/tenant/current`, {
      headers: { 'x-tenant-id': 'unauthorized-foreign-tenant-xyz' },
    });
    const foreignData: any = await foreignTenantRes.json();
    assert(foreignData.data?.tenant?.id !== 'unauthorized-foreign-tenant-xyz', 'Cross-tenant spoofing rejected or sanitized to valid tenant');
  } else {
    console.log('\n--- TEST 3-7: Live Trading Platform Endpoints (Skipped: Upstream offline) ---');
  }

  console.log('\n================================================================');
  console.log(`INTEGRATION TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
