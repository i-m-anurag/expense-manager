import { Sql, one } from './sql';

export type SettingKey =
  | 'onboarded'
  | 'user_name'
  | 'cycle_mode'
  | 'salary_day'
  | 'expected_income'
  | 'grace_days'
  | 'last_sms_at'
  | 'quiet_start'
  | 'quiet_end'
  | 'theme'
  | 'notifications'
  | 'notify_transactions'
  | 'notify_budget'
  | 'notify_upcoming'
  | 'quiet_hours'
  | 'lock_enabled'
  | 'lock_biometric'
  | 'lock_after'
  | 'block_screenshots'
  | 'popup_payments';

// Toggles that are on unless the user switched them off.
export async function isOn(sql: Sql, key: SettingKey) {
  return (await getSetting(sql, key)) !== '0';
}

export async function getSetting(sql: Sql, key: SettingKey) {
  const row = await one<{ value: string }>(
    sql,
    'SELECT value FROM settings WHERE key = ?',
    [key],
  );
  return row?.value ?? null;
}

export async function setSetting(sql: Sql, key: SettingKey, value: string) {
  await sql.execute(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
    [key, value],
  );
}
