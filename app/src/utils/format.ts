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
