// Budget numbers for Home and the Budget tab (PRD §7.6 key calculations).
// Queries gather rows; computeSnapshot() is pure so the maths is unit-tested.

import { BUDGET_BUCKETS } from '../db/categories';
import { getSetting } from '../db/settings';
import { Sql, all, one } from '../db/sql';
import { groupINR } from '../utils/format';
import {
  currentCycle,
  daysBetween,
  istDayStartMs,
  previousCycles,
  todayIst,
} from './cycle';
import { RecurringInput, RecurringKind, detectRecurring } from './recurring';

export type Bucket = (typeof BUDGET_BUCKETS)[number];
export type BucketStatus = 'onTrack' | 'watch' | 'over' | 'paid';

export interface Cycle {
  id: number;
  start_date: string;
  end_date: string;
  mode: 'salary' | 'calendar';
  income: number;
}

export interface Spend {
  amount: number;
  category_id: string | null;
  bucket: string | null;
  category_name: string | null;
  merchant_key: string | null;
}

export interface BucketView {
  bucket: Bucket;
  allocated: number;
  spent: number;
  left: number;
  used: number; // spent / allocated
  pace: number; // where spending should be today, 0..1
  status: BucketStatus;
  subs: { id: string; name: string; spent: number }[];
}

export interface Commitment {
  key: string;
  name: string;
  amount: number;
  date: string | null; // 'YYYY-MM-DD' in this cycle
  paid: boolean;
  kind: RecurringKind | 'emergency';
}

export interface BudgetSnapshot {
  cycle: Cycle;
  day: number; // 1-based day of cycle
  length: number;
  daysLeft: number; // including today
  buckets: BucketView[];
  totalBudget: number;
  totalSpent: number;
  uncategorizedSpent: number;
  left: number;
  emergencyAllocation: number;
  commitments: Commitment[];
  committed: number;
  flexible: number;
  upcomingUnpaid: number;
  safeToSpendToday: number;
  overall: BucketStatus;
  insight: string;
}

const FIXED_BUCKETS: Bucket[] = ['investment', 'loan'];
const PLURAL: Record<Bucket, string> = {
  need: 'Needs',
  want: 'Wants',
  investment: 'Investments',
  loan: 'EMIs',
};
const DAY_MS = 24 * 3600 * 1000;

// Brief §4.2 / §7: Over when past the budget; Watch at 80%+ used or past the
// pace tick (once 30% is used, so day-one spending doesn't trip it). Investment
// and EMI buckets are paid in one go, so pace doesn't apply; full means Paid.
export function bucketStatus(
  bucket: Bucket,
  allocated: number,
  spent: number,
  pace: number,
): BucketStatus {
  if (allocated <= 0) {
    return spent > 0 ? 'over' : 'onTrack';
  }
  const used = spent / allocated;
  if (used > 1.005) return 'over';
  if (FIXED_BUCKETS.includes(bucket)) return used >= 0.95 ? 'paid' : 'onTrack';
  if (used >= 0.8 || (used > pace && used >= 0.3)) return 'watch';
  return 'onTrack';
}

// Date in [start, end] that falls on `day` of the month (clamped to month end).
export function dateInCycle(
  day: number,
  start: string,
  end: string,
): string | null {
  const [y, m] = start.split('-').map(Number);
  for (let k = 0; k < 2; k++) {
    const mm = m - 1 + k;
    const daysInMonth = new Date(Date.UTC(y, mm + 1, 0)).getUTCDate();
    const d = new Date(Date.UTC(y, mm, Math.min(day, daysInMonth)));
    const iso = d.toISOString().slice(0, 10);
    if (iso >= start && iso <= end) return iso;
  }
  return null;
}

interface SnapshotInput {
  cycle: Cycle;
  allocations: { bucket: string; amount: number }[];
  spends: Spend[];
  history: RecurringInput[];
  emergencyContributed: boolean;
  today: string;
}

