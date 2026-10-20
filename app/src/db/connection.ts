import { open } from '@op-engineering/op-sqlite';
import { NativeModules } from 'react-native';
import { seedCategories } from './categories';
import { migrate } from './migrations';
import { Row, Sql, withTransactions } from './sql';

interface SecureStoreNative {
  getDatabaseKey(): Promise<string>;
  setPin(pin: string): Promise<boolean>;
  verifyPin(pin: string): Promise<boolean>;
  hasPin(): Promise<boolean>;
  clearPin(): Promise<boolean>;
}

// Kotlin module in android/app/src/main/java/com/expensemanager/secure.
export const SecureStore: SecureStoreNative = NativeModules.SecureStore;

let ready: Promise<Sql> | null = null;

// One encrypted connection for the whole process (UI and Headless JS share it).
// The SQLCipher key comes from the Android Keystore-wrapped store (SEC-02).
export function getDb(): Promise<Sql> {
  ready ??= (async () => {
    const key = await SecureStore.getDatabaseKey();
    const db = open({ name: 'expense-manager.db', encryptionKey: key });
    const sql = withTransactions(async (query, params) => {
      const r = await db.execute(query, params ?? []);
      return {
        rows: r.rows as Row[],
        insertId: r.insertId,
        rowsAffected: r.rowsAffected,
      };
    });
    await sql.execute('PRAGMA foreign_keys = ON');
    await migrate(sql);
    await seedCategories(sql);
    return sql;
  })();
  ready.catch(() => {
    ready = null;
  });
  return ready;
}
