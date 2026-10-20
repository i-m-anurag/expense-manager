package com.expensemanager

import com.expensemanager.notify.NotificationsModule
import com.expensemanager.secure.BiometricModule
import com.expensemanager.secure.SecureStoreModule
import com.expensemanager.sms.SmsInboxModule
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/** Registers the app's own native modules. */
class AppPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> =
      listOf(
          SmsInboxModule(context),
          SecureStoreModule(context),
          BiometricModule(context),
          NotificationsModule(context),
      )

  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> =
      emptyList()
}
