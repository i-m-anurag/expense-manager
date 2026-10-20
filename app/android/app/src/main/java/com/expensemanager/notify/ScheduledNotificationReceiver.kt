package com.expensemanager.notify

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import org.json.JSONObject

/** Fires a notification scheduled by NotificationsModule.schedule(). */
class ScheduledNotificationReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val spec = intent.getStringExtra(EXTRA_SPEC) ?: return
    Notifier.post(context, JSONObject(spec))
  }

  companion object {
    const val EXTRA_SPEC = "spec"
  }
}
