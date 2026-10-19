// PRD OSS-04: block fixtures that contain real-looking account numbers or
// phone numbers. Runs in CI and can be used as a pre-commit hook.

import {readFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';

const dir = join(__dirname, '..', '..', '..', 'fixtures');
const allowed = new Set(
  readFileSync(join(dir, 'public-numbers.txt'), 'utf8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#')),
);

const problems: string[] = [];

for (const file of readdirSync(dir).filter(f => f.endsWith('.yaml'))) {
  readFileSync(join(dir, file), 'utf8')
    .split('\n')
    .forEach((line, i) => {
      const where = `${file}:${i + 1}`;
      // Any run of 10+ digits: phone numbers, full account numbers, references.
      for (const m of line.matchAll(/\d{10,}/g)) {
        const n = m[0];
        if (!n.startsWith('999') && !n.startsWith('1800') && !allowed.has(n)) {
          problems.push(`${where}: unmasked number ${n.slice(0, 3)}… (use fake digits starting 999)`);
        }
      }
      // Account/card numbers after A/c, Acct, Card with 5+ visible digits.
      for (const m of line.matchAll(/(?:a\/?c(?:ct)?|account|card)(?:\s*no\.?)?\s*[:\s]*[xX*]*(\d{5,})/gi)) {
        if (!m[1].startsWith('999')) {
          problems.push(`${where}: account or card number shows ${m[1].length} digits (keep only the last 4)`);
        }
      }
      // Indian mobile numbers with +91 or 91 prefix.
      for (const m of line.matchAll(/\+?91[6-9]\d{9}\b/g)) {
        if (!m[0].replace('+', '').startsWith('91999') && !allowed.has(m[0].replace('+', ''))) {
          problems.push(`${where}: looks like a mobile number`);
        }
      }
    });
}

if (problems.length) {
  console.error('Fixtures look unmasked:\n' + problems.join('\n'));
  console.error('\nSee fixtures/README.md for the masking rules.');
  process.exit(1);
}
console.log('fixtures look masked');
