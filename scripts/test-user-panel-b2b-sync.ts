import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

process.env.SKIP_SERVER_START = 'true';
process.env.INTERNAL_API_SECRET = 'test-s2s-secret-2026';

async function main() {
  const {
    hashPassword,
    hashPasswordBcrypt,
    verifyPassword,
    verifyS2SRequest,
    deriveReferralCode,
    createSignedToken,
    verifySignedToken,
  } = await import('../server.ts');

  // 1. Password verification across bcrypt (Admin Panel) and legacy SHA-256
  const adminBcryptHash = bcrypt.hashSync('PartnerPass@2026', 10);
  assert.equal(verifyPassword('PartnerPass@2026', adminBcryptHash), true, 'bcrypt hash from Admin Panel should verify');
  assert.equal(verifyPassword('WrongPass', adminBcryptHash), false, 'wrong password should fail bcrypt verification');

  const localBcrypt = hashPasswordBcrypt('ChangedPass@99');
  assert.match(localBcrypt, /^\$2[aby]\$/);
  assert.equal(verifyPassword('ChangedPass@99', localBcrypt), true, 'locally generated bcrypt hash should verify');

  const legacySha = hashPassword('Password@123');
  assert.equal(verifyPassword('Password@123', legacySha), true, 'legacy SHA-256 hash should still verify');
  assert.equal(verifyPassword('Password@124', legacySha), false, 'wrong password should fail legacy SHA-256 verification');

  // 2. S2S HMAC verification (Admin Panel canonical dot format + legacy format + tamper rejection)
  const secret = process.env.INTERNAL_API_SECRET!;
  const ts = Date.now().toString();
  const body = JSON.stringify({ id: 'BRK-9901', role: 'BROKER', email: 'brk@example.com' });
  const path = '/api/internal/v1/hierarchy/sync';
  const canonicalSig = crypto.createHmac('sha256', secret).update(`${ts}.POST.${path}.${body}`).digest('hex');

  const validCanonical = verifyS2SRequest({
    method: 'POST',
    originalUrl: path,
    url: path,
    path,
    rawBody: body,
    body: JSON.parse(body),
    headers: {
      'x-internal-signature': canonicalSig,
      'x-internal-timestamp': ts,
    },
  } as any);
  assert.equal(validCanonical.valid, true, 'Admin Panel canonical S2S signature should validate');

  const legacySig = crypto.createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
  const validLegacy = verifyS2SRequest({
    method: 'POST',
    originalUrl: path,
    url: path,
    path,
    rawBody: body,
    body: JSON.parse(body),
    headers: {
      'x-signature': legacySig,
      'x-timestamp': ts,
    },
  } as any);
  assert.equal(validLegacy.valid, true, 'Legacy S2S signature should validate');

  const tampered = verifyS2SRequest({
    method: 'POST',
    originalUrl: path,
    url: path,
    path,
    rawBody: body + ' ',
    body: JSON.parse(body),
    headers: {
      'x-internal-signature': canonicalSig,
      'x-internal-timestamp': ts,
    },
  } as any);
  assert.equal(tampered.valid, false, 'Tampered S2S body must be rejected');

  // 3. Referral code derivation
  assert.equal(deriveReferralCode('broker_admin', 'BRK-100', 'BRK-CUSTOM'), 'BRK-CUSTOM');
  assert.match(deriveReferralCode('master', 'MST-42') || '', /^MST-[A-F0-9]{6}$/);
  assert.match(deriveReferralCode('broker_admin', 'BRK-42') || '', /^BRK-[A-F0-9]{6}$/);
  assert.match(deriveReferralCode('sub_broker', 'SUB-42') || '', /^SUB-[A-F0-9]{6}$/);
  assert.equal(deriveReferralCode('trader_client', 'CLI-42'), undefined);

  // 4. Token scoping preserves masterId, brokerId, subBrokerId, and referralCode
  const token = createSignedToken({
    sub: 'SUB-881',
    name: 'Test Sub-Broker',
    email: 'sub@example.com',
    role: 'sub_broker',
    roleTitle: 'Sub-Broker / Franchisee',
    masterId: 'MST-001',
    brokerId: 'BRK-009',
    subBrokerId: 'SUB-881',
    tenantId: 'TNT-001',
    organization: 'Alpha Franchise',
    phone: '+91 98765 00001',
    referralCode: 'SUB-ALPHA1',
  });
  const decoded = verifySignedToken(token);
  assert.ok(decoded, 'Signed token must decode');
  assert.equal(decoded?.masterId, 'MST-001');
  assert.equal(decoded?.brokerId, 'BRK-009');
  assert.equal(decoded?.subBrokerId, 'SUB-881');
  assert.equal(decoded?.referralCode, 'SUB-ALPHA1');

  console.log('PASS: User Panel B2B sync, bcrypt auth, HMAC S2S, referral code & token scoping checks succeeded.');
  process.exit(0);
}

main().catch((err) => {
  console.error('FAIL:', err);
  process.exit(1);
});
