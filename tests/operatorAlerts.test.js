const assert = require('node:assert/strict');
const test = require('node:test');

process.env.RELAY_AGENT_KEY = process.env.RELAY_AGENT_KEY ?? 'test-relay-key';
process.env.VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? 'test-public-key';
process.env.VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? 'test-private-key';
process.env.CONSOLE_ORIGIN = 'https://console.test';

const { tryBuildOperatorAlertPayload } = require('../dist/operatorAlerts');

test('builds categorized payloads from direct operator_alert envelopes', () => {
  const payload = tryBuildOperatorAlertPayload({
    to: 'session-primary',
    channel: 'agent-coordination',
    event: 'operator_alert',
    alert_category: 'canary_failed',
    status: '503',
    latency_ms: 842,
  });

  assert.deepEqual(payload, {
    title: 'Budget canary FAILED',
    body: 'Canary FAILED: 503 / latency 842ms. Check budget providers in Console.',
    url: 'https://console.test/budget',
  });
});

test('builds categorized payloads from producer operator-alerts channel envelopes', () => {
  const payload = tryBuildOperatorAlertPayload({
    to: 'session-primary',
    channel: 'operator-alerts',
    body: JSON.stringify({
      category: 'cookie_auth_blocked',
      agent_id: 'codex-1234',
      endpoint: '/api/agents/history',
    }),
  });

  assert.deepEqual(payload, {
    title: 'Agent blocked on cookie refresh',
    body:
      'codex-1234 blocked on cookie refresh: /api/agents/history. Refresh cookie via Console → Deliver Cookie.',
    url: 'https://console.test/agents/codex-1234',
  });
});

test('builds credential_request payloads with mediation deep-link', () => {
  const payload = tryBuildOperatorAlertPayload({
    to: 'operator',
    channel: 'operator-alerts',
    body: JSON.stringify({
      category: 'credential_request',
      agent_id: 'flee-c3497',
      scope: 'aegis-console',
      reason: 'need fresh operator-mediated cookie',
      credential_request_id: '11111111-2222-3333-4444-555555555555',
      mediation_path: '/mediation?credential_request_id=11111111-2222-3333-4444-555555555555',
    }),
  });

  assert.deepEqual(payload, {
    title: 'Credential request',
    body: 'flee-c3497 needs aegis-console: need fresh operator-mediated cookie',
    url:
      'https://console.test/mediation?credential_request_id=11111111-2222-3333-4444-555555555555',
  });
});
