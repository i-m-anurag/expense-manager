import { seedCategories } from '../db/categories';
import { Sql } from '../db/sql';

// Child tables first so foreign keys never block a delete.
const TABLES = [
  'transaction_splits',
  'emergency_fund_entries',
  'alert_log',
  'budget_allocations',
  'budget_cycles',
  'merchant_memory',
  'rules',
  'recurring_patterns',
  'transactions',
  'raw_sms',
  'accounts',
  'emergency_fund',
  'settings',
  'categories',
];

// PRD SEC-07: delete all data, leaving an empty database ready for a fresh
// onboarding. The encryption key stays; the PIN is cleared by the caller.
export async function deleteAllData(sql: Sql) {
  await sql.transaction(async () => {
    for (const t of TABLES) {
      await sql.execute(`DELETE FROM ${t}`);
    }
    await seedCategories(sql);
  });
}
