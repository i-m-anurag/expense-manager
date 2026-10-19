import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Txt } from '../../components/Txt';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { useTheme } from '../../theme/ThemeProvider';
import { OnboardingLayout } from '../OnboardingLayout';
import { useOnboarding } from '../OnboardingContext';
import { useNextStep } from '../flow';
import { sampleScan } from '../sampleScan';

const SIZE = 180;
const R = 80;
const CIRC = 2 * Math.PI * R;
const DURATION = 2600;

// Simulated until the native SMS module (M0) and parser engine (M1) land; the
// real scan will report progress from readInbox() in the same shape.
export function ScanScreen() {
  const { c } = useTheme();
  const reduceMotion = useReduceMotion();
  const { applyScan } = useOnboarding();
  const next = useNextStep('Scan');
  const [progress, setProgress] = useState(0);
  const done = progress >= 1;

  useEffect(() => {
    if (reduceMotion) {
      setProgress(1);
      return;
    }
    const start = Date.now();
    const id = setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / DURATION);
      setProgress(p);
      if (p >= 1) {
        clearInterval(id);
      }
    }, 40);
    return () => clearInterval(id);
  }, [reduceMotion]);

  useEffect(() => {
    if (done) {
      applyScan();
    }
    // applyScan is stable in behaviour; only run once when the scan finishes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const txns = Math.round(sampleScan.transactionCount * progress);
  const accounts = Math.min(
    sampleScan.accounts.length,
    Math.ceil(progress * sampleScan.accounts.length * 1.1),
  );
  const pct = Math.round(progress * 100);

  return (
    <OnboardingLayout
      stage={1}
      centered
      onSkip={() => {
        applyScan();
        next();
      }}
      cta="See what we found"
      ctaDisabled={!done}
      onCta={() => next()}
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
            <Circle
              cx={90}
              cy={90}
              r={R}
              fill="none"
              stroke={c.gold}
              strokeWidth={8}
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * (1 - progress)}
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
            {done ? 'All done' : 'Reading your messages'}
          </Txt>
          <Txt
            variant="bodySemi"
            tone="gold"
            center
            accessibilityLiveRegion="polite"
            style={styles.counts}
          >
            {txns} transactions · {accounts}{' '}
            {accounts === 1 ? 'account' : 'accounts'} found
          </Txt>
          <Txt variant="label" tone="secondary" center style={styles.note}>
            This stays on your phone. Usually under a minute.
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
