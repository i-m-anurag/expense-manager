import type { Spend } from '../src/domain/budget';
import { computeInsights, cycleLabel } from '../src/domain/insights';

const L = (r: number) => r * 100;
const s = (
  bucket: string,
  name: string,
  rupees: number,
  key = name.toLowerCase(),
): Spend => ({
  amount: L(rupees),
  bucket,
  category_id: `${bucket}.${key}`,
  category_name: name,
  merchant_key: key,
  merchant_name: name,
});
const range = (start: string, end: string) => ({ start, end });

const sep = range('2025-09-01', '2025-09-30');
const aug = range('2025-08-01', '2025-08-31');
const jul = range('2025-07-01', '2025-07-31');

test('cycle labels use the month most of the cycle falls in', () => {
  expect(cycleLabel(sep)).toBe('Sep 2025');
  expect(cycleLabel(range('2025-08-25', '2025-09-24'))).toBe('Sep 2025');
  expect(cycleLabel(aug, true)).toBe('August');
});

test('insights for the current cycle', () => {
  const spends = [
    s('need', 'Rent', 25000),
    s('need', 'Groceries', 3000),
    s('want', 'Food delivery', 14000, 'swiggy'),
    s('investment', 'SIP', 15000),
  ];
  const previous = [s('need', 'Rent', 25000), s('need', 'Groceries', 5000)];
  const i = computeInsights({
    range: sep,
    isCurrent: true,
    today: '2025-09-15',
    spends,
    previous,
    history: [
      {
        range: jul,
        spends: [s('investment', 'SIP', 15000), s('need', 'Rent', 25000)],
      },
      { range: aug, spends: [...previous, s('investment', 'SIP', 15000)] },
      { range: sep, spends },
    ],
    allocations: {
      need: L(50000),
      want: L(20000),
      investment: L(15000),
      loan: L(10000),
    },
    income: L(100000),
    recurring: [],
    emergencyContributions: L(5000),
  });
  expect(i.totalSpent).toBe(L(57000));
  expect(i.split.find(x => x.bucket === 'need')?.share).toBeCloseTo(
    28000 / 57000,
  );
  expect(i.splitSentence).toBe(
    "Needs are about half of what you've spent so far.",
  );
  expect(i.categories.map(c => c.name)).toEqual([
    'Rent',
    'SIP',
    'Food delivery',
    'Groceries',
  ]);
  // Want: 14,000 spent vs 20,000 × 15/30 = 10,000 expected → ₹4,000 ahead.
  expect(i.notes[0]).toEqual({
    tone: 'watch',
    text: "You're ₹4,000 ahead of pace on Wants, with 16 days left.",
  });
  expect(i.notes).toContainEqual({
    tone: 'good',
    text: 'Groceries are ₹2,000 lower than last cycle.',
  });
  expect(i.notes).toContainEqual({
    tone: 'gold',
    text: "You've invested on schedule 3 cycles in a row.",
  });
  expect(i.saved.rate).toBeCloseTo(0.2);
  expect(i.cycles.map(c => [c.label, c.current])).toEqual([
    ['Jul', false],
    ['Aug', false],
    ['Sep', true],
  ]);
  expect(i.forecast?.over).toBe(false);
  expect(i.merchants[0]).toEqual({ name: 'Rent', amount: L(25000) });
});
