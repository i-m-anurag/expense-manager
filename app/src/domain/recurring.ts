// PRD TXN-10: a payment is recurring when the same payee is paid a similar
// amount (±10%) around the same day of the month (±3 days) in at least two
// different months. Pure functions over stored transactions.

import { istDate } from '../utils/format';

export type RecurringKind = 'emi' | 'sip' | 'rent' | 'subscription' | 'other';

export interface RecurringInput {
  merchant_key: string | null;
  merchant_name: string | null;
  amount: number; // paise
  occurred_at: number;
  category_id: string | null;
}

export interface RecurringPattern {
  key: string;
  name: string;
  amount: number; // typical amount, paise
  day: number; // typical day of month (IST)
  kind: RecurringKind;
  occurrences: number;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) / 2)];
};

export function kindFor(categoryId: string | null): RecurringKind {
  if (!categoryId) return 'other';
  if (categoryId.startsWith('loan.')) return 'emi';
  if (categoryId.startsWith('investment.')) return 'sip';
  if (categoryId === 'need.rent') return 'rent';
  if (categoryId === 'want.subscriptions' || categoryId === 'need.utilities')
    return 'subscription';
  return 'other';
}

export function detectRecurring(txns: RecurringInput[]): RecurringPattern[] {
  const byKey = new Map<string, RecurringInput[]>();
  for (const t of txns) {
    if (!t.merchant_key) continue;
    const list = byKey.get(t.merchant_key) ?? [];
    list.push(t);
    byKey.set(t.merchant_key, list);
  }
  const out: RecurringPattern[] = [];
  for (const [key, list] of byKey) {
    // Cluster by amount so one payee with two different regular payments
    // (rent and maintenance, say) yields two patterns.
    const clusters: RecurringInput[][] = [];
    for (const t of [...list].sort((a, b) => a.amount - b.amount)) {
      const c = clusters.find(
        x =>
          Math.abs(median(x.map(y => y.amount)) - t.amount) <= t.amount * 0.1,
      );
      if (c) c.push(t);
      else clusters.push([t]);
    }
    for (const c of clusters) {
      const months = new Set(
        c.map(t => {
          const d = istDate(t.occurred_at);
          return `${d.y}-${d.m}`;
        }),
      );
      if (months.size < 2) continue;
      const days = c.map(t => istDate(t.occurred_at).d);
      const day = median(days);
      // Day-of-month spread, allowing for month-end wrap (30th vs 1st).
      const close = days.every(
        d => Math.min(Math.abs(d - day), 31 - Math.abs(d - day)) <= 3,
      );
      if (!close) continue;
      const latest = c.reduce((a, b) =>
        b.occurred_at > a.occurred_at ? b : a,
      );
      out.push({
        key,
        name: latest.merchant_name ?? key,
        amount: median(c.map(t => t.amount)),
        day,
        kind: kindFor(latest.category_id),
        occurrences: c.length,
      });
    }
  }
  return out.sort((a, b) => a.day - b.day);
}
