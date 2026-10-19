import Slider from '@react-native-community/slider';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Amount } from '../../components/Amount';
import { Chip } from '../../components/Chip';
import { Txt } from '../../components/Txt';
import { useTheme } from '../../theme/ThemeProvider';
import { fonts } from '../../theme/tokens';
import {
  SPLIT_KEYS,
  SPLIT_LABELS,
  SplitKey,
  TemplateId,
  fiftyThirtyTwenty,
  fromAverages,
  splitTotal,
} from '../budget';
import { toRupees, useOnboarding } from '../OnboardingContext';
import { OnboardingLayout } from '../OnboardingLayout';
import { useNextStep } from '../flow';

const TEMPLATES: { id: TemplateId; label: string }[] = [
  { id: 'fiftyThirtyTwenty', label: '50/30/20' },
  { id: 'zeroBased', label: 'Zero-based' },
  { id: 'custom', label: 'Custom' },
];

export function SplitScreen() {
  const { c } = useTheme();
  const { state, update } = useOnboarding();
  const next = useNextStep('Split');
  const { income, split, template } = state;
  const unassigned = income - splitTotal(split);

  const colour: Record<SplitKey, string> = {
    need: c.bucket.need,
    want: c.bucket.want,
    investment: c.bucket.investment,
    loan: c.bucket.loan,
    emergency: c.bucket.emergency,
  };

  const pickTemplate = (id: TemplateId) => {
    if (id === 'fiftyThirtyTwenty') {
      update({ template: id, split: fiftyThirtyTwenty(income, split.loan) });
    } else if (id === 'zeroBased') {
      // Pre-fill from scanned averages when we have them (ONB-07).
      const a = state.scan?.averagesPaise;
      const avg = {
        need: toRupees(a?.need ?? 0),
        want: toRupees(a?.want ?? 0),
        investment: toRupees(a?.investment ?? 0),
        loan: toRupees(a?.loan ?? 0),
      };
      update({ template: id, split: fromAverages(avg, split.emergency) });
    } else {
      update({ template: id });
    }
  };

  const setAmount = (key: SplitKey, value: number) =>
    update({ template: 'custom', split: { ...split, [key]: value } });

  const unColour =
    unassigned === 0
      ? c.status.onTrack
      : unassigned < 0
      ? c.status.over
      : c.goldText;

  return (
    <OnboardingLayout
      stage={3}
      onSkip={() => next()}
      cta="Save budget"
      onCta={() => next()}
    >
      <Txt variant="h1" accessibilityRole="header">
        Split your salary
      </Txt>
      <View style={styles.templates}>
        {TEMPLATES.map(t => (
          <Chip
            key={t.id}
            label={t.label}
            selected={template === t.id}
            onPress={() => pickTemplate(t.id)}
          />
        ))}
      </View>

      <View
        style={[styles.bar, { backgroundColor: c.border }]}
        accessible={false}
      >
        {SPLIT_KEYS.map(k => (
          <View
            key={k}
            style={{
              width: `${(Math.max(0, split[k]) / income) * 100}%`,
              backgroundColor: colour[k],
            }}
          />
        ))}
      </View>
      <View
        style={styles.unassigned}
        accessible
        accessibilityLabel={`${
          unassigned < 0 ? 'Over-assigned' : 'Unassigned'
        }: ${Math.abs(unassigned)} rupees`}
      >
        <Txt variant="label" tone="secondary">
          {unassigned < 0 ? 'Over by' : 'Unassigned'}
        </Txt>
        <Amount
          value={Math.abs(unassigned)}
          size={20}
          color={unColour}
          family={fonts.manropeSemiBold}
        />
      </View>

      <View style={styles.sliders}>
        {SPLIT_KEYS.map(k => (
          <View key={k} style={styles.sliderRow}>
            <View style={styles.sliderHead}>
              <View style={styles.sliderName}>
                <View style={[styles.swatch, { backgroundColor: colour[k] }]} />
                <Txt variant="bodyMedium" style={styles.sliderLabel}>
                  {SPLIT_LABELS[k]}
                </Txt>
              </View>
              <Amount value={split[k]} size={15} />
            </View>
            <Slider
              accessibilityLabel={`${SPLIT_LABELS[k]} budget`}
              minimumValue={0}
              maximumValue={income}
              step={1000}
              value={split[k]}
              onValueChange={v => setAmount(k, v)}
              minimumTrackTintColor={c.gold}
              maximumTrackTintColor={c.border}
              thumbTintColor={c.gold}
              style={styles.slider}
            />
          </View>
        ))}
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  templates: { flexDirection: 'row', gap: 8, marginTop: 14 },
  bar: {
    marginTop: 18,
    height: 14,
    borderRadius: 7,
    flexDirection: 'row',
    overflow: 'hidden',
    gap: 2,
  },
  unassigned: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 10,
  },
  sliders: { marginTop: 8, gap: 2 },
  sliderRow: { paddingVertical: 8 },
  sliderHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sliderName: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sliderLabel: { fontSize: 14 },
  swatch: { width: 10, height: 10, borderRadius: 5 },
  slider: { marginTop: 6, height: 32, marginHorizontal: -8 },
});
