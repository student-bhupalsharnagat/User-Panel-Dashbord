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
    console.log('\n--- TEST 3: Live Trading Platform Endpoints Verification ---');
    const instruments = await tradingPlatformClient.fetchInstruments();
    assert(Array.isArray(instruments) && instruments.length > 0, `Fetched ${instruments.length} live instruments from Trading Platform`);
    
    const token = await tradingPlatformClient.authenticate();
    assert(typeof token === 'string' && token.length > 0, 'Acquired session token from Trading Platform');

    const portfolio = await tradingPlatformClient.fetchPortfolio();
    assert(portfolio !== null && typeof portfolio.wallet === 'object', 'Fetched authoritative portfolio wallet');
  } else {
    console.log('\n--- TEST 3: Live Trading Platform Endpoints (Skipped: Upstream offline) ---');
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
