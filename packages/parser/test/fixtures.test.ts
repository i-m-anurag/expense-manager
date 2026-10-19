import assert from 'node:assert/strict';
import {describe, test} from 'node:test';
import {parseSms} from '../src/parse';
import {ist, loadFixtures, loadTemplates} from './helpers';

const templates = loadTemplates();
const DEFAULT_RECEIVED = Date.parse('2025-09-18T12:00:00+05:30');

for (const {bank, cases} of loadFixtures()) {
  describe(`fixtures/${bank}.yaml`, () => {
    for (const c of cases) {
      test(c.name, () => {
        const receivedAt = c.received_at ? Date.parse(c.received_at) : DEFAULT_RECEIVED;
        const result = parseSms({sender: c.sender, body: c.body, receivedAt}, templates);
        const e = c.expect;
        assert.equal(result.status, e.status, `status for: ${c.body}`);
        if (result.status === 'ignored' && e.reason) {
          assert.equal(result.reason, e.reason);
        }
        if (result.status !== 'parsed') {
          return;
        }
        const t = result.txn;
        const checks: [keyof typeof e, unknown][] = [
          ['pattern', t.patternId],
          ['type', t.type],
          ['direction', t.direction],
          ['amount', t.amountPaise / 100],
          ['account', t.accountMask],
          ['account_kind', t.accountKind],
          ['payee', t.merchantRaw],
          ['merchant_key', t.merchantKey],
          ['ref', t.referenceNo],
          ['date', ist(t.occurredAt).date],
          ['time', ist(t.occurredAt).time],
          ['balance', t.balancePaise === null ? null : t.balancePaise / 100],
          ['limit', t.availableLimitPaise === null ? null : t.availableLimitPaise / 100],
        ];
        for (const [key, actual] of checks) {
          if (e[key] !== undefined) {
            assert.equal(actual, e[key], `${key}`);
          }
        }
      });
    }
  });
}

// PRD §7.2 acceptance: every template pattern is exercised by at least one fixture.
test('every pattern has a fixture', () => {
  const covered = new Set(loadFixtures().flatMap(f => f.cases.map(c => c.expect.pattern)));
  const missing = templates.flatMap(t => t.patterns.map(p => p.id)).filter(id => !covered.has(id));
  assert.deepEqual(missing, []);
});
