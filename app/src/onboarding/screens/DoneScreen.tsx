import { allSenderCodes, bundledTemplates } from '@expense-manager/parser';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card } from '../../components/Card';
import { Icon } from '../../components/Icon';
import { Txt } from '../../components/Txt';
import { useData } from '../../data/DataProvider';
import { SecureStore } from '../../db/connection';
import { saveOnboarding } from '../../domain/onboarding';
import { ScreenProps } from '../../navigation/types';
import { SCAN_DAYS } from '../../sms/scan';
import { SmsInbox } from '../../sms/SmsInbox';
import { useTheme } from '../../theme/ThemeProvider';
import { groupINR, ordinal } from '../../utils/format';
import { useOnboarding } from '../OnboardingContext';
import { OnboardingLayout } from '../OnboardingLayout';

const USER_NAME = 'Anurag'; // TODO: ask for a name during onboarding.

export function DoneScreen({ navigation }: ScreenProps<'Done'>) {
  const { c } = useTheme();
  const { state } = useOnboarding();
  const { sql, refresh } = useData();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Persist everything, import the scanned SMS as transactions, then go Home.
  const finish = async () => {
    setSaving(true);
    setError(null);
    try {
      const templates = bundledTemplates();
      const messages =
        state.smsGranted && !state.manualMode
          ? await SmsInbox.readInbox(
              Date.now() - SCAN_DAYS * 24 * 3600 * 1000,
              allSenderCodes(templates),
            )
          : [];
      await saveOnboarding(sql, state, messages, templates, USER_NAME);
      if (state.pin) {
        await SecureStore.setPin(state.pin);
      }
      refresh();
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  const lock = state.pin
    ? state.biometric
      ? 'PIN + fingerprint'
      : 'PIN'
    : 'Off';
  const recap: [string, string][] = [
    ...(state.scan && !state.manualMode
      ? ([
          ['Transactions found', String(state.scan.transactionCount)],
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
      cta={saving ? 'Setting things up…' : 'Go to Home'}
      ctaDisabled={saving}
      onCta={finish}
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
          {error ? (
            <Txt color={c.status.over} style={styles.mt10}>
              Couldn't save: {error}
            </Txt>
          ) : null}
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
