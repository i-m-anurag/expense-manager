// Insights tab (brief §9.8, PRD INS-02..07). computeInsights() is pure; the
// query wrapper gathers one cycle plus the five before it.

import { BUDGET_BUCKETS } from '../db/categories';
import { Sql, all } from '../db/sql';
import { groupINR } from '../utils/format';
import {
  Bucket,
  Spend,
  cycleSettings,
  ensureCurrentCycle,
  spendsBetween,
} from './budget';
import {
  CycleRange,
  daysBetween,
  istDayStartMs,
  previousCycles,
  todayIst,
} from './cycle';
import { RecurringInput, detectRecurring } from './recurring';

const DAY_MS = 24 * 3600 * 1000;
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const FULL_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const PLURAL: Record<Bucket, string> = {
  need: 'Needs',
  want: 'Wants',
  investment: 'Investments',
  loan: 'EMIs',
};

export type NoteTone = 'watch' | 'good' | 'gold';

export interface Insights {
  range: CycleRange;
  label: string; // "Sep 2026"
  isCurrent: boolean;
  notes: { tone: NoteTone; text: string }[];
  totalSpent: number;
  split: { bucket: Bucket; amount: number; share: number }[];
  splitSentence: string;
  categories: {
    id: string;
    name: string;
    bucket: string | null;
    amount: number;
  }[];
  cycles: { label: string; total: number; current: boolean }[];
  cyclesSentence: string;
  forecast: {
    total: number;
    budget: number;
    text: string;
    over: boolean;
  } | null;
  subscriptions: { name: string; amount: number }[];
  subscriptionsTotal: number;
  saved: {
    investment: number;
    emergency: number;
    income: number;
    rate: number;
  };
  merchants: { name: string; amount: number }[];
}

// Label a cycle by the month most of it falls in.
export function cycleLabel(r: CycleRange, long = false) {
  const mid = new Date(
    (Date.parse(`${r.start}T00:00:00Z`) + Date.parse(`${r.end}T00:00:00Z`)) / 2,
  );
  const m = mid.getUTCMonth();
  return long ? FULL_MONTHS[m] : `${MONTHS[m]} ${mid.getUTCFullYear()}`;
}

const rupees = (paise: number) =>
  `₹${groupINR(Math.round(Math.abs(paise) / 100))}`;
const compact = (paise: number) => {
  const r = paise / 100;
  return r >= 100000
    ? `₹${(r / 100000).toFixed(1)}L`
    : r >= 1000
    ? `₹${Math.round(r / 1000)}K`
    : `₹${Math.round(r)}`;
};
const sum = (xs: Spend[]) => xs.reduce((s, x) => s + x.amount, 0);

interface Input {
  range: CycleRange;
  isCurrent: boolean;
  today: string;
  spends: Spend[];
  previous: Spend[]; // the cycle before `range`
  history: { range: CycleRange; spends: Spend[] }[]; // oldest first, ending with `range`
  allocations: Record<string, number>;
  income: number;
  recurring: RecurringInput[];
  emergencyContributions: number;
}

