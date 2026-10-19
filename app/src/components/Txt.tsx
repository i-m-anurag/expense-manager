import React from 'react';
import { StyleSheet, Text, TextProps, TextStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';

export type TxtVariant =
  | 'display' // 40/1.1 Manrope ExtraBold — welcome headline
  | 'title' // 32/1.15 Manrope Bold — welcome screens
  | 'h1' // 28/1.2 Manrope Bold — step titles
  | 'body' // 15/1.5 Inter
  | 'bodyMedium'
  | 'bodySemi'
  | 'label' // 13 Inter Medium
  | 'caption' // 12 Inter
  | 'overline'; // 11 Inter SemiBold, uppercase

type Tone = 'primary' | 'secondary' | 'tertiary' | 'gold';

interface Props extends TextProps {
  variant?: TxtVariant;
  tone?: Tone;
  color?: string;
  center?: boolean;
}

export function Txt({
  variant = 'body',
  tone = 'primary',
  color,
  center,
  style,
  ...rest
}: Props) {
  const { c } = useTheme();
  const toneColor = {
    primary: c.textPrimary,
    secondary: c.textSecondary,
    tertiary: c.textTertiary,
    gold: c.goldText,
  }[tone];
  return (
    <Text
      {...rest}
      style={[
        styles.base,
        styles[variant],
        { color: color ?? toneColor },
        center && styles.center,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create<
  Record<TxtVariant | 'base' | 'center', TextStyle>
>({
  base: { fontVariant: ['tabular-nums'] },
  center: { textAlign: 'center' },
  display: {
    fontFamily: fonts.manropeExtraBold,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1,
  },
  title: {
    fontFamily: fonts.manropeBold,
    fontSize: 32,
    lineHeight: 37,
    letterSpacing: -0.6,
  },
  h1: {
    fontFamily: fonts.manropeBold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.4,
  },
  body: { fontFamily: fonts.inter, fontSize: 15, lineHeight: 22 },
  bodyMedium: { fontFamily: fonts.interMedium, fontSize: 15, lineHeight: 22 },
  bodySemi: { fontFamily: fonts.interSemiBold, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: fonts.interMedium, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.inter, fontSize: 12, lineHeight: 17 },
  overline: {
    fontFamily: fonts.interSemiBold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
});
