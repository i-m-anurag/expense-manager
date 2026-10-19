import React from 'react';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, radius } from '../theme/tokens';

type Kind = 'primary' | 'secondary' | 'ghost';

interface Props {
  label: string;
  onPress: () => void;
  kind?: Kind;
  disabled?: boolean;
  style?: ViewStyle;
  height?: number;
}

export function Button({
  label,
  onPress,
  kind = 'primary',
  disabled,
  style,
  height,
}: Props) {
  const { c } = useTheme();
  const container: ViewStyle =
    kind === 'primary'
      ? { backgroundColor: c.gold, height: height ?? 52 }
      : kind === 'secondary'
      ? { borderWidth: 1, borderColor: c.border, height: height ?? 48 }
      : { height: height ?? 48 };
  const color =
    kind === 'primary'
      ? c.onGold
      : kind === 'secondary'
      ? c.textPrimary
      : c.goldText;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        container,
        (pressed || disabled) && { opacity: disabled ? 0.4 : 0.85 },
        style,
      ]}
    >
      <Text
        style={{
          color,
          fontFamily: fonts.interSemiBold,
          fontSize: kind === 'primary' ? 16 : 15,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
});
