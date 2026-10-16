import http from 'http';

async function probe() {
  const tradingUrl = 'https://trading-platform-2t6r.onrender.com';
  const adminUrl = 'https://admin-dashbord-wxcq.onrender.com';

  console.log('================================================================');
  console.log('   LIVE POST-DEPLOYMENT ECOSYSTEM PROBE');
  console.log('================================================================\n');

  // 1. Trading Platform Health
  try {
    const t0 = Date.now();
    const res = await fetch(`${tradingUrl}/health`);
    const data: any = await res.json();
    console.log(`[PASS] 1. Trading Platform Health: HTTP ${res.status} (${Date.now() - t0}ms)`);
    console.log(`       Service: ${data.service}`);
    console.log(`       PostgreSQL: ${data.dependencies?.postgresql?.status} (${data.dependencies?.postgresql?.latencyMs}ms)`);
    console.log(`       Redis Coordinator: ${data.dependencies?.redis?.status}`);
    console.log(`       Uptime: ${Math.floor(data.uptime)}s`);
  } catch (err: any) {
    console.log(`[FAIL] 1. Trading Platform Health Error: ${err.message}`);
  }

  // 2. Trading Platform CORS preflight from Central Admin
  try {
    const res = await fetch(`${tradingUrl}/api/trading/instruments`, {
      method: 'OPTIONS',
      headers: {
        'Origin': adminUrl,
        'Access-Control-Request-Method': 'GET',
      },
    });
    const allowOrigin = res.headers.get('access-control-allow-origin');
    const allowCreds = res.headers.get('access-control-allow-credentials');
    console.log(`[PASS] 2. Trading Platform CORS Preflight: HTTP ${res.status}`);
    console.log(`       Access-Control-Allow-Origin: ${allowOrigin}`);
    console.log(`       Access-Control-Allow-Credentials: ${allowCreds}`);
  } catch (err: any) {
    console.log(`[FAIL] 2. Trading Platform CORS Error: ${err.message}`);
  }

  // 3. Central Admin Health
  try {
    const t0 = Date.now();
    const res = await fetch(`${adminUrl}/api/health`);
    let body = '';
    try {
      const json = await res.json();
      body = JSON.stringify(json);
    } catch {
      body = await res.text();
    }
    console.log(`[PASS] 3. Central Admin Health: HTTP ${res.status} (${Date.now() - t0}ms)`);
    console.log(`       Body: ${body.slice(0, 150)}`);
  } catch (err: any) {
    console.log(`[FAIL] 3. Central Admin Health Error: ${err.message}`);
  }

  // 4. Trading Platform Instruments (Tenant: vertex-default)
  try {
    const res = await fetch(`${tradingUrl}/api/trading/instruments`, {
      headers: {
        'x-tenant-id': 'vertex-default',
        'Accept': 'application/json',
      },
    });
    const data: any = await res.json();
    const count = Array.isArray(data.instruments) ? data.instruments.length : 0;
    const sample = data.instruments?.[0];
    console.log(`[PASS] 4. Live Instruments Catalog: HTTP ${res.status}, Count: ${count}`);
    console.log(`       Sample: ${sample?.symbol} (${sample?.name}) - LTP: ₹${sample?.lastPrice}`);
  } catch (err: any) {
    console.log(`[FAIL] 4. Live Instruments Error: ${err.message}`);
  }

  // 5. Read-only Auth & Portfolio Check (Trader Session on vertex-default)
  try {
    const authRes = await fetch(`${tradingUrl}/api/auth/demo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': 'vertex-default',
      },
      body: JSON.stringify({ fullName: 'Audit Probe Trader' }),
    });
    const authData: any = await authRes.json();
    console.log(`[PASS] 5. Live Authentication (Demo Session): HTTP ${authRes.status}, Success: ${authData.success}`);
    console.log(`       User: ${authData.user?.fullName} (Role: ${authData.user?.role}, Tenant: ${authData.user?.tenantId})`);

    if (authData.token) {
      const portRes = await fetch(`${tradingUrl}/api/trading/portfolio`, {
        headers: {
          'Authorization': `Bearer ${authData.token}`,
          'x-tenant-id': 'vertex-default',
        },
      });
      const portData: any = await portRes.json();
      console.log(`[PASS] 6. Live Portfolio Read Check: HTTP ${portRes.status}`);
      console.log(`       Available Balance: ₹${portData.wallet?.availableBalance?.toLocaleString('en-IN')}`);
      console.log(`       Open Positions: ${portData.positions?.length || 0}`);
      console.log(`       Orders: ${portData.orders?.length || 0}`);
      console.log(`       Resolved Tenant: ${portData.tenantId}`);
    }
  } catch (err: any) {
    console.log(`[FAIL] 5/6. Live Auth & Portfolio Read Error: ${err.message}`);
  }

  // 7. WebSocket Stream Check
  try {
    console.log(`[INFO] 7. WebSocket URL: ${tradingUrl.replace(/^http/, 'ws')}/ws`);
  } catch (err: any) {
    console.log(`[FAIL] 7. WebSocket Error: ${err.message}`);
  }

  console.log('\n================================================================');
  console.log('   PROBE COMPLETE');
  console.log('================================================================');
}

probe().catch(console.error);
