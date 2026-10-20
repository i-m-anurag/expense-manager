package com.expensemanager

import android.app.Application
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.util.Log
import com.facebook.react.ReactApplication
import com.facebook.react.ReactInstanceEventListener
import com.facebook.react.bridge.ReactContext
import com.facebook.react.jstasks.HeadlessJsTaskConfig
import com.facebook.react.jstasks.HeadlessJsTaskContext
import com.facebook.react.jstasks.HeadlessJsTaskEventListener

/**
 * Runs a Headless JS task straight from a BroadcastReceiver, without starting
 * a Service. Android blocks background apps from starting services, which
 * silently stopped incoming SMS from being processed until the app was opened.
 * The receiver calls goAsync() and stays alive until the task finishes (or the
 * timeout passes), and a short wake lock keeps the CPU on meanwhile.
 */
object HeadlessRunner {
  const val TAG = "ExpenseManager"
  private val main = Handler(Looper.getMainLooper())

  fun run(context: Context, config: HeadlessJsTaskConfig, timeoutMs: Long = 9_000L, onDone: () -> Unit = {}) {
    val app = context.applicationContext as Application
    val wakeLock =
        app.getSystemService(PowerManager::class.java)
            .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "ExpenseManager:headless")
            .apply { acquire(timeoutMs + 1_000L) }
    var finished = false
    val finish = {
      if (!finished) {
        finished = true
        if (wakeLock.isHeld) wakeLock.release()
        onDone()
      }
    }
    main.postDelayed({ if (!finished) Log.w(TAG, "${config.taskKey} timed out"); finish() }, timeoutMs)
    main.post {
      try {
        val host = checkNotNull((app as ReactApplication).reactHost)
        val ctx = host.currentReactContext
        if (ctx != null) {
          start(ctx, config, finish)
        } else {
          host.addReactInstanceEventListener(
              object : ReactInstanceEventListener {
                override fun onReactContextInitialized(context: ReactContext) {
                  host.removeReactInstanceEventListener(this)
                  start(context, config, finish)
                }
              })
          host.start()
        }
      } catch (e: Exception) {
        Log.e(TAG, "Could not run ${config.taskKey}", e)
        finish()
      }
    }
  }

  private fun start(ctx: ReactContext, config: HeadlessJsTaskConfig, finish: () -> Unit) {
    val tasks = HeadlessJsTaskContext.getInstance(ctx)
    var id = -1
    tasks.addTaskEventListener(
        object : HeadlessJsTaskEventListener {
          override fun onHeadlessJsTaskStart(taskId: Int) = Unit

          override fun onHeadlessJsTaskFinish(taskId: Int) {
            if (taskId == id) {
              tasks.removeTaskEventListener(this)
              Log.i(TAG, "${config.taskKey} finished")
              finish()
            }
          }
        })
    id = tasks.startTask(config)
    Log.i(TAG, "${config.taskKey} started")
  }
}
