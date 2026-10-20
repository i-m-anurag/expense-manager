package com.expensemanager.notify

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.expensemanager.HeadlessRunner
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/** A quick-tag button was tapped: categorise in the background (CAT-06). */
class NotificationActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val pending = goAsync()
    QuickTag.run(
        context,
        intent.getIntExtra(EXTRA_TXN, -1),
        intent.getStringExtra(EXTRA_CATEGORY) ?: return pending.finish(),
        intent.getIntExtra(EXTRA_NOTIFICATION, -1),
    ) {
      pending.finish()
    }
  }

  companion object {
    const val EXTRA_TXN = "txnId"
    const val EXTRA_CATEGORY = "categoryId"
    const val EXTRA_NOTIFICATION = "notificationId"
  }
}

/** Runs the "QuickTag" JS task (registered in index.js). */
object QuickTag {
  fun run(context: Context, txnId: Int, categoryId: String, notificationId: Int, onDone: () -> Unit = {}) {
    val data =
        Arguments.createMap().apply {
          putInt("txnId", txnId)
          putString("categoryId", categoryId)
          putInt("notificationId", notificationId)
        }
    HeadlessRunner.run(context, HeadlessJsTaskConfig("QuickTag", data, 9_000L, true), onDone = onDone)
  }
}
