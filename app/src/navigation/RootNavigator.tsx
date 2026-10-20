import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { BudgetScreen } from '../budget/BudgetScreen';
import { EditBudgetScreen } from '../budget/EditBudgetScreen';
import { EmergencyFundScreen } from '../budget/EmergencyFundScreen';
import { useData } from '../data/DataProvider';
import { comingSoon } from '../home/ComingSoonScreen';
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
import { AddTransactionScreen } from '../transactions/AddTransactionScreen';
import { TransactionDetailScreen } from '../transactions/TransactionDetailScreen';
import { TransactionsScreen } from '../transactions/TransactionsScreen';
import { UnparsedSmsScreen } from '../transactions/UnparsedSmsScreen';
import { TabBar } from './TabBar';
import { RootStackParamList, TabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const InsightsScreen = comingSoon(
  'Insights',
  'Trends, forecasts and top merchants arrive after the budget screens.',
);
const AddPlaceholder = () => null;

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={props => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Transactions" component={TransactionsScreen} />
      <Tab.Screen name="Add" component={AddPlaceholder} />
      <Tab.Screen name="Budget" component={BudgetScreen} />
      <Tab.Screen name="Insights" component={InsightsScreen} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { c, name } = useTheme();
  const { onboarded } = useData();
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
        initialRouteName={onboarded ? 'Main' : 'Welcome'}
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
          name="Main"
          component={MainTabs}
          options={{ animation: 'fade' }}
        />
        <Stack.Screen
          name="TransactionDetail"
          component={TransactionDetailScreen}
        />
        <Stack.Screen name="EmergencyFund" component={EmergencyFundScreen} />
        <Stack.Screen name="EditBudget" component={EditBudgetScreen} />
        <Stack.Screen name="UnparsedSms" component={UnparsedSmsScreen} />
        <Stack.Screen
          name="AddTransaction"
          component={AddTransactionScreen}
          options={{ animation: 'slide_from_bottom' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
