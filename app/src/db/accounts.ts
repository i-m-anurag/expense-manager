import { Sql, all, one } from './sql';

export type AccountType =
  | 'salary'
  | 'savings'
  | 'credit'
  | 'emergency'
  | 'loan'
  | 'cash';

export interface Account {
  id: string;
  bank_code: string | null;
  mask: string | null;
  kind: 'account' | 'card';
  type: AccountType;
  display_name: string;
  include_in_budget: number;
  last_balance: number | null;
  balance_updated_at: number | null;
  available_limit: number | null;
  archived: number;
}

export const CASH_WALLET_ID = 'cash';

export async function upsertAccount(
  sql: Sql,
  a: Pick<
    Account,
    'id' | 'bank_code' | 'mask' | 'kind' | 'type' | 'display_name'
  > & {
    include_in_budget?: boolean;
    last_balance?: number | null;
    balance_updated_at?: number | null;
  },
  now = Date.now(),
) {
  await sql.execute(
    `INSERT INTO accounts (id, bank_code, mask, kind, type, display_name, include_in_budget,
       last_balance, balance_updated_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       type = excluded.type,
       display_name = excluded.display_name,
       include_in_budget = excluded.include_in_budget`,
    [
      a.id,
      a.bank_code,
      a.mask,
      a.kind,
      a.type,
      a.display_name,
      a.include_in_budget === false ? 0 : 1,
      a.last_balance ?? null,
      a.balance_updated_at ?? null,
      now,
    ],
  );
}

// Creates an account seen for the first time in an SMS (ACC-01); never
// overwrites the user's name, type or budget choice for an existing one.
export async function ensureAccount(
  sql: Sql,
  a: Pick<
    Account,
    'id' | 'bank_code' | 'mask' | 'kind' | 'type' | 'display_name'
  >,
  now = Date.now(),
) {
  await sql.execute(
    `INSERT OR IGNORE INTO accounts (id, bank_code, mask, kind, type, display_name,
       include_in_budget, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      a.id,
      a.bank_code,
      a.mask,
      a.kind,
      a.type,
      a.display_name,
      a.type === 'emergency' ? 0 : 1,
      now,
    ],
  );
}

// ACC-03: latest "available balance" / "available limit" from SMS wins.
export async function updateBalance(
  sql: Sql,
  id: string,
  at: number,
  balance: number | null,
  limit: number | null,
) {
  if (balance !== null) {
    await sql.execute(
      `UPDATE accounts SET last_balance = ?, balance_updated_at = ?
       WHERE id = ? AND (balance_updated_at IS NULL OR balance_updated_at <= ?)`,
      [balance, at, id, at],
    );
  }
  if (limit !== null) {
    await sql.execute('UPDATE accounts SET available_limit = ? WHERE id = ?', [
      limit,
      id,
    ]);
  }
}

export function listAccounts(sql: Sql): Promise<Account[]> {
  return all<Account & { [k: string]: any }>(
    sql,
    'SELECT * FROM accounts WHERE archived = 0 ORDER BY (type = ?) , created_at',
    ['cash'],
  );
}

export function getAccount(sql: Sql, id: string) {
  return one<Account & { [k: string]: any }>(
    sql,
    'SELECT * FROM accounts WHERE id = ?',
    [id],
  );
}
