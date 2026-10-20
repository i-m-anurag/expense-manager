import type { CompiledTemplate, RawSms } from '@expense-manager/parser';
import { CASH_WALLET_ID, upsertAccount } from '../db/accounts';
import { BUDGET_BUCKETS } from '../db/categories';
import { HIGH_CONFIDENCE_TAGS, rememberCategory } from '../db/merchantMemory';
import { setSetting } from '../db/settings';
import { Sql } from '../db/sql';
import type { OnboardingState } from '../onboarding/OnboardingContext';
import { currentCycle } from './cycle';
import { ingestMessages } from './ingest';

const rupeesToPaise = (r: number) => Math.round(r * 100);

// Writes everything onboarding collected, then imports the scanned SMS so the
// first Home screen already has history. Safe to call again (re-run onboarding).
export async function saveOnboarding(
  sql: Sql,
  s: OnboardingState,
  messages: RawSms[],
  templates: CompiledTemplate[],
  userName: string,
  now = Date.now(),
) {
  await sql.transaction(async () => {
    // Accounts, with the user's names, types and budget choices (ONB-05), plus
    // the default cash wallet (ACC-07).
    for (const a of s.accounts) {
      const [bankCode, mask] = a.id.split('-');
      await upsertAccount(
        sql,
        {
          id: a.id,
          bank_code: bankCode,
          mask,
          kind: a.type === 'credit' ? 'card' : 'account',
          type: a.type,
          display_name: a.name,
          include_in_budget: a.type === 'emergency' ? false : a.include,
          last_balance: a.balancePaise,
          balance_updated_at: a.balancePaise === null ? null : now,
        },
        now,
      );
    }
    await upsertAccount(
      sql,
      {
        id: CASH_WALLET_ID,
        bank_code: null,
        mask: null,
        kind: 'account',
        type: 'cash',
        display_name: 'Cash wallet',
      },
      now,
    );

    // Quick training (ONB-09) is an explicit choice, so it starts at high
    // confidence: those merchants are sorted automatically from day one.
    for (const [merchantKey, bucket] of Object.entries(s.merchantMemory)) {
      await rememberCategory(
        sql,
        merchantKey,
        `${bucket}.other`,
        now,
        HIGH_CONFIDENCE_TAGS,
      );
    }

    // Budget cycle and allocations (BUD-01, BUD-03, BUD-05).
    const cycle = currentCycle(s.cycleMode, s.cycleDay, now);
    await sql.execute(
      "UPDATE budget_cycles SET status = 'replaced' WHERE status = 'active'",
    );
    const c = await sql.execute(
      "INSERT INTO budget_cycles (start_date, end_date, mode, income, status) VALUES (?, ?, ?, ?, 'active')",
      [cycle.start, cycle.end, s.cycleMode, rupeesToPaise(s.income)],
    );
    for (const bucket of BUDGET_BUCKETS) {
      await sql.execute(
        'INSERT INTO budget_allocations (cycle_id, bucket, amount) VALUES (?, ?, ?)',
        [c.insertId!, bucket, rupeesToPaise(s.split[bucket])],
      );
    }
    await sql.execute(
      "INSERT INTO budget_allocations (cycle_id, bucket, amount) VALUES (?, 'emergency', ?)",
      [c.insertId!, rupeesToPaise(s.split.emergency)],
    );

    // Emergency fund (ONB-08, EMF-01/04).
    const linked = s.emergencyAccountId ? [s.emergencyAccountId] : [];
    await sql.execute(
      `INSERT INTO emergency_fund (id, target_months, linked_account_ids, manual_balance)
       VALUES (1, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET target_months = excluded.target_months,
         linked_account_ids = excluded.linked_account_ids, manual_balance = excluded.manual_balance`,
      [
        s.emergencyMonths,
        JSON.stringify(linked),
        linked.length ? 0 : rupeesToPaise(s.emergencyBalance),
      ],
    );

    await setSetting(sql, 'user_name', userName);
    await setSetting(sql, 'cycle_mode', s.cycleMode);
    await setSetting(sql, 'salary_day', String(s.cycleDay));
    await setSetting(sql, 'expected_income', String(rupeesToPaise(s.income)));
    await setSetting(sql, 'grace_days', '5');
    await setSetting(sql, 'quiet_start', '22:00');
    await setSetting(sql, 'quiet_end', '08:00');
    await setSetting(sql, 'notifications', s.notificationsGranted ? '1' : '0');
    await setSetting(sql, 'lock_enabled', s.pin ? '1' : '0');
    await setSetting(sql, 'lock_biometric', s.pin && s.biometric ? '1' : '0');
  });

  if (messages.length) {
    await ingestMessages(sql, messages, templates, now);
    const latest = Math.max(...messages.map(m => m.receivedAt));
    await setSetting(sql, 'last_sms_at', String(latest));
  } else {
    await setSetting(sql, 'last_sms_at', String(now));
  }
  await setSetting(sql, 'onboarded', '1');
}
