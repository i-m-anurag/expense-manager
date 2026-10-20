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

// SET-01: rename, change type or budget inclusion. Emergency-fund accounts are
// kept out of the budget and linked to the fund (ACC-04, EMF-04).
export async function updateAccount(
  sql: Sql,
  id: string,
  patch: {
    display_name?: string;
    type?: AccountType;
    include_in_budget?: boolean;
  },
) {
  await sql.transaction(async () => {
    const sets: string[] = [];
    const params: (string | number)[] = [];
    if (patch.display_name !== undefined) {
      sets.push('display_name = ?');
      params.push(patch.display_name);
    }
    if (patch.type !== undefined) {
      sets.push('type = ?');
      params.push(patch.type);
    }
    if (patch.include_in_budget !== undefined) {
      sets.push('include_in_budget = ?');
      params.push(patch.include_in_budget ? 1 : 0);
    }
    if (patch.type === 'emergency') {
      sets.push('include_in_budget = 0');
    }
    if (sets.length) {
      await sql.execute(`UPDATE accounts SET ${sets.join(', ')} WHERE id = ?`, [
        ...params,
        id,
      ]);
    }
    const linked = await all<{ id: string }>(
      sql,
      "SELECT id FROM accounts WHERE type = 'emergency' AND archived = 0",
    );
    await sql.execute(
      'UPDATE emergency_fund SET linked_account_ids = ? WHERE id = 1',
      [JSON.stringify(linked.map(a => a.id))],
    );
  });
}
