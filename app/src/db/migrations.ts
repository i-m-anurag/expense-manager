import { Sql } from './sql';

// PRD §9 data model. Money is stored as integer paise; timestamps as epoch ms;
// cycle dates as 'YYYY-MM-DD' (IST). Append new migrations, never edit old ones.
export const MIGRATIONS: string[][] = [
  [
    `CREATE TABLE settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,
    `CREATE TABLE accounts (
      id TEXT PRIMARY KEY,
      bank_code TEXT,
      mask TEXT,
      kind TEXT NOT NULL DEFAULT 'account',
      type TEXT NOT NULL,
      display_name TEXT NOT NULL,
      include_in_budget INTEGER NOT NULL DEFAULT 1,
      last_balance INTEGER,
      balance_updated_at INTEGER,
      available_limit INTEGER,
      archived INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE raw_sms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_sms_id TEXT,
      sender TEXT NOT NULL,
      body TEXT NOT NULL,
      received_at INTEGER NOT NULL,
      status TEXT NOT NULL,
      bank_code TEXT,
      parser_pattern_id TEXT,
      ignore_reason TEXT,
      UNIQUE (sender, received_at, body)
    )`,
    'CREATE INDEX raw_sms_status ON raw_sms (status)',
    `CREATE TABLE categories (
      id TEXT PRIMARY KEY,
      bucket TEXT NOT NULL,
      name TEXT NOT NULL,
      icon TEXT,
      color TEXT,
      sort INTEGER NOT NULL DEFAULT 0,
      archived INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id TEXT REFERENCES accounts (id),
      raw_sms_id INTEGER REFERENCES raw_sms (id),
      amount INTEGER NOT NULL,
      direction TEXT NOT NULL,
      txn_type TEXT NOT NULL,
      merchant_raw TEXT,
      merchant_key TEXT,
      merchant_name TEXT,
      reference_no TEXT,
      occurred_at INTEGER NOT NULL,
      category_id TEXT REFERENCES categories (id),
      suggested_category_id TEXT REFERENCES categories (id),
      categorization_source TEXT NOT NULL DEFAULT 'none',
      confidence TEXT NOT NULL DEFAULT 'low',
      is_transfer INTEGER NOT NULL DEFAULT 0,
      is_refund INTEGER NOT NULL DEFAULT 0,
      is_reimbursable INTEGER NOT NULL DEFAULT 0,
      is_emergency INTEGER NOT NULL DEFAULT 0,
      linked_txn_id INTEGER REFERENCES transactions (id),
      note TEXT,
      balance_after INTEGER,
      created_at INTEGER NOT NULL
    )`,
    'CREATE INDEX txn_occurred ON transactions (occurred_at)',
    'CREATE INDEX txn_merchant ON transactions (merchant_key)',
    'CREATE INDEX txn_reference ON transactions (reference_no)',
    `CREATE TABLE transaction_splits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER NOT NULL REFERENCES transactions (id) ON DELETE CASCADE,
      category_id TEXT NOT NULL REFERENCES categories (id),
      amount INTEGER NOT NULL
    )`,
    `CREATE TABLE merchant_memory (
      merchant_key TEXT PRIMARY KEY,
      category_id TEXT NOT NULL REFERENCES categories (id),
      tag_count INTEGER NOT NULL,
      last_used_at INTEGER NOT NULL
    )`,
    `CREATE TABLE rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conditions TEXT NOT NULL,
      category_id TEXT NOT NULL REFERENCES categories (id),
      priority INTEGER NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1
    )`,
    `CREATE TABLE recurring_patterns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payee_key TEXT NOT NULL,
      account_id TEXT REFERENCES accounts (id),
      expected_amount INTEGER NOT NULL,
      expected_day_of_cycle INTEGER NOT NULL,
      kind TEXT NOT NULL,
      confirmed INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE budget_cycles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      mode TEXT NOT NULL,
      income INTEGER NOT NULL,
      status TEXT NOT NULL
    )`,
    `CREATE TABLE budget_allocations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cycle_id INTEGER NOT NULL REFERENCES budget_cycles (id),
      bucket TEXT NOT NULL,
      category_id TEXT REFERENCES categories (id),
      amount INTEGER NOT NULL,
      rollover_amount INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE emergency_fund (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      target_months INTEGER NOT NULL,
      need_spend_override INTEGER,
      linked_account_ids TEXT NOT NULL DEFAULT '[]',
      manual_balance INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE emergency_fund_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      transaction_id INTEGER REFERENCES transactions (id),
      reason TEXT,
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE alert_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alert_type TEXT NOT NULL,
      category_id TEXT,
      cycle_id INTEGER,
      sent_at INTEGER NOT NULL
    )`,
  ],
];

export async function migrate(sql: Sql): Promise<number> {
  const r = await sql.execute('PRAGMA user_version');
  const current = Number(r.rows[0]?.user_version ?? 0);
  for (let v = current; v < MIGRATIONS.length; v++) {
    await sql.transaction(async () => {
      for (const statement of MIGRATIONS[v]) {
        await sql.execute(statement);
      }
      await sql.execute(`PRAGMA user_version = ${v + 1}`);
    });
  }
  return MIGRATIONS.length;
}