export function computeSnapshot(i: SnapshotInput): BudgetSnapshot {
  const { cycle, today } = i;
  const length = daysBetween(cycle.start_date, cycle.end_date) + 1;
  const day = Math.min(
    length,
    Math.max(1, daysBetween(cycle.start_date, today) + 1),
  );
  const daysLeft = length - day + 1;
  const pace = day / length;
  const alloc = (b: string) =>
    i.allocations.find(a => a.bucket === b)?.amount ?? 0;

  const buckets: BucketView[] = BUDGET_BUCKETS.map(bucket => {
    const mine = i.spends.filter(s => s.bucket === bucket);
    const spent = mine.reduce((s, x) => s + x.amount, 0);
    const allocated = alloc(bucket);
    const subs = new Map<string, { id: string; name: string; spent: number }>();
    for (const s of mine) {
      const id = s.category_id!;
      const e = subs.get(id) ?? { id, name: s.category_name ?? id, spent: 0 };
      e.spent += s.amount;
      subs.set(id, e);
    }
    return {
      bucket,
      allocated,
      spent,
      left: allocated - spent,
      used: allocated ? spent / allocated : spent ? 1 : 0,
      pace,
      status: bucketStatus(bucket, allocated, spent, pace),
      subs: [...subs.values()].sort((a, b) => b.spent - a.spent),
    };
  });

  const totalBudget = buckets.reduce((s, b) => s + b.allocated, 0);
  const totalSpent = i.spends.reduce((s, x) => s + x.amount, 0);
  const uncategorizedSpent = i.spends
    .filter(s => !s.bucket)
    .reduce((s, x) => s + x.amount, 0);

  // Fixed commitments (BUD-04): detected EMIs, SIPs, rent and subscriptions.
  const patterns = detectRecurring(i.history).filter(p => p.kind !== 'other');
  const commitments: Commitment[] = patterns.map(p => ({
    key: p.key,
    name: p.name,
    amount: p.amount,
    date: dateInCycle(p.day, cycle.start_date, cycle.end_date),
    paid: i.spends.some(
      s =>
        s.merchant_key === p.key &&
        Math.abs(s.amount - p.amount) <= p.amount * 0.1,
    ),
    kind: p.kind,
  }));
  const emergencyAllocation = alloc('emergency');
  if (emergencyAllocation > 0) {
    commitments.push({
      key: 'emergency',
      name: 'Emergency contribution',
      amount: emergencyAllocation,
      date: null,
      paid: i.emergencyContributed,
      kind: 'emergency',
    });
  }
  const committed = commitments.reduce((s, c) => s + c.amount, 0);
  const upcomingUnpaid = commitments
    .filter(
      c =>
        !c.paid &&
        c.kind !== 'emergency' &&
        (c.date === null || c.date >= today),
    )
    .reduce((s, c) => s + c.amount, 0);

  // PRD: safe to spend today = (budget remaining − unpaid expected recurring
  // payments this cycle) ÷ days remaining.
  const left = totalBudget - totalSpent;
  const safeToSpendToday = Math.max(
    0,
    Math.floor((left - upcomingUnpaid) / daysLeft),
  );

  const over = buckets.filter(b => b.status === 'over');
  const watch = buckets.filter(b => b.status === 'watch');
  const overall: BucketStatus =
    left < 0 || over.length ? 'over' : watch.length ? 'watch' : 'onTrack';

  return {
    cycle,
    day,
    length,
    daysLeft,
    buckets,
    totalBudget,
    totalSpent,
    uncategorizedSpent,
    left,
    emergencyAllocation,
    commitments,
    committed,
    flexible: Math.max(
      0,
      totalBudget -
        commitments
          .filter(c => c.kind !== 'emergency')
          .reduce((s, c) => s + c.amount, 0),
    ),
    upcomingUnpaid,
    safeToSpendToday,
    overall,
    insight: insightFor(over, watch, totalSpent, daysLeft),
  };
}

// Brief §11: encouraging, never judgemental.
function insightFor(
  over: BucketView[],
  watch: BucketView[],
  spent: number,
  daysLeft: number,
) {
  if (over.length) {
    const b = over[0];
    return `${PLURAL[b.bucket]} are ₹${groupINR(
      Math.round((b.spent - b.allocated) / 100),
    )} over budget, with ${daysLeft} day${daysLeft === 1 ? '' : 's'} left.`;
  }
  if (watch.length) {
    const names = watch.map(b => PLURAL[b.bucket]).join(' and ');
    // Bucket names are plural ("Wants"), so the verb is always "are".
    return `You're on track overall. ${names} are running a bit ahead of pace.`;
  }
  return spent
    ? "You're on track. Nice and steady."
    : 'No spending yet this cycle.';
}

// ---------------------------------------------------------------------------
// Queries

const SPEND_WHERE = `
  t.direction = 'debit' AND t.is_transfer = 0 AND t.is_emergency = 0
  AND (a.include_in_budget IS NULL OR a.include_in_budget = 1)`;

async function cycleSettings(sql: Sql) {
  const mode = ((await getSetting(sql, 'cycle_mode')) ??
    'salary') as Cycle['mode'];
  const salaryDay = Number((await getSetting(sql, 'salary_day')) ?? 1);
  return { mode, salaryDay };
}

