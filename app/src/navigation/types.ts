import type { NativeStackScreenProps } from '@react-navigation/native-stack';

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
  Home: undefined;
};

export type ScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;
