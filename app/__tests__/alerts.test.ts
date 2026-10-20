import {
  budgetAlerts,
  isQuiet,
  paymentNotification,
  quietEnds,
  upcomingReminders,
} from '../src/domain/alerts';
import { computeSnapshot, Spend } from '../src/domain/budget';
import type { TxnView } from '../src/db/transactions';

const L = (r: number) => r * 100;
const cycle = {
  id: 7,
  start_date: '2025-09-01',
  end_date: '2025-09-30',
  mode: 'calendar' as const,
  income: L(100000),
};
const allocations = [
  { bucket: 'need', amount: L(50000) },
  { bucket: 'want', amount: L(20000) },
  { bucket: 'investment', amount: L(15000) },
  { bucket: 'loan', amount: L(10000) },
];
const spend = (bucket: string, rupees: number): Spend => ({
  amount: L(rupees),
  bucket,
  category_id: `${bucket}.other`,
  category_name: 'Other',
  merchant_key: 'x',
});
const snap = (spends: Spend[], today: string, history = []) =>
  computeSnapshot({
    cycle,
    allocations,
    spends,
    history,
    emergencyContributed: false,
    today,
  });
const now = Date.parse('2025-09-20T12:00:00+05:30');

test('the highest new threshold is shown; lower ones are only logged', () => {
  const alerts = budgetAlerts(
    snap([spend('want', 17000)], '2025-09-20'),
    [],
    now,
  );
  expect(alerts.map(a => [a.type, !!a.spec])).toEqual([
    ['threshold_80', true],
    ['threshold_50', false],
  ]);
  expect(alerts[0].spec?.title).toBe('Want budget 80% used');
  expect(alerts[0].spec?.body).toBe('₹3,000 left · 11 days to go.');
});

test('a threshold fires once per cycle', () => {
  const log = [
    {
      alert_type: 'threshold_80',
      category_id: 'want',
      cycle_id: 7,
      sent_at: now - 1000,
    },
    {
      alert_type: 'threshold_50',
      category_id: 'want',
      cycle_id: 7,
      sent_at: now - 1000,
    },
  ];
  expect(
    budgetAlerts(snap([spend('want', 17500)], '2025-09-20'), log, now),
  ).toEqual([]);
});

test('pace alert after 30% used and 20% past pace, at most weekly', () => {
  // Day 5 of 30: pace 16.7%; 40% of Need used.
  const s = snap([spend('need', 20000)], '2025-09-05');
  // Logged in an earlier cycle, so it doesn't block this one's pace alert.
  const log = [
    {
      alert_type: 'threshold_50',
      category_id: 'need',
      cycle_id: 6,
      sent_at: now - 8 * 86400000,
    },
  ];
  const first = budgetAlerts(s, log, now);
  expect(first.map(a => a.type)).toEqual(['pace']);
  expect(first[0].spec?.title).toBe("Needs: you've used 40%");
  const again = budgetAlerts(
    s,
    [
      ...log,
      {
        alert_type: 'pace',
        category_id: 'need',
        cycle_id: 7,
        sent_at: now - 2 * 86400000,
      },
    ],
    now,
  );
  expect(again).toEqual([]);
});

test('investment and EMI buckets never alert', () => {
  expect(
    budgetAlerts(
      snap([spend('investment', 15000), spend('loan', 10000)], '2025-09-03'),
      [],
      now,
    ),
  ).toEqual([]);
});

test('quiet hours wrap past midnight', () => {
  const at = (h: number, m = 0) => new Date(2025, 8, 20, h, m).getTime();
  expect(isQuiet(at(23))).toBe(true);
  expect(isQuiet(at(2))).toBe(true);
  expect(isQuiet(at(8))).toBe(false);
  expect(isQuiet(at(21, 59))).toBe(false);
  expect(new Date(quietEnds(at(23))).getDate()).toBe(21);
  expect(new Date(quietEnds(at(2))).getHours()).toBe(8);
});

const txn = (p: Partial<TxnView>): TxnView =>
  ({
    id: 42,
    amount: L(450),
    direction: 'debit',
    merchant_name: 'Swiggy',
    merchant_raw: 'SWIGGY',
    account_name: 'HDFC ••4521',
    account_mask: '4521',
    category_id: null,
    suggested_category_id: null,
    ...p,
  } as TxnView);
const names = {
  'want.food_delivery': 'Food delivery',
  'need.utilities': 'Utilities',
  'want.other': 'Other',
};

test('payment notification offers the suggested bucket first', () => {
  const n = paymentNotification(
    txn({ suggested_category_id: 'want.food_delivery' }),
    names,
    false,
  );
  expect(n.title).toBe('₹450 at Swiggy · HDFC ••4521');
  expect(n.body).toBe('Looks like Want · Food delivery. Tap to save.');
  expect(n.actions?.map(a => [a.label, a.categoryId ?? a.url])).toEqual([
    ['Want', 'want.food_delivery'],
    ['Need', 'need.other'],
    ['Other', 'expensemanager://txn/42'],
  ]);
  expect(n.channel).toBe('transactions');
});

test('auto-categorised payment shows where it went, quietly at night', () => {
  const n = paymentNotification(
    txn({
      merchant_name: 'Airtel',
      amount: L(1299),
      category_id: 'need.utilities',
    }),
    names,
    true,
  );
  expect(n.title).toBe('₹1,299 Airtel → Need · Utilities');
  expect(n.actions).toEqual([
    { label: 'Change', url: 'expensemanager://txn/42' },
  ]);
  expect(n.channel).toBe('transactions_quiet');
});

test('upcoming reminder 2 days before at 9 AM', () => {
  const history = [
    {
      merchant_key: 'netflix',
      merchant_name: 'Netflix',
      amount: L(649),
      occurred_at: Date.parse('2025-07-25T10:00:00+05:30'),
      category_id: 'want.subscriptions',
    },
    {
      merchant_key: 'netflix',
      merchant_name: 'Netflix',
      amount: L(649),
      occurred_at: Date.parse('2025-08-25T10:00:00+05:30'),
      category_id: 'want.subscriptions',
    },
  ];
  const s = computeSnapshot({
    cycle,
    allocations,
    spends: [],
    history,
    emergencyContributed: false,
    today: '2025-09-20',
  });
  const r = upcomingReminders(s, [], now);
  expect(r).toHaveLength(1);
  expect(r[0].spec?.title).toBe('Netflix · ₹649');
  expect(new Date(r[0].at!).getDate()).toBe(23);
  expect(new Date(r[0].at!).getHours()).toBe(9);
  expect(
    upcomingReminders(
      s,
      [
        {
          alert_type: 'upcoming:netflix',
          category_id: null,
          cycle_id: 7,
          sent_at: now,
        },
      ],
      now,
    ),
  ).toEqual([]);
});
