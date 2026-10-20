import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Txt } from './src/components/Txt';
import { DataProvider } from './src/data/DataProvider';
import { RootNavigator } from './src/navigation/RootNavigator';
import { OnboardingProvider } from './src/onboarding/OnboardingContext';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';

// Shown while the encrypted database opens (usually a blink), or if it can't.
function Boot({ error }: { error?: Error }) {
  const { c } = useTheme();
  return (
    <View style={[styles.boot, { backgroundColor: c.bg }]}>
      {error ? (
        <>
          <Txt variant="bodySemi" center>
            Couldn't open your data
          </Txt>
          <Txt tone="secondary" center style={styles.mt8}>
            {error.message}
          </Txt>
        </>
      ) : null}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <DataProvider fallback={error => <Boot error={error} />}>
          <OnboardingProvider>
            <RootNavigator />
          </OnboardingProvider>
        </DataProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, justifyContent: 'center', padding: 24 },
  mt8: { marginTop: 8 },
});
