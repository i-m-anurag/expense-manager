import { Sql, all, one } from './sql';

export interface UnparsedSms {
  id: number;
  sender: string;
  body: string;
  received_at: number;
}

// PRD SMS-09: bank SMS that matched no pattern and weren't ignored.
export function listUnparsed(sql: Sql) {
  return all<UnparsedSms & { [k: string]: any }>(
    sql,
    "SELECT id, sender, body, received_at FROM raw_sms WHERE status = 'unparsed' ORDER BY received_at DESC LIMIT 200",
  );
}

export async function countUnparsed(sql: Sql) {
  const r = await one<{ n: number }>(
    sql,
    "SELECT COUNT(*) AS n FROM raw_sms WHERE status = 'unparsed'",
  );
  return Number(r?.n ?? 0);
}

export async function dismissUnparsed(sql: Sql, id: number) {
  await sql.execute("UPDATE raw_sms SET status = 'dismissed' WHERE id = ?", [
    id,
  ]);
}
