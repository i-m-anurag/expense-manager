import assert from 'node:assert/strict';
import {test} from 'node:test';
import {analyzeScan} from '../src/analyze';
import {dedupe} from '../src/dedupe';
import {parseSms} from '../src/parse';
import type {ParsedTxn} from '../src/types';
import {loadFixtures, loadTemplates} from './helpers';

// PRD ONB acceptance: 90 days / 5,000 messages in under 30 s on a mid-range
// phone. Node on a laptop is far faster, so hold the engine to 2 s here.
test('parses, dedupes and analyses 5,000 messages quickly', () => {
  // Unique refs and amounts so dedupe can't collapse the set and hide slow paths.
  const templates = loadTemplates();
  const samples = loadFixtures().flatMap(f => f.cases);
  const start = Date.now();
  const parsed: ParsedTxn[] = [];
  for (let i = 0; i < 5000; i++) {
    const c = samples[i % samples.length];
    const r = parseSms({sender: c.sender, body: c.body, receivedAt: Date.parse('2025-09-18T12:00:00+05:30') + i * 600_000}, templates);
    if (r.status === 'parsed') {
      parsed.push({...r.txn, referenceNo: `999${i}`, amountPaise: r.txn.amountPaise + i});
    }
  }
  const kept = dedupe(parsed);
  assert.ok(kept.length > 3000, `kept ${kept.length}`);
  analyzeScan(kept, templates, Date.parse('2025-12-01T00:00:00+05:30'));
  const ms = Date.now() - start;
  assert.ok(ms < 2000, `took ${ms} ms`);
});
