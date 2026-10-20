import { rememberCategory } from '../db/merchantMemory';
import { Sql, one } from '../db/sql';
import { getTxn, updateTxn } from '../db/transactions';

// TXN-02 / CAT-02 / CAT-07 / CAT-08: the user picks a category. With
// "Always use this for <merchant>" on, merchant memory learns it and every
// other uncategorised payment to the same merchant is sorted too.
export async function setCategory(
  sql: Sql,
  txnId: number,
  categoryId: string,
  remember: boolean,
  now = Date.now(),
) {
  await sql.transaction(async () => {
    const t = await getTxn(sql, txnId);
    if (!t) {
      return;
    }
    await updateTxn(sql, txnId, {
      category_id: categoryId,
      suggested_category_id: null,
      categorization_source: 'user',
      confidence: 'high',
    });
    if (remember && t.merchant_key) {
      await rememberCategory(sql, t.merchant_key, categoryId, now);
      await sql.execute(
        `UPDATE transactions SET category_id = ?, suggested_category_id = NULL,
           categorization_source = 'memory', confidence = 'high'
         WHERE merchant_key = ? AND category_id IS NULL AND id != ? AND is_transfer = 0
           AND direction = 'debit'`,
        [categoryId, t.merchant_key, txnId],
      );
    }
  });
}

export type Flag = 'is_transfer' | 'is_refund' | 'is_reimbursable';

// TXN-05: transfers and refunds stop counting as spending; reimbursable ones
// go on the "to be reimbursed" list.
export async function toggleFlag(
  sql: Sql,
  txnId: number,
  flag: Flag,
  on: boolean,
) {
  const patch: Record<string, number | string | null> = { [flag]: on ? 1 : 0 };
  if (flag === 'is_transfer') {
    patch.category_id = on ? 'transfer.self' : null;
    patch.categorization_source = on ? 'user' : 'none';
  }
  await updateTxn(sql, txnId, patch);
}

// EMF-06: paid from the emergency fund — excluded from the monthly budget,
// reduces the fund, and needs a reason.
export async function markEmergency(
  sql: Sql,
  txnId: number,
  reason: string,
  now = Date.now(),
) {
  await sql.transaction(async () => {
    const t = await getTxn(sql, txnId);
    if (!t || t.is_emergency) {
      return;
    }
    await updateTxn(sql, txnId, {
      is_emergency: 1,
      category_id: 'emergency.withdrawal',
      categorization_source: 'user',
      note: reason,
    });
    await sql.execute(
      "INSERT INTO emergency_fund_entries (type, amount, transaction_id, reason, created_at) VALUES ('withdrawal', ?, ?, ?, ?)",
      [t.amount, txnId, reason, now],
    );
  });
}

export async function unmarkEmergency(sql: Sql, txnId: number) {
  await sql.transaction(async () => {
    await updateTxn(sql, txnId, {
      is_emergency: 0,
      category_id: null,
      categorization_source: 'none',
    });
    await sql.execute(
      "DELETE FROM emergency_fund_entries WHERE transaction_id = ? AND type = 'withdrawal'",
      [txnId],
    );
  });
}

export async function setNote(sql: Sql, txnId: number, note: string) {
  await updateTxn(sql, txnId, { note: note.trim() || null });
}

// TXN-04: manual add for cash and missed payments.
export async function addManualTxn(
  sql: Sql,
  input: {
    amountPaise: number;
    merchant: string;
    accountId: string;
    categoryId: string | null;
    direction: 'debit' | 'credit';
    occurredAt: number;
    note?: string;
  },
  now = Date.now(),
) {
  const key = input.merchant.toLowerCase().replace(/[^a-z0-9]/g, '') || null;
  const r = await sql.execute(
    `INSERT INTO transactions (account_id, amount, direction, txn_type, merchant_raw,
       merchant_key, merchant_name, occurred_at, category_id, categorization_source,
       confidence, note, created_at)
     VALUES (?, ?, ?, 'other', ?, ?, ?, ?, ?, ?, 'high', ?, ?)`,
    [
      input.accountId,
      input.amountPaise,
      input.direction,
      input.merchant,
      key,
      input.merchant,
      input.occurredAt,
      input.categoryId,
      input.categoryId ? 'user' : 'none',
      input.note ?? null,
      now,
    ],
  );
  if (key && input.categoryId) {
    await rememberCategory(sql, key, input.categoryId, now);
  }
  return r.insertId!;
}

// "Auto-categorized · based on 5 past payments" (brief §9.4).
export async function pastPaymentsCount(sql: Sql, merchantKey: string | null) {
  if (!merchantKey) {
    return 0;
  }
  const r = await one<{ n: number }>(
    sql,
    'SELECT COUNT(*) AS n FROM transactions WHERE merchant_key = ? AND category_id IS NOT NULL',
    [merchantKey],
  );
  return Number(r?.n ?? 0);
}
