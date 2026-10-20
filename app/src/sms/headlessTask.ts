import { RawSms, bundledTemplates } from '@expense-manager/parser';
import { getDb } from '../db/connection';
import { getSetting, setSetting } from '../db/settings';
import { ingestMessages } from '../domain/ingest';

// "SmsReceived" Headless JS task, started by SmsReceiver.kt for each incoming
// SMS that is not from a phone number (PRD SMS-07 / flow 8.1). Stores the
// transaction; the quick-tag notification comes with alerts (M5).
export async function smsReceivedTask(data: RawSms): Promise<void> {
  const sql = await getDb();
  if ((await getSetting(sql, 'onboarded')) !== '1') {
    return;
  }
  await ingestMessages(sql, [data], bundledTemplates());
  const last = Number((await getSetting(sql, 'last_sms_at')) ?? 0);
  if (data.receivedAt > last) {
    await setSetting(sql, 'last_sms_at', String(data.receivedAt));
  }
}
