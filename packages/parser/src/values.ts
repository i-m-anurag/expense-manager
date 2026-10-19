// Field normalisers: amounts, dates, account masks.

// "Rs.1,23,456.50", "INR 450", "450.0" -> paise. Returns null if no number.
export function toPaise(raw: string | undefined): number | null {
  if (!raw) {
    return null;
  }
  // First number in the string, so "Rs.450.5" doesn't read the dot after Rs.
  const match = raw.match(/\d[\d,]*(?:\.\d{1,2})?/);
  if (!match) {
    return null;
  }
  const [rupees, fraction = ''] = match[0].replace(/,/g, '').split('.');
  return parseInt(rupees, 10) * 100 + parseInt((fraction + '00').slice(0, 2), 10);
}

// Keep only the trailing 4 digits of a masked number: "XX4521", "*4521", "XXXXX8830".
export function toMask(raw: string | undefined): string | null {
  if (!raw) {
    return null;
  }
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 3 ? digits.slice(-4) : null;
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

const TOKEN = /yyyy|yy|MMM|MM|dd|d/g;

export interface DateParts {
  year: number;
  month: number; // 0-based
  day: number;
}

// Parses a date string against a small format language (dd, d, MM, MMM, yy, yyyy).
// Separators in the format must match the input loosely: any non-alphanumeric
// character in the format matches any run of non-alphanumerics in the input.
export function parseDate(input: string, format: string): DateParts | null {
  const order: string[] = [];
  let pattern = '';
  let last = 0;
  for (const m of format.matchAll(TOKEN)) {
    pattern += format.slice(last, m.index).replace(/[^A-Za-z0-9]+/g, '[^A-Za-z0-9]*');
    order.push(m[0]);
    pattern +=
      m[0] === 'yyyy' ? '(\\d{4})'
      : m[0] === 'yy' ? '(\\d{2})'
      : m[0] === 'MMM' ? '([A-Za-z]{3})'
      : m[0] === 'd' ? '(\\d{1,2})'
      : '(\\d{2})';
    last = (m.index ?? 0) + m[0].length;
  }
  pattern += format.slice(last).replace(/[^A-Za-z0-9]+/g, '[^A-Za-z0-9]*');
  const match = input.trim().match(new RegExp('^' + pattern, 'i'));
  if (!match) {
    return null;
  }
  let year = NaN;
  let month = NaN;
  let day = NaN;
  order.forEach((tok, i) => {
    const v = match[i + 1];
    if (tok === 'yyyy') year = parseInt(v, 10);
    else if (tok === 'yy') year = 2000 + parseInt(v, 10);
    else if (tok === 'MMM') month = MONTHS[v.toLowerCase()] ?? NaN;
    else if (tok === 'MM') month = parseInt(v, 10) - 1;
    else day = parseInt(v, 10);
  });
  if ([year, month, day].some(Number.isNaN) || month < 0 || month > 11 || day < 1 || day > 31) {
    return null;
  }
  return {year, month, day};
}

// "14:22", "14:22:10", "02:22 PM" -> seconds since midnight.
export function parseTime(input: string | undefined): number | null {
  if (!input) {
    return null;
  }
  const m = input.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!m) {
    return null;
  }
  let h = parseInt(m[1], 10);
  const ap = m[4]?.toLowerCase();
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  return h * 3600 + parseInt(m[2], 10) * 60 + (m[3] ? parseInt(m[3], 10) : 0);
}

// Bank SMS dates are Indian Standard Time (UTC+5:30), whatever the phone's zone.
const IST_OFFSET_MS = 330 * 60 * 1000;

export function istDayStart(p: DateParts): number {
  return Date.UTC(p.year, p.month, p.day) - IST_OFFSET_MS;
}

export function istParts(epochMs: number): DateParts & {secondsOfDay: number} {
  const d = new Date(epochMs + IST_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth(),
    day: d.getUTCDate(),
    secondsOfDay: d.getUTCHours() * 3600 + d.getUTCMinutes() * 60 + d.getUTCSeconds(),
  };
}
