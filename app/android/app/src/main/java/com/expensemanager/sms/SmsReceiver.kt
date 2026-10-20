package com.expensemanager.sms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import android.util.Log
import com.expensemanager.HeadlessRunner
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/**
 * Receives incoming SMS (PRD SMS-07). Multi-part messages are joined, then each
 * message that isn't from a phone number is handed to the "SmsReceived"
 * Headless JS task, which filters bank senders against the parser templates.
 * Personal SMS (from phone numbers) never reach JS.
 */
class SmsReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
    val parts = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return
    val messages =
        parts
            .groupBy { it.displayOriginatingAddress ?: "" }
            .filter { (address, _) -> address.isNotEmpty() && !isPhoneNumber(address) }
    if (messages.isEmpty()) return
    Log.i(HeadlessRunner.TAG, "SMS from ${messages.keys.joinToString()} received")

    // Keep the receiver alive until JS has stored the transaction.
    val pending = goAsync()
    var left = messages.size
    messages.forEach { (address, group) ->
      val data =
          Arguments.createMap().apply {
            putString("sender", address)
            putString("body", group.joinToString("") { it.displayMessageBody ?: "" })
            putDouble("receivedAt", group.minOf { it.timestampMillis }.toDouble())
          }
      HeadlessRunner.run(context, HeadlessJsTaskConfig(TASK_NAME, data, 9_000L, true)) {
        left -= 1
        if (left == 0) pending.finish()
      }
    }
  }

  // Banks send from alphanumeric headers; a plain number is a person.
  private fun isPhoneNumber(address: String) = address.replace(Regex("[\\s+()-]"), "").all { it.isDigit() }

  companion object {
    const val TASK_NAME = "SmsReceived"
  }
}
