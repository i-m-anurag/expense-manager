import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AppState } from 'react-native';
import { getDb } from '../db/connection';
import { getSetting } from '../db/settings';
import { Sql } from '../db/sql';
import { scheduleReminders } from '../notify/dispatch';
import { reconcileInbox } from '../sms/sync';
import { ThemePref, useTheme } from '../theme/ThemeProvider';

interface DataCtx {
  sql: Sql;
  onboarded: boolean;
  // Bumped after any write so screens re-run their queries.
  version: number;
  refresh: () => void;
}

const Ctx = createContext<DataCtx | null>(null);

type Boot =
  | { state: 'loading' }
  | { state: 'ready'; sql: Sql; onboarded: boolean }
  | { state: 'error'; error: Error };

export function DataProvider({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback: (error?: Error) => React.ReactNode;
}) {
  const [boot, setBoot] = useState<Boot>({ state: 'loading' });
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion(v => v + 1), []);
  const { setPref } = useTheme();

  useEffect(() => {
    (async () => {
      try {
        const sql = await getDb();
        const onboarded = (await getSetting(sql, 'onboarded')) === '1';
        const theme = await getSetting(sql, 'theme');
        if (theme) {
          setPref(theme as ThemePref);
        }
        setBoot({ state: 'ready', sql, onboarded });
      } catch (e) {
        setBoot({ state: 'error', error: e as Error });
      }
    })();
    // Runs once at launch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // SMS-08: reconcile the inbox at launch and whenever the app comes back.
  useEffect(() => {
    if (boot.state !== 'ready') {
      return;
    }
    const run = () =>
      reconcileInbox(boot.sql)
        // Always refresh: a notification quick-tag may have changed data
        // while the app was in the background.
        .then(() => refresh())
        .then(() => scheduleReminders(boot.sql))
        .catch(() => undefined);
    run();
    const sub = AppState.addEventListener(
      'change',
      s => s === 'active' && run(),
    );
    return () => sub.remove();
  }, [boot, refresh]);

  const value = useMemo(
    () =>
      boot.state === 'ready'
        ? { sql: boot.sql, onboarded: boot.onboarded, version, refresh }
        : null,
    [boot, version, refresh],
  );

  if (!value) {
    return <>{fallback(boot.state === 'error' ? boot.error : undefined)}</>;
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error('useData must be used inside DataProvider');
  }
  return ctx;
}

// Runs an async query and re-runs it whenever data changes.
export function useQuery<T>(
  fn: (sql: Sql) => Promise<T>,
  deps: React.DependencyList,
): T | undefined {
  const { sql, version } = useData();
  const [value, setValue] = useState<T>();
  useEffect(() => {
    let alive = true;
    fn(sql).then(v => alive && setValue(v));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sql, version, ...deps]);
  return value;
}
