import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius } from '../theme/tokens';

interface Props extends ViewProps {
  raised?: boolean;
  highlight?: boolean; // gold border
  dashed?: boolean;
}

export function Card({ raised, highlight, dashed, style, ...rest }: Props) {
  const { c, name } = useTheme();
  return (
    <View
      {...rest}
      style={[
        styles.base,
        {
          backgroundColor: raised ? c.surfaceRaised : c.surface,
          borderColor: highlight ? c.gold : c.border,
          borderStyle: dashed ? 'dashed' : 'solid',
        },
        raised && name === 'light' && styles.lightShadow,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.card, borderWidth: 1, padding: 16 },
  lightShadow: {
    shadowColor: '#0B1020',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
});
