// In-memory SQLite for tests, through the same Sql interface the app uses.
// Node's built-in driver stands in for op-sqlite (no SQLCipher needed here).
import { seedCategories } from '../../src/db/categories';
import { migrate } from '../../src/db/migrations';
import { Scalar, Sql, withTransactions } from '../../src/db/sql';

const { DatabaseSync } = require('node:sqlite');

export async function memorySql(): Promise<Sql> {
  const db = new DatabaseSync(':memory:');
  const sql = withTransactions(async (query: string, params: Scalar[] = []) => {
    const stmt = db.prepare(query);
    if (stmt.columns().length > 0) {
      return { rows: stmt.all(...params), rowsAffected: 0 };
    }
    const r = stmt.run(...params);
    return {
      rows: [],
      insertId: Number(r.lastInsertRowid),
      rowsAffected: Number(r.changes),
    };
  });
  await sql.execute('PRAGMA foreign_keys = ON');
  await migrate(sql);
  await seedCategories(sql);
  return sql;
}
