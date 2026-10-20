import { Sql, all } from './sql';

export type CategoryBucket =
  | 'need'
  | 'want'
  | 'investment'
  | 'loan'
  | 'emergency'
  | 'income'
  | 'transfer';

export interface Category {
  id: string;
  bucket: CategoryBucket;
  name: string;
}

// PRD CAT-01. Buckets are fixed; sub-categories can be added later. Every
// budget bucket has an "Other" so a bucket-only choice still has a category.
const DEFAULTS: Record<CategoryBucket, [string, string][]> = {
  need: [
    ['rent', 'Rent'],
    ['groceries', 'Groceries'],
    ['utilities', 'Utilities'],
    ['commute', 'Commute'],
    ['medical', 'Medical'],
    ['insurance', 'Insurance'],
    ['education', 'Education'],
    ['other', 'Other'],
  ],
  want: [
    ['food_delivery', 'Food delivery'],
    ['dining_out', 'Dining out'],
    ['shopping', 'Shopping'],
    ['entertainment', 'Entertainment'],
    ['travel', 'Travel'],
    ['subscriptions', 'Subscriptions'],
    ['other', 'Other'],
  ],
  investment: [
    ['sip', 'SIP'],
    ['stocks', 'Stocks'],
    ['ppf_nps', 'PPF / NPS'],
    ['recurring_deposit', 'Recurring deposit'],
    ['other', 'Other'],
  ],
  loan: [
    ['home_loan', 'Home loan'],
    ['car_loan', 'Car loan'],
    ['personal_loan', 'Personal loan'],
    ['card_emi', 'Credit card EMI'],
    ['other', 'Other'],
  ],
  emergency: [
    ['contribution', 'Contribution'],
    ['withdrawal', 'Withdrawal'],
  ],
  income: [
    ['salary', 'Salary'],
    ['interest', 'Interest'],
    ['refund', 'Refund'],
    ['other', 'Other income'],
  ],
  transfer: [
    ['self', 'Self-transfer'],
    ['card_bill', 'Card bill payment'],
    ['atm', 'ATM withdrawal'],
  ],
};

export const BUDGET_BUCKETS = ['need', 'want', 'investment', 'loan'] as const;

export const BUCKET_LABELS: Record<CategoryBucket, string> = {
  need: 'Need',
  want: 'Want',
  investment: 'Investment',
  loan: 'Loan / EMI',
  emergency: 'Emergency fund',
  income: 'Income',
  transfer: 'Transfer',
};

export async function seedCategories(sql: Sql) {
  let sort = 0;
  for (const [bucket, items] of Object.entries(DEFAULTS)) {
    for (const [slug, name] of items) {
      await sql.execute(
        'INSERT OR IGNORE INTO categories (id, bucket, name, sort) VALUES (?, ?, ?, ?)',
        [`${bucket}.${slug}`, bucket, name, sort++],
      );
    }
  }
}

export function listCategories(sql: Sql): Promise<Category[]> {
  return all<Category & { [k: string]: string }>(
    sql,
    'SELECT id, bucket, name FROM categories WHERE archived = 0 ORDER BY sort',
  );
}

export const bucketOf = (categoryId: string) =>
  categoryId.split('.')[0] as CategoryBucket;
