# Expense Manager

**Every rupee, in its place.**

Private, automatic budgeting from your bank SMS — nothing leaves your phone.

Expense Manager is an open-source, privacy-first Android app for salaried people in India. It reads bank transaction SMS on the device, fits each transaction into a salary-cycle budget (Need, Want, Investment, Loan/EMI), keeps a separate emergency fund, and tells you how much you can safely spend today.

- **On-device only.** No server, no account, no `INTERNET` permission.
- **Open source.** GPLv3 — read the code, verify the promise.
- **Near-zero manual work.** The app learns from every category you pick.

## Repository layout

```
app/                 React Native app (TypeScript) + Kotlin SMS module
packages/parser/     SMS parser engine (TypeScript, platform-independent)
parsers/             Bank parser templates (YAML)
fixtures/            Masked sample SMS + expected output, per bank
docs/                Architecture notes and the parser guide
```

## Getting started

Requirements: Node 20+, JDK 17, Android SDK (API 36), an Android device or emulator.

```bash
cd app
npm install
npm run android
```

Parser engine and bank templates:

```bash
cd packages/parser
npm install
npm test
```

Want your bank supported? See [docs/parser-guide.md](docs/parser-guide.md).

## Status

Early development. Done: onboarding, SMS parser engine (HDFC, ICICI, SBI, Axis, Bank of India), native SMS reader, encrypted database, transactions with smart categorisation, Home dashboard, Budget, Emergency fund, Insights, Settings, payment notifications with quick tags, budget alerts and app lock. Next: encrypted backup and restore, CSV export, starting the cycle on the salary credit.

## License

[GPLv3](LICENSE)
