import {readFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {parse} from 'yaml';
import {compileTemplates} from '../src/parse';
import type {TemplateSource} from '../src/types';

export const ROOT = join(__dirname, '..', '..', '..');

// Tests compile straight from parsers/*.yaml so they never run against a stale bundle.
export function loadTemplates() {
  const dir = join(ROOT, 'parsers');
  const sources = readdirSync(dir)
    .filter(f => f.endsWith('.yaml'))
    .map(f => parse(readFileSync(join(dir, f), 'utf8')) as TemplateSource);
  return compileTemplates(sources);
}

export interface FixtureCase {
  name: string;
  sender: string;
  body: string;
  received_at?: string;
  expect: {
    status: 'parsed' | 'ignored' | 'unparsed' | 'not_bank';
    reason?: string;
    pattern?: string;
    type?: string;
    direction?: string;
    amount?: number;
    account?: string;
    account_kind?: string;
    payee?: string;
    merchant_key?: string;
    ref?: string;
    date?: string;
    time?: string;
    balance?: number;
    limit?: number;
  };
}

export function loadFixtures(): {bank: string; cases: FixtureCase[]}[] {
  const dir = join(ROOT, 'fixtures');
  return readdirSync(dir)
    .filter(f => f.endsWith('.yaml'))
    .sort()
    .map(f => ({bank: f.replace(/\.yaml$/, ''), cases: parse(readFileSync(join(dir, f), 'utf8')) as FixtureCase[]}));
}

// Formats an epoch as IST date and HH:mm, to compare with fixture expectations.
export function ist(epochMs: number) {
  const d = new Date(epochMs + 330 * 60 * 1000).toISOString();
  return {date: d.slice(0, 10), time: d.slice(11, 16)};
}
