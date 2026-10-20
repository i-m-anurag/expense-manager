// Side of the alert rules that touches the outside world: settings, the
// alert log and the native notification module.

import { listCategories } from '../db/categories';
import { getSetting, isOn } from '../db/settings';
import { Sql, all } from '../db/sql';
import { getTxn } from '../db/transactions';
import { setCategory } from '../domain/actions';
import {
  Alert,
  AlertLogRow,
  budgetAlerts,
  isQuiet,
  paymentNotification,
  paymentPopup,
  quietEnds,
  summaryNotification,
  upcomingReminders,
} from '../domain/alerts';
import { getBudgetSnapshot } from '../domain/budget';
import { palettes } from '../theme/tokens';
import { Notifications } from './native';

const DAY_MS = 24 * 3600 * 1000;
// More new payments than this at once (catching up after the phone was off)
// get one summary instead of a notification each.
const MAX_SEPARATE = 3;

async function quietSettings(sql: Sql) {
  return {
    enabled: await isOn(sql, 'quiet_hours'),
    start: (await getSetting(sql, 'quiet_start')) ?? '22:00',
    end: (await getSetting(sql, 'quiet_end')) ?? '08:00',
  };
}

async function recentLog(sql: Sql, now: number) {
  return all<AlertLogRow & { [k: string]: any }>(
    sql,
    'SELECT alert_type, category_id, cycle_id, sent_at FROM alert_log WHERE sent_at >= ?',
    [now - 62 * DAY_MS],
  );
}

async function deliver(
  sql: Sql,
  alerts: Alert[],
  now: number,
  quietUntil: number | null,
) {
  for (const a of alerts) {
    await sql.execute(
      'INSERT INTO alert_log (alert_type, category_id, cycle_id, sent_at) VALUES (?, ?, ?, ?)',
      [a.type, a.bucket, a.cycleId, now],
    );
    if (!a.spec) continue;
    // ALR-07: during quiet hours alerts wait until the morning, not dropped.
    const at = Math.max(a.at ?? now, quietUntil ?? 0);
    if (at > now + 60_000) {
      await Notifications.schedule(a.spec, at);
    } else {
      await Notifications.show(a.spec);
    }
  }
}

// Flow 8.1 steps 5–6, after new transactions are stored. Transactions older
// than 24 hours (caught up later) don't notify (flow 8.4).
export async function afterIngest(
  sql: Sql,
  insertedIds: number[],
  now = Date.now(),
) {
  if (!insertedIds.length || !(await Notifications.enabled())) return;
  const quiet = await quietSettings(sql);
  const inQuiet = quiet.enabled && isQuiet(now, quiet.start, quiet.end);

  if (await isOn(sql, 'notify_transactions')) {
    const fresh = [];
    for (const id of insertedIds) {
      const t = await getTxn(sql, id);
      if (
        t &&
        t.direction === 'debit' &&
        !t.is_transfer &&
        t.occurred_at >= now - DAY_MS
      ) {
        fresh.push(t);
      }
    }
    if (fresh.length > MAX_SEPARATE) {
      await Notifications.show(summaryNotification(fresh.length, inQuiet));
    } else if (fresh.length) {
      const names = Object.fromEntries(
        (await listCategories(sql)).map(c => [c.id, c.name]),
      );
      for (const t of fresh) {
        await Notifications.show(paymentNotification(t, names, inQuiet));
      }
      await maybePopup(sql, fresh, names, inQuiet);
    }
  }

  if (await isOn(sql, 'notify_budget')) {
    const snapshot = await getBudgetSnapshot(sql, now);
    if (snapshot) {
      const alerts = budgetAlerts(snapshot, await recentLog(sql, now), now);
      await deliver(
        sql,
        alerts,
        now,
        inQuiet ? quietEnds(now, quiet.end) : null,
      );
    }
  }
  await scheduleReminders(sql, now);
}

// Native colours as #AARRGGBB (the tint is gold at 12% / 14%).
function popupPalette(name: 'dark' | 'light') {
  const p = palettes[name];
  return {
    surfaceRaised: p.surfaceRaised,
    border: p.border,
    textPrimary: p.textPrimary,
    textSecondary: p.textSecondary,
    textTertiary: p.textTertiary,
    gold: p.gold,
    goldText: p.goldText,
    goldTint: name === 'dark' ? '#1FD4AF6A' : '#24D4AF6A',
    need: p.bucket.need,
    want: p.bucket.want,
    investment: p.bucket.investment,
    loan: p.bucket.loan,
  };
}

// The pop-up over other apps for the newest payment: every payment by
// default, or only ones that still need a bucket (Settings). Only when
// allowed, outside the app, and not during quiet hours.
async function maybePopup(
  sql: Sql,
  fresh: Awaited<ReturnType<typeof getTxn>>[],
  names: Record<string, string>,
  inQuiet: boolean,
) {
  const everyPayment =
    (await getSetting(sql, 'popup_scope')) !== 'uncategorized';
  const t = [...fresh]
    .reverse()
    .find(x => x && (everyPayment || !x.category_id));
  if (
    !t ||
    inQuiet ||
    !(await isOn(sql, 'popup_payments')) ||
    !(await Notifications.canShowOverlay()) ||
    (await Notifications.isAppInForeground())
  ) {
    return;
  }
  const theme = (await getSetting(sql, 'theme')) ?? 'system';
  await Notifications.showPaymentOverlay(
    paymentPopup(t, names, theme, {
      dark: popupPalette('dark'),
      light: popupPalette('light'),
    }),
  );
}

// ALR-04: schedule reminders for recurring payments due soon. Runs after new
// transactions and on every app open; each reminder is logged once per cycle.
export async function scheduleReminders(sql: Sql, now = Date.now()) {
  if (!(await isOn(sql, 'notify_upcoming')) || !(await Notifications.enabled()))
    return;
  const snapshot = await getBudgetSnapshot(sql, now);
  if (!snapshot) return;
  const quiet = await quietSettings(sql);
  const soon = upcomingReminders(
    snapshot,
    await recentLog(sql, now),
    now,
  ).filter(a => (a.at ?? now) - now <= 3 * DAY_MS);
  const quietUntil =
    quiet.enabled && isQuiet(now, quiet.start, quiet.end)
      ? quietEnds(now, quiet.end)
      : null;
  await deliver(sql, soon, now, quietUntil);
}

// "QuickTag" Headless JS task: a bucket button on a payment notification.
export async function quickTag(
  sql: Sql,
  data: { txnId: number; categoryId: string; notificationId: number },
) {
  await setCategory(sql, data.txnId, data.categoryId, true);
  const t = await getTxn(sql, data.txnId);
  await Notifications.show({
    id: data.notificationId,
    channel: 'transactions_quiet',
    title: `Saved as ${
      t?.category_bucket
        ? `${t.category_bucket[0].toUpperCase()}${t.category_bucket.slice(1)}`
        : 'categorised'
    }${
      t?.category_name && !t.category_name.startsWith('Other')
        ? ` · ${t.category_name}`
        : ''
    }`,
    body: `${t?.merchant_name ?? 'Payment'} · we'll remember this.`,
    url: `expensemanager://txn/${data.txnId}`,
    timeoutMs: 5000,
  });
}
