import React, { useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Amount } from '../../components/Amount';
import { Chip } from '../../components/Chip';
import { Icon } from '../../components/Icon';
import { Txt } from '../../components/Txt';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { useTheme } from '../../theme/ThemeProvider';
import { fonts, motion, radius } from '../../theme/tokens';
import { BudgetBucket } from '../budget';
import { toRupees, useOnboarding } from '../OnboardingContext';
import { OnboardingLayout } from '../OnboardingLayout';
import { useNextStep } from '../flow';

const BUCKETS: { id: BudgetBucket; label: string }[] = [
  { id: 'need', label: 'Need' },
  { id: 'want', label: 'Want' },
  { id: 'investment', label: 'Investment' },
  { id: 'loan', label: 'Loan' },
];

// ONB-09: one card per frequent merchant; each tap becomes a merchant-memory entry.
export function TrainingScreen() {
  const { c } = useTheme();
  const reduceMotion = useReduceMotion();
  const { state, update } = useOnboarding();
  const next = useNextStep('Training');
  const merchants = state.scan?.merchants ?? [];
  const [index, setIndex] = useState(0);
  const slide = useRef(new Animated.Value(0)).current;
  const busy = useRef(false);
  const total = merchants.length;
  const finished = index >= total;
  const cur = merchants[Math.min(index, total - 1)];

  const choose = (bucket: BudgetBucket) => {
    if (busy.current || finished) {
      return;
    }
    busy.current = true;
    update({ merchantMemory: { ...state.merchantMemory, [cur.key]: bucket } });
    Animated.timing(slide, {
      toValue: 1,
      duration: reduceMotion ? 0 : motion.duration,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      setIndex(i => i + 1);
      slide.setValue(0);
      busy.current = false;
    });
  };

  const done = Math.min(index, total);

  return (
    <OnboardingLayout
      stage={3}
      onSkip={() => next()}
      cta="Continue"
      onCta={() => next()}
    >
      <Txt variant="h1" accessibilityRole="header">
        Quick training
      </Txt>
      <Txt tone="secondary" style={styles.mt8}>
        Tap a bucket once per merchant. We'll remember it.
      </Txt>
      <View style={styles.mt14}>
        <Txt variant="caption" tone="secondary" style={styles.medium}>
          {done} of {total}
        </Txt>
        <View style={[styles.track, { backgroundColor: c.border }]}>
          <View
            style={[
              styles.fill,
              {
                backgroundColor: c.gold,
                width: `${total ? (done / total) * 100 : 100}%`,
              },
            ]}
          />
        </View>
      </View>

      <View style={styles.stack}>
        {!finished && index + 2 < total ? (
          <View
            style={[
              styles.card,
              styles.back2,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          />
        ) : null}
        {!finished && index + 1 < total ? (
          <View
            style={[
              styles.card,
              styles.back1,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          />
        ) : null}
        {finished ? (
          <View
            style={[
              styles.card,
              styles.front,
              styles.doneCard,
              { backgroundColor: c.surfaceRaised, borderColor: c.border },
            ]}
          >
            <View style={[styles.doneIcon, { backgroundColor: c.gold }]}>
              <Icon name="check" size={28} color={c.onGold} strokeWidth={2} />
            </View>
            <Txt variant="h1" center style={styles.mt14}>
              All {total} remembered
            </Txt>
            <Txt tone="secondary" center style={styles.mt8}>
              Future payments to these merchants will be sorted for you.
            </Txt>
          </View>
        ) : (
          <Animated.View
            style={[
              styles.card,
              styles.front,
              { backgroundColor: c.surfaceRaised, borderColor: c.border },
              {
                opacity: slide.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 0],
                }),
                transform: [
                  {
                    translateX: slide.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 320],
                    }),
                  },
                  {
                    rotate: slide.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '8deg'],
                    }),
                  },
                ],
              },
            ]}
          >
            <View
              style={[
                styles.initials,
                { backgroundColor: c.surface, borderColor: c.border },
              ]}
            >
              <Txt style={styles.iniText} tone="secondary">
                {cur.initials}
              </Txt>
            </View>
            <Txt style={styles.name}>{cur.name}</Txt>
            <Txt tone="secondary" style={styles.mt4}>
              {cur.count} payments ·{' '}
              <Amount
                value={toRupees(cur.totalPaise)}
                size={15}
                family={fonts.interSemiBold}
              />
            </Txt>
            <View style={styles.flex} />
            <Txt variant="caption" tone="tertiary" style={styles.usually}>
              This is usually…
            </Txt>
            <View style={styles.chips}>
              {BUCKETS.map(b => (
                <Chip
                  key={b.id}
                  label={b.label}
                  size="lg"
                  selected={b.id === cur.suggested}
                  onPress={() => choose(b.id)}
                />
              ))}
            </View>
          </Animated.View>
        )}
      </View>
    </OnboardingLayout>
  );
}

const CARD_H = 280;

const styles = StyleSheet.create({
  mt4: { marginTop: 4 },
  mt8: { marginTop: 8 },
  mt14: { marginTop: 14 },
  medium: { fontFamily: fonts.interMedium },
  track: { height: 6, borderRadius: 3, marginTop: 6 },
  fill: { height: 6, borderRadius: 3 },
  stack: { height: CARD_H + 20, marginTop: 24 },
  card: {
    position: 'absolute',
    height: CARD_H,
    borderRadius: 24,
    borderWidth: 1,
  },
  back2: { left: 16, right: 16, top: 14, opacity: 0.5 },
  back1: { left: 8, right: 8, top: 7, opacity: 0.8 },
  front: { left: 0, right: 0, top: 0, padding: 24 },
  doneCard: { alignItems: 'center', justifyContent: 'center' },
  doneIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    width: 52,
    height: 52,
    borderRadius: radius.chip,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iniText: { fontFamily: fonts.manropeBold, fontSize: 16 },
  name: {
    fontFamily: fonts.manropeBold,
    fontSize: 28,
    lineHeight: 34,
    marginTop: 14,
  },
  flex: { flex: 1 },
  usually: { fontFamily: fonts.interMedium, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
