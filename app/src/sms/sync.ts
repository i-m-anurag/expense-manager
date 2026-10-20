import { allSenderCodes, bundledTemplates } from '@expense-manager/parser';
import { getSetting, setSetting } from '../db/settings';
import { Sql } from '../db/sql';
import { ingestMessages } from '../domain/ingest';
import { afterIngest } from '../notify/dispatch';
import { SmsInbox } from './SmsInbox';

// Re-read a little before the last processed message: clocks and delivery
// order wobble, and ingest skips anything already stored.
const OVERLAP_MS = 60 * 60 * 1000;

let running: Promise<number> | null = null;

// SMS-08: on every app open, catch up on messages the background receiver
// missed (killed by battery optimisation, phone off, etc.). Returns how many
// new transactions were added.
export function reconcileInbox(sql: Sql): Promise<number> {
  running ??= (async () => {
    try {
      if (
        (await getSetting(sql, 'onboarded')) !== '1' ||
        !(await SmsInbox.hasPermission())
      ) {
        return 0;
      }
      const last = Number((await getSetting(sql, 'last_sms_at')) ?? 0);
      const templates = bundledTemplates();
      const messages = await SmsInbox.readInbox(
        Math.max(0, last - OVERLAP_MS),
        allSenderCodes(templates),
      );
      if (!messages.length) {
        return 0;
      }
      const result = await ingestMessages(sql, messages, templates);
      await setSetting(
        sql,
        'last_sms_at',
        String(Math.max(last, ...messages.map(m => m.receivedAt))),
      );
      await afterIngest(sql, result.inserted);
      return result.inserted.length;
    } finally {
      running = null;
    }
  })();
  return running;
}
