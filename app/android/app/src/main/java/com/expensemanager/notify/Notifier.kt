package com.expensemanager.notify

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.expensemanager.R
import org.json.JSONObject

/**
 * Builds and posts notifications from a small JSON spec written in JS:
 * { id, channel, title, body, url?, timeoutMs?, actions?: [{ label, url? } | { label, txnId, categoryId }] }
 * Actions with a category run the "QuickTag" Headless JS task without opening
 * the app (PRD CAT-06); actions and taps with a url open that deep link.
 */
object Notifier {
  const val CH_TRANSACTIONS = "transactions"
  const val CH_TRANSACTIONS_QUIET = "transactions_quiet"
  const val CH_ALERTS = "alerts"
  const val CH_REMINDERS = "reminders"

  fun ensureChannels(ctx: Context) {
    val nm = ctx.getSystemService(NotificationManager::class.java)
    nm.createNotificationChannels(
        listOf(
            NotificationChannel(CH_TRANSACTIONS, "New payments", NotificationManager.IMPORTANCE_DEFAULT).apply {
              description = "A notification for each payment, with one-tap tags"
            },
            NotificationChannel(CH_TRANSACTIONS_QUIET, "New payments during quiet hours", NotificationManager.IMPORTANCE_LOW).apply {
              description = "Same as New payments, without sound, during quiet hours"
            },
            NotificationChannel(CH_ALERTS, "Budget alerts", NotificationManager.IMPORTANCE_DEFAULT).apply {
              description = "When a bucket is filling up or running ahead of pace"
            },
            NotificationChannel(CH_REMINDERS, "Upcoming payments", NotificationManager.IMPORTANCE_DEFAULT).apply {
              description = "Reminders before EMIs, SIPs, rent and bills"
            },
        ))
  }

  fun post(ctx: Context, spec: JSONObject) {
    ensureChannels(ctx)
    val id = spec.getInt("id")
    val builder =
        NotificationCompat.Builder(ctx, spec.optString("channel", CH_ALERTS))
            .setSmallIcon(R.drawable.ic_notification)
            .setColor(0xFFD4AF6A.toInt())
            .setContentTitle(spec.optString("title"))
            .setContentText(spec.optString("body"))
            .setStyle(NotificationCompat.BigTextStyle().bigText(spec.optString("body")))
            .setAutoCancel(true)
            .setContentIntent(openUrl(ctx, spec.optString("url", "expensemanager://home"), id * 10))
    if (spec.has("timeoutMs")) builder.setTimeoutAfter(spec.getLong("timeoutMs"))
    val actions = spec.optJSONArray("actions")
    if (actions != null) {
      for (i in 0 until minOf(actions.length(), 3)) {
        val a = actions.getJSONObject(i)
        val pi =
            if (a.has("categoryId")) {
              val intent =
                  Intent(ctx, NotificationActionReceiver::class.java).apply {
                    putExtra(NotificationActionReceiver.EXTRA_TXN, a.getInt("txnId"))
                    putExtra(NotificationActionReceiver.EXTRA_CATEGORY, a.getString("categoryId"))
                    putExtra(NotificationActionReceiver.EXTRA_NOTIFICATION, id)
                  }
              PendingIntent.getBroadcast(
                  ctx, id * 10 + i + 1, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
            } else {
              openUrl(ctx, a.optString("url", "expensemanager://home"), id * 10 + i + 1)
            }
        builder.addAction(0, a.getString("label"), pi)
      }
    }
    try {
      NotificationManagerCompat.from(ctx).notify(id, builder.build())
    } catch (_: SecurityException) {
      // Notification permission was turned off; nothing to show.
    }
  }

  private fun openUrl(ctx: Context, url: String, requestCode: Int): PendingIntent {
    val intent =
        Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
          setPackage(ctx.packageName)
          flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
    return PendingIntent.getActivity(
        ctx, requestCode, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
  }
}
