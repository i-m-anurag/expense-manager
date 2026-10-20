package com.expensemanager.secure

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import android.view.WindowManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.security.KeyStore
import java.security.MessageDigest
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec

/**
 * Secrets that must never sit in plain text on disk (PRD SEC-02, SEC-03):
 * - the SQLCipher database key: 32 random bytes, wrapped with an AES-GCM key that
 *   lives in the Android Keystore and never leaves it;
 * - the app-lock PIN: stored only as a salted PBKDF2 hash, itself Keystore-wrapped.
 */
class SecureStoreModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {

  private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  override fun getName() = NAME

  @ReactMethod
  fun getDatabaseKey(promise: Promise) {
    try {
      val stored = prefs.getString(DB_KEY, null)
      val key =
          if (stored != null) {
            unwrap(stored)
          } else {
            val fresh = ByteArray(32).also { SecureRandom().nextBytes(it) }
            // commit(), not apply(): the key must be on disk before the database is created.
            prefs.edit().putString(DB_KEY, wrap(fresh)).commit()
            fresh
          }
      promise.resolve(key.joinToString("") { "%02x".format(it) })
    } catch (e: Exception) {
      promise.reject("E_DB_KEY", e.message, e)
    }
  }

  @ReactMethod
  fun setPin(pin: String, promise: Promise) {
    try {
      val salt = ByteArray(16).also { SecureRandom().nextBytes(it) }
      val hash = pbkdf2(pin, salt)
      prefs.edit().putString(PIN_KEY, wrap(salt + hash)).commit()
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("E_SET_PIN", e.message, e)
    }
  }

  @ReactMethod
  fun verifyPin(pin: String, promise: Promise) {
    try {
      val stored = prefs.getString(PIN_KEY, null) ?: return promise.resolve(false)
      val blob = unwrap(stored)
      val salt = blob.copyOfRange(0, 16)
      val expected = blob.copyOfRange(16, blob.size)
      promise.resolve(MessageDigest.isEqual(expected, pbkdf2(pin, salt)))
    } catch (e: Exception) {
      promise.reject("E_VERIFY_PIN", e.message, e)
    }
  }

  @ReactMethod
  fun hasPin(promise: Promise) {
    promise.resolve(prefs.contains(PIN_KEY))
  }

  @ReactMethod
  fun clearPin(promise: Promise) {
    prefs.edit().remove(PIN_KEY).commit()
    promise.resolve(true)
  }

  // SEC-09: keep amounts out of screenshots and the recent-apps preview.
  @ReactMethod
  fun setSecureWindow(enabled: Boolean) {
    val activity = reactApplicationContext.currentActivity ?: return
    activity.runOnUiThread {
      if (enabled) activity.window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
      else activity.window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
    }
  }

  private fun pbkdf2(pin: String, salt: ByteArray): ByteArray =
      SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
          .generateSecret(PBEKeySpec(pin.toCharArray(), salt, 120_000, 256))
          .encoded

  private fun keystoreKey(): SecretKey {
    val ks = KeyStore.getInstance(KEYSTORE).apply { load(null) }
    (ks.getKey(ALIAS, null) as? SecretKey)?.let {
      return it
    }
    return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE)
        .apply {
          init(
              KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                  .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                  .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                  .setKeySize(256)
                  .build())
        }
        .generateKey()
  }

  private fun wrap(plain: ByteArray): String {
    val cipher = Cipher.getInstance(TRANSFORM).apply { init(Cipher.ENCRYPT_MODE, keystoreKey()) }
    val out = cipher.iv + cipher.doFinal(plain)
    return Base64.encodeToString(out, Base64.NO_WRAP)
  }

  private fun unwrap(stored: String): ByteArray {
    val blob = Base64.decode(stored, Base64.NO_WRAP)
    val cipher =
        Cipher.getInstance(TRANSFORM).apply {
          init(Cipher.DECRYPT_MODE, keystoreKey(), GCMParameterSpec(128, blob, 0, 12))
        }
    return cipher.doFinal(blob, 12, blob.size - 12)
  }

  companion object {
    const val NAME = "SecureStore"
    private const val KEYSTORE = "AndroidKeyStore"
    private const val ALIAS = "expense_manager_master"
    private const val TRANSFORM = "AES/GCM/NoPadding"
    private const val PREFS = "secure_store"
    private const val DB_KEY = "db_key"
    private const val PIN_KEY = "pin_hash"
  }
}
