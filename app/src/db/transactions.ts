import { Scalar, Sql, all, one } from './sql';

export type Confidence = 'high' | 'medium' | 'low';
export type CategorizationSource =
  | 'rule'
  | 'memory'
  | 'pattern'
  | 'user'
  | 'none';

export interface Txn {
  id: number;
  account_id: string | null;
  raw_sms_id: number | null;
  amount: number; // paise
  direction: 'debit' | 'credit';
  txn_type: string;
  merchant_raw: string | null;
  merchant_key: string | null;
  merchant_name: string | null;
  reference_no: string | null;
  occurred_at: number;
  category_id: string | null;
  suggested_category_id: string | null;
  categorization_source: CategorizationSource;
  confidence: Confidence;
  is_transfer: number;
  is_refund: number;
  is_reimbursable: number;
  is_emergency: number;
  linked_txn_id: number | null;
  note: string | null;
  balance_after: number | null;
}

// Row as shown in lists: transaction plus account and category names.
export interface TxnView extends Txn {
  account_name: string | null;
  account_mask: string | null;
  category_name: string | null;
  category_bucket: string | null;
  suggested_name: string | null;
  sms_body: string | null;
}

export type NewTxn = Omit<Txn, 'id'>;

export async function insertTxn(sql: Sql, t: NewTxn, now = Date.now()) {
  const cols = Object.keys(t) as (keyof NewTxn)[];
  const r = await sql.execute(
    `INSERT INTO transactions (${cols.join(', ')}, created_at)
     VALUES (${cols.map(() => '?').join(', ')}, ?)`,
    [...cols.map(c => t[c] as Scalar), now],
  );
  return r.insertId!;
}

export async function updateTxn(sql: Sql, id: number, patch: Partial<NewTxn>) {
  const cols = Object.keys(patch) as (keyof NewTxn)[];
  if (!cols.length) {
    return;
  }
  await sql.execute(
    `UPDATE transactions SET ${cols
      .map(c => `${c} = ?`)
      .join(', ')} WHERE id = ?`,
    [...cols.map(c => patch[c] as Scalar), id],
  );
}

const VIEW = `
  SELECT t.*, a.display_name AS account_name, a.mask AS account_mask,
         c.name AS category_name, c.bucket AS category_bucket,
         s.name AS suggested_name, r.body AS sms_body
  FROM transactions t
  LEFT JOIN accounts a ON a.id = t.account_id
  LEFT JOIN categories c ON c.id = t.category_id
  LEFT JOIN categories s ON s.id = t.suggested_category_id
  LEFT JOIN raw_sms r ON r.id = t.raw_sms_id`;

export interface TxnFilter {
  search?: string;
  accountId?: string;
  bucket?: string; // a category bucket, or 'uncategorized'
  direction?: 'debit' | 'credit';
  from?: number;
  to?: number;
  limit?: number;
}

// TXN-01: list with filters and search by merchant or amount.
export function listTxns(sql: Sql, f: TxnFilter = {}): Promise<TxnView[]> {
  const where: string[] = [];
  const params: Scalar[] = [];
  if (f.search?.trim()) {
    const q = f.search.trim();
    const rupees = Number(q.replace(/[₹,\s]/g, ''));
    if (q.replace(/[₹,\s.]/g, '') !== '' && !Number.isNaN(rupees)) {
      where.push('t.amount BETWEEN ? AND ?');
      params.push(Math.floor(rupees) * 100, Math.floor(rupees) * 100 + 99);
    } else {
      where.push(
        '(t.merchant_name LIKE ? OR t.merchant_raw LIKE ? OR t.note LIKE ?)',
      );
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
  }
  if (f.accountId) {
    where.push('t.account_id = ?');
    params.push(f.accountId);
  }
  if (f.bucket === 'uncategorized') {
    where.push('t.category_id IS NULL');
  } else if (f.bucket) {
    where.push('c.bucket = ?');
    params.push(f.bucket);
  }
  if (f.direction) {
    where.push('t.direction = ?');
    params.push(f.direction);
  }
  if (f.from !== undefined) {
    where.push('t.occurred_at >= ?');
    params.push(f.from);
  }
  if (f.to !== undefined) {
    where.push('t.occurred_at < ?');
    params.push(f.to);
  }
  return all<TxnView & { [k: string]: any }>(
    sql,
    `${VIEW} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY t.occurred_at DESC, t.id DESC LIMIT ?`,
    [...params, f.limit ?? 500],
  );
}

export function getTxn(sql: Sql, id: number) {
  return one<TxnView & { [k: string]: any }>(sql, `${VIEW} WHERE t.id = ?`, [
    id,
  ]);
}

export async function countUncategorized(sql: Sql) {
  const r = await one<{ n: number }>(
    sql,
    'SELECT COUNT(*) AS n FROM transactions WHERE category_id IS NULL',
  );
  return Number(r?.n ?? 0);
}

export async function pastTagCount(sql: Sql, merchantKey: string) {
  const r = await one<{ n: number }>(
    sql,
    "SELECT COUNT(*) AS n FROM transactions WHERE merchant_key = ? AND categorization_source = 'user'",
    [merchantKey],
  );
  return Number(r?.n ?? 0);
}
