import { bundledTemplates } from '@expense-manager/parser';
import { markEmergency, setCategory } from '../src/domain/actions';
import {
  Spend,
  bucketStatus,
  computeSnapshot,
  dateInCycle,
  ensureCurrentCycle,
  getBudgetSnapshot,
  getEmergencySnapshot,
} from '../src/domain/budget';
import { ingestMessages } from '../src/domain/ingest';
import { saveOnboarding } from '../src/domain/onboarding';
import { detectRecurring } from '../src/domain/recurring';
import { all } from '../src/db/sql';
import { listTxns } from '../src/db/transactions';
import type { OnboardingState } from '../src/onboarding/OnboardingContext';
import { memorySql } from './helpers/memorySql';

const at = (iso: string) => Date.parse(iso);
const L = (r: number) => r * 100; // rupees → paise

const cycle = {
  id: 1,
  start_date: '2025-09-01',
  end_date: '2025-09-30',
  mode: 'salary' as const,
  income: L(100000),
};
const allocations = [
  { bucket: 'need', amount: L(50000) },
  { bucket: 'want', amount: L(20000) },
  { bucket: 'investment', amount: L(15000) },
  { bucket: 'loan', amount: L(10000) },
  { bucket: 'emergency', amount: L(5000) },
];
const spend = (bucket: string | null, rupees: number, key = 'x'): Spend => ({
  amount: L(rupees),
  bucket,
  category_id: bucket ? `${bucket}.other` : null,
  category_name: 'Other',
  merchant_key: key,
});

test('bucket status follows the brief', () => {
  expect(bucketStatus('want', L(20000), L(5000), 0.6)).toBe('onTrack');
  expect(bucketStatus('want', L(20000), L(15800), 0.6)).toBe('watch'); // 79% > pace 60%
  expect(bucketStatus('want', L(20000), L(16000), 0.9)).toBe('watch'); // 80%+
  expect(bucketStatus('want', L(20000), L(4000), 0.05)).toBe('onTrack'); // ahead of pace but < 30%
  expect(bucketStatus('want', L(20000), L(21000), 0.6)).toBe('over');
  expect(bucketStatus('loan', L(10000), L(10000), 0.2)).toBe('paid');
  expect(bucketStatus('investment', L(15000), L(8000), 0.9)).toBe('onTrack');
});

test('safe to spend reserves upcoming commitments', () => {
  const history = [
    {
      merchant_key: 'hdfcmf',
      merchant_name: 'HDFC MF',
      amount: L(15000),
      occurred_at: at('2025-07-25T10:00:00+05:30'),
      category_id: 'investment.sip',
    },
    {
      merchant_key: 'hdfcmf',
      merchant_name: 'HDFC MF',
      amount: L(15000),
      occurred_at: at('2025-08-25T10:00:00+05:30'),
      category_id: 'investment.sip',
    },
  ];
  const s = computeSnapshot({
    cycle,
    allocations,
    spends: [spend('need', 30000), spend('want', 15800), spend(null, 1000)],
    history,
    emergencyContributed: false,
    today: '2025-09-18',
  });
  expect(s.day).toBe(18);
  expect(s.daysLeft).toBe(13);
  expect(s.totalBudget).toBe(L(95000));
  expect(s.left).toBe(L(95000 - 46800));
  // SIP on the 25th is still to come: (48,200 − 15,000) / 13 days.
  expect(s.upcomingUnpaid).toBe(L(15000));
  expect(s.safeToSpendToday).toBe(Math.floor(L(33200) / 13));
  expect(s.buckets.find(b => b.bucket === 'want')?.status).toBe('watch');
  expect(s.overall).toBe('watch');
  expect(s.insight).toBe(
    "You're on track overall. Wants are running a bit ahead of pace.",
  );
  expect(s.commitments.map(c => [c.name, c.date, c.paid])).toEqual([
    ['HDFC MF', '2025-09-25', false],
    ['Emergency contribution', null, false],
  ]);
});

