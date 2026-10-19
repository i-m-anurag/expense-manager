// Stand-in for the SMS scan result until the parser engine (M1) and native SMS
// module exist. Numbers match the design's sample data (brief §13).

import { AccountType } from './OnboardingContext';
import { BudgetBucket } from './budget';

export interface ScannedAccount {
  id: string;
  name: string;
  type: AccountType;
  include: boolean;
}

export interface MonthSplit {
  label: string;
  total: number;
  need: number;
  want: number;
  investment: number;
  loan: number;
}

export interface FrequentMerchant {
  key: string;
  name: string;
  initials: string;
  count: number;
  total: number;
  suggested: BudgetBucket;
}

export const sampleScan = {
  transactionCount: 124,
  accounts: [
    { id: 'hdfc-4521', name: 'HDFC ••4521', type: 'salary', include: true },
    { id: 'sbi-8830', name: 'SBI ••8830', type: 'savings', include: true },
    {
      id: 'icici-1123',
      name: 'ICICI credit card ••1123',
      type: 'credit',
      include: true,
    },
    { id: 'axis-7710', name: 'Axis ••7710', type: 'emergency', include: false },
  ] as ScannedAccount[],
  months: [
    {
      label: 'Jul',
      total: 86000,
      need: 44720,
      want: 18920,
      investment: 12040,
      loan: 10320,
    },
    {
      label: 'Aug',
      total: 95000,
      need: 47500,
      want: 22800,
      investment: 13300,
      loan: 11400,
    },
    {
      label: 'Sep',
      total: 77000,
      need: 42350,
      want: 15400,
      investment: 10010,
      loan: 9240,
    },
  ] as MonthSplit[],
  averages: { need: 46200, want: 21400, investment: 12000, loan: 10000 },
  averageMonthlySpend: 86000,
  salary: { amount: 100000, day: 1, accountName: 'HDFC ••4521', monthsSeen: 3 },
  emergencyBalance: 240000,
  averageEssentialSpend: 48000,
  merchants: [
    {
      key: 'swiggy',
      name: 'Swiggy',
      initials: 'SW',
      count: 14,
      total: 6820,
      suggested: 'want',
    },
    {
      key: 'bigbasket',
      name: 'BigBasket',
      initials: 'BB',
      count: 6,
      total: 9150,
      suggested: 'need',
    },
    {
      key: 'uber',
      name: 'Uber',
      initials: 'UB',
      count: 11,
      total: 2980,
      suggested: 'need',
    },
    {
      key: 'zomato',
      name: 'Zomato',
      initials: 'ZO',
      count: 9,
      total: 3410,
      suggested: 'want',
    },
    {
      key: 'airtel',
      name: 'Airtel',
      initials: 'AT',
      count: 3,
      total: 3897,
      suggested: 'need',
    },
    {
      key: 'netflix',
      name: 'Netflix',
      initials: 'NF',
      count: 3,
      total: 1947,
      suggested: 'want',
    },
    {
      key: 'amazon',
      name: 'Amazon',
      initials: 'AM',
      count: 7,
      total: 8640,
      suggested: 'want',
    },
    {
      key: 'rakeshkumar',
      name: 'Rakesh Kumar',
      initials: 'RK',
      count: 3,
      total: 66000,
      suggested: 'need',
    },
    {
      key: 'hdfcmf',
      name: 'HDFC MF',
      initials: 'HM',
      count: 3,
      total: 36000,
      suggested: 'investment',
    },
    {
      key: 'bajajfinance',
      name: 'Bajaj Finance',
      initials: 'BF',
      count: 3,
      total: 30000,
      suggested: 'loan',
    },
    {
      key: 'apollopharmacy',
      name: 'Apollo Pharmacy',
      initials: 'AP',
      count: 4,
      total: 2310,
      suggested: 'need',
    },
    {
      key: 'bookmyshow',
      name: 'BookMyShow',
      initials: 'BM',
      count: 2,
      total: 1180,
      suggested: 'want',
    },
  ] as FrequentMerchant[],
};
