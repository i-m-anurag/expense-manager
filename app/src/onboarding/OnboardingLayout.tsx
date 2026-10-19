import React from 'react';
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Txt } from '../components/Txt';
import { useTheme } from '../theme/ThemeProvider';
import { screenPadding } from '../theme/tokens';

export const STAGES = ['Privacy', 'Scan', 'Accounts', 'Budget'] as const;

interface Props {
  children: React.ReactNode;
  // Index into STAGES; omitted on the welcome screens. 'all' fills every stage.
  stage?: number | 'all';
  onSkip?: () => void;
  cta: string;
  onCta: () => void;
  ctaDisabled?: boolean;
  ghost?: string;
  onGhost?: () => void;
  ghostKind?: 'ghost' | 'secondary';
  // Pager dots for the welcome screens: [active index, count].
  dots?: [number, number];
  // Content that centres vertically (welcome, scan, done) instead of top-aligning.
  centered?: boolean;
  scroll?: boolean;
}

export function OnboardingLayout({
  children,
  stage,
  onSkip,
  cta,
  onCta,
  ctaDisabled,
  ghost,
  onGhost,
  ghostKind = 'ghost',
  dots,
  centered,
  scroll = true,
}: Props) {
  const { c, name } = useTheme();
  const insets = useSafeAreaInsets();
  const body = (
    <View style={[styles.body, centered && styles.centered]}>{children}</View>
  );
  return (
    <View
      style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}
    >
      <StatusBar
        barStyle={name === 'dark' ? 'light-content' : 'dark-content'}
      />
      {stage !== undefined && <StageProgress stage={stage} onSkip={onSkip} />}
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {body}
        </ScrollView>
      ) : (
        body
      )}
      <View
        style={[
          styles.footer,
          { paddingBottom: Math.max(insets.bottom, 12) + 16 },
        ]}
      >
        <Button label={cta} onPress={onCta} disabled={ctaDisabled} />
        {ghost && onGhost ? (
          <Button label={ghost} onPress={onGhost} kind={ghostKind} />
        ) : null}
        {dots ? <PagerDots active={dots[0]} count={dots[1]} /> : null}
      </View>
    </View>
  );
}

function StageProgress({
  stage,
  onSkip,
}: {
  stage: number | 'all';
  onSkip?: () => void;
}) {
  const { c } = useTheme();
  const current = stage === 'all' ? STAGES.length - 1 : stage;
  return (
    <View style={styles.progress}>
      <View style={styles.progressTop}>
        <Txt variant="caption" tone="secondary" style={styles.stepLabel}>
          Step {current + 1} of {STAGES.length} ·{' '}
          <Txt variant="caption" tone="gold" style={styles.stepLabel}>
            {STAGES[current]}
          </Txt>
        </Txt>
        {onSkip ? (
          <Pressable
            accessibilityRole="button"
            onPress={onSkip}
            hitSlop={12}
            style={styles.skip}
          >
            <Txt variant="label" tone="gold">
              Skip
            </Txt>
          </Pressable>
        ) : null}
      </View>
      <View
        style={styles.stages}
        accessibilityLabel={`Stage ${current + 1} of 4, ${STAGES[current]}`}
      >
        {STAGES.map((n, i) => {
          const filled = stage === 'all' || i <= current;
          const active = stage !== 'all' && i === current;
          return (
            <View key={n} style={styles.stage}>
              <View
                style={[
                  styles.stageBar,
                  { backgroundColor: filled ? c.gold : c.border },
                ]}
              />
              <Txt
                variant="caption"
                color={active ? c.goldText : c.textTertiary}
                style={styles.stageName}
              >
                {n}
              </Txt>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function PagerDots({ active, count }: { active: number; count: number }) {
  const { c } = useTheme();
  return (
    <View
      style={styles.dots}
      accessibilityLabel={`Page ${active + 1} of ${count}`}
    >
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              width: i === active ? 20 : 6,
              backgroundColor: i === active ? c.gold : c.border,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  body: { flexGrow: 1, paddingHorizontal: screenPadding, paddingTop: 8 },
  centered: { justifyContent: 'center' },
  footer: { paddingHorizontal: screenPadding, paddingTop: 12, gap: 8 },
  progress: { paddingHorizontal: screenPadding, paddingTop: 8, minHeight: 52 },
  progressTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 20,
  },
  stepLabel: { fontFamily: 'Inter-Medium' },
  skip: { paddingVertical: 8, paddingLeft: 16 },
  stages: { flexDirection: 'row', gap: 6, marginTop: 8 },
  stage: { flex: 1 },
  stageBar: { height: 4, borderRadius: 2 },
  stageName: { fontFamily: 'Inter-Medium', fontSize: 11, marginTop: 5 },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 4,
  },
  dot: { height: 6, borderRadius: 3 },
});
