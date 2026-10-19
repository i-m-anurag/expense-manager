export type BudgetBucket = 'need' | 'want' | 'investment' | 'loan';

export type SplitKey = BudgetBucket | 'emergency';

export type Split = Record<SplitKey, number>;

export type TemplateId = 'fiftyThirtyTwenty' | 'zeroBased' | 'custom';

export const SPLIT_KEYS: SplitKey[] = [
  'need',
  'want',
  'investment',
  'loan',
  'emergency',
];

export const SPLIT_LABELS: Record<SplitKey, string> = {
  need: 'Need',
  want: 'Want',
  investment: 'Investment',
  loan: 'Loan / EMI',
  emergency: 'Emergency fund',
};

const roundTo = (n: number, step: number) => Math.round(n / step) * step;

// 50/30/20: Needs (including EMIs) 50%, Wants 30%, savings 20% split between
// investments and the emergency fund. Loans come out of the Need share.
export function fiftyThirtyTwenty(income: number, currentLoan: number): Split {
  const needShare = roundTo(income * 0.5, 1000);
  const loan = Math.min(currentLoan, needShare);
  return {
    need: needShare - loan,
    loan,
    want: roundTo(income * 0.3, 1000),
    investment: roundTo(income * 0.15, 1000),
    emergency: roundTo(income * 0.05, 1000),
  };
}

// Zero-based starts from what the user actually spent; every rupee left over
// shows as "Unassigned" until they place it (BUD-06).
export function fromAverages(
  avg: Record<BudgetBucket, number>,
  emergency: number,
): Split {
  return {
    need: roundTo(avg.need, 1000),
    want: roundTo(avg.want, 1000),
    investment: roundTo(avg.investment, 1000),
    loan: roundTo(avg.loan, 1000),
    emergency,
  };
}

export const splitTotal = (s: Split) =>
  SPLIT_KEYS.reduce((sum, k) => sum + s[k], 0);
