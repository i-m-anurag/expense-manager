import React from 'react';
import { Text, TextStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';
import { groupINR, spokenINR } from '../utils/format';

interface Props {
  // Rupees. Fractions are only shown with showPaise.
  value: number;
  size?: number;
  family?: string;
  color?: string;
  // "−" for money out, "+" for money in (brief §4.2: expenses stay neutral).
  sign?: '+' | '−';
  showPaise?: boolean;
  style?: TextStyle;
}

// Amount with a smaller, muted ₹ (brief §5: symbol ~65% of digit size, text-secondary).
export function Amount({
  value,
  size = 16,
  family = fonts.manropeSemiBold,
  color,
  sign,
  showPaise,
  style,
}: Props) {
  const { c } = useTheme();
  const abs = Math.abs(value);
  const rupees = showPaise ? Math.floor(abs) : Math.round(abs);
  const paise = Math.round((abs - Math.floor(abs)) * 100);
  const small = Math.round(size * 0.65);
  const muted = color ?? c.textSecondary;
  return (
    <Text
      accessibilityLabel={`${sign === '+' ? 'received ' : ''}${spokenINR(abs)}`}
      style={[
        { fontFamily: family, fontSize: size, color: color ?? c.textPrimary },
        { fontVariant: ['tabular-nums'] },
        style,
      ]}
    >
      {sign ?? ''}
      <Text style={{ fontSize: small, color: muted }}>₹</Text>
      {groupINR(rupees)}
      {showPaise ? (
        <Text style={{ fontSize: small, color: muted }}>
          .{String(paise).padStart(2, '0')}
        </Text>
      ) : null}
    </Text>
  );
}
