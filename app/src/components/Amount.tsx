import React from 'react';
import { Text, TextStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';
import { groupINR, spokenINR } from '../utils/format';

interface Props {
  value: number;
  size?: number;
  family?: string;
  color?: string;
  style?: TextStyle;
}

// Amount with a smaller, muted ₹ (brief §5: symbol ~65% of digit size, text-secondary).
export function Amount({
  value,
  size = 16,
  family = fonts.manropeSemiBold,
  color,
  style,
}: Props) {
  const { c } = useTheme();
  return (
    <Text
      accessibilityLabel={spokenINR(value)}
      style={[
        { fontFamily: family, fontSize: size, color: color ?? c.textPrimary },
        { fontVariant: ['tabular-nums'] },
        style,
      ]}
    >
      <Text
        style={{
          fontSize: Math.round(size * 0.65),
          color: color ?? c.textSecondary,
        }}
      >
        ₹
      </Text>
      {groupINR(value)}
    </Text>
  );
}
