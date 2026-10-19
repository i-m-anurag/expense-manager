package com.expensemanager.sms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import com.facebook.react.HeadlessJsTaskService

/**
 * Receives incoming SMS (PRD SMS-07). Multi-part messages are joined, then each
 * message from a bank sender is handed to the "SmsReceived" Headless JS task.
 * Bank-sender filtering happens in JS against the parser templates; this side
 * only drops messages from phone numbers so personal SMS never reach JS.
 */
class SmsReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
    val parts = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return
    parts
        .groupBy { it.displayOriginatingAddress ?: "" }
        .forEach { (address, messages) ->
          if (address.isEmpty() || isPhoneNumber(address)) return@forEach
          val body = messages.joinToString("") { it.displayMessageBody ?: "" }
          val receivedAt = messages.minOf { it.timestampMillis }
          val service =
              Intent(context, SmsHeadlessService::class.java).apply {
                putExtra(SmsHeadlessService.EXTRA_SENDER, address)
                putExtra(SmsHeadlessService.EXTRA_BODY, body)
                putExtra(SmsHeadlessService.EXTRA_RECEIVED_AT, receivedAt.toDouble())
              }
          HeadlessJsTaskService.acquireWakeLockNow(context)
          context.startService(service)
        }
  }

  // Banks send from alphanumeric headers; a plain number is a person.
  private fun isPhoneNumber(address: String) = address.replace(Regex("[\\s+()-]"), "").all { it.isDigit() }
}
