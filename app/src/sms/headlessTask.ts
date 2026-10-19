import { RawSms, bundledTemplates, parseSms } from '@expense-manager/parser';

// "SmsReceived" Headless JS task, started by SmsReceiver.kt for each incoming
// SMS that is not from a phone number (PRD SMS-07 / flow 8.1).
//
// For now it only parses. Storing the transaction, categorising it and showing
// the quick-tag notification arrive with the encrypted database (M0) and
// categorisation (M3). Until then the on-open reconciliation re-reads the inbox,
// so nothing is lost.
export async function smsReceivedTask(data: RawSms): Promise<void> {
  const result = parseSms(data, bundledTemplates());
  if (__DEV__) {
    console.log(
      '[SmsReceived]',
      result.status,
      result.status === 'parsed' ? result.txn.patternId : '',
    );
  }
}
