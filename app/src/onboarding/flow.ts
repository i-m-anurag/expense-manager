import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { OnboardingState, useOnboarding } from './OnboardingContext';

type Step = Exclude<
  keyof RootStackParamList,
  | 'Main'
  | 'TransactionDetail'
  | 'AddTransaction'
  | 'EmergencyFund'
  | 'EditBudget'
  | 'UnparsedSms'
  | 'Settings'
  | 'SetPin'
>;

// Order of the onboarding journey after the permission screens. Manual mode
// (SMS denied) skips everything that depends on scanned messages.
const AFTER_PERMISSIONS: Step[] = [
  'Scan',
  'Summary',
  'Accounts',
  'Income',
  'Split',
  'Emergency',
  'Training',
  'Lock',
  'Done',
];

const NEEDS_SMS: Step[] = ['Scan', 'Summary', 'Accounts', 'Training'];

export function nextStep(current: Step, state: OnboardingState): Step {
  switch (current) {
    case 'Welcome':
      return 'SmsPermission';
    case 'SmsPermission':
    case 'SmsDenied':
      return 'Notifications';
    case 'Notifications':
      return state.manualMode ? 'Income' : 'Scan';
  }
  // A scan that found nothing behaves like manual mode from here on.
  const noData =
    state.manualMode ||
    (state.scan !== null && state.scan.transactionCount === 0);
  const i = AFTER_PERMISSIONS.indexOf(current);
  const rest = AFTER_PERMISSIONS.slice(i + 1);
  return rest.find(s => !(noData && NEEDS_SMS.includes(s))) ?? 'Done';
}

// Navigates to the step after `current`, reading the latest state (pass any
// state changes made in the same tap as `patch`).
export function useNextStep(current: Step) {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { state, update } = useOnboarding();
  return (patch?: Partial<OnboardingState>) => {
    if (patch) {
      update(patch);
    }
    // Every onboarding step takes no params.
    (navigation.navigate as (step: Step) => void)(
      nextStep(current, { ...state, ...patch }),
    );
  };
}
