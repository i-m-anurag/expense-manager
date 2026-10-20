import { bundledTemplates } from '@expense-manager/parser';
import { listAccounts } from '../src/db/accounts';
import { getMemory } from '../src/db/merchantMemory';
import { migrate } from '../src/db/migrations';
import { getSetting } from '../src/db/settings';
import { all } from '../src/db/sql';
import { countUncategorized, listTxns } from '../src/db/transactions';
import { markEmergency, setCategory } from '../src/domain/actions';
import { currentCycle } from '../src/domain/cycle';
import { ingestMessages } from '../src/domain/ingest';
import { saveOnboarding } from '../src/domain/onboarding';
import type { OnboardingState } from '../src/onboarding/OnboardingContext';
import { memorySql } from './helpers/memorySql';

const templates = bundledTemplates();
const at = (iso: string) => Date.parse(iso);

const swiggy = (ref: string, when: string) => ({
  sender: 'VM-HDFCBK',
  body: `Sent Rs.450.00\nFrom HDFC Bank A/C *4521\nTo SWIGGY\nOn 18/09/25\nRef ${ref}`,
  receivedAt: at(when),
});

test('migrations are idempotent', async () => {
  const sql = await memorySql();
  await expect(migrate(sql)).resolves.toBe(1);
  const cats = await all(sql, 'SELECT COUNT(*) AS n FROM categories');
  expect(Number(cats[0].n)).toBeGreaterThan(30);
});

test('ingest stores transactions, accounts and balances, and skips repeats', async () => {
  const sql = await memorySql();
  const salary = {
    sender: 'VM-HDFCBK',
    body: 'Update! INR 1,00,000.00 deposited in HDFC Bank A/c XX4521 on 01-SEP-25 for NEFT Cr-ACME0000123-ACME TECHNOLOGIES PVT LTD-SALARY SEP 2025.Avl bal INR 1,23,456.78. Cheque deposits in A/C are subject to clearing',
    receivedAt: at('2025-09-01T10:00:00+05:30'),
  };
  const otp = {
    sender: 'VM-HDFCBK',
    body: '999123 is the OTP for login',
    receivedAt: at('2025-09-02T10:00:00+05:30'),
  };
  const r1 = await ingestMessages(
    sql,
    [salary, otp, swiggy('999000000001', '2025-09-18T20:12:00+05:30')],
    templates,
  );
  expect(r1.inserted).toHaveLength(2);
  expect(r1.ignored).toBe(1);

  // Same messages again (on-open reconciliation overlap) change nothing.
  const r2 = await ingestMessages(
    sql,
    [salary, swiggy('999000000001', '2025-09-18T20:12:00+05:30')],
    templates,
  );
  expect(r2.inserted).toHaveLength(0);
  expect(r2.alreadySeen).toBe(2);

  const accounts = await listAccounts(sql);
  expect(accounts.map(a => a.id)).toEqual(['hdfc-4521']);
  expect(accounts[0].last_balance).toBe(12345678);

  const txns = await listTxns(sql);
  expect(txns.map(t => t.category_id)).toEqual([null, 'income.salary']);
  expect(txns[0].suggested_category_id).toBe('want.food_delivery');
  expect(txns[0].merchant_name).toBe('Swiggy');
});

test('a second SMS for the same payment is a duplicate', async () => {
  const sql = await memorySql();
  const upi = swiggy('999000000002', '2025-09-18T20:12:00+05:30');
  const sameRefOtherFormat = {
    sender: 'VM-HDFCBK',
    body: 'Update! INR 450.00 debited from HDFC Bank XX4521 on 18-SEP-25. Info: UPI-SWIGGY-999000000002. Avl bal:INR 45,000.00',
    receivedAt: at('2025-09-18T20:13:00+05:30'),
  };
  const r = await ingestMessages(sql, [upi, sameRefOtherFormat], templates);
  expect(r.inserted).toHaveLength(1);
  expect(r.duplicates).toBe(1);
});

test('money moved between own accounts is linked as a transfer', async () => {
  const sql = await memorySql();
  const out = {
    sender: 'VM-HDFCBK',
    body: 'Sent Rs.5000.00\nFrom HDFC Bank A/C *4521\nTo AXIS SAVINGS\nOn 16/09/25\nRef 999000000003',
    receivedAt: at('2025-09-16T09:00:00+05:30'),
  };
  const into = {
    sender: 'VM-AXISBK',
    body: 'INR 5000.00 credited\nA/c no. XX7710\n16-09-25, 09:01:00 IST\nUPI/P2A/999000000004/ANURAG\nAxis Bank',
    receivedAt: at('2025-09-16T09:01:00+05:30'),
  };
  await ingestMessages(sql, [out, into], templates);
  const txns = await listTxns(sql);
  expect(txns.every(t => t.is_transfer === 1)).toBe(true);
  expect(txns.every(t => t.category_id === 'transfer.self')).toBe(true);
  expect(txns[0].linked_txn_id).toBe(txns[1].id);
});

