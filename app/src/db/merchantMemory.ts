import { Sql, one } from './sql';

export interface MemoryEntry {
  merchant_key: string;
  category_id: string;
  tag_count: number;
  last_used_at: number;
}

// CAT-03: 3+ consistent tags → applied automatically.
export const HIGH_CONFIDENCE_TAGS = 3;

export function getMemory(sql: Sql, merchantKey: string) {
  return one<MemoryEntry & { [k: string]: any }>(
    sql,
    'SELECT * FROM merchant_memory WHERE merchant_key = ?',
    [merchantKey],
  );
}

// CAT-02 / CAT-08: the same category again strengthens the entry; a different
// one replaces it and drops back to medium confidence (count 1).
export async function rememberCategory(
  sql: Sql,
  merchantKey: string,
  categoryId: string,
  now = Date.now(),
  initialCount = 1,
) {
  await sql.execute(
    `INSERT INTO merchant_memory (merchant_key, category_id, tag_count, last_used_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (merchant_key) DO UPDATE SET
       tag_count = CASE WHEN category_id = excluded.category_id
                        THEN tag_count + 1 ELSE excluded.tag_count END,
       category_id = excluded.category_id,
       last_used_at = excluded.last_used_at`,
    [merchantKey, categoryId, initialCount, now],
  );
}
