package com.expensemanager.notify

import android.animation.ValueAnimator
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.view.animation.DecelerateInterpolator
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import org.json.JSONObject
import kotlin.math.abs

/**
 * The "New payment" pop-up from the design (Extras · 5c): a card that slides in
 * from the right over any app, asks for a bucket, shows "Saved as … · Undo" for
 * 3 seconds, then saves through the QuickTag Headless JS task. Needs the
 * "Display over other apps" permission; without it we fall back to the
 * notification alone.
 *
 * Spec (JSON from JS): { txnId, notificationId, merchant, amount, account,
 *   suggestion?, suggestedId?, theme: system|light|dark,
 *   palettes: { dark: {...}, light: {...} }, buckets: [{ id, label, key }] }
 */
object PaymentOverlay {
  private const val AUTO_HIDE_MS = 20_000L
  private const val UNDO_MS = 3_000L

  private var current: View? = null
  private val main = Handler(Looper.getMainLooper())

  fun canShow(ctx: Context) = Settings.canDrawOverlays(ctx)

  fun show(ctx: Context, spec: JSONObject) {
    main.post { showOnMain(ctx.applicationContext, spec) }
  }

  fun hide(ctx: Context) {
    main.post { remove(ctx.applicationContext, animate = true) }
  }

  @SuppressLint("ClickableViewAccessibility")
  private fun showOnMain(ctx: Context, spec: JSONObject) {
    if (!canShow(ctx)) return
    remove(ctx, animate = false)
    val wm = ctx.getSystemService(WindowManager::class.java)

    val night =
        when (spec.optString("theme", "system")) {
          "dark" -> true
          "light" -> false
          else ->
              (ctx.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
                  Configuration.UI_MODE_NIGHT_YES
        }
    val p = spec.getJSONObject("palettes").getJSONObject(if (night) "dark" else "light")
    fun col(key: String) = Color.parseColor(p.getString(key))
    fun dp(v: Float) = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, ctx.resources.displayMetrics)
    fun font(name: String) =
        try {
          Typeface.createFromAsset(ctx.assets, "fonts/$name.ttf")
        } catch (_: Exception) {
          Typeface.DEFAULT
        }
    val manropeBold = font("Manrope-Bold")
    val interMedium = font("Inter-Medium")
    val interSemi = font("Inter-SemiBold")
    val inter = font("Inter-Regular")

    fun text(s: String, size: Float, color: Int, face: Typeface) =
        TextView(ctx).apply {
          text = s
          setTextSize(TypedValue.COMPLEX_UNIT_SP, size)
          setTextColor(color)
          typeface = face
        }
    fun rounded(fill: Int, radius: Float, stroke: Int? = null) =
        GradientDrawable().apply {
          setColor(fill)
          cornerRadius = dp(radius)
          if (stroke != null) setStroke(dp(1f).toInt(), stroke)
        }

    val txnId = spec.getInt("txnId")
    val notificationId = spec.getInt("notificationId")
    val suggestedId = spec.optString("suggestedId", "")

    // Card
    val card =
        LinearLayout(ctx).apply {
          orientation = LinearLayout.VERTICAL
          background = rounded(col("surfaceRaised"), 28f, col("border"))
          elevation = dp(12f)
          setPadding(dp(18f).toInt(), dp(18f).toInt(), dp(18f).toInt(), dp(16f).toInt())
        }

    // Header: dot · "New payment · HDFC ••4521" · close
    val header = LinearLayout(ctx).apply { gravity = Gravity.CENTER_VERTICAL }
    header.addView(
        View(ctx).apply { background = rounded(col("gold"), 4f) },
        LinearLayout.LayoutParams(dp(8f).toInt(), dp(8f).toInt()).apply { marginEnd = dp(8f).toInt() })
    val account = spec.optString("account", "")
    header.addView(
        text(if (account.isEmpty()) "New payment" else "New payment · $account", 12f, col("goldText"), interSemi),
        LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
    val close =
        text("✕", 16f, col("textTertiary"), inter).apply {
          setPadding(dp(12f).toInt(), dp(4f).toInt(), dp(4f).toInt(), dp(4f).toInt())
          contentDescription = "Close"
        }
    header.addView(close)
    card.addView(header)

    // Merchant and amount
    val row =
        LinearLayout(ctx).apply {
          gravity = Gravity.BOTTOM
          setPadding(0, dp(12f).toInt(), 0, 0)
        }
    row.addView(
        text(spec.optString("merchant"), 22f, col("textPrimary"), manropeBold).apply { maxLines = 1 },
        LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
    row.addView(text(spec.optString("amount"), 28f, col("textPrimary"), manropeBold))
    card.addView(row)

    // "Ask" state: hint, bucket grid, footer
    val ask = LinearLayout(ctx).apply { orientation = LinearLayout.VERTICAL }
    val suggestion = spec.optString("suggestion", "")
    // Already categorised: show it selected; another bucket changes it.
    val alreadySaved = spec.optBoolean("saved", false)
    ask.addView(
        text(
            when {
              alreadySaved -> "Sorted as $suggestion. Tap another bucket to change it."
              suggestion.isEmpty() -> "Which bucket does this belong to?"
              else -> "Looks like $suggestion. Tap to save."
            },
            13f,
            col("textSecondary"),
            inter),
        LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
          topMargin = dp(2f).toInt()
        })

    // "Saved" state, hidden until a bucket is tapped
    val saved =
        LinearLayout(ctx).apply {
          gravity = Gravity.CENTER_VERTICAL
          background = rounded(col("goldTint"), 14f, col("gold"))
          setPadding(dp(14f).toInt(), 0, dp(14f).toInt(), 0)
          visibility = View.GONE
        }
    val savedLabel = text("", 15f, col("goldText"), interSemi)
    saved.addView(savedLabel, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
    val undo = text("Undo", 13f, col("goldText"), interMedium).apply { setPadding(dp(12f).toInt(), dp(12f).toInt(), 0, dp(12f).toInt()) }
    saved.addView(undo)

    var pending: Runnable? = null
    val autoHide = Runnable { remove(ctx, animate = true) }

    val buckets = spec.getJSONArray("buckets")
    val grid = LinearLayout(ctx).apply { orientation = LinearLayout.VERTICAL }
    var line: LinearLayout? = null
    for (i in 0 until buckets.length()) {
      val b = buckets.getJSONObject(i)
      val id = b.getString("id")
      val isSuggested = suggestedId.isNotEmpty() && suggestedId.substringBefore('.') == id.substringBefore('.')
      val categoryId = if (isSuggested) suggestedId else id
      if (i % 2 == 0) {
        line = LinearLayout(ctx)
        grid.addView(
            line,
            LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
              topMargin = dp(8f).toInt()
            })
      }
      val btn =
          LinearLayout(ctx).apply {
            gravity = Gravity.CENTER
            background =
                if (isSuggested) rounded(col("goldTint"), 14f, col("gold")) else rounded(Color.TRANSPARENT, 14f, col("border"))
            contentDescription = b.getString("label")
            isClickable = true
          }
      btn.addView(
          View(ctx).apply { background = rounded(col(b.getString("key")), 5f) },
          LinearLayout.LayoutParams(dp(9f).toInt(), dp(9f).toInt()).apply { marginEnd = dp(8f).toInt() })
      btn.addView(text(b.getString("label"), 15f, if (isSuggested) col("goldText") else col("textPrimary"), interSemi))
      btn.setOnClickListener {
        main.removeCallbacks(autoHide)
        savedLabel.text = "Saved as ${b.getString("label")}"
        ask.visibility = View.GONE
        saved.visibility = View.VISIBLE
        // Commit after the undo window, then slide away.
        pending =
            Runnable {
                  quickTag(ctx, txnId, categoryId, notificationId)
                  remove(ctx, animate = true)
                }
                .also { main.postDelayed(it, UNDO_MS) }
      }
      line!!.addView(
          btn,
          LinearLayout.LayoutParams(0, dp(52f).toInt(), 1f).apply {
            if (i % 2 == 0) marginEnd = dp(4f).toInt() else marginStart = dp(4f).toInt()
          })
    }
    ask.addView(grid, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
      topMargin = dp(6f).toInt()
    })

    val footer = LinearLayout(ctx).apply { setPadding(0, dp(14f).toInt(), 0, 0) }
    val more = text("More categories", 13f, col("goldText"), interMedium).apply { setPadding(0, dp(6f).toInt(), dp(12f).toInt(), dp(6f).toInt()) }
    val notNow = text(if (alreadySaved) "Looks right" else "Not now", 13f, col("textTertiary"), interMedium).apply { setPadding(dp(12f).toInt(), dp(6f).toInt(), 0, dp(6f).toInt()) }
    footer.addView(more, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
    footer.addView(notNow)
    ask.addView(footer)

    card.addView(ask)
    card.addView(
        saved,
        LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(56f).toInt()).apply { topMargin = dp(14f).toInt() })

    undo.setOnClickListener {
      pending?.let { main.removeCallbacks(it) }
      pending = null
      saved.visibility = View.GONE
      ask.visibility = View.VISIBLE
      main.postDelayed(autoHide, AUTO_HIDE_MS)
    }
    close.setOnClickListener { remove(ctx, animate = true) }
    notNow.setOnClickListener { remove(ctx, animate = true) }
    more.setOnClickListener {
      remove(ctx, animate = false)
      ctx.startActivity(
          Intent(Intent.ACTION_VIEW, Uri.parse("expensemanager://txn/$txnId")).apply {
            setPackage(ctx.packageName)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
          })
    }

    val root = FrameLayout(ctx)
    root.addView(card, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))

