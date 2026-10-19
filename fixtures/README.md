# Parser fixtures

One YAML file per bank (`<code>.yaml`). Each case is a masked SMS plus the
result the parser must produce. CI runs every case (`npm test` in
`packages/parser`) and blocks fixtures that look unmasked (`npm run check:fixtures`).

Masking rules:
- Account and card numbers: keep only the last 4 digits (`XX4521`).
- Reference numbers, phone numbers and any other 10+ digit numbers: replace with
  fake digits starting `999` (`999112345678`). Bank toll-free (`1800…`) and
  published SMS-block numbers listed in `public-numbers.txt` may stay.
- People's names: replace with made-up names.
