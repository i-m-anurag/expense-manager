import {
  CompiledTemplate,
  ParsedTxn,
  RawSms,
  displayName,
  parseSms,
} from '@expense-manager/parser';
import { ensureAccount, getAccount, updateBalance } from '../db/accounts';
import { getMemory } from '../db/merchantMemory';
import { Sql, one } from '../db/sql';
import { insertTxn, updateTxn } from '../db/transactions';
import { categorize } from './categorize';

const DUP_WINDOW_MS = 10 * 60 * 1000;
const TRANSFER_WINDOW_MS = 30 * 60 * 1000;
const CARD_BILL =
  /credit\s*card|\bcc\s*(bill|pay)|card\s*(bill|payment)|\bcred\b|billdesk.*card/i;

const SHORT_BANK: Record<string, string> = {
  hdfc: 'HDFC',
  icici: 'ICICI',
  sbi: 'SBI',
  axis: 'Axis',
  boi: 'BOI',
};

export interface IngestResult {
  inserted: number[];
  duplicates: number;
  unparsed: number;
  ignored: number;
  alreadySeen: number;
}

// Flow 8.1: raw SMS → parse → dedupe → account → transfer check → categorise →
// store. Idempotent: a message already in raw_sms is skipped, so the on-open
// reconciliation (SMS-08) can safely re-read overlapping ranges.
export async function ingestMessages(
  sql: Sql,
  messages: RawSms[],
  templates: CompiledTemplate[],
  now = Date.now(),
): Promise<IngestResult> {
  const out: IngestResult = {
    inserted: [],
    duplicates: 0,
    unparsed: 0,
    ignored: 0,
    alreadySeen: 0,
  };
  for (const sms of messages) {
    await sql.transaction(async () => {
      const r = parseSms(sms, templates);
      if (r.status === 'not_bank') {
        return;
      }
      const status =
        r.status === 'parsed'
          ? 'parsed'
          : r.status === 'ignored'
          ? 'ignored'
          : 'unparsed';
      const ins = await sql.execute(
        `INSERT OR IGNORE INTO raw_sms (device_sms_id, sender, body, received_at, status,
           bank_code, parser_pattern_id, ignore_reason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sms.id ?? null,
          sms.sender,
          sms.body,
          sms.receivedAt,
          status,
          r.status === 'parsed' ? r.txn.bankCode : r.bankCode,
          r.status === 'parsed' ? r.txn.patternId : null,
          r.status === 'ignored' ? r.reason : null,
        ],
      );
      if (!ins.rowsAffected) {
        out.alreadySeen++;
        return;
      }
      const rawId = ins.insertId!;
      if (r.status === 'ignored') {
        out.ignored++;
        return;
      }
      if (r.status === 'unparsed') {
        out.unparsed++;
        return;
      }
      const t = r.txn;
      const accountId = t.accountMask ? `${t.bankCode}-${t.accountMask}` : null;
      if (await isDuplicateInDb(sql, t, accountId)) {
        await sql.execute(
          "UPDATE raw_sms SET status = 'duplicate' WHERE id = ?",
          [rawId],
        );
        out.duplicates++;
        return;
      }
      if (accountId) {
        const bank = SHORT_BANK[t.bankCode] ?? t.bankCode.toUpperCase();
        await ensureAccount(sql, {
          id: accountId,
          bank_code: t.bankCode,
          mask: t.accountMask,
          kind: t.accountKind,
          type: t.accountKind === 'card' ? 'credit' : 'savings',
          display_name:
            t.accountKind === 'card'
              ? `${bank} credit card ••${t.accountMask}`
              : `${bank} ••${t.accountMask}`,
        });
        await updateBalance(
          sql,
          accountId,
          t.occurredAt,
          t.balancePaise,
          t.availableLimitPaise,
        );
      }

      const transfer = await detectTransfer(sql, t, accountId);
      const memory = t.merchantKey ? await getMemory(sql, t.merchantKey) : null;
      const p2pMatch = memory ? null : await findP2pMatch(sql, t);
      const cat = categorize(t, {
        isTransfer: transfer?.kind ?? null,
        memory,
        p2pMatch,
      });

      const id = await insertTxn(
        sql,
        {
          account_id: accountId,
          raw_sms_id: rawId,
          amount: t.amountPaise,
          direction: t.direction,
          txn_type: t.type,
          merchant_raw: t.merchantRaw,
          merchant_key: t.merchantKey,
          merchant_name: t.merchantRaw ? displayName(t.merchantRaw) : null,
          reference_no: t.referenceNo,
          occurred_at: t.occurredAt,
          category_id: cat.categoryId,
          suggested_category_id: cat.suggestedId,
          categorization_source: cat.source,
          confidence: cat.confidence,
          is_transfer: transfer ? 1 : 0,
          is_refund: t.type === 'refund' ? 1 : 0,
          is_reimbursable: 0,
          is_emergency: 0,
          linked_txn_id: transfer?.otherId ?? null,
          note: null,
          balance_after: t.balancePaise,
        },
        now,
      );
      if (transfer?.otherId) {
        // Link the other leg and re-label it as a self-transfer.
        await updateTxn(sql, transfer.otherId, {
          is_transfer: 1,
          linked_txn_id: id,
          category_id: 'transfer.self',
          suggested_category_id: null,
          categorization_source: 'pattern',
          confidence: 'high',
        });
        await recordEmergencyContribution(
          sql,
          t.direction === 'credit' ? id : transfer.otherId,
          now,
        );
      }
      out.inserted.push(id);
    });
  }
  return out;
}

// SMS-06 against what is already stored.
async function isDuplicateInDb(
  sql: Sql,
  t: ParsedTxn,
  accountId: string | null,
) {
  if (t.referenceNo) {
    const byRef = await one(
      sql,
      'SELECT id FROM transactions WHERE reference_no = ? AND direction = ? LIMIT 1',
      [t.referenceNo, t.direction],
    );
    if (byRef) {
      return true;
    }
  }
  const near = await one(
    sql,
    `SELECT id FROM transactions
     WHERE account_id IS ? AND amount = ? AND direction = ? AND occurred_at BETWEEN ? AND ?
       AND (reference_no IS NULL OR ? IS NULL)
     LIMIT 1`,
    [
      accountId,
      t.amountPaise,
      t.direction,
      t.occurredAt - DUP_WINDOW_MS,
      t.occurredAt + DUP_WINDOW_MS,
      t.referenceNo,
    ],
  );
  return near !== null;
}

// ACC-05, TXN-06, TXN-07.
async function detectTransfer(
  sql: Sql,
  t: ParsedTxn,
  accountId: string | null,
): Promise<{ kind: 'self' | 'card_bill' | 'atm'; otherId?: number } | null> {
  if (t.type === 'atm') {
    return { kind: 'atm' };
  }
  if (
    t.direction === 'debit' &&
    t.accountKind === 'account' &&
    CARD_BILL.test(t.merchantRaw ?? '')
  ) {
    const card = await one(
      sql,
      "SELECT id FROM accounts WHERE kind = 'card' LIMIT 1",
    );
    if (card) {
      return { kind: 'card_bill' };
    }
  }
  const other = await one<{ id: number }>(
    sql,
    `SELECT id FROM transactions
     WHERE direction = ? AND amount = ? AND is_transfer = 0
       AND account_id IS NOT NULL AND account_id IS NOT ?
       AND occurred_at BETWEEN ? AND ?
     ORDER BY ABS(occurred_at - ?) LIMIT 1`,
    [
      t.direction === 'debit' ? 'credit' : 'debit',
      t.amountPaise,
      accountId,
      t.occurredAt - TRANSFER_WINDOW_MS,
      t.occurredAt + TRANSFER_WINDOW_MS,
      t.occurredAt,
    ],
  );
  return other ? { kind: 'self', otherId: Number(other.id) } : null;
}

// CAT-04: same payee, amount within ±10%, same part of the month (±3 days) as a
// payment the user already categorised.
async function findP2pMatch(sql: Sql, t: ParsedTxn): Promise<string | null> {
  if (!t.merchantKey || t.direction !== 'debit') {
    return null;
  }
  const day = new Date(t.occurredAt + 330 * 60000).getUTCDate();
  const row = await one<{ category_id: string }>(
    sql,
    `SELECT category_id FROM transactions
     WHERE merchant_key = ? AND categorization_source = 'user' AND category_id IS NOT NULL
       AND amount BETWEEN ? AND ?
       AND ABS(CAST(strftime('%d', (occurred_at + 19800000) / 1000, 'unixepoch') AS INTEGER) - ?) <= 3
     ORDER BY occurred_at DESC LIMIT 1`,
    [
      t.merchantKey,
      Math.round(t.amountPaise * 0.9),
      Math.round(t.amountPaise * 1.1),
      day,
    ],
  );
  return row?.category_id ?? null;
}

// EMF-05: money moved into an emergency-fund account is a contribution.
async function recordEmergencyContribution(
  sql: Sql,
  creditTxnId: number,
  now: number,
) {
  const row = await one<{ account_id: string; amount: number }>(
    sql,
    'SELECT account_id, amount FROM transactions WHERE id = ?',
    [creditTxnId],
  );
  if (!row?.account_id) {
    return;
  }
  const account = await getAccount(sql, row.account_id);
  if (account?.type !== 'emergency') {
    return;
  }
  await updateTxn(sql, creditTxnId, { category_id: 'emergency.contribution' });
  await sql.execute(
    "INSERT INTO emergency_fund_entries (type, amount, transaction_id, created_at) VALUES ('contribution', ?, ?, ?)",
    [row.amount, creditTxnId, now],
  );
}
