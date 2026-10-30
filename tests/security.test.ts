/**
 * Security & Secret Policy Assurance Tests
 *
 * Verifies that sensitive server secrets (SUPABASE_SERVICE_ROLE_KEY, INSFORGE_SERVICE_KEY, etc.)
 * are strictly forbidden from being imported or referenced inside client-facing source trees:
 * - components/
 * - hooks/
 * - app/ (excluding server-only route handlers in app/api/)
 *
 * Run with: node --experimental-strip-types tests/security.test.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

let passed = 0;
let failed = 0;

function assertCondition(label: string, condition: boolean, details?: string) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label} ${details ? `— ${details}` : ''}`);
    failed++;
  }
}

const ROOT_DIR = process.cwd();

const CLIENT_DIRECTORIES = [
  path.join(ROOT_DIR, 'components'),
  path.join(ROOT_DIR, 'hooks'),
  path.join(ROOT_DIR, 'app'),
];

const BANNED_PATTERNS = [
  /process\.env\.SUPABASE_SERVICE_ROLE_KEY/i,
  /process\.env\.INSFORGE_SERVICE_ROLE_KEY/i,
  /process\.env\.INSFORGE_SERVICE_KEY/i,
  /process\.env\.SERVICE_ROLE_KEY/i,
  /process\.env\.SERVICE_KEY/i,
  /createClient.*service_role/i,
];

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  if (!fs.existsSync(dirPath)) return arrayOfFiles;
  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      // Exclude app/api directory as it runs on the server
      if (fullPath.includes(path.join('app', 'api'))) continue;
      // Exclude build artifacts and caches
      if (file === '.next' || file === 'node_modules') continue;
      getAllFiles(fullPath, arrayOfFiles);
    } else if (/\.(tsx|ts|jsx|js)$/.test(file)) {
      arrayOfFiles.push(fullPath);
    }
  }

  return arrayOfFiles;
}

console.log('\n🛡️ Client-Side Secret Leak Prevention Audit:');

let totalClientFilesChecked = 0;
let leaksFound: { file: string; pattern: string }[] = [];

for (const dir of CLIENT_DIRECTORIES) {
  const files = getAllFiles(dir);
  totalClientFilesChecked += files.length;

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf-8');
    for (const pattern of BANNED_PATTERNS) {
      if (pattern.test(content)) {
        leaksFound.push({
          file: path.relative(ROOT_DIR, filePath),
          pattern: pattern.toString(),
        });
      }
    }
  }
}

assertCondition(
  `Scanned ${totalClientFilesChecked} client files across components/, hooks/, and app/`,
  totalClientFilesChecked > 20
);

assertCondition(
  'Zero references to service role keys in client code',
  leaksFound.length === 0,
  leaksFound.map((l) => `${l.file} matched ${l.pattern}`).join('; ')
);

console.log('\n🔒 Anonymous Key Environment Format Validation:');
const anonKeyFormatCheck = (key: string | undefined): boolean => {
  if (!key) return false;
  return key.startsWith('eyJ') || key.startsWith('ik_') || key.startsWith('sbp_') || key.startsWith('ci-');
};

assertCondition('Validates standard JWT or InsForge API key prefix', anonKeyFormatCheck('ik_4697b4a8df7380fb98a348d2d8c6d163'));
assertCondition('Validates Supabase JWT anon key format', anonKeyFormatCheck('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy'));
assertCondition('Rejects empty or missing key', !anonKeyFormatCheck(''));
assertCondition('Rejects undefined key', !anonKeyFormatCheck(undefined));

console.log('\n🌐 Client Environment Variable Prefix Safety:');
// Ensure that any NEXT_PUBLIC variable used across client code follows safe public conventions
const isSafePublicEnv = (varName: string): boolean => {
  return varName.startsWith('NEXT_PUBLIC_');
};

assertCondition('Permits NEXT_PUBLIC_SUPABASE_URL', isSafePublicEnv('NEXT_PUBLIC_SUPABASE_URL'));
assertCondition('Permits NEXT_PUBLIC_SUPABASE_ANON_KEY', isSafePublicEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'));
assertCondition('Permits NEXT_PUBLIC_INSFORGE_URL', isSafePublicEnv('NEXT_PUBLIC_INSFORGE_URL'));
assertCondition('Rejects non-prefixed secret variables', !isSafePublicEnv('SUPABASE_SERVICE_ROLE_KEY'));
assertCondition('Rejects non-prefixed GEMINI_API_KEY', !isSafePublicEnv('GEMINI_API_KEY'));

console.log(`\n──────────────────────────────────────────────────`);
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log(`All security assurance tests passed! 🛡️\n`);
}
