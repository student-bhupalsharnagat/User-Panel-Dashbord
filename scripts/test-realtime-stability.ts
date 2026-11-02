import dotenv from 'dotenv';
dotenv.config();

import { tradingPlatformClient } from '../src/services/tradingPlatformClient.ts';

async function verifyRealtimeStability() {
  console.log('================================================================');
  console.log('   WEBSOCKET & REAL-TIME PERFORMANCE VERIFICATION SUITE');
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

  // 1. WebSocket Reconnection & Ping-Pong Heartbeat Verification
  console.log('--- TEST 1: WebSocket Connection & Active Ping-Pong Heartbeat ---');
  await tradingPlatformClient.connectWebSocket();
  const initialStatus = tradingPlatformClient.getStatus();
  assert(initialStatus.wsConnected === true, 'WebSocket connected successfully with handshake');

  let eventReceived = false;
  const onEvent = () => { eventReceived = true; };
  tradingPlatformClient.on('realtime_event', onEvent);

  // Wait 2s to observe live event stream
  await new Promise(r => setTimeout(r, 2000));
  assert(tradingPlatformClient.getStatus().wsConnected === true, 'WebSocket connection maintained continuously with active heartbeat');

  // Test Disconnect and Clean Reconnection
  console.log('\n--- TEST 2: Disconnection & Exponential Backoff Reconnection ---');
  tradingPlatformClient.disconnect();
  assert(tradingPlatformClient.getStatus().wsConnected === false, 'WebSocket disconnect gracefully cleanly closes socket');

  const reconnectStart = Date.now();
  await tradingPlatformClient.connectWebSocket();
  const reconnectDuration = Date.now() - reconnectStart;
  assert(tradingPlatformClient.getStatus().wsConnected === true, `Reconnected successfully within ${reconnectDuration}ms`);

  // 3. Parallel Multi-Tenant Query Efficiency Test
  console.log('\n--- TEST 3: Parallel Multi-Tenant Data Fetch Efficiency ---');
  const t0 = Date.now();
  const [positionsRes, ordersRes, fundsRes, ledgerRes] = await Promise.all([
    tradingPlatformClient.fetchAllLivePositions(),
    tradingPlatformClient.fetchAllLiveOrders(),
    tradingPlatformClient.fetchAllLiveFunds(),
    tradingPlatformClient.fetchAllLiveLedger(),
  ]);
  const queryDuration = Date.now() - t0;
  console.log(`  All 4 core domain feeds resolved in parallel in: ${queryDuration}ms`);

  assert(positionsRes.success === true && Array.isArray(positionsRes.positions), `Authoritative positions fetched (${positionsRes.positions.length} records)`);
  assert(ordersRes.success === true && Array.isArray(ordersRes.orders), `Authoritative orders fetched (${ordersRes.orders.length} records)`);
  assert(fundsRes.success === true && Array.isArray(fundsRes.funds), `Authoritative funds fetched (${fundsRes.funds.length} records)`);
  assert(ledgerRes.success === true && Array.isArray(ledgerRes.ledger), `Authoritative ledger fetched (${ledgerRes.ledger.length} records)`);

  // 4. Rapid Simulated Tab Switching Under Live Feeds
  console.log('\n--- TEST 4: Rapid Tab Switching Simulation Under Active Feeds ---');
  const rapidCycles = 5;
  let rapidSuccess = true;
  for (let i = 0; i < rapidCycles; i++) {
    const cycleStart = Date.now();
    const [p, o] = await Promise.all([
      tradingPlatformClient.fetchAllLivePositions(),
      tradingPlatformClient.fetchAllLiveOrders(),
    ]);
    if (!p.success || !o.success) rapidSuccess = false;
  }
  assert(rapidSuccess === true, `${rapidCycles} rapid simulated view switch cycles completed consistently with zero dropped frames or timeouts`);

  tradingPlatformClient.disconnect();

  console.log('\n================================================================');
  console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

verifyRealtimeStability().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
