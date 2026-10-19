// Merchant key normalisation (PRD §7.5): lowercase, drop spaces and punctuation,
// strip trailing numeric IDs from UPI handles and card merchant strings, then map
// known aliases so several handles of one merchant share a key.

import aliases from './merchantAliases.json';

const ALIASES: Record<string, string> = aliases;

// Words banks append to merchant names that don't help identify them.
// Banks truncate long names, so match cut-off forms too ("PRIVA", "LIMI").
const NOISE = /\b(pvt|priv[a-z]*|ltd|limi[a-z]*|india|technologies|tech|services|online|payments?|retail)\b/g;

export function cleanMerchant(raw: string | null | undefined): string | null {
  if (!raw) {
    return null;
  }
  const s = raw
    .replace(/\s+/g, ' ')
    .replace(/[.\s-]+$/, '')
    .trim();
  return s.length ? s : null;
}

export function merchantKey(raw: string | null | undefined): string | null {
  const cleaned = cleanMerchant(raw);
  if (!cleaned) {
    return null;
  }
  let s = cleaned.toLowerCase();
  // UPI handle: keep the part before @ (swiggy.stores@axisbank -> swiggy.stores).
  if (s.includes('@')) {
    s = s.split('@')[0];
  }
  s = s.replace(NOISE, ' ');
  s = s.replace(/[^a-z0-9]/g, '');
  // Trailing numeric IDs: paytmqr2810050501 -> paytmqr, amazon123 -> amazon.
  const stripped = s.replace(/\d+[a-z]{0,3}$/, '');
  if (stripped.length >= 3) {
    s = stripped;
  }
  if (!s) {
    return null;
  }
  return ALIASES[s] ?? s;
}
