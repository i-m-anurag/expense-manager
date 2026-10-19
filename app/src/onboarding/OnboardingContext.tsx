import React, { createContext, useContext, useMemo, useState } from 'react';
import { BudgetBucket, Split, TemplateId } from './budget';
import { ScannedAccount, sampleScan } from './sampleScan';

export type AccountType =
  | 'salary'
  | 'savings'
  | 'credit'
  | 'emergency'
  | 'loan'
  | 'cash';

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  salary: 'Salary account',
  savings: 'Savings',
  credit: 'Credit card',
  emergency: 'Emergency fund',
  loan: 'Loan',
  cash: 'Cash wallet',
};

export interface OnboardingState {
  smsGranted: boolean;
  notificationsGranted: boolean;
  manualMode: boolean;
  scanned: boolean;
  accounts: ScannedAccount[];
  income: number;
  cycleDay: number;
  cycleMode: 'salary' | 'calendar';
  incomeConfirmed: boolean;
  template: TemplateId;
  split: Split;
  emergencyMonths: number;
  emergencyAccountId: string | null;
  emergencyBalance: number;
  averageEssentialSpend: number;
  merchantMemory: Record<string, BudgetBucket>;
  pin: string | null;
  biometric: boolean;
}

// Defaults are what the user gets if they skip a step (brief §9.1: "every step
// after permissions is skippable with sensible defaults").
const initialState: OnboardingState = {
  smsGranted: false,
  notificationsGranted: false,
  manualMode: false,
  scanned: false,
  accounts: [],
  income: 100000,
  cycleDay: 1,
  cycleMode: 'salary',
  incomeConfirmed: false,
  template: 'custom',
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
  averageEssentialSpend: 50000,
  merchantMemory: {},
  pin: null,
  biometric: true,
};

interface Ctx {
  state: OnboardingState;
  update: (patch: Partial<OnboardingState>) => void;
  applyScan: () => void;
}

const OnboardingContext = createContext<Ctx | null>(null);

export function OnboardingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState(initialState);
  const value = useMemo<Ctx>(
    () => ({
      state,
      update: patch => setState(s => ({ ...s, ...patch })),
      applyScan: () =>
        setState(s => ({
          ...s,
          scanned: true,
          accounts: sampleScan.accounts,
          income: sampleScan.salary.amount,
          cycleDay: sampleScan.salary.day,
          emergencyAccountId:
            sampleScan.accounts.find(a => a.type === 'emergency')?.id ?? null,
          emergencyBalance: sampleScan.emergencyBalance,
          averageEssentialSpend: sampleScan.averageEssentialSpend,
        })),
    }),
    [state],
  );
  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error('useOnboarding must be used inside OnboardingProvider');
  }
  return ctx;
}
