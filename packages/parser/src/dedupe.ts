import {ParsedTxn} from './types';

const WINDOW_MS = 10 * 60 * 1000;

// PRD SMS-06: two parsed transactions are the same if they share a reference
// number, or have the same account, amount and direction within 10 minutes.
// Banks often send one SMS for the UPI leg and one for the account debit.
export function isDuplicate(a: ParsedTxn, b: ParsedTxn): boolean {
  if (a.referenceNo && b.referenceNo) {
    return a.referenceNo === b.referenceNo && a.direction === b.direction;
  }
  return (
    a.bankCode === b.bankCode &&
    a.accountMask === b.accountMask &&
    a.amountPaise === b.amountPaise &&
    a.direction === b.direction &&
    Math.abs(a.occurredAt - b.occurredAt) <= WINDOW_MS
  );
}

// Keeps the first of each duplicate group, preferring the one with more detail.
export function dedupe(txns: ParsedTxn[]): ParsedTxn[] {
  const sorted = [...txns].sort((a, b) => a.occurredAt - b.occurredAt);
  const kept: ParsedTxn[] = [];
  for (const t of sorted) {
    // `kept` is in time order, so only look back while still inside the window.
    // Reference matches can be a little further apart than 10 minutes (an hour).
    let i = -1;
    for (let j = kept.length - 1; j >= 0 && t.occurredAt - kept[j].occurredAt <= WINDOW_MS * 6; j--) {
      if (isDuplicate(kept[j], t)) {
        i = j;
        break;
      }
    }
    if (i === -1) {
      kept.push(t);
    } else if (detail(t) > detail(kept[i])) {
      kept[i] = t;
    }
  }
  return kept;
}

const detail = (t: ParsedTxn) =>
  (t.merchantRaw ? 2 : 0) + (t.referenceNo ? 1 : 0) + (t.balancePaise !== null ? 1 : 0);
