import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Amount } from '../../components/Amount';
import { Card } from '../../components/Card';
import { Txt } from '../../components/Txt';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { useTheme } from '../../theme/ThemeProvider';
import { groupINR } from '../../utils/format';
import { OnboardingLayout } from '../OnboardingLayout';
import { useNextStep } from '../flow';
import { sampleScan } from '../sampleScan';

const CHART_H = 150;

export function SummaryScreen() {
  const { c } = useTheme();
  const next = useNextStep('Summary');
  const reduceMotion = useReduceMotion();
  const grow = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(grow, {
      toValue: 1,
      duration: reduceMotion ? 0 : 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [grow, reduceMotion]);

  const max = Math.max(...sampleScan.months.map(m => m.total));
  const avg = sampleScan.averages;
  const top = (Object.keys(avg) as (keyof typeof avg)[]).reduce((a, b) =>
    avg[a] >= avg[b] ? a : b,
  );
  const topLabel = {
    need: 'Needs',
    want: 'Wants',
    investment: 'Investments',
    loan: 'EMIs',
  }[top];
  const rows = [
    { n: 'Need', color: c.bucket.need, v: avg.need },
    { n: 'Want', color: c.bucket.want, v: avg.want },
    { n: 'Investment', color: c.bucket.investment, v: avg.investment },
    { n: 'Loan / EMI', color: c.bucket.loan, v: avg.loan },
  ];

  return (
    <OnboardingLayout
      stage={1}
      onSkip={() => next()}
      cta="Looks right"
      onCta={() => next()}
    >
      <Txt variant="h1" accessibilityRole="header">
        Here's where your money went
      </Txt>
      <Txt tone="secondary" style={styles.mt8}>
        You spent about ₹{groupINR(sampleScan.averageMonthlySpend)} a month,
        mostly on {topLabel}.
      </Txt>

      <Card style={styles.mt18}>
        <View style={styles.chart}>
          {sampleScan.months.map(m => (
            <View
              key={m.label}
              style={styles.col}
              accessible
              accessibilityLabel={`${m.label}: ${groupINR(m.total)} rupees`}
            >
              <Animated.View
                style={[
                  styles.bar,
                  {
                    height: (m.total / max) * (CHART_H - 26),
                    transform: [{ scaleY: grow }],
                  },
                ]}
              >
                <View
                  style={{ flex: m.need, backgroundColor: c.bucket.need }}
                />
                <View
                  style={{ flex: m.want, backgroundColor: c.bucket.want }}
                />
                <View
                  style={{
                    flex: m.investment,
                    backgroundColor: c.bucket.investment,
                  }}
                />
                <View
                  style={{ flex: m.loan, backgroundColor: c.bucket.loan }}
                />
              </Animated.View>
              <Txt variant="caption" tone="secondary" style={styles.medium}>
                {m.label}
              </Txt>
            </View>
          ))}
        </View>
      </Card>

      <Card style={[styles.mt14, styles.avgCard]}>
        <Txt variant="caption" tone="tertiary" style={styles.avgHead}>
          Average per month
        </Txt>
        {rows.map((r, i) => (
          <View
            key={r.n}
            style={[
              styles.avgRow,
              i > 0 && { borderTopWidth: 1, borderTopColor: c.border },
            ]}
          >
            <View style={[styles.swatch, { backgroundColor: r.color }]} />
            <Txt variant="bodyMedium" style={styles.flex}>
              {r.n}
            </Txt>
            <Amount value={r.v} size={16} />
          </View>
        ))}
      </Card>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  mt8: { marginTop: 8 },
  mt14: { marginTop: 14 },
  mt18: { marginTop: 18 },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: CHART_H,
  },
  col: { alignItems: 'center', gap: 8 },
  // Stack from the bottom (Need first) and grow upwards from the baseline.
  bar: {
    width: 56,
    borderRadius: 10,
    overflow: 'hidden',
    flexDirection: 'column-reverse',
    gap: 2,
    transformOrigin: 'bottom',
  },
  medium: { fontFamily: 'Inter-Medium' },
  avgCard: { paddingVertical: 4 },
  avgHead: { fontFamily: 'Inter-Medium', paddingTop: 12, paddingBottom: 4 },
  avgRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  swatch: { width: 10, height: 10, borderRadius: 5 },
  flex: { flex: 1 },
});
