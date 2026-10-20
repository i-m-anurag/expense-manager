package com.expensemanager.secure

import androidx.biometric.BiometricManager
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_WEAK
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/** Fingerprint / face unlock for the app lock (PRD SEC-03), via AndroidX Biometric. */
class BiometricModule(private val context: ReactApplicationContext) :
    ReactContextBaseJavaModule(context) {

  override fun getName() = "Biometric"

  @ReactMethod
  fun isAvailable(promise: Promise) {
    promise.resolve(
        BiometricManager.from(context).canAuthenticate(BIOMETRIC_WEAK) == BiometricManager.BIOMETRIC_SUCCESS)
  }

  @ReactMethod
  fun authenticate(title: String, promise: Promise) {
    val activity = reactApplicationContext.currentActivity as? FragmentActivity
    if (activity == null) {
      promise.resolve(false)
      return
    }
    activity.runOnUiThread {
      var settled = false
      val prompt =
          BiometricPrompt(
              activity,
              ContextCompat.getMainExecutor(activity),
              object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                  if (!settled) {
                    settled = true
                    promise.resolve(true)
                  }
                }

                override fun onAuthenticationError(code: Int, msg: CharSequence) {
                  if (!settled) {
                    settled = true
                    promise.resolve(false)
                  }
                }
              })
      prompt.authenticate(
          BiometricPrompt.PromptInfo.Builder()
              .setTitle(title)
              .setNegativeButtonText("Use PIN")
              .setAllowedAuthenticators(BIOMETRIC_WEAK)
              .build())
    }
  }
}
