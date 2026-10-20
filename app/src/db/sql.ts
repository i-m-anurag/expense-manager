// The narrow slice of SQLite the app uses. op-sqlite implements it on device;
// tests use Node's built-in sqlite through the same interface.

export type Scalar = string | number | null;

export interface Row {
  [column: string]: Scalar;
}

export interface Result {
  rows: Row[];
  insertId?: number;
  rowsAffected: number;
}

export interface Sql {
  execute(query: string, params?: Scalar[]): Promise<Result>;
  // Runs fn inside BEGIN/COMMIT; rolls back if it throws.
  transaction<T>(fn: () => Promise<T>): Promise<T>;
}

// Serialises transactions so a background SMS task and the UI can't interleave
// BEGIN/COMMIT on the single connection.
export function withTransactions(execute: Sql['execute']): Sql {
  let queue: Promise<unknown> = Promise.resolve();
  return {
    execute,
    transaction<T>(fn: () => Promise<T>) {
      const run = async () => {
        await execute('BEGIN');
        try {
          const out = await fn();
          await execute('COMMIT');
          return out;
        } catch (e) {
          await execute('ROLLBACK');
          throw e;
        }
      };
      const next = queue.then(run, run);
      queue = next.catch(() => undefined);
      return next;
    },
  };
}

export async function one<T extends Row>(
  sql: Sql,
  query: string,
  params: Scalar[] = [],
): Promise<T | null> {
  const r = await sql.execute(query, params);
  return (r.rows[0] as T | undefined) ?? null;
}

export async function all<T extends Row>(
  sql: Sql,
  query: string,
  params: Scalar[] = [],
): Promise<T[]> {
  return (await sql.execute(query, params)).rows as T[];
}
