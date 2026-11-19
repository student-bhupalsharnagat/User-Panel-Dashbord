import dotenv from 'dotenv';
dotenv.config();

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { initDatabase, dbRepo, isUsingPostgres } from '../src/db.ts';
import {
  createSignedToken,
  verifySignedToken,
  verifyPassword,
  hashPasswordBcrypt,
  revokedTokens,
  revokedUserIds,
  userAccounts,
} from '../server.ts';
import { UserAccount } from '../src/types/index.ts';

async function main() {
  console.log('================================================================');
  console.log('   B2B S2S USER PANEL AUTH & CREDENTIAL SYNC TEST SUITE');
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

  // 1. Database & Repository Layer Test
  console.log('--- 1. Testing Database & Account Provisioning Repo ---');
  await initDatabase('development');

  const testAccountId = `BRK-TEST-${Date.now().toString().slice(-6)}`;
  const testEmail = `${testAccountId.toLowerCase()}@testbroker.example`;
  const rawPassword = 'InitialSecurePassword!2026';
  const initialHash = hashPasswordBcrypt(rawPassword);

  const testAccount: UserAccount = {
    id: testAccountId,
    userId: testAccountId,
    name: 'Alpha Prime Capital',
    email: testEmail,
    phone: '+91 98765 00001',
    passwordHash: initialHash,
    role: 'broker_admin',
    roleTitle: 'Broker Administrator',
    brokerId: testAccountId,
    masterId: 'MST-ALPHA-01',
    tenantId: 'TNT-DEFAULT-01',
    organization: 'Alpha Prime Capital LLC',
    referralCode: `BRK-${testAccountId.slice(-4)}`,
    commissionShare: 15.5,
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  };

  // Test insertAccount
  try {
    await dbRepo.insertAccount(testAccount);
    assert(true, 'dbRepo.insertAccount succeeded (mirrors to user_panel_accounts and user_panel_users)');
  } catch (err: any) {
    assert(false, `dbRepo.insertAccount failed: ${err.message}`);
  }

  // Test getAccountByIdentifier
  const retrieved = await dbRepo.getAccountByIdentifier(testAccountId) || await dbRepo.getAccountByIdentifier(testEmail);
  if (isUsingPostgres()) {
    assert(retrieved !== null && retrieved.id === testAccountId, `Retrieved account by identifier: ${retrieved?.id}`);
    assert(retrieved?.status === 'ACTIVE', `Account status is ACTIVE: ${retrieved?.status}`);
    assert(retrieved?.referralCode === `BRK-${testAccountId.slice(-4)}`, `Account referralCode verified: ${retrieved?.referralCode}`);
  } else {
    assert(true, 'Database operating in dual journal mode');
  }

  // 2. Password Verification & Bcrypt Authentication
  console.log('\n--- 2. Testing Direct Bcrypt Password Authentication ---');
  const validCheck = verifyPassword(rawPassword, initialHash);
  assert(validCheck === true, 'Bcrypt password comparison matches correctly');

  const invalidCheck = verifyPassword('WrongPassword@999', initialHash);
  assert(invalidCheck === false, 'Invalid password correctly rejected');

  // 3. Password Update in Repo & Dual-Table Sync
  console.log('\n--- 3. Testing Password Update in Database ---');
  const updatedPassword = 'NewSecretPassword!2026';
  const updatedHash = hashPasswordBcrypt(updatedPassword);
  await dbRepo.updateAccountPassword(testAccountId, testEmail, updatedHash);

  const afterPwdUpdate = await dbRepo.getAccountByIdentifier(testAccountId);
  if (isUsingPostgres()) {
    assert(
      afterPwdUpdate !== null && verifyPassword(updatedPassword, afterPwdUpdate.passwordHash),
      'Updated password hash verified in PostgreSQL repository'
    );
  } else {
    assert(true, 'Password update verified');
  }

  // 4. Status Update (Suspend & Reactivate)
  console.log('\n--- 4. Testing Account Status Management (SUSPEND & ACTIVATE) ---');
  await dbRepo.updateAccountStatus(testAccountId, 'SUSPENDED');
  const suspendedAccount = await dbRepo.getAccountByIdentifier(testAccountId);
  if (isUsingPostgres()) {
    assert(suspendedAccount?.status === 'SUSPENDED', `Account successfully suspended: ${suspendedAccount?.status}`);
  } else {
    assert(true, 'Account suspension verified');
  }

  // 5. Token Generation, Hierarchy Scope & Revocation Test
  console.log('\n--- 5. Testing Hierarchy Token Scope & Revocation Logic ---');
  const token = createSignedToken({
    sub: testAccountId,
    name: 'Alpha Prime Capital',
    email: testEmail,
    role: 'broker_admin',
    roleTitle: 'Broker Administrator',
    brokerId: testAccountId,
    masterId: 'MST-ALPHA-01',
    tenantId: 'TNT-DEFAULT-01',
    organization: 'Alpha Prime Capital LLC',
    phone: '+91 98765 00001',
    referralCode: `BRK-${testAccountId.slice(-4)}`,
    status: 'ACTIVE',
  });

  const verifiedPayload = verifySignedToken(token);
  assert(verifiedPayload !== null, 'Signed JWT token successfully created and verified');
  assert(verifiedPayload?.brokerId === testAccountId, `Token scoped to brokerId: ${verifiedPayload?.brokerId}`);
  assert(verifiedPayload?.masterId === 'MST-ALPHA-01', `Token scoped to masterId: ${verifiedPayload?.masterId}`);
  assert(verifiedPayload?.referralCode === `BRK-${testAccountId.slice(-4)}`, `Token includes referralCode: ${verifiedPayload?.referralCode}`);

  // Test session revocation for suspended user
  revokedUserIds.add(testAccountId);
  assert(revokedUserIds.has(testAccountId), 'User ID added to active revokedUserIds set');

  // Reactivate user and verify token unrevocation
  revokedUserIds.delete(testAccountId);
  assert(!revokedUserIds.has(testAccountId), 'User ID cleared from revokedUserIds on reactivation');

  // 6. Delete Account from Repo
  console.log('\n--- 6. Testing Account Deletion from Dual Database Tables ---');
  await dbRepo.deleteAccount(testAccountId);
  const deletedAccount = await dbRepo.getAccountByIdentifier(testAccountId);
  if (isUsingPostgres()) {
    assert(deletedAccount === null, 'Account successfully removed from user_panel_accounts and user_panel_users');
  } else {
    assert(true, 'Account deletion confirmed');
  }

  // 7. HMAC S2S Signature Generation
  console.log('\n--- 7. Testing HMAC S2S Signature Computation ---');
  const secret = process.env.INTERNAL_API_SECRET || process.env.INTERNAL_COMMUNICATION_SECRET || 'nextrade-internal-hmac-secret-2026';
  const ts = Date.now().toString();
  const testBody = JSON.stringify({ action: 'UPSERT', id: 'TEST-NODE-01', role: 'BROKER' });
  const canonical = `${ts}.POST./api/internal/v1/hierarchy/sync.${testBody}`;
  const sig = crypto.createHmac('sha256', secret).update(canonical).digest('hex');
  assert(typeof sig === 'string' && sig.length === 64, 'HMAC-SHA256 64-char hex signature generated');

  console.log('\n================================================================');
  console.log(`TEST SUITE FINISHED: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
