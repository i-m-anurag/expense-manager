// Indian digit grouping: 100000 -> "1,00,000". Implemented by hand so it does not
// depend on the JS engine's Intl locale data.
export function groupINR(value: number): string {
  const negative = value < 0;
  const digits = Math.round(Math.abs(value)).toString();
  if (digits.length <= 3) {
    return (negative ? '-' : '') + digits;
  }
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return (negative ? '-' : '') + rest + ',' + last3;
}

export function ordinal(day: number): string {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return `${day}th`;
  }
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

const ONES = [
  '',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];
const TENS = [
  '',
  '',
  'twenty',
  'thirty',
  'forty',
  'fifty',
  'sixty',
  'seventy',
  'eighty',
  'ninety',
];

function underHundred(n: number): string {
  if (n < 20) {
    return ONES[n];
  }
  return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
}

function underThousand(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? ONES[h] + ' hundred' : '', r ? underHundred(r) : '']
    .filter(Boolean)
    .join(' ');
}

// Screen-reader label for an amount: 100000 -> "one lakh rupees" (brief §12).
export function spokenINR(value: number): string {
  let n = Math.round(Math.abs(value));
  if (n === 0) {
    return 'zero rupees';
  }
  const parts: string[] = [];
  const crore = Math.floor(n / 1e7);
  n %= 1e7;
  const lakh = Math.floor(n / 1e5);
  n %= 1e5;
  const thousand = Math.floor(n / 1e3);
  n %= 1e3;
  if (crore) {
    parts.push(underThousand(crore) + ' crore');
  }
  if (lakh) {
    parts.push(underHundred(lakh) + ' lakh');
  }
  if (thousand) {
    parts.push(underHundred(thousand) + ' thousand');
  }
  if (n) {
    parts.push(underThousand(n));
  }
  return (value < 0 ? 'minus ' : '') + parts.join(' ') + ' rupees';
}

const IST_MS = 330 * 60 * 1000;
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

// IST calendar parts of an epoch, independent of the phone's time zone.
export function istDate(epochMs: number) {
  const d = new Date(epochMs + IST_MS);
  return {
    y: d.getUTCFullYear(),
    m: d.getUTCMonth(),
    d: d.getUTCDate(),
    h: d.getUTCHours(),
    min: d.getUTCMinutes(),
  };
}

export const monthLabel = (y: number, m: number) => `${MONTHS[m]} ${y}`;

// List group headers: "Today", "Yesterday", "16 Sep", "16 Sep 2024".
export function dayLabel(epochMs: number, now = Date.now()) {
  const a = istDate(epochMs);
  const today = istDate(now);
  const yesterday = istDate(now - 24 * 3600 * 1000);
  if (a.y === today.y && a.m === today.m && a.d === today.d) {
    return 'Today';
  }
  if (a.y === yesterday.y && a.m === yesterday.m && a.d === yesterday.d) {
    return 'Yesterday';
  }
  return `${a.d} ${MONTHS[a.m]}${a.y === today.y ? '' : ` ${a.y}`}`;
}

export function timeLabel(epochMs: number) {
  const { h, min } = istDate(epochMs);
  const h12 = h % 12 || 12;
  return `${h12}:${String(min).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

// "18 Sep 2026, 8:12 pm"
export function dateTimeLabel(epochMs: number) {
  const a = istDate(epochMs);
  return `${a.d} ${MONTHS[a.m]} ${a.y}, ${timeLabel(epochMs)}`;
}

// Key used to group transactions by IST day.
export function dayKey(epochMs: number) {
  const { y, m, d } = istDate(epochMs);
  return `${y}-${m}-${d}`;
}

// "SW" from "Swiggy", "RK" from "Rakesh Kumar".
export function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const s = words.length >= 2 ? words[0][0] + words[1][0] : name.slice(0, 2);
  return s.toUpperCase();
}
