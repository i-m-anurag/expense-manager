import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card } from '../../components/Card';
import { Chip } from '../../components/Chip';
import { Txt } from '../../components/Txt';
import { requestNotifications } from '../../permissions';
import { OnboardingLayout } from '../OnboardingLayout';
import { useNextStep } from '../flow';

export function NotificationsScreen() {
  const next = useNextStep('Notifications');
  // The preview's quick-tag buttons are live so the user can feel the one-tap flow.
  const [tag, setTag] = useState('Want');

  const allow = async () => {
    const result = await requestNotifications();
    next({ notificationsGranted: result === 'granted' });
  };

  return (
    <OnboardingLayout
      stage={0}
      cta="Allow notifications"
      onCta={allow}
      ghost="Not now"
      onGhost={() => next({ notificationsGranted: false })}
    >
      <Txt variant="h1" accessibilityRole="header">
        Tag it the moment it happens
      </Txt>
      <Txt tone="secondary" style={styles.mt8}>
        Get a quiet notification for each payment, with one-tap tags.
      </Txt>

      <Card raised style={styles.notif}>
        <View style={styles.notifHead}>
          <Txt variant="caption" tone="secondary" style={styles.medium}>
            Expense Manager
          </Txt>
          <Txt variant="caption" tone="secondary" style={styles.medium}>
            now
          </Txt>
        </View>
        <Txt style={styles.notifTitle}>₹450 at Swiggy · HDFC ••4521</Txt>
        <Txt variant="label" tone="secondary" style={styles.regular}>
          Which bucket does this belong to?
        </Txt>
        <View style={styles.tags}>
          {['Want', 'Need', 'Other'].map(t => (
            <Chip
              key={t}
              label={t}
              size="lg"
              selected={tag === t}
              onPress={() => setTag(t)}
              style={styles.tag}
            />
          ))}
        </View>
      </Card>
      <Txt variant="label" tone="tertiary" style={styles.footnote}>
        You can change this any time in Settings.
      </Txt>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  mt8: { marginTop: 8 },
  notif: { marginTop: 28, borderRadius: 24 },
  notifHead: { flexDirection: 'row', justifyContent: 'space-between' },
  medium: { fontFamily: 'Inter-Medium' },
  regular: { fontFamily: 'Inter-Regular', marginTop: 2 },
  notifTitle: { fontFamily: 'Manrope-SemiBold', fontSize: 16, marginTop: 8 },
  tags: { flexDirection: 'row', gap: 8, marginTop: 14 },
  tag: { flex: 1, borderRadius: 12 },
  footnote: {
    fontFamily: 'Inter-Regular',
    marginTop: 16,
    paddingHorizontal: 4,
  },
});
