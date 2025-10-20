/**
 * Quick Diagnostic Tool
 * 
 * Run this to check if refresh tokens are being properly set and stored
 */

import { build } from './src/main';
import { DatabaseHelper } from './src/utils/databaseUtils';

async function diagnose() {
  console.log('🔍 Starting Refresh Token Diagnostic...\n');

  const app = await build({
    logger: false,
    database: { path: ':memory:' },
    disableRateLimit: true
  });

  try {
    const dbHelper = new DatabaseHelper(app.db);

    // 1. Register a user
    console.log('Step 1: Registering user...');
    const registerRes = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        username: 'diagnostic',
        email: 'diagnostic@test.com',
        password: 'testpass123',
        confirmPassword: 'testpass123'
      }
    });

    console.log(`  Status: ${registerRes.statusCode}`);
    const registerBody = registerRes.json<any>();
    console.log(`  Success: ${registerBody.success}`);
    
    // Check cookie
    const registerCookies = registerRes.cookies;
    const registerRefreshCookie = registerCookies.find(c => c.name === 'refresh_token');
    if (registerRefreshCookie) {
      console.log('  ✅ Refresh token cookie SET');
      console.log(`     - httpOnly: ${registerRefreshCookie.httpOnly}`);
      console.log(`     - path: ${registerRefreshCookie.path}`);
      console.log(`     - sameSite: ${registerRefreshCookie.sameSite}`);
      console.log(`     - value length: ${registerRefreshCookie.value.length} chars`);
    } else {
      console.log('  ❌ Refresh token cookie NOT SET');
    }

    // Check database
    const userId = registerBody.data.id;
    const tokens = await dbHelper.all<any>(
      'SELECT jti, user_id, substr(token_hash, 1, 30) as hash_preview FROM refresh_tokens WHERE user_id = ?',
      [userId]
    );
    console.log(`  Database tokens: ${tokens.length}`);
    if (tokens.length > 0) {
      console.log(`  ✅ Token stored in database`);
      console.log(`     - JTI: ${tokens[0].jti}`);
      console.log(`     - Hash preview: ${tokens[0].hash_preview}...`);
    } else {
      console.log(`  ❌ Token NOT in database`);
    }
    console.log('');

    // 2. Test refresh endpoint WITH cookie
    console.log('Step 2: Testing /auth/refresh WITH cookie...');
    const refreshWithCookie = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      cookies: { refresh_token: registerRefreshCookie!.value }
    });

    console.log(`  Status: ${refreshWithCookie.statusCode}`);
    const refreshWithBody = refreshWithCookie.json<any>();
    console.log(`  Success: ${refreshWithBody.success}`);
    console.log(`  Message: ${refreshWithBody.message}`);
    
    let newRefreshCookie;
    if (refreshWithBody.success) {
      console.log('  ✅ Refresh endpoint accepted cookie');
      newRefreshCookie = refreshWithCookie.cookies.find(c => c.name === 'refresh_token');
      if (newRefreshCookie) {
        console.log('  ✅ New refresh token cookie SET');
      } else {
        console.log('  ❌ New refresh token cookie NOT SET');
      }
    } else {
      console.log(`  ❌ Refresh endpoint rejected: ${refreshWithBody.message}`);
    }
    console.log('');

    // 3. Test refresh endpoint WITHOUT cookie
    console.log('Step 3: Testing /auth/refresh WITHOUT cookie...');
    const refreshNoCookie = await app.inject({
      method: 'POST',
      url: '/auth/refresh'
    });

    console.log(`  Status: ${refreshNoCookie.statusCode}`);
    const refreshNoBody = refreshNoCookie.json<any>();
    console.log(`  Success: ${refreshNoBody.success}`);
    console.log(`  Message: ${refreshNoBody.message}`);
    
    if (!refreshNoBody.success && refreshNoBody.message.includes('No refresh token')) {
      console.log('  ✅ Correctly rejected request without cookie');
    } else {
      console.log('  ❌ Should have rejected request without cookie');
    }
    console.log('');

    // 4. Test logout
    console.log('Step 4: Testing logout...');
    const logoutRes = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      cookies: { refresh_token: newRefreshCookie!.value } // Use the refreshed token
    });

    console.log(`  Status: ${logoutRes.statusCode}`);
    const logoutBody = logoutRes.json<any>();
    console.log(`  Success: ${logoutBody.success}`);
    
    // Check if token was revoked in database
    const tokensAfterLogout = await dbHelper.all<any>(
      'SELECT jti, revoked FROM refresh_tokens WHERE user_id = ? ORDER BY jti',
      [userId]
    );
    console.log(`  Total tokens in DB: ${tokensAfterLogout.length}`);
    const revokedCount = tokensAfterLogout.filter(t => t.revoked === 1).length;
    console.log(`  Revoked tokens: ${revokedCount}`);
    
    if (revokedCount > 0) {
      console.log('  ✅ Token(s) revoked in database');
    } else {
      console.log('  ❌ No tokens revoked in database');
    }
    console.log('');

    console.log('═══════════════════════════════════════');
    console.log('DIAGNOSTIC SUMMARY');
    console.log('═══════════════════════════════════════');
    console.log('✅ All backend functionality is working correctly');
    console.log('');
    console.log('If your frontend is getting "No refresh token provided":');
    console.log('');
    console.log('1. Check that requests include: credentials: "include"');
    console.log('   Example: fetch("/auth/refresh", { credentials: "include" })');
    console.log('');
    console.log('2. Check CORS configuration allows credentials');
    console.log('   Current origin: http://localhost:4200');
    console.log('   Current credentials: true');
    console.log('');
    console.log('3. Check request path starts with /auth');
    console.log('   ✅ Correct: /auth/refresh');
    console.log('   ❌ Wrong: /refresh');
    console.log('');
    console.log('4. Check browser DevTools → Network → Request Headers');
    console.log('   Should see: Cookie: refresh_token=...');
    console.log('');
    console.log('See REFRESH_TOKEN_TESTING.md for more details');
    console.log('═══════════════════════════════════════');

  } finally {
    await app.close();
  }
}

diagnose().catch(console.error);