// BUD-10: when a cycle ends, close it and open the next with the same plan.
// (Starting the cycle on the actual salary credit, BUD-02, comes with alerts.)
export async function ensureCurrentCycle(
  sql: Sql,
  now = Date.now(),
): Promise<Cycle | null> {
  let cycle = await one<Cycle & { [k: string]: any }>(
    sql,
    "SELECT id, start_date, end_date, mode, income FROM budget_cycles WHERE status = 'active' ORDER BY id DESC LIMIT 1",
  );
  if (!cycle) return null;
  const today = todayIst(now);
  if (cycle.end_date >= today) return cycle;
  const { salaryDay } = await cycleSettings(sql);
  await sql.transaction(async () => {
    while (cycle!.end_date < today) {
      const next = currentCycle(
        cycle!.mode,
        salaryDay,
        istDayStartMs(cycle!.end_date) + DAY_MS,
      );
      await sql.execute(
        "UPDATE budget_cycles SET status = 'closed' WHERE id = ?",
        [cycle!.id],
      );
      const r = await sql.execute(
        "INSERT INTO budget_cycles (start_date, end_date, mode, income, status) VALUES (?, ?, ?, ?, 'active')",
        [next.start, next.end, cycle!.mode, cycle!.income],
      );
      await sql.execute(
        `INSERT INTO budget_allocations (cycle_id, bucket, category_id, amount)
         SELECT ?, bucket, category_id, amount FROM budget_allocations WHERE cycle_id = ?`,
        [r.insertId!, cycle!.id],
      );
      cycle = {
        ...cycle!,
        id: r.insertId!,
        start_date: next.start,
        end_date: next.end,
      };
    }
  });
  return cycle;
}

const spendsBetween = (sql: Sql, from: number, to: number) =>
  all<Spend & { [k: string]: any }>(
    sql,
    `SELECT t.amount, t.category_id, c.bucket, c.name AS category_name, t.merchant_key
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     LEFT JOIN accounts a ON a.id = t.account_id
     WHERE ${SPEND_WHERE} AND t.occurred_at >= ? AND t.occurred_at < ?`,
    [from, to],
  );

export async function getBudgetSnapshot(
  sql: Sql,
  now = Date.now(),
): Promise<BudgetSnapshot | null> {
  const cycle = await ensureCurrentCycle(sql, now);
  if (!cycle) return null;
  const from = istDayStartMs(cycle.start_date);
  const to = istDayStartMs(cycle.end_date) + DAY_MS;
  const allocations = await all<{ bucket: string; amount: number }>(
    sql,
    'SELECT bucket, SUM(amount) AS amount FROM budget_allocations WHERE cycle_id = ? GROUP BY bucket',
    [cycle.id],
  );
  const spends = await spendsBetween(sql, from, to);
  const history = await all<RecurringInput & { [k: string]: any }>(
    sql,
    `SELECT t.merchant_key, t.merchant_name, t.amount, t.occurred_at, t.category_id
     FROM transactions t LEFT JOIN accounts a ON a.id = t.account_id
     WHERE ${SPEND_WHERE} AND t.merchant_key IS NOT NULL AND t.occurred_at >= ?`,
    [now - 120 * DAY_MS],
  );
  const contributed = await one(
    sql,
    "SELECT id FROM emergency_fund_entries WHERE type = 'contribution' AND created_at >= ? LIMIT 1",
    [from],
  );
  return computeSnapshot({
    cycle,
    allocations: allocations.map(a => ({
      bucket: a.bucket,
      amount: Number(a.amount),
    })),
    spends,
    history,
    emergencyContributed: contributed !== null,
    today: todayIst(now),
  });
}

