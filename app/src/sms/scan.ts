import {
  ParsedTxn,
  RawSms,
  ScanSummary,
  allSenderCodes,
  analyzeScan,
  bundledTemplates,
  dedupe,
  parseSms,
} from '@expense-manager/parser';
import { SmsInbox } from './SmsInbox';

export const SCAN_DAYS = 90;
const CHUNK = 200;

export interface ScanProgress {
  read: number;
  total: number;
  transactions: number;
  accounts: number;
}

export interface ScanOutcome {
  summary: ScanSummary;
  transactions: ParsedTxn[];
  unparsed: RawSms[];
  ignoredCount: number;
}

const nextFrame = () => new Promise<void>(resolve => setTimeout(resolve, 0));

// Onboarding backfill (PRD ONB-04): read the last 90 days of bank SMS, parse
// in small chunks so the progress ring keeps moving, then dedupe and analyse.
export async function scanInbox(
  onProgress: (p: ScanProgress) => void,
  now = Date.now(),
): Promise<ScanOutcome> {
  const templates = bundledTemplates();
  const messages = await SmsInbox.readInbox(
    now - SCAN_DAYS * 24 * 3600 * 1000,
    allSenderCodes(templates),
  );
  const parsed: ParsedTxn[] = [];
  const unparsed: RawSms[] = [];
  const accounts = new Set<string>();
  let ignoredCount = 0;

  for (let i = 0; i < messages.length; i += CHUNK) {
    for (const sms of messages.slice(i, i + CHUNK)) {
      const r = parseSms(sms, templates);
      if (r.status === 'parsed') {
        parsed.push(r.txn);
        if (r.txn.accountMask) {
          accounts.add(`${r.txn.bankCode}-${r.txn.accountMask}`);
        }
      } else if (r.status === 'unparsed') {
        unparsed.push(sms);
      } else if (r.status === 'ignored') {
        ignoredCount++;
      }
    }
    onProgress({
      read: Math.min(i + CHUNK, messages.length),
      total: messages.length,
      transactions: parsed.length,
      accounts: accounts.size,
    });
    await nextFrame();
  }

  const transactions = dedupe(parsed);
  return {
    summary: analyzeScan(transactions, templates, now),
    transactions,
    unparsed,
    ignoredCount,
  };
}
