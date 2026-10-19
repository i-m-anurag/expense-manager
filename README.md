# Expense Manager

**Every rupee, in its place.**

Private, automatic budgeting from your bank SMS — nothing leaves your phone.

Expense Manager is an open-source, privacy-first Android app for salaried people in India. It reads bank transaction SMS on the device, fits each transaction into a salary-cycle budget (Need, Want, Investment, Loan/EMI), keeps a separate emergency fund, and tells you how much you can safely spend today.

- **On-device only.** No server, no account, no `INTERNET` permission.
- **Open source.** GPLv3 — read the code, verify the promise.
- **Near-zero manual work.** The app learns from every category you pick.

## Repository layout

```
app/                 React Native app (TypeScript)
android-modules/     Kotlin native modules (SMS, lock)
packages/parser/     SMS parser engine (TypeScript, platform-independent)
parsers/             Bank parser templates (YAML)
fixtures/            Masked sample SMS + expected output, per bank
website/             expansemanager.com docs site
docs/                PRD, architecture notes, ADRs
```

## Getting started

Requirements: Node 20+, JDK 17, Android SDK (API 36), an Android device or emulator.

```bash
cd app
npm install
npm run android
```

## Status

Early development. Current milestone: onboarding flow and app foundations.

## License

[GPLv3](LICENSE)
