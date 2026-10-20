import Slider from '@react-native-community/slider';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Amount } from '../components/Amount';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { Txt } from '../components/Txt';
import { useData, useQuery } from '../data/DataProvider';
import { getBudgetSnapshot, updateAllocations } from '../domain/budget';
import { ScreenProps } from '../navigation/types';
import { SPLIT_KEYS, SPLIT_LABELS, SplitKey } from '../onboarding/budget';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, screenPadding } from '../theme/tokens';

// Brief §9.6: "Edit budget opens the same split UI as onboarding". Changes
// apply to the current cycle and carry into the next ones (BUD-10).
export function EditBudgetScreen({ navigation }: ScreenProps<'EditBudget'>) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { sql, refresh } = useData();
  const budget = useQuery(s => getBudgetSnapshot(s), []);
  const [split, setSplit] = useState<Record<SplitKey, number> | null>(null);

  useEffect(() => {
    if (budget && !split) {
      const a = (k: string) =>
        k === 'emergency'
          ? budget.emergencyAllocation
          : budget.buckets.find(b => b.bucket === k)?.allocated ?? 0;
      setSplit(
        Object.fromEntries(
          SPLIT_KEYS.map(k => [k, Math.round(a(k) / 100)]),
        ) as Record<SplitKey, number>,
      );
    }
  }, [budget, split]);

  if (!budget || !split) {
    return <View style={[styles.root, { backgroundColor: c.bg }]} />;
  }
  const income = Math.round(budget.cycle.income / 100);
  const unassigned = income - SPLIT_KEYS.reduce((s, k) => s + split[k], 0);
  const colour: Record<SplitKey, string> = { ...c.bucket };
  const unColour =
    unassigned === 0
      ? c.status.onTrack
      : unassigned < 0
      ? c.status.over
      : c.goldText;

  const save = async () => {
    await updateAllocations(
      sql,
      budget.cycle.id,
      Object.fromEntries(SPLIT_KEYS.map(k => [k, split[k] * 100])),
    );
    refresh();
    navigation.goBack();
  };

  return (
    <View
      style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}
    >
      <View style={styles.topBar}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Icon name="chevronLeft" size={24} color={c.textSecondary} />
        </Pressable>
        <Txt variant="bodySemi">Edit budget</Txt>
        <View style={styles.spacer} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
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
        <View style={styles.unassigned}>
          <Txt variant="label" tone="secondary">
            {unassigned < 0 ? 'Over by' : 'Unassigned'}
          </Txt>
          <Amount
            value={Math.abs(unassigned)}
            size={20}
            color={unColour}
            alwaysVisible
          />
        </View>
        {SPLIT_KEYS.map(k => (
          <View key={k} style={styles.sliderRow}>
            <View style={styles.sliderHead}>
              <View style={styles.sliderName}>
                <View style={[styles.swatch, { backgroundColor: colour[k] }]} />
                <Txt variant="bodyMedium">{SPLIT_LABELS[k]}</Txt>
              </View>
              <Amount value={split[k]} size={15} alwaysVisible />
            </View>
            <Slider
              accessibilityLabel={`${SPLIT_LABELS[k]} budget`}
              minimumValue={0}
              maximumValue={income}
              step={1000}
              value={split[k]}
              onValueChange={v => setSplit(s => ({ ...s!, [k]: v }))}
              minimumTrackTintColor={c.gold}
              maximumTrackTintColor={c.border}
              thumbTintColor={c.gold}
              style={styles.slider}
            />
          </View>
        ))}
        <Txt variant="caption" tone="tertiary" style={styles.note}>
          Changes apply from this cycle onwards.
        </Txt>
      </ScrollView>
      <View
        style={[
          styles.footer,
          { paddingBottom: Math.max(insets.bottom, 12) + 16 },
        ]}
      >
        <Button label="Save budget" onPress={save} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    height: 48,
    paddingHorizontal: screenPadding,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  spacer: { width: 24 },
  content: { paddingHorizontal: screenPadding, paddingBottom: 24 },
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
  sliderRow: { paddingVertical: 8 },
  sliderHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sliderName: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  swatch: { width: 10, height: 10, borderRadius: 5 },
  slider: { marginTop: 6, height: 32, marginHorizontal: -8 },
  note: { fontFamily: fonts.inter, marginTop: 8 },
  footer: { paddingHorizontal: screenPadding, paddingTop: 12 },
});
