import React from 'react';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, radius } from '../theme/tokens';

interface Props {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  size?: 'sm' | 'lg';
  style?: ViewStyle;
}

export function Chip({ label, selected, onPress, size = 'sm', style }: Props) {
  const { c } = useTheme();
  const lg = size === 'lg';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      hitSlop={lg ? 2 : 6}
      style={[
        styles.base,
        lg ? styles.lg : styles.sm,
        {
          borderColor: selected ? c.gold : c.border,
          backgroundColor: selected ? c.goldTint : 'transparent',
        },
        style,
      ]}
    >
      <Text
        style={{
          fontFamily: lg ? fonts.interSemiBold : fonts.interMedium,
          fontSize: lg ? 14 : 13,
          color: selected ? c.goldText : lg ? c.textPrimary : c.textSecondary,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderRadius: radius.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sm: { paddingVertical: 8, paddingHorizontal: 14 },
  lg: { height: 44, paddingHorizontal: 16 },
});
