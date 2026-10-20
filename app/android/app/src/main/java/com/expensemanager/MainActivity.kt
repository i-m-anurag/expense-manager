package com.expensemanager

import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  // react-native-screens restores fragments itself; pass null to avoid crashes on restore.
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(null)
  }

  // Whether the user is looking at the app right now. Process importance
  // can't tell: Android treats the process as foreground while it handles an
  // SMS broadcast, which wrongly hid the payment pop-up.
  override fun onResume() {
    super.onResume()
    visible = true
  }

  override fun onPause() {
    visible = false
    super.onPause()
  }

  companion object {
    @Volatile var visible = false
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "ExpenseManager"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
