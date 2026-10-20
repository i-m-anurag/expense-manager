import { bundledTemplates } from '@expense-manager/parser';
import { getBudgetSnapshot, setCycleMode } from '../src/domain/budget';
import { saveOnboarding } from '../src/domain/onboarding';
import { deleteAllData } from '../src/domain/reset';
import { getSetting } from '../src/db/settings';
import { all } from '../src/db/sql';
import type { OnboardingState } from '../src/onboarding/OnboardingContext';
import { memorySql } from './helpers/memorySql';

const at = (iso: string) => Date.parse(iso);
const state = {
  accounts: [],
  merchantMemory: {},
  cycleMode: 'salary',
  cycleDay: 25,
  income: 100000,
  split: {
    need: 50000,
    want: 20000,
    investment: 15000,
    loan: 10000,
    emergency: 5000,
  },
  emergencyMonths: 6,
  emergencyAccountId: null,
  emergencyBalance: 0,
  notificationsGranted: false,
} as unknown as OnboardingState;

test('switching to the 1st moves the current cycle', async () => {
  const sql = await memorySql();
  const now = at('2025-10-10T12:00:00+05:30');
  await saveOnboarding(sql, state, [], bundledTemplates(), 'A', now);
  expect((await getBudgetSnapshot(sql, now))?.cycle.start_date).toBe(
    '2025-09-25',
  );
  await setCycleMode(sql, 'calendar', 25, now);
  const b = await getBudgetSnapshot(sql, now);
  expect([b?.cycle.start_date, b?.cycle.end_date]).toEqual([
    '2025-10-01',
    '2025-10-31',
  ]);
  expect(b?.totalBudget).toBe(9500000);
});

test('delete all data leaves an empty, usable database', async () => {
  const sql = await memorySql();
  await saveOnboarding(sql, state, [], bundledTemplates(), 'A', Date.now());
  await deleteAllData(sql);
  expect(await getSetting(sql, 'onboarded')).toBeNull();
  expect(
    Number((await all(sql, 'SELECT COUNT(*) AS n FROM accounts'))[0].n),
  ).toBe(0);
  expect(
    Number((await all(sql, 'SELECT COUNT(*) AS n FROM categories'))[0].n),
  ).toBeGreaterThan(30);
  // Onboarding again works on the emptied database.
  await saveOnboarding(sql, state, [], bundledTemplates(), 'B', Date.now());
  expect(await getSetting(sql, 'user_name')).toBe('B');
});
