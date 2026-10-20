// What to notify about, and when (PRD §7.8). Pure: callers post the result.

import { BUCKET_LABELS, bucketOf } from '../db/categories';
import type { TxnView } from '../db/transactions';
import type { NotificationSpec } from '../notify/native';
import { groupINR } from '../utils/format';
import type { BudgetSnapshot, Bucket } from './budget';

export interface AlertLogRow {
  alert_type: string;
  category_id: string | null;
  cycle_id: number | null;
  sent_at: number;
}

export interface Alert {
  type: string; // logged as alert_log.alert_type
  bucket: string | null; // logged as alert_log.category_id
  cycleId: number | null;
  // Missing for alerts that are only logged (lower thresholds crossed at the
  // same time as a higher one), so they never fire later in the cycle.
  spec?: NotificationSpec;
  at?: number; // post later (epoch ms) instead of now
}

const DAY_MS = 24 * 3600 * 1000;
const NAME: Record<Bucket, string> = {
  need: 'Need',
  want: 'Want',
  investment: 'Investment',
  loan: 'Loan / EMI',
};
const PLURAL: Record<Bucket, string> = {
  need: 'Needs',
  want: 'Wants',
  investment: 'Investments',
  loan: 'EMIs',
};
const rupees = (paise: number) =>
  `₹${groupINR(Math.round(Math.abs(paise) / 100))}`;

// Stable small ids so a repeat replaces rather than stacks.
function hashId(base: number, key: string) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return base + (Math.abs(h) % 900000);
}

// ---------------------------------------------------------------------------
// Quiet hours (ALR-07): default 10 PM – 8 AM, phone's local time.

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export function isQuiet(now: number, start = '22:00', end = '08:00') {
  const d = new Date(now);
  const t = d.getHours() * 60 + d.getMinutes();
  const s = minutes(start);
  const e = minutes(end);
  return s > e ? t >= s || t < e : t >= s && t < e;
}

// The next moment quiet hours end.
export function quietEnds(now: number, end = '08:00') {
  const d = new Date(now);
  const e = minutes(end);
  const target = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    Math.floor(e / 60),
    e % 60,
  );
  if (target.getTime() <= now) target.setDate(target.getDate() + 1);
  return target.getTime();
}

// ---------------------------------------------------------------------------
// New payment (ALR-01, CAT-06, brief §9.10).

const label = (categoryId: string, names: Record<string, string>) => {
  const b = bucketOf(categoryId);
  const sub = names[categoryId];
  return sub && !sub.startsWith('Other')
    ? `${BUCKET_LABELS[b]} · ${sub}`
    : BUCKET_LABELS[b];
};

export function paymentNotification(
  t: TxnView,
  names: Record<string, string>,
  quiet: boolean,
): NotificationSpec {
  const merchant = t.merchant_name ?? t.merchant_raw ?? 'a payment';
  const where = t.account_mask
    ? ` · ${(t.account_name ?? '').split(' ')[0]} ••${t.account_mask}`
    : '';
  const amount = rupees(t.amount);
  const url = `expensemanager://txn/${t.id}`;
  const channel = quiet ? 'transactions_quiet' : 'transactions';
  if (t.category_id) {
    // Auto-categorised: show where it went, with a way to change it.
    return {
      id: t.id,
      channel,
      title: `${amount} ${merchant} → ${label(t.category_id, names)}`,
      body: `Sorted automatically${where}. Tap Change if that's wrong.`,
      url,
      actions: [{ label: 'Change', url }],
    };
  }
  const suggested = t.suggested_category_id;
  const first = suggested ? bucketOf(suggested) : 'need';
  const second = first === 'want' ? 'need' : 'want';
  const firstId =
    suggested && ['need', 'want', 'investment', 'loan'].includes(first)
      ? suggested
      : `${first}.other`;
  return {
    id: t.id,
    channel,
    title: `${amount} at ${merchant}${where}`,
    body: suggested
      ? `Looks like ${label(suggested, names)}. Tap to save.`
      : 'Which bucket does this belong to?',
    url,
    actions: [
      {
        label: BUCKET_LABELS[bucketOf(firstId)].replace(' / EMI', ''),
        txnId: t.id,
        categoryId: firstId,
      },
      {
        label: BUCKET_LABELS[second],
        txnId: t.id,
        categoryId: `${second}.other`,
      },
      { label: 'Other', url },
    ],
  };
}

export function summaryNotification(
  count: number,
  quiet: boolean,
): NotificationSpec {
  return {
    id: 1_000_000,
    channel: quiet ? 'transactions_quiet' : 'transactions',
    title: `${count} new payments`,
    body: 'Tap to review and sort them.',
    url: 'expensemanager://transactions',
  };
}

