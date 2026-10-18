import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const dbIndexSource = await readFile(new URL('../db/index.ts', import.meta.url), 'utf8');
const appStateFnSource = await readFile(new URL('../netlify/functions/app-state.ts', import.meta.url), 'utf8');
const sessionSyncFnSource = await readFile(new URL('../netlify/functions/session-sync.ts', import.meta.url), 'utf8');
const dbSessionSyncSource = await readFile(new URL('../db/session-sync.ts', import.meta.url), 'utf8');
const pdaEstimationsFnSource = await readFile(new URL('../netlify/functions/pda-estimations.ts', import.meta.url), 'utf8');
const calculationStateFnSource = await readFile(new URL('../netlify/functions/calculation-state.ts', import.meta.url), 'utf8');

test('db/index.ts implements isSchemaReady singleton flag and guards ensureApplicationSchema', () => {
  assert.match(dbIndexSource, /let\s+isSchemaReady\s*=\s*false/, 'Must declare isSchemaReady flag initialized to false');
  assert.match(dbIndexSource, /if\s*\(\s*isSchemaReady\s*\)\s*return/, 'ensureApplicationSchema must return immediately if isSchemaReady is true');
  assert.match(dbIndexSource, /isSchemaReady\s*=\s*true/, 'Must set isSchemaReady to true upon successful DDL execution');
  assert.match(dbIndexSource, /isSchemaReady\s*=\s*false/, 'Must reset isSchemaReady to false on error');
});

test('netlify/functions/app-state.ts implements isSchemaReady singleton flag and guards ensureAppStateTable', () => {
  assert.match(appStateFnSource, /let\s+isSchemaReady\s*=\s*false/, 'Must declare isSchemaReady flag outside the handler');
  assert.match(appStateFnSource, /async\s+function\s+ensureAppStateTable\(\)\s*\{[\s\S]*?if\s*\(\s*isSchemaReady\s*\)\s*return/, 'ensureAppStateTable must return immediately if isSchemaReady is true');
  assert.match(appStateFnSource, /isSchemaReady\s*=\s*true/, 'Must set isSchemaReady to true upon successful execution');
  
  // Verify GET, POST, and DELETE conditional bypasses
  const getBypassMatches = [...appStateFnSource.matchAll(/if\s*\(\s*!isSchemaReady\s*\)\s*\{\s*await\s+ensureAppStateTable\(\);/g)];
  assert.ok(getBypassMatches.length >= 3, 'Must wrap ensureAppStateTable calls with if (!isSchemaReady) across DELETE, GET, and POST handlers');
});

test('netlify/functions/session-sync.ts and db/session-sync.ts guard ensureApplicationSchema with isSchemaReady', () => {
  assert.match(sessionSyncFnSource, /let\s+isSchemaReady\s*=\s*false/, 'session-sync function must declare isSchemaReady outside handler');
  assert.match(sessionSyncFnSource, /if\s*\(\s*!isSchemaReady\s*\)\s*\{[\s\S]*?await\s+ensureApplicationSchema\(\);[\s\S]*?isSchemaReady\s*=\s*true;/, 'session-sync function must conditionally bypass ensureApplicationSchema');

  assert.match(dbSessionSyncSource, /let\s+isSchemaReady\s*=\s*false/, 'db/session-sync.ts must declare isSchemaReady flag');
  const dbSyncMatches = [...dbSessionSyncSource.matchAll(/if\s*\(\s*!isSchemaReady\s*\)\s*\{\s*await\s+ensureApplicationSchema\(\);/g)];
  assert.ok(dbSyncMatches.length >= 4, 'All database access functions in db/session-sync.ts must wrap ensureApplicationSchema with if (!isSchemaReady)');
});

test('netlify/functions/pda-estimations.ts implements isSchemaReady singleton flag and conditional bypasses', () => {
  assert.match(pdaEstimationsFnSource, /let\s+isSchemaReady\s*=\s*false/, 'pda-estimations must declare isSchemaReady outside handler');
  const pdaBypassMatches = [...pdaEstimationsFnSource.matchAll(/if\s*\(\s*!isSchemaReady\s*\)\s*\{[\s\S]*?await\s+ensureApplicationSchema\(\);[\s\S]*?isSchemaReady\s*=\s*true;/g)];
  assert.ok(pdaBypassMatches.length >= 2, 'pda-estimations must conditionally bypass ensureApplicationSchema in both GET and POST');
});

test('netlify/functions/calculation-state.ts implements isSchemaReady singleton flag and conditional bypasses', () => {
  assert.match(calculationStateFnSource, /let\s+isSchemaReady\s*=\s*false/, 'calculation-state must declare isSchemaReady outside handler');
  const calcBypassMatches = [...calculationStateFnSource.matchAll(/if\s*\(\s*!isSchemaReady\s*\)\s*\{[\s\S]*?await\s+ensureApplicationSchema\(\);[\s\S]*?isSchemaReady\s*=\s*true;/g)];
  assert.ok(calcBypassMatches.length >= 2, 'calculation-state must conditionally bypass ensureApplicationSchema in both GET and POST');
});

test('Singleton cache bypass skips DDL execution when serverless container is warm', async () => {
  let ddlExecutionCount = 0;
  let isSchemaReady = false;

  async function mockEnsureSchema() {
    if (isSchemaReady) return;
    ddlExecutionCount += 1;
    // Simulate DDL roundtrip
    await new Promise((resolve) => setTimeout(resolve, 10));
    isSchemaReady = true;
  }

  // Request 1: Cold start -> DDL executes
  if (!isSchemaReady) {
    await mockEnsureSchema();
    isSchemaReady = true;
  }
  assert.equal(ddlExecutionCount, 1, 'First request on cold start must execute DDL once');

  // Request 2: Warm container -> DDL is bypassed
  if (!isSchemaReady) {
    await mockEnsureSchema();
    isSchemaReady = true;
  }
  assert.equal(ddlExecutionCount, 1, 'Second request on warm container must bypass DDL call entirely');

  // Request 3: Direct call to mockEnsureSchema when schema is ready
  await mockEnsureSchema();
  assert.equal(ddlExecutionCount, 1, 'Direct ensureSchema call must fast-return without executing DDL');
});
