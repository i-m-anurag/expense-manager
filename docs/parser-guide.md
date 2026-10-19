# Adding or fixing a bank parser

Bank SMS formats live in YAML, one file per bank, in [`parsers/`](../parsers). You
don't need to touch app code to add a bank.

## How a message is handled

1. **Sender check.** The sender header (`VM-HDFCBK`, `AD-HDFCBK-S`) is reduced to
   its code (`HDFCBK`) and matched against each template's `senders`. Anything
   else, including all personal messages, is never parsed.
2. **Ignore rules.** OTPs, offers, failed/declined payments, reminders
   ("will be debited") and balance-only messages are dropped.
3. **Patterns.** The first pattern whose `regex` matches produces a transaction.
4. **Unparsed.** A bank message that matched nothing goes to the unparsed inbox,
   so the user can add it by hand, and it tells us a pattern is missing.

## Template fields

```yaml
bank: HDFC Bank          # display name
code: hdfc               # stable id; pattern ids must start with it
senders: [HDFCBK, HDFCBN]
ignore:
  - {pattern: '(?i)\bOTP\b', reason: otp}   # otp | promo | failed | balance | other
patterns:
  - id: hdfc_upi_sent
    type: upi            # upi, debit_card, credit_card, neft, imps, rtgs, atm,
                         # auto_debit, salary, refund, transfer, other
    direction: debit     # debit | credit
    account_kind: card   # optional; card for credit/debit card spends
    regex: '(?i)Sent\s+Rs\.?\s*(?<amount>[\d,]+(?:\.\d+)?) ...'
    date_format: dd/MM/yy
    type_overrides:      # optional; refine the type from the message text
      - {when: '(?i)salary', type: salary}
```

Named groups the engine understands:

| Group | Meaning |
| --- | --- |
| `amount` | **Required.** `Rs.1,234.50`, `INR 450` etc. |
| `account` | Masked account or card number; the last 4 digits are kept. |
| `payee` | Merchant, person or UPI ID. |
| `ref` | Bank reference / UPI reference number (used for de-duplication). |
| `date` | Transaction date, read with `date_format`. |
| `time` | `14:22`, `14:22:10` or `02:22 PM`. |
| `balance` | Available balance after the transaction. |
| `limit` | Available credit card limit. |

`date_format` tokens: `dd`, `d` (1–2 digits), `MM`, `MMM` (`Sep`), `yy`, `yyyy`.
Separators match loosely, so `dd-MM-yy` also reads `18/09/25`.

Regexes are JavaScript regexes. Start with `(?i)` for case-insensitive matching.
Single-quote them in YAML so backslashes stay as written.

## Fixtures

Every pattern needs at least one fixture in [`fixtures/<code>.yaml`](../fixtures):

```yaml
- name: UPI payment to a merchant
  sender: VM-HDFCBK-S
  body: |-
    Sent Rs.450.00
    From HDFC Bank A/C *4521
    ...
  expect: {status: parsed, pattern: hdfc_upi_sent, amount: 450, account: '4521', payee: SWIGGY, date: '2025-09-18'}
```

Also add fixtures for the messages that must **not** become transactions (OTP,
offers, failed payments): `expect: {status: ignored, reason: otp}`.

**Mask before you commit.** Keep only the last 4 digits of account/card numbers,
replace reference and phone numbers with fake digits starting `999`, and replace
people's names. `npm run check:fixtures` (also run in CI and by the pre-commit
hook) blocks anything that looks unmasked. Enable the hook once with
`git config core.hooksPath .githooks`.

## Run it

```bash
cd packages/parser
npm install
npm test                 # schema-independent unit + fixture tests
npm run build:templates  # validate YAML and regenerate generated/templates.json
```

Commit the regenerated `generated/templates.json`; CI fails if it is stale.
