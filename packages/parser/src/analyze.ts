// Turns a batch of parsed transactions (the 90-day onboarding scan) into what
// onboarding shows: accounts, salary, a per-month bucket split and the most
// frequent merchants. Pure functions; no storage.

import defaults from './defaultBuckets.json';
import {CompiledTemplate} from './parse';
import {ParsedTxn} from './types';
import {istParts} from './values';

export type Bucket = 'need' | 'want' | 'investment' | 'loan';

export type SuggestedAccountType = 'salary' | 'savings' | 'credit';

export interface DetectedAccount {
  id: string; // `${bankCode}-${mask}`
  bankCode: string;
  bankName: string;
  mask: string;
  kind: 'account' | 'card';
  suggestedType: SuggestedAccountType;
  txnCount: number;
  lastBalancePaise: number | null;
  balanceUpdatedAt: number | null;
  availableLimitPaise: number | null;
}

export interface SalaryGuess {
  amountPaise: number;
  day: number;
  accountId: string;
  monthsSeen: number;
}

export interface MonthSplit {
  label: string; // "Sep"
  totalPaise: number;
  need: number;
  want: number;
  investment: number;
  loan: number;
  unsorted: number;
}

export interface FrequentMerchant {
  key: string;
  name: string;
  initials: string;
  count: number;
  totalPaise: number;
  suggested: Bucket | null;
}

export interface ScanSummary {
  transactionCount: number;
  accounts: DetectedAccount[];
  salary: SalaryGuess | null;
  months: MonthSplit[];
  averagesPaise: Record<Bucket | 'unsorted', number>;
  averageMonthlySpendPaise: number;
  merchants: FrequentMerchant[];
  // Transaction indexes (into the input array) treated as transfers, not spending.
  transferIndexes: number[];
}

const DEFAULTS = defaults as Record<string, Bucket>;
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TRANSFER_WINDOW_MS = 30 * 60 * 1000;
const CARD_BILL = /credit\s*card|\bcc\s*(bill|pay)|card\s*(bill|payment)|\bcred\b|billdesk.*card/i;
const INVESTMENT_HINT = /\b(mf|mutual|sip|zerodha|groww|kuvera|nps|ppf)\b|mutualfund/i;

export const accountId = (t: Pick<ParsedTxn, 'bankCode' | 'accountMask'>) =>
  `${t.bankCode}-${t.accountMask ?? 'unknown'}`;

// Default bucket for a debit before the user has taught the app anything.
export function suggestBucket(t: ParsedTxn): Bucket | null {
  if (t.merchantKey && DEFAULTS[t.merchantKey]) {
    return DEFAULTS[t.merchantKey];
  }
  if (t.type === 'auto_debit') {
    return INVESTMENT_HINT.test(t.merchantRaw ?? '') ? 'investment' : 'loan';
  }
  if (INVESTMENT_HINT.test(t.merchantRaw ?? '')) {
    return 'investment';
  }
  return null;
}

// PRD ACC-05 / TXN-06 / TXN-07: self-transfers, card bill payments and ATM
// withdrawals move money between the user's own pockets; they are not spending.
export function findTransfers(txns: ParsedTxn[]): Set<number> {
  const out = new Set<number>();
  const hasCard = txns.some(t => t.accountKind === 'card');
  txns.forEach((t, i) => {
    if (t.type === 'atm' || t.type === 'transfer') {
      out.add(i);
    }
    if (hasCard && t.direction === 'debit' && t.accountKind === 'account' && CARD_BILL.test(t.merchantRaw ?? '')) {
      out.add(i);
    }
  });
  // Pair each debit with a same-amount credit into another own account within
  // 30 minutes. Walk in time order so each debit only scans its window.
  const order = txns.map((_, i) => i).sort((a, b) => txns[a].occurredAt - txns[b].occurredAt);
  let lo = 0;
  order.forEach((i, pos) => {
    const d = txns[i];
    while (txns[order[lo]].occurredAt < d.occurredAt - TRANSFER_WINDOW_MS) {
      lo++;
    }
    if (d.direction !== 'debit' || out.has(i)) {
      return;
    }
    for (let q = lo; q < order.length; q++) {
      const k = order[q];
      const c = txns[k];
      if (c.occurredAt > d.occurredAt + TRANSFER_WINDOW_MS) {
        break;
      }
      if (
        q !== pos &&
        !out.has(k) &&
        c.direction === 'credit' &&
        c.amountPaise === d.amountPaise &&
        accountId(c) !== accountId(d)
      ) {
        out.add(i);
        out.add(k);
        break;
      }
    }
  });
  return out;
}

export function analyzeScan(txns: ParsedTxn[], templates: CompiledTemplate[], now = Date.now()): ScanSummary {
  const transfers = findTransfers(txns);
  const salary = detectSalary(txns, transfers);
  const accounts = detectAccounts(txns, templates, salary);
  const spends = txns.filter((t, i) => t.direction === 'debit' && !transfers.has(i));

  // Last three calendar months (IST) with the current one last.
  const nowParts = istParts(now);
  const monthKeys = [2, 1, 0].map(back => {
    const m = (nowParts.month - back + 12) % 12;
    const y = nowParts.year - (nowParts.month - back < 0 ? 1 : 0);
    return {y, m};
  });
  const months: MonthSplit[] = monthKeys.map(({m}) => ({
    label: MONTH_LABELS[m],
    totalPaise: 0,
    need: 0,
    want: 0,
    investment: 0,
    loan: 0,
    unsorted: 0,
  }));
  for (const t of spends) {
    const p = istParts(t.occurredAt);
    const i = monthKeys.findIndex(k => k.y === p.year && k.m === p.month);
    if (i === -1) {
      continue;
    }
    const bucket = suggestBucket(t) ?? 'unsorted';
    months[i][bucket] += t.amountPaise;
    months[i].totalPaise += t.amountPaise;
  }
  const active = months.filter(m => m.totalPaise > 0);
  const avg = (k: keyof Omit<MonthSplit, 'label'>) =>
    active.length ? Math.round(active.reduce((s, m) => s + m[k], 0) / active.length) : 0;

  return {
    transactionCount: txns.length,
    accounts,
    salary,
    months,
    averagesPaise: {
      need: avg('need'),
      want: avg('want'),
      investment: avg('investment'),
      loan: avg('loan'),
      unsorted: avg('unsorted'),
    },
    averageMonthlySpendPaise: avg('totalPaise'),
    merchants: frequentMerchants(spends),
    transferIndexes: [...transfers],
  };
}

