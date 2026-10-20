import { RawSms, bundledTemplates } from '@expense-manager/parser';
import { getDb } from '../db/connection';
import { getSetting, setSetting } from '../db/settings';
import { ingestMessages } from '../domain/ingest';
import { afterIngest, quickTag } from '../notify/dispatch';

// "SmsReceived" Headless JS task, started by SmsReceiver.kt for each incoming
// SMS that is not from a phone number (PRD SMS-07 / flow 8.1). Stores the
// transaction, then shows the payment notification and any budget alert.
export async function smsReceivedTask(data: RawSms): Promise<void> {
  const sql = await getDb();
  if ((await getSetting(sql, 'onboarded')) !== '1') {
    return;
  }
  const result = await ingestMessages(sql, [data], bundledTemplates());
  const last = Number((await getSetting(sql, 'last_sms_at')) ?? 0);
  if (data.receivedAt > last) {
    await setSetting(sql, 'last_sms_at', String(data.receivedAt));
  }
  await afterIngest(sql, result.inserted);
}

// "QuickTag" Headless JS task, started by NotificationActionReceiver.kt when a
// bucket button on a payment notification is tapped.
export async function quickTagTask(data: {
  txnId: number;
  categoryId: string;
  notificationId: number;
}): Promise<void> {
  await quickTag(await getDb(), data);
}
