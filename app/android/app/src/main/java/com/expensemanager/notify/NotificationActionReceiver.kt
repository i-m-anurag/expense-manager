package com.expensemanager.notify

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.facebook.react.HeadlessJsTaskService

/** A quick-tag button was tapped: categorise in the background (CAT-06). */
class NotificationActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val service =
        Intent(context, QuickTagService::class.java).apply {
          putExtra(EXTRA_TXN, intent.getIntExtra(EXTRA_TXN, -1))
          putExtra(EXTRA_CATEGORY, intent.getStringExtra(EXTRA_CATEGORY))
          putExtra(EXTRA_NOTIFICATION, intent.getIntExtra(EXTRA_NOTIFICATION, -1))
        }
    HeadlessJsTaskService.acquireWakeLockNow(context)
    context.startService(service)
  }

  companion object {
    const val EXTRA_TXN = "txnId"
    const val EXTRA_CATEGORY = "categoryId"
    const val EXTRA_NOTIFICATION = "notificationId"
  }
}
