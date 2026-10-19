import { fiftyThirtyTwenty, splitTotal } from '../src/onboarding/budget';
import { OnboardingState } from '../src/onboarding/OnboardingContext';
import { nextStep } from '../src/onboarding/flow';

jest.mock('@react-navigation/native', () => ({ useNavigation: jest.fn() }));

const base = { manualMode: false } as OnboardingState;

test('full journey order with SMS access', () => {
  const order = ['Welcome'];
  let step = 'Welcome' as Parameters<typeof nextStep>[0];
  while (step !== 'Done') {
    step = nextStep(step, base);
    order.push(step);
  }
  expect(order).toEqual([
    'Welcome',
    'SmsPermission',
    'Notifications',
    'Scan',
    'Summary',
    'Accounts',
    'Income',
    'Split',
    'Emergency',
    'Training',
    'Lock',
    'Done',
  ]);
});

test('manual mode skips SMS-dependent steps', () => {
  const manual = { ...base, manualMode: true };
  expect(nextStep('SmsDenied', manual)).toBe('Notifications');
  expect(nextStep('Notifications', manual)).toBe('Income');
  expect(nextStep('Emergency', manual)).toBe('Lock');
});

test('50/30/20 assigns the whole salary', () => {
  const s = fiftyThirtyTwenty(100000, 10000);
  expect(splitTotal(s)).toBe(100000);
  expect(s.need + s.loan).toBe(50000);
  expect(s.want).toBe(30000);
});