export function computeInsights(i: Input): Insights {
  const total = sum(i.spends);
  const byBucket = (xs: Spend[], b: string) =>
    sum(xs.filter(x => x.bucket === b));

  // Where it went (INS-02): the one donut, budget buckets only.
  const bucketTotals = BUDGET_BUCKETS.map(b => ({
    bucket: b,
    amount: Math.max(0, byBucket(i.spends, b)),
  }));
  const sorted = bucketTotals.reduce((s, b) => s + b.amount, 0);
  const split = bucketTotals.map(b => ({
    ...b,
    share: sorted ? b.amount / sorted : 0,
  }));
  const top = [...split].sort((a, b) => b.amount - a.amount)[0];
  const share = top?.share ?? 0;
  const portion =
    share >= 0.45 && share <= 0.55
      ? 'about half'
      : share > 0.55
      ? 'more than half'
      : share >= 0.3
      ? 'about a third'
      : share >= 0.22
      ? 'about a quarter'
      : 'the biggest part';
  const splitSentence = sorted
    ? `${PLURAL[top.bucket]} are ${portion} of what you've spent${
        i.isCurrent ? ' so far' : ''
      }.`
    : 'Nothing categorised yet in this cycle.';

  // Top categories.
  const cats = new Map<
    string,
    { id: string; name: string; bucket: string | null; amount: number }
  >();
  for (const s of i.spends) {
    if (
      !s.category_id ||
      !s.bucket ||
      !(BUDGET_BUCKETS as readonly string[]).includes(s.bucket)
    )
      continue;
    const e = cats.get(s.category_id) ?? {
      id: s.category_id,
      name: s.category_name ?? s.category_id,
      bucket: s.bucket,
      amount: 0,
    };
    e.amount += s.amount;
    cats.set(s.category_id, e);
  }
  const categories = [...cats.values()]
    .filter(c => c.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  // Last 6 cycles (INS-03).
  const cycles = i.history.map(h => ({
    label: cycleLabel(h.range).slice(0, 3),
    total: Math.max(0, sum(h.spends)),
    current: h.range.start === i.range.start,
  }));
  const withData = cycles.filter(c => c.total > 0);
  let cyclesSentence = 'Trends appear once you have a few cycles of history.';
  if (withData.length >= 2) {
    const past = withData.filter(c => !(c.current && i.isCurrent));
    const pool = past.length >= 2 ? past : withData;
    const hi = pool.reduce((a, b) => (b.total > a.total ? b : a));
    const lo = pool.reduce((a, b) => (b.total < a.total ? b : a));
    const name = i.history.find(h =>
      cycleLabel(h.range).startsWith(hi.label),
    )?.range;
    cyclesSentence = `Spending has stayed between ${compact(
      lo.total,
    )} and ${compact(hi.total)}. ${
      name ? cycleLabel(name, true) : hi.label
    } was your highest.`;
  }

  // Notes (brief: 2–3 plain-language insight cards).
  const notes: Insights['notes'] = [];
  const length = daysBetween(i.range.start, i.range.end) + 1;
  const day = i.isCurrent
    ? Math.min(length, daysBetween(i.range.start, i.today) + 1)
    : length;
  const daysLeft = length - day + (i.isCurrent ? 1 : 0);
  if (i.isCurrent) {
    for (const b of ['want', 'need'] as Bucket[]) {
      const alloc = i.allocations[b] ?? 0;
      const ahead = byBucket(i.spends, b) - alloc * (day / length);
      if (alloc && ahead > alloc * 0.05) {
        notes.push({
          tone: 'watch',
          text: `You're ${rupees(ahead)} ahead of pace on ${
            PLURAL[b]
          }, with ${daysLeft} day${daysLeft === 1 ? '' : 's'} left.`,
        });
        break;
      }
    }
  }
  if (i.previous.length) {
    const prevCats = new Map<string, number>();
    for (const s of i.previous)
      if (s.category_name && s.bucket && s.bucket !== 'income')
        prevCats.set(
          s.category_name,
          (prevCats.get(s.category_name) ?? 0) + s.amount,
        );
    // Compare like with like: the same number of days into the previous cycle
    // would be fairer, but a full previous cycle keeps the sentence simple.
    let best: { name: string; diff: number } | null = null;
    for (const c of categories) {
      const prev = prevCats.get(c.name);
      if (prev === undefined) continue;
      const diff = c.amount - prev;
      if (diff < 0 && (!best || diff < best.diff))
        best = { name: c.name, diff };
    }
    if (best && -best.diff >= 50000)
      notes.push({
        tone: 'good',
        text: `${best.name} ${best.name.endsWith('s') ? 'are' : 'is'} ${rupees(
          best.diff,
        )} lower than last cycle.`,
      });
  }
  const invAlloc = i.allocations.investment ?? 0;
  if (invAlloc) {
    let streak = 0;
    for (let k = i.history.length - 1; k >= 0; k--) {
      const h = i.history[k];
      if (
        h.range.start === i.range.start &&
        i.isCurrent &&
        byBucket(h.spends, 'investment') < invAlloc * 0.95
      )
        continue;
      if (byBucket(h.spends, 'investment') >= invAlloc * 0.95) streak++;
      else break;
    }
    if (streak >= 2)
      notes.push({
        tone: 'gold',
        text: `You've invested on schedule ${streak} cycles in a row.`,
      });
  }
  if (!notes.length && total > 0) {
    notes.push({
      tone: 'good',
      text: `You've spent ${rupees(total)} ${
        i.isCurrent ? 'so far this cycle' : 'in this cycle'
      }.`,
    });
  }

  // Month-end forecast (INS-04): spending so far + the same daily pace for
  // the days left + recurring payments still to come.
  const patterns = detectRecurring(i.recurring);
  let forecast: Insights['forecast'] = null;
  const budget = BUDGET_BUCKETS.reduce(
    (s, b) => s + (i.allocations[b] ?? 0),
    0,
  );
  if (i.isCurrent && budget) {
    const paidKeys = new Set(i.spends.map(s => s.merchant_key));
    // One-off monthly payments (rent, SIPs, EMIs, detected recurring) are
    // already done; only the rest is projected forward at the daily pace.
    const isFixed = (s: Spend) =>
      s.bucket === 'investment' ||
      s.bucket === 'loan' ||
      s.category_id === 'need.rent' ||
      patterns.some(
        p =>
          p.key === s.merchant_key &&
          Math.abs(s.amount - p.amount) <= p.amount * 0.1,
      );
    const fixedPaid = sum(i.spends.filter(isFixed));
    const upcoming = patterns
      .filter(p => p.kind !== 'other' && !paidKeys.has(p.key))
      .reduce((s, p) => s + p.amount, 0);
    const dailyFlexible = Math.max(0, total - fixedPaid) / day;
    const projected = Math.round(
      total + dailyFlexible * (daysLeft - 1) + upcoming,
    );
    const over = projected > budget;
    const gap = Math.abs(projected - budget);
    const trimPerDay =
      daysLeft > 1 ? Math.ceil(gap / (daysLeft - 1) / 10000) * 10000 : gap;
    forecast = {
      total: projected,
      budget,
      over,
      text: over
        ? `At this pace you'll end about ${rupees(
            gap,
          )} over. Trimming spending by ${rupees(
            trimPerDay,
          )} a day gets you back on plan.`
        : `At this pace you'll finish about ${rupees(gap)} under plan.`,
    };
  }

  // Subscriptions (INS-05).
  const subscriptions = patterns
    .filter(p => p.kind === 'subscription')
    .map(p => ({ name: p.name, amount: p.amount }));

  // Saved and invested (INS-06): (Investment + Emergency contributions) ÷ income.
  const investment = Math.max(0, byBucket(i.spends, 'investment'));
  const saved = {
    investment,
    emergency: i.emergencyContributions,
    income: i.income,
    rate: i.income ? (investment + i.emergencyContributions) / i.income : 0,
  };

  // Top merchants (INS-07).
  const m = new Map<string, { name: string; amount: number }>();
  for (const s of i.spends) {
    if (!s.merchant_key || s.amount <= 0) continue;
    const e = m.get(s.merchant_key) ?? {
      name: s.merchant_name ?? s.merchant_key,
      amount: 0,
    };
    e.amount += s.amount;
    m.set(s.merchant_key, e);
  }

  return {
    range: i.range,
    label: cycleLabel(i.range),
    isCurrent: i.isCurrent,
    notes: notes.slice(0, 3),
    totalSpent: total,
    split,
    splitSentence,
    categories,
    cycles,
    cyclesSentence,
    forecast,
    subscriptions,
    subscriptionsTotal: subscriptions.reduce((s, x) => s + x.amount, 0),
    saved,
    merchants: [...m.values()].sort((a, b) => b.amount - a.amount).slice(0, 5),
  };
}

// offset 0 = the current cycle, 1 = the one before, and so on.
export async function getInsights(
  sql: Sql,
  offset: number,
  now = Date.now(),
): Promise<Insights | null> {
  const active = await ensureCurrentCycle(sql, now);
  if (!active) return null;
  const { salaryDay } = await cycleSettings(sql);
  const current: CycleRange = {
    start: active.start_date,
    end: active.end_date,
  };
  const back = previousCycles(
    active.mode,
    salaryDay,
    current.start,
    offset + 6,
  );
  const range = offset === 0 ? current : back[offset - 1];
  const windows = [range, ...back.slice(offset, offset + 5)].reverse();
  const load = (r: CycleRange) =>
    spendsBetween(sql, istDayStartMs(r.start), istDayStartMs(r.end) + DAY_MS);

  const history = [];
  for (const r of windows) history.push({ range: r, spends: await load(r) });
  const spends = history[history.length - 1].spends;
  const previous = history.length > 1 ? history[history.length - 2].spends : [];

  const allocRows = await all<{ bucket: string; amount: number }>(
    sql,
    'SELECT bucket, SUM(amount) AS amount FROM budget_allocations WHERE cycle_id = ? GROUP BY bucket',
    [active.id],
  );
  const recurring = await all<RecurringInput & { [k: string]: any }>(
    sql,
    `SELECT merchant_key, merchant_name, amount, occurred_at, category_id FROM transactions
     WHERE direction = 'debit' AND is_transfer = 0 AND merchant_key IS NOT NULL
       AND occurred_at >= ? AND occurred_at < ?`,
    [
      istDayStartMs(range.end) - 120 * DAY_MS,
      istDayStartMs(range.end) + DAY_MS,
    ],
  );
  const contrib = await all<{ n: number }>(
    sql,
    `SELECT COALESCE(SUM(e.amount), 0) AS n FROM emergency_fund_entries e
     LEFT JOIN transactions t ON t.id = e.transaction_id
     WHERE e.type = 'contribution' AND COALESCE(t.occurred_at, e.created_at) >= ? AND COALESCE(t.occurred_at, e.created_at) < ?`,
    [istDayStartMs(range.start), istDayStartMs(range.end) + DAY_MS],
  );

  return computeInsights({
    range,
    isCurrent: offset === 0,
    today: todayIst(now),
    spends,
    previous,
    history,
    allocations: Object.fromEntries(
      allocRows.map(r => [r.bucket, Number(r.amount)]),
    ),
    income: active.income,
    recurring,
    emergencyContributions: Number(contrib[0]?.n ?? 0),
  });
}

// The oldest stored transaction, to stop the cycle picker going further back.
export async function earliestTransaction(sql: Sql): Promise<number | null> {
  const r = await all<{ t: number | null }>(
    sql,
    'SELECT MIN(occurred_at) AS t FROM transactions',
  );
  return r[0]?.t ?? null;
}
