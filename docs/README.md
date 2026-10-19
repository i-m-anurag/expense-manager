# Docs

- **PRD (v0.2):** https://claude.ai/artifact/VtRiB7Qm7XyTC8zaUoqEKi
- **App design brief** (Midnight & Gold — tokens, screens, copy): https://claude.ai/artifact/R6VEaQV56Lbgt3aziVUJLJ
- **[Adding or fixing a bank parser](parser-guide.md)**

## Implementation notes

### SMS parsing (packages/parser, parsers/, fixtures/)

Platform-independent TypeScript (PRD §7.2, §10.1): the same code runs in the app
and in Node for CI.

- `parse.ts`: sender whitelist → ignore rules → first matching pattern. Amounts
  are integer paise; dates are read as IST.
- `dedupe.ts`: same reference number, or same account/amount/direction within
  10 minutes (SMS-06).
- `analyze.ts`: onboarding scan summary: accounts (bank + last 4), salary
  (repeating credit ±20% in 2+ months), self-transfers / card bill payments /
  ATM withdrawals excluded from spending, per-month bucket split, top merchants.
- Launch banks: HDFC, ICICI, SBI, Axis, Bank of India. **Templates are written
  from publicly shared SMS formats and still need checking against real masked
  samples.**

### Native SMS module (app/android/.../sms)

Lives in the app module for now rather than `android-modules/`; it can move to a
separate Gradle module once there is more than one native module.

- `SmsInboxModule.readInbox(sinceMs, senderCodes, limit)`: backfill and on-open
  reconciliation. Filters by bank sender in Kotlin, so personal SMS never reach JS.
- `SmsReceiver` + `SmsHeadlessService`: incoming SMS → `SmsReceived` Headless JS
  task. The task parses only, for now; storing, categorising and notifying come
  with the database (M0) and categorisation (M3).

### Onboarding (app/src/onboarding)

Implements the 15-screen onboarding design (brief §9.1, PRD §7.1):
Welcome ×3 → SMS permission (→ manual-mode screen if denied) → Notifications →
Scan → "Where your money went" → Accounts → Income & cycle → Budget split →
Emergency fund → Quick training → App lock → All set.

- Step order lives in `flow.ts`. Manual mode, or a scan that found no bank
  messages, skips Summary, Accounts and Training.
- Every step after the permissions has a **Skip** that keeps sensible defaults.
- The Scan screen reads the real inbox through the native module and the parser.
- Onboarding state is in memory only. It moves to the encrypted database (SEC-02)
  and the PIN to Keystore-backed storage (SEC-03) when those land.
- `INTERNET` is declared only in `app/android/app/src/debug/AndroidManifest.xml`
  (for Metro); release builds have no network permission (SEC-01, checked in CI).
