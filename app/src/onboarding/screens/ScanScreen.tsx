import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Txt } from '../../components/Txt';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { ScanProgress, scanInbox } from '../../sms/scan';
import { useTheme } from '../../theme/ThemeProvider';
import { OnboardingLayout } from '../OnboardingLayout';
import { useOnboarding } from '../OnboardingContext';
import { useNextStep } from '../flow';

const SIZE = 180;
const R = 80;
const CIRC = 2 * Math.PI * R;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Phase = 'scanning' | 'done' | 'error';

// PRD ONB-04: scan the last 90 days of bank SMS with live counters.
export function ScanScreen() {
  const { c } = useTheme();
  const reduceMotion = useReduceMotion();
  const { applyScan } = useOnboarding();
  const next = useNextStep('Scan');
  const [phase, setPhase] = useState<Phase>('scanning');
  const [progress, setProgress] = useState<ScanProgress>({
    read: 0,
    total: 0,
    transactions: 0,
    accounts: 0,
  });
  const ring = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    scanInbox(p => !cancelled && setProgress(p))
      .then(outcome => {
        if (cancelled) {
          return;
        }
        applyScan(outcome.summary);
        setProgress(p => ({
          ...p,
          transactions: outcome.summary.transactionCount,
          accounts: outcome.summary.accounts.length,
        }));
        setPhase('done');
      })
      .catch(() => !cancelled && setPhase('error'));
    return () => {
      cancelled = true;
    };
    // applyScan only writes state; run the scan once per visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fraction =
    phase === 'scanning'
      ? progress.total
        ? progress.read / progress.total
        : 0
      : 1;

  useEffect(() => {
    Animated.timing(ring, {
      toValue: fraction,
      duration: reduceMotion ? 0 : 300,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [fraction, reduceMotion, ring]);

  const pct = Math.round(fraction * 100);
  const { transactions, accounts } = progress;
  const title =
    phase === 'error'
      ? "Couldn't read your messages"
      : phase === 'done'
      ? transactions
        ? 'All done'
        : 'No bank messages found'
      : 'Reading your messages';
  const subtitle =
    phase === 'error'
      ? 'You can continue and add payments yourself.'
      : phase === 'done' && !transactions
      ? 'We support HDFC, ICICI, SBI, Axis and Bank of India. You can add payments yourself.'
      : 'This stays on your phone. Usually under a minute.';

  return (
    <OnboardingLayout
      stage={1}
      centered
      onSkip={phase === 'scanning' ? undefined : () => next()}
      cta={transactions ? 'See what we found' : 'Continue'}
      ctaDisabled={phase === 'scanning'}
      onCta={() => next(phase === 'error' ? { manualMode: true } : undefined)}
    >
      <View style={styles.wrap}>
        <View
          style={styles.ring}
          accessible
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: 100, now: pct }}
        >
          <Svg width={SIZE} height={SIZE} style={styles.rotate}>
            <Circle
              cx={90}
              cy={90}
              r={R}
              fill="none"
              stroke={c.border}
              strokeWidth={8}
            />
            <AnimatedCircle
              cx={90}
              cy={90}
              r={R}
              fill="none"
              stroke={c.gold}
              strokeWidth={8}
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={ring.interpolate({
                inputRange: [0, 1],
                outputRange: [CIRC, 0],
              })}
            />
          </Svg>
          <View style={styles.ringLabel}>
            <Txt style={styles.pct}>{pct}%</Txt>
            <Txt variant="caption" tone="secondary">
              of inbox scanned
            </Txt>
          </View>
        </View>
        <View>
          <Txt variant="h1" center accessibilityRole="header">
            {title}
          </Txt>
          {phase !== 'error' ? (
            <Txt
              variant="bodySemi"
              tone="gold"
              center
              accessibilityLiveRegion="polite"
              style={styles.counts}
            >
              {transactions} transactions · {accounts}{' '}
              {accounts === 1 ? 'account' : 'accounts'} found
            </Txt>
          ) : null}
          <Txt variant="label" tone="secondary" center style={styles.note}>
            {subtitle}
          </Txt>
        </View>
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 28 },
  ring: { width: SIZE, height: SIZE },
  rotate: { transform: [{ rotate: '-90deg' }] },
  ringLabel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pct: { fontFamily: 'Manrope-Bold', fontSize: 40, lineHeight: 46 },
  counts: { fontSize: 16, marginTop: 10 },
  note: { fontFamily: 'Inter-Regular', marginTop: 8 },
});