function detectAccounts(
  txns: ParsedTxn[],
  templates: CompiledTemplate[],
  salary: SalaryGuess | null,
): DetectedAccount[] {
  const byId = new Map<string, DetectedAccount>();
  const bankName = (code: string) => templates.find(t => t.code === code)?.bank ?? code.toUpperCase();
  for (const t of txns) {
    if (!t.accountMask) {
      continue;
    }
    const id = accountId(t);
    let a = byId.get(id);
    if (!a) {
      a = {
        id,
        bankCode: t.bankCode,
        bankName: bankName(t.bankCode),
        mask: t.accountMask,
        kind: t.accountKind,
        suggestedType: t.accountKind === 'card' ? 'credit' : 'savings',
        txnCount: 0,
        lastBalancePaise: null,
        balanceUpdatedAt: null,
        availableLimitPaise: null,
      };
      byId.set(id, a);
    }
    a.txnCount += 1;
    if (t.balancePaise !== null && (a.balanceUpdatedAt === null || t.occurredAt > a.balanceUpdatedAt)) {
      a.lastBalancePaise = t.balancePaise;
      a.balanceUpdatedAt = t.occurredAt;
    }
    if (t.availableLimitPaise !== null) {
      a.availableLimitPaise = t.availableLimitPaise;
    }
  }
  if (salary) {
    const s = byId.get(salary.accountId);
    if (s) {
      s.suggestedType = 'salary';
    }
  }
  return [...byId.values()].sort((a, b) =>
    a.suggestedType === 'salary' ? -1 : b.suggestedType === 'salary' ? 1 : b.txnCount - a.txnCount,
  );
}

// PRD ONB-06: a salary is a credit that repeats in at least two different
// months at a similar amount (±20%). Credits the bank labels SALARY win.
export function detectSalary(txns: ParsedTxn[], transfers: Set<number>): SalaryGuess | null {
  const credits = txns
    .map((t, i) => ({t, i}))
    .filter(({t, i}) => t.direction === 'credit' && !transfers.has(i) && t.type !== 'refund' && t.accountMask);
  type Group = {items: ParsedTxn[]; labelled: boolean};
  const groups: Group[] = [];
  for (const {t} of credits) {
    const g = groups.find(
      x => accountId(x.items[0]) === accountId(t) && Math.abs(x.items[0].amountPaise - t.amountPaise) <= x.items[0].amountPaise * 0.2,
    );
    if (g) {
      g.items.push(t);
      g.labelled ||= t.type === 'salary';
    } else {
      groups.push({items: [t], labelled: t.type === 'salary'});
    }
  }
  const monthsOf = (g: Group) =>
    new Set(g.items.map(t => {
      const p = istParts(t.occurredAt);
      return `${p.year}-${p.month}`;
    })).size;
  const candidates = groups.filter(g => monthsOf(g) >= 2 || g.labelled);
  if (!candidates.length) {
    return null;
  }
  const best = candidates.sort(
    (a, b) => Number(b.labelled) - Number(a.labelled) || median(b.items.map(t => t.amountPaise)) - median(a.items.map(t => t.amountPaise)),
  )[0];
  const days = best.items.map(t => istParts(t.occurredAt).day);
  return {
    amountPaise: median(best.items.map(t => t.amountPaise)),
    day: mode(days),
    accountId: accountId(best.items[0]),
    monthsSeen: monthsOf(best),
  };
}

function frequentMerchants(spends: ParsedTxn[], limit = 12): FrequentMerchant[] {
  const byKey = new Map<string, FrequentMerchant>();
  for (const t of spends) {
    if (!t.merchantKey || !t.merchantRaw) {
      continue;
    }
    let m = byKey.get(t.merchantKey);
    if (!m) {
      const name = displayName(t.merchantRaw);
      m = {key: t.merchantKey, name, initials: initials(name), count: 0, totalPaise: 0, suggested: suggestBucket(t)};
      byKey.set(t.merchantKey, m);
    }
    m.count += 1;
    m.totalPaise += t.amountPaise;
  }
  return [...byKey.values()].sort((a, b) => b.count - a.count || b.totalPaise - a.totalPaise).slice(0, limit);
}

// "SWIGGY" -> "Swiggy", "rakesh.kumar@okicici" -> "Rakesh Kumar".
export function displayName(raw: string): string {
  const base = raw.includes('@') ? raw.split('@')[0].replace(/[._-]+/g, ' ') : raw;
  return base
    .replace(/\d{4,}/g, '')
    .trim()
    .toLowerCase()
    .replace(/\b[a-z]/g, c => c.toUpperCase())
    .replace(/\s+/g, ' ')
    .slice(0, 28);
}

export function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  const s = words.length >= 2 ? words[0][0] + words[1][0] : name.slice(0, 2);
  return s.toUpperCase();
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) / 2)];
}

function mode(xs: number[]): number {
  const counts = new Map<number, number>();
  xs.forEach(x => counts.set(x, (counts.get(x) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
}
