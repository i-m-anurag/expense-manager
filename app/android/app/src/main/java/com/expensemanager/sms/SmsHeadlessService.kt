package com.expensemanager.sms

import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/** Runs the "SmsReceived" JS task (registered in index.js) for one incoming SMS. */
class SmsHeadlessService : HeadlessJsTaskService() {
  override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
    val extras = intent?.extras ?: return null
    val data =
        Arguments.createMap().apply {
          putString("sender", extras.getString(EXTRA_SENDER))
          putString("body", extras.getString(EXTRA_BODY))
          putDouble("receivedAt", extras.getDouble(EXTRA_RECEIVED_AT))
        }
    // allowedInForeground: also run while the app is open, so one code path handles both.
    return HeadlessJsTaskConfig(TASK_NAME, data, TIMEOUT_MS, true)
  }

  companion object {
    const val TASK_NAME = "SmsReceived"
    const val TIMEOUT_MS = 10_000L
    const val EXTRA_SENDER = "sender"
    const val EXTRA_BODY = "body"
    const val EXTRA_RECEIVED_AT = "receivedAt"
  }
}
