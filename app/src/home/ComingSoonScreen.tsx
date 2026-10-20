import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Txt } from '../components/Txt';
import { useTheme } from '../theme/ThemeProvider';
import { screenPadding } from '../theme/tokens';

// Budget and Insights tabs until their milestones (M4, M5) land.
export function comingSoon(title: string, body: string) {
  return function ComingSoon() {
    const { c } = useTheme();
    const insets = useSafeAreaInsets();
    return (
      <View
        style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}
      >
        <Txt variant="h1" accessibilityRole="header">
          {title}
        </Txt>
        <Txt tone="secondary" style={styles.mt8}>
          {body}
        </Txt>
      </View>
    );
  };
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: screenPadding, justifyContent: 'center' },
  mt8: { marginTop: 8 },
});