// BUD-08 (without history yet): edit the current cycle's plan.
export async function updateAllocations(
  sql: Sql,
  cycleId: number,
  amounts: Record<string, number>,
) {
  await sql.transaction(async () => {
    for (const [bucket, amount] of Object.entries(amounts)) {
      const r = await sql.execute(
        'UPDATE budget_allocations SET amount = ? WHERE cycle_id = ? AND bucket = ? AND category_id IS NULL',
        [amount, cycleId, bucket],
      );
      if (!r.rowsAffected) {
        await sql.execute(
          'INSERT INTO budget_allocations (cycle_id, bucket, amount) VALUES (?, ?, ?)',
          [cycleId, bucket, amount],
        );
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Emergency fund (PRD §7.7)

export interface EmergencySnapshot {
  balance: number;
  targetMonths: number;
  averageNeed: number;
  averageFromHistory: boolean;
  monthsCovered: number;
  linked: {
    id: string;
    name: string;
    balance: number | null;
    updatedAt: number | null;
  }[];
  contributions: { amount: number; at: number }[];
  withdrawals: {
    amount: number;
    at: number;
    reason: string | null;
    name: string | null;
  }[];
  refillMonthly: number | null;
}

export async function getEmergencySnapshot(
  sql: Sql,
  now = Date.now(),
): Promise<EmergencySnapshot | null> {
  const fund = await one<{
    target_months: number;
    need_spend_override: number | null;
    linked_account_ids: string;
    manual_balance: number;
  }>(
    sql,
    'SELECT target_months, need_spend_override, linked_account_ids, manual_balance FROM emergency_fund WHERE id = 1',
  );
  if (!fund) return null;
  const ids: string[] = JSON.parse(fund.linked_account_ids || '[]');
  const linked = ids.length
    ? await all<{
        id: string;
        display_name: string;
        last_balance: number | null;
        balance_updated_at: number | null;
      }>(
        sql,
        `SELECT id, display_name, last_balance, balance_updated_at FROM accounts WHERE id IN (${ids
          .map(() => '?')
          .join(',')})`,
        ids,
      )
    : [];
  const entries = await all<{
    type: string;
    amount: number;
    created_at: number;
    reason: string | null;
    occurred_at: number | null;
    merchant_name: string | null;
    account_id: string | null;
  }>(
    sql,
    `SELECT e.type, e.amount, e.created_at, e.reason, t.occurred_at, t.merchant_name, t.account_id
     FROM emergency_fund_entries e LEFT JOIN transactions t ON t.id = e.transaction_id
     ORDER BY COALESCE(t.occurred_at, e.created_at) DESC`,
  );
  const withdrawals = entries.filter(e => e.type === 'withdrawal');
  const contributions = entries.filter(e => e.type === 'contribution');

  // EMF-04: linked account balances from SMS, or a manually tracked balance.
  // Withdrawals paid from other accounts are taken off, since the linked
  // balance won't show them.
  const base = ids.length
    ? linked.reduce((s, a) => s + Number(a.last_balance ?? 0), 0)
    : Number(fund.manual_balance) +
      contributions.reduce((s, e) => s + Number(e.amount), 0);
  const balance =
    base -
    withdrawals
      .filter(w => !w.account_id || !ids.includes(w.account_id))
      .reduce((s, w) => s + Number(w.amount), 0);

  // EMF-02: average Need spend over the last 3 completed cycles, else the
  // Need budget. A manual override wins.
  const cycle = await ensureCurrentCycle(sql, now);
  let averageNeed = 0;
  let averageFromHistory = false;
  if (fund.need_spend_override) {
    averageNeed = Number(fund.need_spend_override);
  } else if (cycle) {
    const { salaryDay } = await cycleSettings(sql);
    const prev = previousCycles(cycle.mode, salaryDay, cycle.start_date, 3);
    const totals: number[] = [];
    for (const c of prev) {
      const rows = await spendsBetween(
        sql,
        istDayStartMs(c.start),
        istDayStartMs(c.end) + DAY_MS,
      );
      totals.push(
        rows.filter(r => r.bucket === 'need').reduce((s, r) => s + r.amount, 0),
      );
    }
    const withData = totals.filter(t => t > 0);
    if (withData.length) {
      averageNeed = Math.round(
        withData.reduce((s, t) => s + t, 0) / withData.length,
      );
      averageFromHistory = true;
    } else {
      const need = await one<{ amount: number }>(
        sql,
        "SELECT SUM(amount) AS amount FROM budget_allocations WHERE cycle_id = ? AND bucket = 'need'",
        [cycle.id],
      );
      averageNeed = Number(need?.amount ?? 0);
    }
  }

  const monthsCovered = averageNeed ? balance / averageNeed : 0;
  const target = fund.target_months * averageNeed;
  // EMF-08: after a withdrawal, suggest topping back up over 6 months.
  const refillMonthly =
    withdrawals.length && balance < target
      ? Math.ceil((target - balance) / 6 / 100000) * 100000
      : null;

  return {
    balance,
    targetMonths: fund.target_months,
    averageNeed,
    averageFromHistory,
    monthsCovered,
    linked: linked.map(a => ({
      id: a.id,
      name: a.display_name,
      balance: a.last_balance,
      updatedAt: a.balance_updated_at,
    })),
    contributions: contributions.map(c => ({
      amount: Number(c.amount),
      at: Number(c.occurred_at ?? c.created_at),
    })),
    withdrawals: withdrawals.map(w => ({
      amount: Number(w.amount),
      at: Number(w.occurred_at ?? w.created_at),
      reason: w.reason,
      name: w.merchant_name,
    })),
    refillMonthly,
  };
}
