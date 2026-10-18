import dotenv from 'dotenv';
dotenv.config();

import { tradingPlatformClient } from '../src/services/tradingPlatformClient.ts';

async function testLiveS2SAndAggregation() {
  console.log('================================================================');
  console.log('   LIVE AUTHORITATIVE S2S & MULTI-TENANT TEST SUITE');
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

  // 1. Probe Trading Platform & Central Admin
  console.log('--- 1. Probing Live Upstream Services ---');
  const tpHealth = await tradingPlatformClient.probeHealth(25000);
  assert(tpHealth.reachable, `Trading Platform live health: ${tpHealth.status} (${tpHealth.latencyMs}ms)`);

  // 2. Test S2S HMAC request with shared secret
  console.log('\n--- 2. Testing Signed S2S HMAC Request ---');
  const s2sFundsRes = await tradingPlatformClient.fetchLiveFunds('TNT-001');
  assert(s2sFundsRes.success === true, 'S2S HMAC request to /api/internal/v1/trading/funds accepted without INVALID_SIGNATURE');
  console.log(`  Live authoritative funds verified for TNT-001`);

  // 3. Test Multi-tenant Aggregation across TNT-001, vertex-default, default, TNT-002, TNT-003
  console.log('\n--- 3. Testing Multi-Tenant Live Records Aggregation ---');
  const allOrdersRes = await tradingPlatformClient.fetchAllLiveOrders();
  assert(allOrdersRes.success && Array.isArray(allOrdersRes.orders), `Aggregated live orders across default tenants (${allOrdersRes.orders.length} orders)`);

  const allPositionsRes = await tradingPlatformClient.fetchAllLivePositions();
  assert(allPositionsRes.success && Array.isArray(allPositionsRes.positions), `Aggregated live positions across default tenants (${allPositionsRes.positions.length} positions)`);

  const allFundsRes = await tradingPlatformClient.fetchAllLiveFunds();
  assert(allFundsRes.success && Array.isArray(allFundsRes.funds), `Aggregated live funds across default tenants (${allFundsRes.funds.length} records)`);

  const allLedgerRes = await tradingPlatformClient.fetchAllLiveLedger();
  assert(allLedgerRes.success && Array.isArray(allLedgerRes.ledger), `Aggregated live ledger across default tenants (${allLedgerRes.ledger.length} entries)`);

  const liveSummary = await tradingPlatformClient.fetchAllLiveSummary();
  assert(typeof liveSummary === 'object' && liveSummary !== null, 'Aggregated live summary across default tenants');

  console.log('\n================================================================');
  console.log(`S2S AGGREGATION TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
}

testLiveS2SAndAggregation().catch(err => {
  console.error('Fatal S2S test error:', err);
  process.exit(1);
});
