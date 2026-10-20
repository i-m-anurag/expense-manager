package com.expensemanager.notify

import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/** Runs the "QuickTag" JS task (registered in index.js). */
class QuickTagService : HeadlessJsTaskService() {
  override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
    val extras = intent?.extras ?: return null
    val data =
        Arguments.createMap().apply {
          putInt("txnId", extras.getInt(NotificationActionReceiver.EXTRA_TXN))
          putString("categoryId", extras.getString(NotificationActionReceiver.EXTRA_CATEGORY))
          putInt("notificationId", extras.getInt(NotificationActionReceiver.EXTRA_NOTIFICATION))
        }
    return HeadlessJsTaskConfig("QuickTag", data, 10_000L, true)
  }
}
