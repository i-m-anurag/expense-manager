import React from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Txt } from '../components/Txt';
import { useTheme } from '../theme/ThemeProvider';
import { screenPadding } from '../theme/tokens';

// Placeholder until the Home dashboard (brief §9.2) is built.
export function HomeScreen() {
  const { c, name } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}
    >
      <StatusBar
        barStyle={name === 'dark' ? 'light-content' : 'dark-content'}
      />
      <Txt variant="h1">Home</Txt>
      <Txt tone="secondary" style={styles.mt8}>
        Onboarding complete. The dashboard comes next.
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: screenPadding, justifyContent: 'center' },
  mt8: { marginTop: 8 },
});
