import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const blueprintUrl = new URL('../render.yaml', import.meta.url);

test('HTTPS pilot blueprint uses the free single-instance Node service without paid resources', async () => {
  const text = await readFile(blueprintUrl, 'utf8');
  assert.match(text, /^services:\s*\n/m);
  assert.match(text, /^\s+runtime: node\s*$/m);
  assert.match(text, /^\s+plan: free\s*$/m);
  assert.match(text, /^\s+numInstances: 1\s*$/m);
  assert.doesNotMatch(text, /^\s*(?:databases|disk|scaling|schedule):/m);
  assert.match(text, /^\s+autoDeployTrigger: off\s*$/m);
});

test('HTTPS pilot generates its access secret at the host and fails closed without the assigned hostname', async () => {
  const text = await readFile(blueprintUrl, 'utf8');
  assert.match(text, /- key: PILOT_ACCESS_TOKEN\s*\n\s+generateValue: true/);
  assert.match(text, /- key: HOST\s*\n\s+value: 0\.0\.0\.0/);
  assert.match(text, /startCommand: 'test -n "\$RENDER_EXTERNAL_HOSTNAME" && ALLOWED_HOSTS="\$RENDER_EXTERNAL_HOSTNAME" npm start'/);
  assert.match(text, /healthCheckPath: \/api\/health/);
  assert.doesNotMatch(text, /- key: (?:SUPABASE_SERVICE_ROLE_KEY|OPENROUTER_API_KEY|GEMINI_API_KEY)/);
});

test('HTTPS pilot leaves AI and cloud publication disabled and restricts targets explicitly', async () => {
  const text = await readFile(blueprintUrl, 'utf8');
  assert.match(text, /- key: AI_PROVIDER\s*\n\s+value: none/);
  assert.match(text, /- key: RANKING_PUBLISH_ENABLED\s*\n\s+value: "false"/);
  assert.match(text, /- key: PILOT_ALLOWED_TARGETS\s*\n\s+value: example\.com,pa-semarang\.go\.id,www\.pa-semarang\.go\.id/);
  assert.doesNotMatch(text, /- key: ALLOWED_HOSTS\s*\n\s+value: \*/);
});

test('HTTPS pilot tests and builds with dev dependencies before pruning only the hosting copy', async () => {
  const text = await readFile(blueprintUrl, 'utf8');
  assert.match(text, /npm ci --include=dev --ignore-scripts/);
  assert.match(text, /npm run lint && npm run build && npm run test:build && npm test/);
  assert.match(text, /npm test && node --test scripts\/pilot-deployment\.test\.mjs && npm prune --omit=dev --ignore-scripts --package-lock=false/);
});
