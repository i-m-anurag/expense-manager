import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type {
  CompositeScreenProps,
  NavigatorScreenParams,
} from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type TabParamList = {
  Home: undefined;
  Transactions: { bucket?: string } | undefined;
  Add: undefined;
  Budget: undefined;
  Insights: undefined;
};

export type RootStackParamList = {
  Welcome: undefined;
  SmsPermission: undefined;
  SmsDenied: undefined;
  Notifications: undefined;
  Scan: undefined;
  Summary: undefined;
  Accounts: undefined;
  Income: undefined;
  Split: undefined;
  Emergency: undefined;
  Training: undefined;
  Lock: undefined;
  Done: undefined;
  Main: NavigatorScreenParams<TabParamList> | undefined;
  TransactionDetail: { id: number };
  AddTransaction: undefined;
};

export type ScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type TabProps<T extends keyof TabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;
