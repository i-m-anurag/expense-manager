import {cleanMerchant, merchantKey} from './merchant';
import {
  IgnoreReason,
  ParseResult,
  PatternSource,
  RawSms,
  TemplateSource,
  TxnType,
} from './types';
import {istDayStart, istParts, parseDate, parseTime, toMask, toPaise} from './values';

interface CompiledPattern extends Omit<PatternSource, 'regex' | 'type_overrides'> {
  re: RegExp;
  overrides: {re: RegExp; type: TxnType}[];
}

export interface CompiledTemplate {
  bank: string;
  code: string;
  senders: Set<string>;
  ignore: {re: RegExp; reason: IgnoreReason}[];
  patterns: CompiledPattern[];
}

// JS regexes have no inline flags; templates may start with (?i) like PCRE.
export function compileRegex(source: string): RegExp {
  let flags = '';
  let body = source;
  const inline = body.match(/^\(\?([a-z]+)\)/);
  if (inline) {
    flags = inline[1].replace(/[^ims]/g, '');
    body = body.slice(inline[0].length);
  }
  return new RegExp(body, flags);
}

export function compileTemplates(sources: TemplateSource[]): CompiledTemplate[] {
  return sources.map(t => ({
    bank: t.bank,
    code: t.code,
    senders: new Set(t.senders.map(s => s.toUpperCase())),
    ignore: (t.ignore ?? []).map(i => ({re: compileRegex(i.pattern), reason: i.reason ?? 'other'})),
    patterns: t.patterns.map(({regex, type_overrides, ...p}) => ({
      ...p,
      re: compileRegex(regex),
      overrides: (type_overrides ?? []).map(o => ({re: compileRegex(o.when), type: o.type})),
    })),
  }));
}

// Sender headers look like "VM-HDFCBK", "AD-HDFCBK-S" (TRAI suffixes -S/-T/-P/-G)
// or plain "HDFCBK". Returns the code part.
export function senderCode(sender: string): string {
  const parts = sender.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
  if (parts.length === 0) {
    return '';
  }
  // Prefix is 2 chars, suffix is 1 char; the code is the longest part.
  return parts.reduce((a, b) => (b.length > a.length ? b : a));
}

export function findTemplate(sender: string, templates: CompiledTemplate[]) {
  const code = senderCode(sender);
  return templates.find(t => t.senders.has(code)) ?? null;
}

// Senders the native inbox query should keep (PRD SMS-02).
export function allSenderCodes(templates: CompiledTemplate[]): string[] {
  return templates.flatMap(t => [...t.senders]);
}

export function parseSms(sms: RawSms, templates: CompiledTemplate[]): ParseResult {
  const template = findTemplate(sms.sender, templates);
  if (!template) {
    return {status: 'not_bank'};
  }
  const body = sms.body.replace(/\r\n?/g, '\n');
  for (const rule of template.ignore) {
    if (rule.re.test(body)) {
      return {status: 'ignored', bankCode: template.code, reason: rule.reason};
    }
  }
  for (const p of template.patterns) {
    const m = body.match(p.re);
    const g = m?.groups;
    if (!g) {
      continue;
    }
    const amountPaise = toPaise(g.amount);
    if (amountPaise === null || amountPaise === 0) {
      continue;
    }
    const merchantRaw = cleanMerchant(g.payee);
    const type = p.overrides.find(o => o.re.test(body))?.type ?? p.type;
    return {
      status: 'parsed',
      txn: {
        bankCode: template.code,
        patternId: p.id,
        type,
        direction: p.direction,
        amountPaise,
        accountMask: toMask(g.account),
        accountKind: p.account_kind ?? 'account',
        merchantRaw,
        merchantKey: merchantKey(merchantRaw),
        referenceNo: g.ref?.trim() || null,
        occurredAt: occurredAt(sms.receivedAt, g.date, p.date_format, g.time),
        balancePaise: toPaise(g.balance),
        availableLimitPaise: toPaise(g.limit),
        smsId: sms.id,
      },
    };
  }
  return {status: 'unparsed', bankCode: template.code};
}

// Date from the SMS when present, time from the SMS or (same day) from when it
// arrived; otherwise noon IST so the transaction lands on the right day.
function occurredAt(
  receivedAt: number,
  dateRaw: string | undefined,
  format: string | undefined,
  timeRaw: string | undefined,
): number {
  const date = dateRaw && format ? parseDate(dateRaw, format) : null;
  const time = parseTime(timeRaw);
  if (!date) {
    return receivedAt;
  }
  const dayStart = istDayStart(date);
  if (time !== null) {
    return dayStart + time * 1000;
  }
  const rec = istParts(receivedAt);
  const sameDay = rec.year === date.year && rec.month === date.month && rec.day === date.day;
  return dayStart + (sameDay ? rec.secondsOfDay : 12 * 3600) * 1000;
}
