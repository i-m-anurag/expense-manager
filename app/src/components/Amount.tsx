import React from 'react';
import { Text, TextStyle } from 'react-native';
import { usePrivacy } from '../data/Privacy';
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
  // Show even in privacy mode (e.g. while the user is typing an amount).
  alwaysVisible?: boolean;
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
  alwaysVisible,
  style,
}: Props) {
  const { c } = useTheme();
  const { hidden } = usePrivacy();
  const abs = Math.abs(value);
  const rupees = showPaise ? Math.floor(abs) : Math.round(abs);
  const paise = Math.round((abs - Math.floor(abs)) * 100);
  const small = Math.round(size * 0.65);
  const muted = color ?? c.textSecondary;
  return (
    <Text
      accessibilityLabel={
        hidden && !alwaysVisible
          ? 'Amount hidden'
          : `${sign === '+' ? 'received ' : ''}${spokenINR(abs)}`
      }
      style={[
        { fontFamily: family, fontSize: size, color: color ?? c.textPrimary },
        { fontVariant: ['tabular-nums'] },
        style,
      ]}
    >
      {sign ?? ''}
      <Text style={{ fontSize: small, color: muted }}>₹</Text>
      {hidden && !alwaysVisible ? '••••' : groupINR(rupees)}
      {showPaise && !(hidden && !alwaysVisible) ? (
        <Text style={{ fontSize: small, color: muted }}>
          .{String(paise).padStart(2, '0')}
        </Text>
      ) : null}
    </Text>
  );
}
