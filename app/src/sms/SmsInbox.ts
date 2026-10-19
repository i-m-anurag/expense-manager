import { NativeModules } from 'react-native';
import type { RawSms } from '@expense-manager/parser';

interface SmsInboxNative {
  hasPermission(): Promise<boolean>;
  readInbox(
    sinceMs: number,
    senderCodes: string[],
    limit: number,
  ): Promise<RawSms[]>;
}

// Kotlin module in android/app/src/main/java/com/expensemanager/sms.
const native: SmsInboxNative | undefined = NativeModules.SmsInbox;

export const SmsInbox = {
  available: native !== undefined,
  hasPermission: () => native?.hasPermission() ?? Promise.resolve(false),
  readInbox: (
    sinceMs: number,
    senderCodes: string[],
    limit = 20000,
  ): Promise<RawSms[]> =>
    native
      ? native.readInbox(sinceMs, senderCodes, limit)
      : Promise.resolve([]),
};
