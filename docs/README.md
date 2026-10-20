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
  task, which stores and categorises the transaction. The quick-tag
  notification comes with alerts (M5).

### Encrypted storage (app/src/db, app/android/.../secure)

- SQLite with SQLCipher via op-sqlite (`"op-sqlite": {"sqlcipher": true}` in
  `app/package.json`). The 256-bit database key is random, wrapped with an
  AES-GCM key that never leaves the Android Keystore (`SecureStoreModule.kt`).
- The app-lock PIN is stored only as a salted PBKDF2 hash, also Keystore-wrapped.
- Schema follows PRD §9 (`migrations.ts`); money is integer paise. Raw SMS
  bodies live in the encrypted database so transactions can be re-parsed (SMS-10).
- Repositories take a tiny `Sql` interface, so Jest runs the same queries against
  Node's built-in SQLite (`__tests__/helpers/memorySql.ts`).
- Known follow-up: op-sqlite links a prebuilt OpenSSL from Maven Central for
  SQLCipher; F-Droid may ask for it to be built from source.

### Transactions (app/src/domain, app/src/transactions)

- `domain/ingest.ts` is flow 8.1: raw SMS → parse → dedupe against stored rows →
  account (bank + last 4) and balance → transfer check (self-transfer within
  30 min, card bill, ATM) → categorise → store. It is idempotent, so the on-open
  reconciliation (`sms/sync.ts`, SMS-08) and the background task share it.
- `domain/categorize.ts`: transfers → merchant memory (3+ tags auto-apply,
  1–2 suggest) → P2P pattern → well-known merchant defaults → ask.
- Choosing a category with "Always use this" on updates merchant memory and
  sorts the merchant's other uncategorised payments (CAT-02/07/08).
- Screens follow the Transactions design: list with search and filters grouped
  by day, detail with category picker, flags and source SMS, the categorize
  sheet, and manual add from the gold + tab.

### Home, Budget and Emergency fund (app/src/domain/budget.ts, app/src/budget, app/src/home)

- `computeSnapshot()` is pure and unit-tested. Spending = debits that aren't
  transfers or emergency-fund payments, from accounts included in the budget.
  Uncategorised spending counts towards "left this cycle" but not any bucket.
- **Safe to spend today** = (budget left − unpaid recurring payments still due
  this cycle) ÷ days left including today.
- **Status:** Over past 100%; Watch at 80%+ or past the pace tick once 30% is
  used; Investment and EMI buckets show Paid when full (no pace tick).
- **Recurring payments** (`recurring.ts`, TXN-10) are detected from history:
  same payee, ±10% amount, ±3 days of the month, in 2+ months. They drive Fixed
  commitments, Upcoming on Home and the safe-to-spend reserve. Not yet stored or
  confirmable by the user.
- Cycles roll over on their end date with the same plan (BUD-10); starting a
  cycle on the actual salary credit (BUD-02) and the cycle-close summary are next.
- Emergency fund: linked account balances from SMS (or a manual balance), minus
  withdrawals paid from other accounts; months covered against the average Need
  spend of the last 3 cycles, falling back to the Need budget.
- Privacy mode (eye on Home) hides every amount until turned off.
- "SMS we couldn't read" lists unparsed bank messages (SMS-09).

### Onboarding (app/src/onboarding)

Implements the 15-screen onboarding design (brief §9.1, PRD §7.1):
Welcome ×3 → SMS permission (→ manual-mode screen if denied) → Notifications →
Scan → "Where your money went" → Accounts → Income & cycle → Budget split →
Emergency fund → Quick training → App lock → All set.

- Step order lives in `flow.ts`. Manual mode, or a scan that found no bank
  messages, skips Summary, Accounts and Training.
- Every step after the permissions has a **Skip** that keeps sensible defaults.
- The Scan screen reads the real inbox through the native module and the parser.
- "Go to Home" saves accounts, budget cycle and allocations, emergency fund,
  merchant memory from Quick training (as high confidence) and the PIN, then
  imports the scanned SMS as transactions (`domain/onboarding.ts`).
- `INTERNET` is declared only in `app/android/app/src/debug/AndroidManifest.xml`
  (for Metro); release builds have no network permission (SEC-01, checked in CI).
