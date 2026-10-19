import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card } from '../../components/Card';
import { Icon } from '../../components/Icon';
import { Txt } from '../../components/Txt';
import { ScreenProps } from '../../navigation/types';
import { useTheme } from '../../theme/ThemeProvider';
import { groupINR, ordinal } from '../../utils/format';
import { useOnboarding } from '../OnboardingContext';
import { OnboardingLayout } from '../OnboardingLayout';
import { sampleScan } from '../sampleScan';

const USER_NAME = 'Anurag'; // TODO: ask for a name during onboarding.

export function DoneScreen({ navigation }: ScreenProps<'Done'>) {
  const { c } = useTheme();
  const { state } = useOnboarding();

  const lock = state.pin
    ? state.biometric
      ? 'PIN + fingerprint'
      : 'PIN'
    : 'Off';
  const recap: [string, string][] = [
    ...(state.scanned
      ? ([
          ['Transactions found', String(sampleScan.transactionCount)],
          ['Accounts', String(state.accounts.length)],
        ] as [string, string][])
      : [['Mode', 'Manual'] as [string, string]]),
    [
      'Budget cycle',
      state.cycleMode === 'calendar'
        ? 'Calendar month'
        : `${ordinal(state.cycleDay)} of month`,
    ],
    ['Budget', `₹${groupINR(state.income)} split`],
    ['Emergency fund', `${state.emergencyMonths} months`],
    ['App lock', lock],
  ];

  return (
    <OnboardingLayout
      stage="all"
      centered
      cta="Go to Home"
      onCta={() => navigation.reset({ index: 0, routes: [{ name: 'Home' }] })}
    >
      <View style={styles.stack}>
        <View style={[styles.badge, { backgroundColor: c.gold }]}>
          <Icon name="check" size={36} color={c.onGold} strokeWidth={2} />
        </View>
        <View>
          <Txt
            variant="display"
            accessibilityRole="header"
            style={styles.title}
          >
            You're all set, {USER_NAME}
          </Txt>
          <Txt tone="secondary" style={styles.mt10}>
            Here's what we set up.
          </Txt>
        </View>
        <Card style={styles.recap}>
          {recap.map(([k, v], i) => (
            <View
              key={k}
              style={[
                styles.row,
                i > 0 && { borderTopWidth: 1, borderTopColor: c.border },
              ]}
            >
              <Txt tone="secondary">{k}</Txt>
              <Txt variant="bodySemi">{v}</Txt>
            </View>
          ))}
        </Card>
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 24 },
  badge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 36, lineHeight: 40, letterSpacing: -0.8 },
  mt10: { marginTop: 10 },
  recap: { paddingVertical: 4 },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
