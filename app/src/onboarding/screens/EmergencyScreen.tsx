import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Amount } from '../../components/Amount';
import { Card } from '../../components/Card';
import { Icon } from '../../components/Icon';
import { Txt } from '../../components/Txt';
import { useTheme } from '../../theme/ThemeProvider';
import { fonts } from '../../theme/tokens';
import { groupINR } from '../../utils/format';
import { essentialSpend, useOnboarding } from '../OnboardingContext';
import { OnboardingLayout } from '../OnboardingLayout';
import { useNextStep } from '../flow';

const MIN = 1;
const MAX = 12;

export function EmergencyScreen() {
  const { c } = useTheme();
  const { state, update } = useOnboarding();
  const next = useNextStep('Emergency');
  const months = state.emergencyMonths;
  // EMF-01/02: target = months × average Need spend (the Need budget before history exists).
  const essentials = essentialSpend(state);
  const fromHistory = essentials !== state.split.need;
  const target = essentials * months;
  const linked = state.accounts.find(a => a.id === state.emergencyAccountId);

  const set = (m: number) =>
    update({ emergencyMonths: Math.min(MAX, Math.max(MIN, m)) });

  return (
    <OnboardingLayout
      stage={3}
      onSkip={() => next()}
      cta="Set target"
      onCta={() => next()}
    >
      <Txt variant="h1" accessibilityRole="header">
        Your emergency fund
      </Txt>
      <Txt tone="secondary" style={styles.mt8}>
        Kept separate from your budget, for the unexpected.
      </Txt>

      <Card style={styles.targetCard}>
        <Txt variant="label" tone="secondary" center>
          Target
        </Txt>
        <View
          style={styles.stepper}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Target months of essentials"
          accessibilityValue={{ text: `${months} months` }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={e =>
            set(months + (e.nativeEvent.actionName === 'increment' ? 1 : -1))
          }
        >
          <StepButton
            label="−"
            a11y="Fewer months"
            onPress={() => set(months - 1)}
            disabled={months <= MIN}
          />
          <Text style={[styles.months, { color: c.textPrimary }]}>
            {months}
          </Text>
          <StepButton
            label="+"
            a11y="More months"
            onPress={() => set(months + 1)}
            disabled={months >= MAX}
          />
        </View>
        <Txt variant="bodyMedium" tone="secondary" center style={styles.mt6}>
          months of essentials
        </Txt>
        <Txt variant="bodyMedium" tone="gold" center style={styles.mt14}>
          That's ₹{groupINR(target)} for {months} months of essentials.
        </Txt>
      </Card>

      <Card style={styles.linked}>
        <View style={[styles.shield, { backgroundColor: c.goldTint }]}>
          <Icon name="shield" size={20} color={c.goldText} />
        </View>
        <View style={styles.flex}>
          <Txt variant="caption" tone="secondary" style={styles.medium}>
            Linked account
          </Txt>
          <Txt variant="bodySemi">
            {linked ? linked.name : 'Not linked · tracked manually'}
          </Txt>
        </View>
        <View style={styles.right}>
          <Txt variant="caption" tone="secondary" style={styles.medium}>
            Balance
          </Txt>
          <Amount value={state.emergencyBalance} size={18} />
        </View>
      </Card>
      <Txt variant="label" tone="tertiary" style={styles.footnote}>
        Based on {fromHistory ? 'average essential spend' : 'your Need budget'}{' '}
        of ₹{groupINR(essentials)} a month.
      </Txt>
    </OnboardingLayout>
  );
}

function StepButton(props: {
  label: string;
  a11y: string;
  onPress: () => void;
  disabled: boolean;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.a11y}
      accessibilityState={{ disabled: props.disabled }}
      onPress={props.onPress}
      disabled={props.disabled}
      style={[
        styles.stepBtn,
        {
          borderColor: c.border,
          backgroundColor: c.surfaceRaised,
          opacity: props.disabled ? 0.4 : 1,
        },
      ]}
    >
      <Text style={[styles.stepLabel, { color: c.textPrimary }]}>
        {props.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  mt6: { marginTop: 6 },
  mt8: { marginTop: 8 },
  mt14: { marginTop: 14 },
  targetCard: { marginTop: 20, padding: 20 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginTop: 10,
  },
  months: {
    fontFamily: fonts.manropeBold,
    fontSize: 56,
    lineHeight: 62,
    minWidth: 72,
    textAlign: 'center',
  },
  stepBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLabel: { fontFamily: fonts.interMedium, fontSize: 22 },
  linked: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  shield: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
  right: { alignItems: 'flex-end' },
  medium: { fontFamily: fonts.interMedium },
  footnote: { fontFamily: fonts.inter, marginTop: 12, paddingHorizontal: 4 },
});