test('categorising with "always use this" teaches merchant memory', async () => {
  const sql = await memorySql();
  await ingestMessages(
    sql,
    [
      swiggy('999000000005', '2025-09-10T20:00:00+05:30'),
      swiggy('999000000006', '2025-09-12T20:00:00+05:30'),
    ],
    templates,
  );
  expect(await countUncategorized(sql)).toBe(2);
  const [latest] = await listTxns(sql);
  await setCategory(sql, latest.id, 'want.dining_out', true);
  expect(await countUncategorized(sql)).toBe(0);
  expect((await getMemory(sql, 'swiggy'))?.tag_count).toBe(1);

  // Changing to a different category resets confidence (CAT-08).
  await setCategory(sql, latest.id, 'want.food_delivery', true);
  const m = await getMemory(sql, 'swiggy');
  expect(m?.category_id).toBe('want.food_delivery');
  expect(m?.tag_count).toBe(1);
});

test('three consistent tags auto-apply to the next payment', async () => {
  const sql = await memorySql();
  for (let i = 0; i < 3; i++) {
    await ingestMessages(
      sql,
      [swiggy(`99900000001${i}`, `2025-09-0${i + 1}T20:00:00+05:30`)],
      templates,
    );
    const [t] = await listTxns(sql);
    await setCategory(sql, t.id, 'want.food_delivery', true);
  }
  await ingestMessages(
    sql,
    [swiggy('999000000020', '2025-09-08T20:00:00+05:30')],
    templates,
  );
  const [next] = await listTxns(sql);
  expect(next.category_id).toBe('want.food_delivery');
  expect(next.categorization_source).toBe('memory');
});

test('paid from emergency fund records a withdrawal', async () => {
  const sql = await memorySql();
  await ingestMessages(
    sql,
    [swiggy('999000000030', '2025-09-10T20:00:00+05:30')],
    templates,
  );
  const [t] = await listTxns(sql);
  await markEmergency(sql, t.id, 'Hospital');
  const entries = await all(
    sql,
    'SELECT type, amount, reason FROM emergency_fund_entries',
  );
  expect(entries).toEqual([
    { type: 'withdrawal', amount: 45000, reason: 'Hospital' },
  ]);
});

test('saving onboarding writes accounts, budget, memory and history', async () => {
  const sql = await memorySql();
  const state = {
    accounts: [
      {
        id: 'hdfc-4521',
        name: 'Salary',
        type: 'salary',
        include: true,
        balancePaise: 5000000,
      },
      {
        id: 'axis-7710',
        name: 'Rainy day',
        type: 'emergency',
        include: true,
        balancePaise: 24000000,
      },
    ],
    merchantMemory: { swiggy: 'want' },
    cycleMode: 'salary',
    cycleDay: 1,
    income: 100000,
    split: {
      need: 50000,
      want: 20000,
      investment: 15000,
      loan: 10000,
      emergency: 5000,
    },
    emergencyMonths: 6,
    emergencyAccountId: 'axis-7710',
    emergencyBalance: 240000,
    notificationsGranted: true,
  } as unknown as OnboardingState;
  const now = at('2025-09-20T12:00:00+05:30');
  await saveOnboarding(
    sql,
    state,
    [swiggy('999000000040', '2025-09-18T20:12:00+05:30')],
    templates,
    'Anurag',
    now,
  );

  expect(await getSetting(sql, 'onboarded')).toBe('1');
  const accounts = await listAccounts(sql);
  expect(accounts.map(a => [a.id, a.include_in_budget])).toEqual([
    ['hdfc-4521', 1],
    ['axis-7710', 0],
    ['cash', 1],
  ]);
  const cycles = await all(
    sql,
    'SELECT start_date, end_date, income FROM budget_cycles',
  );
  expect(cycles).toEqual([
    { start_date: '2025-09-01', end_date: '2025-09-30', income: 10000000 },
  ]);
  const [t] = await listTxns(sql);
  // Trained merchant is categorised automatically.
  expect(t.category_id).toBe('want.other');
});

test('salary cycles clamp to short months', () => {
  expect(currentCycle('salary', 31, at('2025-04-15T12:00:00+05:30'))).toEqual({
    start: '2025-03-31',
    end: '2025-04-29',
  });
  expect(currentCycle('salary', 25, at('2025-01-10T12:00:00+05:30'))).toEqual({
    start: '2024-12-25',
    end: '2025-01-24',
  });
  expect(currentCycle('calendar', 1, at('2025-02-10T12:00:00+05:30'))).toEqual({
    start: '2025-02-01',
    end: '2025-02-28',
  });
});