// The pop-up card over other apps (design Extras · 5c), drawn natively by
// PaymentOverlay.kt from this spec. Colours come from the app's own tokens.
export function paymentPopup(
  t: TxnView,
  names: Record<string, string>,
  theme: string,
  palettes: Record<'dark' | 'light', Record<string, string>>,
) {
  // Already categorised: show that category selected (the user can change it).
  const suggested = t.category_id ?? t.suggested_category_id;
  return {
    saved: !!t.category_id,
    txnId: t.id,
    notificationId: t.id,
    merchant: t.merchant_name ?? t.merchant_raw ?? 'Payment',
    amount: rupees(t.amount),
    account: t.account_mask
      ? `${(t.account_name ?? '').split(' ')[0]} ••${t.account_mask}`
      : '',
    suggestion: suggested ? label(suggested, names) : '',
    suggestedId: suggested ?? '',
    theme,
    palettes,
    buckets: [
      { id: 'need.other', label: 'Need', key: 'need' },
      { id: 'want.other', label: 'Want', key: 'want' },
      { id: 'investment.other', label: 'Investment', key: 'investment' },
      { id: 'loan.other', label: 'Loan / EMI', key: 'loan' },
    ],
  };
}

// ---------------------------------------------------------------------------
// Budget alerts (ALR-02 thresholds, ALR-03 pace).

const THRESHOLDS = [100, 80, 50] as const;
// Investment and EMI buckets fill in one payment, so "100% used" is expected
// there; alerts cover the day-to-day buckets.
const ALERT_BUCKETS: Bucket[] = ['need', 'want'];

export function budgetAlerts(
  s: BudgetSnapshot,
  log: AlertLogRow[],
  now: number,
): Alert[] {
  const out: Alert[] = [];
  const cycleId = s.cycle.id;
  for (const b of s.buckets) {
    if (!ALERT_BUCKETS.includes(b.bucket) || b.allocated <= 0) continue;
    const pct = (b.spent / b.allocated) * 100;
    const crossed = THRESHOLDS.filter(t => pct >= t);
    const sent = (type: string) =>
      log.some(
        l =>
          l.alert_type === type &&
          l.category_id === b.bucket &&
          l.cycle_id === cycleId,
      );
    const fresh = crossed.filter(t => !sent(`threshold_${t}`));
    if (fresh.length) {
      // Only the highest new threshold is shown; lower ones are logged too.
      const t = fresh[0];
      const left = b.allocated - b.spent;
      const title =
        t === 100
          ? `${NAME[b.bucket]} budget used up`
          : t === 80
          ? `${NAME[b.bucket]} budget 80% used`
          : `${NAME[b.bucket]} budget half used`;
      const body =
        t === 100
          ? left < 0
            ? `${rupees(left)} over, with ${s.daysLeft} day${
                s.daysLeft === 1 ? '' : 's'
              } left.`
            : `Nothing left for ${s.daysLeft} day${
                s.daysLeft === 1 ? '' : 's'
              }.`
          : `${rupees(left)} left · ${s.daysLeft} day${
              s.daysLeft === 1 ? '' : 's'
            } to go.`;
      for (const f of fresh) {
        out.push({
          type: `threshold_${f}`,
          bucket: b.bucket,
          cycleId,
          spec:
            f === t
              ? {
                  id: hashId(2_000_000, `${cycleId}-${b.bucket}`),
                  channel: 'alerts',
                  title,
                  body,
                  url: 'expensemanager://budget',
                }
              : undefined,
        });
      }
      continue;
    }
    // Pace: 20% past where spending should be, once 30% is used, at most
    // once a week per bucket, and not right after a threshold alert for it.
    const lastPace = log
      .filter(
        l =>
          (l.alert_type === 'pace' || l.alert_type.startsWith('threshold_')) &&
          l.category_id === b.bucket,
      )
      .reduce((m, l) => Math.max(m, l.sent_at), 0);
    if (pct >= 30 && b.used > b.pace * 1.2 && now - lastPace >= 7 * DAY_MS) {
      out.push({
        type: 'pace',
        bucket: b.bucket,
        cycleId,
        spec: {
          id: hashId(2_000_000, `${cycleId}-${b.bucket}`),
          channel: 'alerts',
          title: `${PLURAL[b.bucket]}: you've used ${Math.round(pct)}%`,
          body: `With ${s.daysLeft} day${
            s.daysLeft === 1 ? '' : 's'
          } left. A lighter few days will bring it back in line.`,
          url: 'expensemanager://budget',
        },
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Upcoming payments (ALR-04): a reminder at 9 AM, 2 days before.

export function upcomingReminders(
  s: BudgetSnapshot,
  log: AlertLogRow[],
  now: number,
  daysBefore = 2,
): Alert[] {
  const out: Alert[] = [];
  for (const c of s.commitments) {
    if (c.paid || !c.date || c.kind === 'emergency') continue;
    const type = `upcoming:${c.key}`;
    if (log.some(l => l.alert_type === type && l.cycle_id === s.cycle.id))
      continue;
    const [y, m, d] = c.date.split('-').map(Number);
    const due = new Date(y, m - 1, d, 9, 0).getTime();
    const at = due - daysBefore * DAY_MS;
    if (due <= now) continue; // already due; nothing useful to remind
    out.push({
      type,
      bucket: null,
      cycleId: s.cycle.id,
      at: Math.max(at, now),
      spec: {
        id: hashId(3_000_000, `${s.cycle.id}-${c.key}`),
        channel: 'reminders',
        title: `${c.name} · ${rupees(c.amount)}`,
        body: `Due ${
          daysBefore === 2 && at > now ? 'in 2 days' : 'soon'
        }. Keep enough in the account.`,
        url: 'expensemanager://budget',
      },
    });
  }
  return out;
}
