import { groupINR, ordinal, spokenINR } from '../src/utils/format';

test('groups digits the Indian way', () => {
  expect(groupINR(0)).toBe('0');
  expect(groupINR(450)).toBe('450');
  expect(groupINR(4500)).toBe('4,500');
  expect(groupINR(100000)).toBe('1,00,000');
  expect(groupINR(240000)).toBe('2,40,000');
  expect(groupINR(12345678)).toBe('1,23,45,678');
  expect(groupINR(-86000)).toBe('-86,000');
});

test('ordinals', () => {
  expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 31].map(ordinal)).toEqual([
    '1st',
    '2nd',
    '3rd',
    '4th',
    '11th',
    '12th',
    '13th',
    '21st',
    '22nd',
    '31st',
  ]);
});

test('reads amounts in full for screen readers', () => {
  expect(spokenINR(100000)).toBe('one lakh rupees');
  expect(spokenINR(240000)).toBe('two lakh forty thousand rupees');
  expect(spokenINR(1240)).toBe('one thousand two hundred forty rupees');
  expect(spokenINR(0)).toBe('zero rupees');
});