    // Swipe sideways to dismiss.
    var downX = 0f
    root.setOnTouchListener { v, e ->
      when (e.actionMasked) {
        MotionEvent.ACTION_DOWN -> downX = e.rawX
        MotionEvent.ACTION_MOVE -> v.translationX = e.rawX - downX
        MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
          if (abs(v.translationX) > v.width / 3f) remove(ctx, animate = true, toRight = v.translationX > 0)
          else v.animate().translationX(0f).setDuration(150).start()
        }
      }
      false
    }

    val params =
        WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                // Not focusable: the app underneath keeps the keyboard and back key.
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                PixelFormat.TRANSLUCENT)
            .apply {
              gravity = Gravity.BOTTOM
              x = 0
              y = dp(24f).toInt()
              horizontalMargin = 0f
            }
    root.setPadding(dp(12f).toInt(), 0, dp(12f).toInt(), 0)
    wm.addView(root, params)
    current = root

    // Slide in from the right (brief §6: 200–250 ms ease-out).
    root.translationX = ctx.resources.displayMetrics.widthPixels.toFloat()
    root.animate().translationX(0f).setDuration(250).setInterpolator(DecelerateInterpolator()).start()
    main.postDelayed(autoHide, AUTO_HIDE_MS)
  }

  private fun remove(ctx: Context, animate: Boolean, toRight: Boolean = true) {
    val v = current ?: return
    current = null
    val wm = ctx.getSystemService(WindowManager::class.java)
    val detach = {
      try {
        wm.removeView(v)
      } catch (_: Exception) {}
    }
    if (!animate) {
      detach()
      return
    }
    val w = ctx.resources.displayMetrics.widthPixels.toFloat()
    ValueAnimator.ofFloat(v.translationX, if (toRight) w else -w).apply {
      duration = 200
      addUpdateListener { v.translationX = it.animatedValue as Float }
      addListener(
          object : android.animation.AnimatorListenerAdapter() {
            override fun onAnimationEnd(animation: android.animation.Animator) = detach()
          })
      start()
    }
  }

  private fun quickTag(ctx: Context, txnId: Int, categoryId: String, notificationId: Int) {
    QuickTag.run(ctx, txnId, categoryId, notificationId)
  }
}