test('recurring needs two months around the same day', () => {
  const p = (iso: string, amount = L(649)) => ({
    merchant_key: 'netflix',
    merchant_name: 'Netflix',
    amount,
    occurred_at: at(iso),
    category_id: 'want.subscriptions',
  });
  expect(
    detectRecurring([
      p('2025-08-23T10:00:00+05:30'),
      p('2025-09-22T10:00:00+05:30'),
    ]),
  ).toHaveLength(1);
  expect(
    detectRecurring([
      p('2025-08-23T10:00:00+05:30'),
      p('2025-09-05T10:00:00+05:30'),
    ]),
  ).toHaveLength(0);
  expect(
    detectRecurring([
      p('2025-09-01T10:00:00+05:30'),
      p('2025-09-20T10:00:00+05:30'),
    ]),
  ).toHaveLength(0);
});

test('cycle dates clamp to the month', () => {
  expect(dateInCycle(25, '2025-09-01', '2025-09-30')).toBe('2025-09-25');
  expect(dateInCycle(3, '2025-09-25', '2025-10-24')).toBe('2025-10-03');
  expect(dateInCycle(31, '2025-02-01', '2025-02-28')).toBe('2025-02-28');
});

const onboarding = {
  accounts: [
    {
      id: 'hdfc-4521',
      name: 'HDFC ••4521',
      type: 'salary',
      include: true,
      balancePaise: null,
    },
  ],
  merchantMemory: {},
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
  emergencyAccountId: null,
  emergencyBalance: 100000,
  notificationsGranted: false,
} as unknown as OnboardingState;

test('a finished cycle rolls over with the same plan', async () => {
  const sql = await memorySql();
  await saveOnboarding(
    sql,
    onboarding,
    [],
    bundledTemplates(),
    'A',
    at('2025-09-20T12:00:00+05:30'),
  );
  const next = await ensureCurrentCycle(sql, at('2025-11-03T12:00:00+05:30'));
  expect([next?.start_date, next?.end_date]).toEqual([
    '2025-11-01',
    '2025-11-30',
  ]);
  const rows = await all(sql, 'SELECT status FROM budget_cycles ORDER BY id');
  expect(rows.map(r => r.status)).toEqual(['closed', 'closed', 'active']);
  const alloc = await all(
    sql,
    'SELECT SUM(amount) AS n FROM budget_allocations WHERE cycle_id = ?',
    [next!.id],
  );
  expect(Number(alloc[0].n)).toBe(L(100000));
});

test('budget and emergency snapshots from stored data', async () => {
  const sql = await memorySql();
  const now = at('2025-09-20T12:00:00+05:30');
  await saveOnboarding(sql, onboarding, [], bundledTemplates(), 'A', now);
  await ingestMessages(
    sql,
    [
      {
        sender: 'VM-HDFCBK',
        body: 'Sent Rs.450.00\nFrom HDFC Bank A/C *4521\nTo SWIGGY\nOn 18/09/25\nRef 999000000101',
        receivedAt: at('2025-09-18T20:00:00+05:30'),
      },
      {
        sender: 'VM-HDFCBK',
        body: 'Sent Rs.2000.00\nFrom HDFC Bank A/C *4521\nTo APOLLO PHARMACY\nOn 12/08/25\nRef 999000000102',
        receivedAt: at('2025-08-12T20:00:00+05:30'),
      },
    ],
    bundledTemplates(),
    now,
  );
  const txns = await listTxns(sql);
  await setCategory(sql, txns[0].id, 'want.food_delivery', true);
  await setCategory(sql, txns[1].id, 'need.medical', true);

  const b = await getBudgetSnapshot(sql, now);
  expect(b?.totalSpent).toBe(L(450));
  expect(b?.buckets.find(x => x.bucket === 'want')?.spent).toBe(L(450));

  await markEmergency(sql, txns[0].id, 'Test');
  const e = await getEmergencySnapshot(sql, now);
  // Manual balance 1,00,000 minus the ₹450 withdrawal; Need average from August.
  expect(e?.balance).toBe(L(100000 - 450));
  expect(e?.averageNeed).toBe(L(2000));
  expect(e?.averageFromHistory).toBe(true);
  expect(e?.withdrawals[0].reason).toBe('Test');
});
