/**
 * Middleware Route Classification Tests
 *
 * Tests the isProtectedPath / isAuthOnlyPath logic from middleware.ts.
 * We extract the functions here so we can test them without needing
 * a running Next.js server or live InsForge connection.
 *
 * Run with: node tests/middleware.test.ts
 */
// ── Replicate the route classification logic from middleware.ts ──────────────
const PROTECTED_PATH_PREFIXES = [
    '/dashboard',
    '/analysis',
    '/reports',
    '/parity-monitor',
    '/admin',
    '/help',
    '/debug',
];
const AUTH_ONLY_PATHS = ['/login'];
function isProtectedPath(pathname) {
    return PROTECTED_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
function isAuthOnlyPath(pathname) {
    return AUTH_ONLY_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
// ── Test runner ──────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
function expect(label, actual, expected) {
    if (actual === expected) {
        console.log(`  ✅ ${label}`);
        passed++;
    }
    else {
        console.error(`  ❌ ${label} — expected ${expected}, got ${actual}`);
        failed++;
    }
}
// ── Protected paths: should require auth ─────────────────────────────────────
console.log('\n🔒 Protected paths (should be true):');
expect('/dashboard', isProtectedPath('/dashboard'), true);
expect('/dashboard/', isProtectedPath('/dashboard/'), true);
expect('/dashboard/settings', isProtectedPath('/dashboard/settings'), true);
expect('/analysis', isProtectedPath('/analysis'), true);
expect('/analysis/hotel-123', isProtectedPath('/analysis/hotel-123'), true);
expect('/reports', isProtectedPath('/reports'), true);
expect('/parity-monitor', isProtectedPath('/parity-monitor'), true);
expect('/parity-monitor/violations', isProtectedPath('/parity-monitor/violations'), true);
expect('/admin', isProtectedPath('/admin'), true);
expect('/admin/users', isProtectedPath('/admin/users'), true);
expect('/help', isProtectedPath('/help'), true);
expect('/debug', isProtectedPath('/debug'), true);
// ── Public paths: should NOT require auth ────────────────────────────────────
console.log('\n🌐 Public paths (should be false):');
expect('/', isProtectedPath('/'), false);
expect('/login', isProtectedPath('/login'), false);
expect('/about', isProtectedPath('/about'), false);
expect('/pricing', isProtectedPath('/pricing'), false);
expect('/privacy', isProtectedPath('/privacy'), false);
expect('/contact', isProtectedPath('/contact'), false);
expect('/accessibility', isProtectedPath('/accessibility'), false);
// ── Boundary cases: paths that START WITH a protected word but aren't ─────────
console.log('\n⚠️  Boundary cases (false — similar but not protected):');
expect('/dashboardx', isProtectedPath('/dashboardx'), false);
expect('/admintools', isProtectedPath('/admintools'), false);
expect('/reports-old', isProtectedPath('/reports-old'), false);
expect('/helpdesk', isProtectedPath('/helpdesk'), false);
// ── Auth-only paths ───────────────────────────────────────────────────────────
console.log('\n🔑 Auth-only paths (redirect if already logged in):');
expect('/login', isAuthOnlyPath('/login'), true);
expect('/login?redirectTo=/dashboard', isAuthOnlyPath('/login?redirectTo=/dashboard'), false); // query string not matched
expect('/', isAuthOnlyPath('/'), false);
expect('/dashboard', isAuthOnlyPath('/dashboard'), false);
// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
    console.error('❌ Some tests failed!');
    process.exit(1);
}
else {
    console.log('✅ All tests passed!');
}
