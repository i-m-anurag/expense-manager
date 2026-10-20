// Budget cycle dates (PRD BUD-01/02). Dates are IST calendar days as 'YYYY-MM-DD'.

const IST_MS = 330 * 60 * 1000;

export interface CycleRange {
  start: string;
  end: string; // inclusive
}

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => {
  const dt = new Date(Date.UTC(y, m, d));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(
    dt.getUTCDate(),
  )}`;
};
const daysIn = (y: number, m: number) =>
  new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

// The cycle containing `now`. Salary mode starts on the salary day (clamped to
// short months, so the 31st becomes the 30th in April); calendar mode on the 1st.
export function currentCycle(
  mode: 'salary' | 'calendar',
  salaryDay: number,
  now = Date.now(),
): CycleRange {
  const d = new Date(now + IST_MS);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = mode === 'calendar' ? 1 : salaryDay;
  const startDayThisMonth = Math.min(day, daysIn(y, m));
  let sy = y;
  let sm = m;
  if (d.getUTCDate() < startDayThisMonth) {
    sm -= 1;
    if (sm < 0) {
      sm = 11;
      sy -= 1;
    }
  }
  const sd = Math.min(day, daysIn(sy, sm));
  const ny = sm === 11 ? sy + 1 : sy;
  const nm = (sm + 1) % 12;
  const nd = Math.min(day, daysIn(ny, nm));
  return { start: iso(sy, sm, sd), end: iso(ny, nm, nd - 1) };
}

// Epoch ms of the start of an IST day, for querying transactions.
export const istDayStartMs = (date: string) =>
  Date.parse(`${date}T00:00:00+05:30`);

const DAY_MS = 24 * 3600 * 1000;

// Whole days from a to b ('YYYY-MM-DD'), e.g. ('2025-09-01','2025-09-30') → 29.
export const daysBetween = (a: string, b: string) =>
  Math.round(
    (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS,
  );

export function todayIst(now = Date.now()): string {
  const d = new Date(now + IST_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(
    d.getUTCDate(),
  )}`;
}

// The n cycles before the one starting on `start`, most recent first.
export function previousCycles(
  mode: 'salary' | 'calendar',
  salaryDay: number,
  start: string,
  n: number,
): CycleRange[] {
  const out: CycleRange[] = [];
  let edge = istDayStartMs(start) - 1;
  for (let i = 0; i < n; i++) {
    const c = currentCycle(mode, salaryDay, edge);
    out.push(c);
    edge = istDayStartMs(c.start) - 1;
  }
  return out;
}
