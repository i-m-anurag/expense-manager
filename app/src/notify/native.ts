import { NativeModules } from 'react-native';

export interface NotificationAction {
  label: string;
  url?: string;
  txnId?: number;
  categoryId?: string;
}

export interface NotificationSpec {
  id: number;
  channel: 'transactions' | 'transactions_quiet' | 'alerts' | 'reminders';
  title: string;
  body: string;
  url?: string;
  timeoutMs?: number;
  actions?: NotificationAction[];
}

interface NotificationsNative {
  show(spec: string): Promise<boolean>;
  schedule(spec: string, atMs: number): Promise<boolean>;
  cancel(id: number): void;
  enabled(): Promise<boolean>;
  canShowOverlay(): Promise<boolean>;
  openOverlaySettings(): void;
  showPaymentOverlay(spec: string): Promise<boolean>;
  isAppInForeground(): Promise<boolean>;
}

interface BiometricNative {
  isAvailable(): Promise<boolean>;
  authenticate(title: string): Promise<boolean>;
}

const notifications: NotificationsNative | undefined =
  NativeModules.Notifications;
const biometric: BiometricNative | undefined = NativeModules.Biometric;

// Kotlin modules in android/app/src/main/java/com/expensemanager/{notify,secure}.
// Missing in tests, where every call is a no-op.
export const Notifications = {
  show: (s: NotificationSpec) =>
    notifications?.show(JSON.stringify(s)) ?? Promise.resolve(false),
  schedule: (s: NotificationSpec, atMs: number) =>
    notifications?.schedule(JSON.stringify(s), atMs) ?? Promise.resolve(false),
  cancel: (id: number) => notifications?.cancel(id),
  enabled: () => notifications?.enabled() ?? Promise.resolve(false),
  canShowOverlay: () =>
    notifications?.canShowOverlay() ?? Promise.resolve(false),
  openOverlaySettings: () => notifications?.openOverlaySettings(),
  showPaymentOverlay: (spec: object) =>
    notifications?.showPaymentOverlay(JSON.stringify(spec)) ??
    Promise.resolve(false),
  isAppInForeground: () =>
    notifications?.isAppInForeground() ?? Promise.resolve(true),
};

export const Biometric = {
  isAvailable: () => biometric?.isAvailable() ?? Promise.resolve(false),
  authenticate: (title: string) =>
    biometric?.authenticate(title) ?? Promise.resolve(false),
};
