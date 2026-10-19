// Validates parsers/*.yaml against parsers/schema.json and bundles them into
// generated/templates.json, which the app imports. Run with --check in CI to
// fail when the bundle is out of date.

import Ajv from 'ajv';
import {readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {parse} from 'yaml';
import {compileRegex} from '../src/parse';
import type {TemplateSource} from '../src/types';

const root = join(__dirname, '..', '..', '..');
const parsersDir = join(root, 'parsers');
const outFile = join(__dirname, '..', 'generated', 'templates.json');
const check = process.argv.includes('--check');

const schema = JSON.parse(readFileSync(join(parsersDir, 'schema.json'), 'utf8'));
const validate = new Ajv({allErrors: true, useDefaults: false}).compile(schema);

const errors: string[] = [];
const templates: TemplateSource[] = [];
const seenCodes = new Set<string>();
const seenSenders = new Map<string, string>();

for (const file of readdirSync(parsersDir).filter(f => f.endsWith('.yaml')).sort()) {
  const data = parse(readFileSync(join(parsersDir, file), 'utf8')) as TemplateSource;
  if (!validate(data)) {
    for (const e of validate.errors ?? []) {
      errors.push(`${file}: ${e.instancePath || '/'} ${e.message}`);
    }
    continue;
  }
  if (seenCodes.has(data.code)) {
    errors.push(`${file}: duplicate bank code "${data.code}"`);
  }
  seenCodes.add(data.code);
  for (const s of data.senders) {
    const other = seenSenders.get(s);
    if (other) {
      errors.push(`${file}: sender ${s} already used by ${other}`);
    }
    seenSenders.set(s, file);
  }
  const ids = new Set<string>();
  for (const p of data.patterns) {
    if (ids.has(p.id)) {
      errors.push(`${file}: duplicate pattern id "${p.id}"`);
    }
    ids.add(p.id);
    if (!p.id.startsWith(data.code + '_')) {
      errors.push(`${file}: pattern id "${p.id}" should start with "${data.code}_"`);
    }
    try {
      const re = compileRegex(p.regex);
      if (!re.source.includes('(?<amount>')) {
        errors.push(`${file}: ${p.id} has no (?<amount>...) group`);
      }
      if (re.source.includes('(?<date>') && !p.date_format) {
        errors.push(`${file}: ${p.id} captures a date but has no date_format`);
      }
    } catch (e) {
      errors.push(`${file}: ${p.id} regex does not compile: ${(e as Error).message}`);
    }
  }
  for (const i of data.ignore ?? []) {
    try {
      compileRegex(i.pattern);
    } catch (e) {
      errors.push(`${file}: ignore pattern does not compile: ${(e as Error).message}`);
    }
  }
  templates.push(data);
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

const json = JSON.stringify(templates, null, 2) + '\n';
if (check) {
  let current = '';
  try {
    current = readFileSync(outFile, 'utf8');
  } catch {}
  if (current !== json) {
    console.error('generated/templates.json is out of date. Run: npm run build:templates');
    process.exit(1);
  }
  console.log(`templates OK (${templates.length} banks)`);
} else {
  writeFileSync(outFile, json);
  console.log(`wrote ${templates.length} templates to generated/templates.json`);
}
