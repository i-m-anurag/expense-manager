package com.expensemanager.notify

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Intent
import androidx.core.app.NotificationManagerCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import org.json.JSONObject

/** Local notifications only; nothing leaves the phone (PRD §7.8). */
class NotificationsModule(private val context: ReactApplicationContext) :
    ReactContextBaseJavaModule(context) {

  override fun getName() = "Notifications"

  @ReactMethod
  fun show(specJson: String, promise: Promise) {
    try {
      Notifier.post(context, JSONObject(specJson))
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("E_NOTIFY", e.message, e)
    }
  }

  // Posts later (quiet hours end, reminder day). Inexact on purpose: no exact-
  // alarm permission, and a few minutes either way doesn't matter here.
  @ReactMethod
  fun schedule(specJson: String, atMs: Double, promise: Promise) {
    try {
      val spec = JSONObject(specJson)
      val intent =
          Intent(context, ScheduledNotificationReceiver::class.java).putExtra(
              ScheduledNotificationReceiver.EXTRA_SPEC, specJson)
      val pi =
          PendingIntent.getBroadcast(
              context, spec.getInt("id"), intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
      context.getSystemService(AlarmManager::class.java)
          .setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMs.toLong(), pi)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("E_SCHEDULE", e.message, e)
    }
  }

  @ReactMethod
  fun cancel(id: Double) {
    NotificationManagerCompat.from(context).cancel(id.toInt())
  }

  @ReactMethod
  fun enabled(promise: Promise) {
    promise.resolve(NotificationManagerCompat.from(context).areNotificationsEnabled())
  }
}
