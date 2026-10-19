import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card } from '../../components/Card';
import { Icon } from '../../components/Icon';
import { Txt } from '../../components/Txt';
import { openAppSettings, requestSms } from '../../permissions';
import { useTheme } from '../../theme/ThemeProvider';
import { OnboardingLayout } from '../OnboardingLayout';
import { useNextStep } from '../flow';

export function SmsDeniedScreen() {
  const { c } = useTheme();
  const next = useNextStep('SmsDenied');

  const enable = async () => {
    const result = await requestSms();
    if (result === 'granted') {
      next({ smsGranted: true, manualMode: false });
    } else if (result === 'blocked') {
      // Android won't show the prompt again; the user has to flip it in Settings.
      openAppSettings();
    }
  };

  const rows = [
    { s: '✓', color: c.status.onTrack, t: 'Add payments with the + button' },
    {
      s: '✓',
      color: c.status.onTrack,
      t: 'Budgets, pace and insights all work',
    },
    { s: '–', color: c.textTertiary, t: 'No automatic reading of bank SMS' },
  ];

  return (
    <OnboardingLayout
      stage={0}
      centered
      cta="Enable SMS reading"
      onCta={enable}
      ghost="Continue in manual mode"
      ghostKind="secondary"
      onGhost={() => next({ smsGranted: false, manualMode: true })}
    >
      <View style={styles.stack}>
        <View
          style={[
            styles.badge,
            { backgroundColor: c.surfaceRaised, borderColor: c.border },
          ]}
        >
          <Icon name="smsOff" size={42} color={c.textSecondary} />
        </View>
        <Txt variant="title" accessibilityRole="header" style={styles.title}>
          SMS access is off
        </Txt>
        <Txt tone="secondary">
          No problem. You can use Expense Manager in manual mode and add each
          payment yourself.
        </Txt>
        <Card style={styles.list}>
          {rows.map((r, i) => (
            <View
              key={r.t}
              style={[
                styles.row,
                i > 0 && { borderTopWidth: 1, borderTopColor: c.border },
              ]}
            >
              <Txt variant="bodySemi" color={r.color}>
                {r.s}
              </Txt>
              <Txt variant="label" style={styles.rowText}>
                {r.t}
              </Txt>
            </View>
          ))}
        </Card>
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 22 },
  badge: {
    width: 88,
    height: 88,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 30, lineHeight: 35 },
  list: { paddingVertical: 6 },
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowText: { fontFamily: 'Inter-Regular', fontSize: 14, flex: 1 },
});
