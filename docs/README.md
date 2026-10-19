# Docs

- **PRD (v0.2):** https://claude.ai/artifact/VtRiB7Qm7XyTC8zaUoqEKi
- **App design brief** (Midnight & Gold — tokens, screens, copy): https://claude.ai/artifact/R6VEaQV56Lbgt3aziVUJLJ

## Implementation notes

### Onboarding (app/src/onboarding)

Implements the 15-screen onboarding design (brief §9.1, PRD §7.1):
Welcome ×3 → SMS permission (→ manual-mode screen if denied) → Notifications →
Scan → "Where your money went" → Accounts → Income & cycle → Budget split →
Emergency fund → Quick training → App lock → All set.

- Step order lives in `flow.ts`; manual mode skips Scan, Summary, Accounts and Training.
- Every step after the permissions has a **Skip** that keeps sensible defaults.
- **The scan is simulated** with `sampleScan.ts` until the native SMS module (M0)
  and parser engine (M1) exist. Swap `applyScan()` for the real result then.
- Onboarding state is in memory only. It moves to the encrypted database (SEC-02)
  and the PIN to Keystore-backed storage (SEC-03) when those land.
- `INTERNET` is declared only in `app/android/app/src/debug/AndroidManifest.xml`
  (for Metro); release builds have no network permission (SEC-01).
