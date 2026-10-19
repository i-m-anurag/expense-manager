import assert from 'node:assert/strict';
import {test} from 'node:test';
import {analyzeScan, detectSalary, displayName, findTransfers} from '../src/analyze';
import {dedupe} from '../src/dedupe';
import {merchantKey} from '../src/merchant';
import {compileRegex, senderCode} from '../src/parse';
import type {ParsedTxn} from '../src/types';
import {parseDate, toMask, toPaise} from '../src/values';
import {loadTemplates} from './helpers';

test('amounts become integer paise', () => {
  assert.equal(toPaise('1,00,000.00'), 10000000);
  assert.equal(toPaise('Rs.450.5'), 45050);
  assert.equal(toPaise('INR 1299'), 129900);
  assert.equal(toPaise(''), null);
});

test('account masks keep the last 4 digits', () => {
  assert.equal(toMask('XX4521'), '4521');
  assert.equal(toMask('XXXXX8830'), '8830');
  assert.equal(toMask('XX123'), '123');
  assert.equal(toMask('X'), null);
});

test('date formats', () => {
  assert.deepEqual(parseDate('18Sep25', 'dMMMyy'), {year: 2025, month: 8, day: 18});
  assert.deepEqual(parseDate('5Sep25', 'dMMMyy'), {year: 2025, month: 8, day: 5});
  assert.deepEqual(parseDate('01-SEP-25', 'dd-MMM-yy'), {year: 2025, month: 8, day: 1});
  assert.deepEqual(parseDate('2025-09-18', 'yyyy-MM-dd'), {year: 2025, month: 8, day: 18});
  assert.equal(parseDate('32/13/25', 'dd/MM/yy'), null);
});

test('sender codes ignore operator prefix and TRAI suffix', () => {
  assert.equal(senderCode('VM-HDFCBK'), 'HDFCBK');
  assert.equal(senderCode('AD-HDFCBK-S'), 'HDFCBK');
  assert.equal(senderCode('HDFCBK'), 'HDFCBK');
});

test('inline (?i) flag', () => {
  assert.ok(compileRegex('(?i)debited').test('DEBITED'));
});

test('merchant keys', () => {
  assert.equal(merchantKey('swiggy.stores@axisbank'), 'swiggy');
  assert.equal(merchantKey('SWIGGY'), 'swiggy');
  assert.equal(merchantKey('AMAZON PAY INDIA PRIVA'), 'amazon');
  assert.equal(merchantKey('paytmqr2810050501@paytm'), 'paytmqr');
  assert.equal(merchantKey('BAJAJ FINANCE LTD'), 'bajajfinance');
  assert.equal(merchantKey(null), null);
});

test('display names', () => {
  assert.equal(displayName('rakesh.kumar@okicici'), 'Rakesh Kumar');
  assert.equal(displayName('SWIGGY'), 'Swiggy');
});

const base: ParsedTxn = {
  bankCode: 'hdfc',
  patternId: 'x',
  type: 'upi',
  direction: 'debit',
  amountPaise: 45000,
  accountMask: '4521',
  accountKind: 'account',
  merchantRaw: 'SWIGGY',
  merchantKey: 'swiggy',
  referenceNo: null,
  occurredAt: Date.parse('2025-09-18T14:00:00+05:30'),
  balancePaise: null,
  availableLimitPaise: null,
};
const txn = (p: Partial<ParsedTxn>): ParsedTxn => ({...base, ...p});

test('dedupe by reference number', () => {
  const a = txn({referenceNo: '999'});
  const b = txn({referenceNo: '999', merchantRaw: null, occurredAt: base.occurredAt + 60_000});
  assert.equal(dedupe([a, b]).length, 1);
});

test('dedupe by account, amount and direction within 10 minutes', () => {
  assert.equal(dedupe([txn({}), txn({occurredAt: base.occurredAt + 5 * 60_000})]).length, 1);
  assert.equal(dedupe([txn({}), txn({occurredAt: base.occurredAt + 15 * 60_000})]).length, 2);
  assert.equal(dedupe([txn({}), txn({direction: 'credit'})]).length, 2);
});

test('self-transfer between own accounts is not spending', () => {
  const out = txn({merchantRaw: 'SELF', merchantKey: 'self', amountPaise: 2000000});
  const into = txn({bankCode: 'axis', accountMask: '7710', direction: 'credit', amountPaise: 2000000, occurredAt: base.occurredAt + 60_000});
  assert.deepEqual([...findTransfers([out, into])].sort(), [0, 1]);
});

test('credit card bill payment is a transfer when the user has a card', () => {
  const card = txn({accountKind: 'card', accountMask: '1123', type: 'credit_card'});
  const bill = txn({merchantRaw: 'ICICI CREDIT CARD', merchantKey: 'icicicreditcard', amountPaise: 1500000});
  assert.ok(findTransfers([card, bill]).has(1));
});

test('salary detection needs two months at a similar amount', () => {
  const sal = (iso: string, amount: number) =>
    txn({direction: 'credit', type: 'neft', amountPaise: amount, merchantRaw: 'ACME', occurredAt: Date.parse(iso)});
  const s = detectSalary([sal('2025-08-01T10:00:00+05:30', 10000000), sal('2025-09-01T10:00:00+05:30', 10200000)], new Set());
  assert.ok(s);
  assert.equal(s.day, 1);
  assert.equal(s.monthsSeen, 2);
  assert.equal(detectSalary([sal('2025-09-01T10:00:00+05:30', 10000000)], new Set()), null);
});

test('scan summary groups spending by month and bucket', () => {
  const templates = loadTemplates();
  const now = Date.parse('2025-09-20T12:00:00+05:30');
  const s = analyzeScan(
    [
      txn({occurredAt: Date.parse('2025-09-10T12:00:00+05:30')}),
      txn({merchantRaw: 'BIGBASKET', merchantKey: 'bigbasket', amountPaise: 300000, occurredAt: Date.parse('2025-08-10T12:00:00+05:30')}),
      txn({merchantRaw: 'BAJAJ FINANCE', merchantKey: 'bajajfinance', type: 'auto_debit', amountPaise: 1000000, occurredAt: Date.parse('2025-09-05T12:00:00+05:30')}),
    ],
    templates,
    now,
  );
  assert.deepEqual(s.months.map(m => m.label), ['Jul', 'Aug', 'Sep']);
  assert.equal(s.months[2].want, 45000);
  assert.equal(s.months[2].loan, 1000000);
  assert.equal(s.months[1].need, 300000);
  assert.equal(s.accounts.length, 1);
  assert.equal(s.accounts[0].bankName, 'HDFC Bank');
  assert.ok(s.merchants.some(m => m.key === 'swiggy' && m.suggested === 'want'));
});
