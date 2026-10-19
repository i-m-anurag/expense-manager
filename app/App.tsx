import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';
import { OnboardingProvider } from './src/onboarding/OnboardingContext';
import { ThemeProvider } from './src/theme/ThemeProvider';

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <OnboardingProvider>
          <RootNavigator />
        </OnboardingProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
