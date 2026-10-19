import React, { createContext, useContext, useMemo, useState } from 'react';
import type { ScanSummary } from '@expense-manager/parser';
import { BudgetBucket, Split, TemplateId } from './budget';

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

export interface OnboardingAccount {
  id: string;
  name: string;
  type: AccountType;
  include: boolean;
  balancePaise: number | null;
}

export interface OnboardingState {
  smsGranted: boolean;
  notificationsGranted: boolean;
  manualMode: boolean;
  // Result of the 90-day SMS scan; null until it has run.
  scan: ScanSummary | null;
  accounts: OnboardingAccount[];
  income: number;
  cycleDay: number;
  cycleMode: 'salary' | 'calendar';
  incomeConfirmed: boolean;
  template: TemplateId;
  split: Split;
  emergencyMonths: number;
  emergencyAccountId: string | null;
  emergencyBalance: number;
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
  scan: null,
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
  merchantMemory: {},
  pin: null,
  biometric: true,
};

const SHORT_BANK: Record<string, string> = {
  hdfc: 'HDFC',
  icici: 'ICICI',
  sbi: 'SBI',
  axis: 'Axis',
  boi: 'BOI',
};

// "HDFC ••4521", "ICICI credit card ••1123" (brief §13 sample names).
export function accountName(a: ScanSummary['accounts'][number]): string {
  const bank = SHORT_BANK[a.bankCode] ?? a.bankName;
  return a.kind === 'card'
    ? `${bank} credit card ••${a.mask}`
    : `${bank} ••${a.mask}`;
}

export const toRupees = (paise: number) => Math.round(paise / 100);

// Average monthly Need spend from the scan, or the Need budget when there is no
// history yet (PRD EMF-02).
export function essentialSpend(state: OnboardingState): number {
  const fromScan = state.scan ? toRupees(state.scan.averagesPaise.need) : 0;
  return fromScan > 0 ? fromScan : state.split.need;
}

interface Ctx {
  state: OnboardingState;
  update: (patch: Partial<OnboardingState>) => void;
  applyScan: (scan: ScanSummary) => void;
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
      applyScan: scan =>
        setState(s => ({
          ...s,
          scan,
          accounts: scan.accounts.map(a => ({
            id: a.id,
            name: accountName(a),
            type: a.suggestedType,
            include: true,
            balancePaise: a.lastBalancePaise,
          })),
          income: scan.salary ? toRupees(scan.salary.amountPaise) : s.income,
          cycleDay: scan.salary?.day ?? s.cycleDay,
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
