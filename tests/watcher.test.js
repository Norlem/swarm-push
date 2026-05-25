const assert = require('node:assert/strict');
const test = require('node:test');

process.env.RELAY_AGENT_KEY = process.env.RELAY_AGENT_KEY ?? 'test-relay-key';
process.env.VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? 'test-public-key';
process.env.VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? 'test-private-key';
process.env.OPERATOR_ID = 'operator';

const { isOperatorMessage } = require('../dist/operatorRouting');

test('isOperatorMessage matches to_agent_id and legacy primary alias', () => {
  assert.equal(isOperatorMessage({ to_agent_id: 'operator' }), true);
  assert.equal(isOperatorMessage({ to: 'operator' }), true);
  assert.equal(isOperatorMessage({ to: 'primary' }), true);
  assert.equal(isOperatorMessage({ to_agent_id: 'flee-1234' }), false);
});

test('isOperatorMessage matches operator-mediation to_role routing', () => {
  assert.equal(
    isOperatorMessage({
      to_role: 'operator-mediation',
      agent_id: 'flee-c3497',
      credential_type: 'cookie',
    }),
    true,
  );
  assert.equal(isOperatorMessage({ to_role: 'operator' }), true);
  assert.equal(isOperatorMessage({ to_role: 'cursor' }), false);
});
