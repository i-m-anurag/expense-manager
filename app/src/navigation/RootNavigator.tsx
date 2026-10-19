import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { HomeScreen } from '../home/HomeScreen';
import { AccountsScreen } from '../onboarding/screens/AccountsScreen';
import { DoneScreen } from '../onboarding/screens/DoneScreen';
import { EmergencyScreen } from '../onboarding/screens/EmergencyScreen';
import { IncomeScreen } from '../onboarding/screens/IncomeScreen';
import { LockScreen } from '../onboarding/screens/LockScreen';
import { NotificationsScreen } from '../onboarding/screens/NotificationsScreen';
import { ScanScreen } from '../onboarding/screens/ScanScreen';
import { SmsDeniedScreen } from '../onboarding/screens/SmsDeniedScreen';
import { SmsPermissionScreen } from '../onboarding/screens/SmsPermissionScreen';
import { SplitScreen } from '../onboarding/screens/SplitScreen';
import { SummaryScreen } from '../onboarding/screens/SummaryScreen';
import { TrainingScreen } from '../onboarding/screens/TrainingScreen';
import { WelcomeScreen } from '../onboarding/screens/WelcomeScreen';
import { useTheme } from '../theme/ThemeProvider';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { c, name } = useTheme();
  const base = name === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      background: c.bg,
      card: c.bg,
      text: c.textPrimary,
      primary: c.gold,
      border: c.border,
    },
  };
  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        initialRouteName="Welcome"
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: c.bg },
        }}
      >
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="SmsPermission" component={SmsPermissionScreen} />
        <Stack.Screen name="SmsDenied" component={SmsDeniedScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen
          name="Scan"
          component={ScanScreen}
          options={{ gestureEnabled: false }}
        />
        <Stack.Screen name="Summary" component={SummaryScreen} />
        <Stack.Screen name="Accounts" component={AccountsScreen} />
        <Stack.Screen name="Income" component={IncomeScreen} />
        <Stack.Screen name="Split" component={SplitScreen} />
        <Stack.Screen name="Emergency" component={EmergencyScreen} />
        <Stack.Screen name="Training" component={TrainingScreen} />
        <Stack.Screen name="Lock" component={LockScreen} />
        <Stack.Screen name="Done" component={DoneScreen} />
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ animation: 'fade' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
