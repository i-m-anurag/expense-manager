package com.expensemanager.sms

import android.Manifest
import android.content.pm.PackageManager
import android.provider.Telephony
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import java.util.concurrent.Executors

/**
 * Reads the SMS inbox for the onboarding backfill and the on-open reconciliation
 * (PRD SMS-04, SMS-08). Only messages from whitelisted bank senders are returned,
 * so personal messages never cross into JavaScript.
 */
class SmsInboxModule(private val context: ReactApplicationContext) :
    ReactContextBaseJavaModule(context) {

  private val executor = Executors.newSingleThreadExecutor()

  override fun getName() = NAME

  @ReactMethod
  fun hasPermission(promise: Promise) {
    promise.resolve(granted())
  }

  /**
   * @param sinceMs only messages received after this epoch-millis timestamp
   * @param senderCodes bank sender codes from the parser templates (e.g. "HDFCBK")
   * @param limit maximum rows to return, newest last
   */
  @ReactMethod
  fun readInbox(sinceMs: Double, senderCodes: ReadableArray, limit: Double, promise: Promise) {
    if (!granted()) {
      promise.reject("E_PERMISSION", "READ_SMS permission not granted")
      return
    }
    val allowed = (0 until senderCodes.size()).mapNotNull { senderCodes.getString(it)?.uppercase() }.toSet()
    executor.execute {
      try {
        val out = Arguments.createArray()
        var count = 0
        context.contentResolver
            .query(
                Telephony.Sms.Inbox.CONTENT_URI,
                arrayOf(Telephony.Sms._ID, Telephony.Sms.ADDRESS, Telephony.Sms.BODY, Telephony.Sms.DATE),
                "${Telephony.Sms.DATE} > ?",
                arrayOf(sinceMs.toLong().toString()),
                "${Telephony.Sms.DATE} ASC",
            )
            ?.use { c ->
              val idCol = c.getColumnIndexOrThrow(Telephony.Sms._ID)
              val addrCol = c.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)
              val bodyCol = c.getColumnIndexOrThrow(Telephony.Sms.BODY)
              val dateCol = c.getColumnIndexOrThrow(Telephony.Sms.DATE)
              while (c.moveToNext() && count < limit.toInt()) {
                val address = c.getString(addrCol) ?: continue
                if (senderCode(address) !in allowed) continue
                out.pushMap(
                    Arguments.createMap().apply {
                      putString("id", c.getLong(idCol).toString())
                      putString("sender", address)
                      putString("body", c.getString(bodyCol) ?: "")
                      putDouble("receivedAt", c.getLong(dateCol).toDouble())
                    })
                count++
              }
            }
        promise.resolve(out)
      } catch (e: Exception) {
        promise.reject("E_READ_INBOX", e.message, e)
      }
    }
  }

  private fun granted() =
      ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) ==
          PackageManager.PERMISSION_GRANTED

  override fun invalidate() {
    executor.shutdown()
    super.invalidate()
  }

  companion object {
    const val NAME = "SmsInbox"
  }
}
