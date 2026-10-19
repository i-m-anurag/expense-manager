import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '../../components/Card';
import { Icon } from '../../components/Icon';
import { Toggle } from '../../components/Toggle';
import { Txt } from '../../components/Txt';
import { useTheme } from '../../theme/ThemeProvider';
import { fonts } from '../../theme/tokens';
import { useOnboarding } from '../OnboardingContext';
import { OnboardingLayout } from '../OnboardingLayout';
import { useNextStep } from '../flow';

const LENGTH = 4;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

// ONB-10. PIN is held in onboarding state for now; it moves to Keystore-backed
// storage with the encrypted database (SEC-02/03).
export function LockScreen() {
  const { c } = useTheme();
  const { state, update } = useOnboarding();
  const next = useNextStep('Lock');
  const [first, setFirst] = useState<string | null>(state.pin);
  const [entry, setEntry] = useState(state.pin ?? '');
  const [mismatch, setMismatch] = useState(false);
  const confirming = first !== null && state.pin === null;
  const set = state.pin !== null;

  const press = (k: string) => {
    if (set) {
      return;
    }
    if (k === 'del') {
      setEntry(e => e.slice(0, -1));
      return;
    }
    const value = (entry + k).slice(0, LENGTH);
    setEntry(value);
    setMismatch(false);
    if (value.length < LENGTH) {
      return;
    }
    if (first === null) {
      setFirst(value);
      setEntry('');
    } else if (value === first) {
      update({ pin: value });
    } else {
      setMismatch(true);
      setFirst(null);
      setEntry('');
    }
  };

  const reset = () => {
    update({ pin: null });
    setFirst(null);
    setEntry('');
  };

  const subtitle = set
    ? 'PIN set'
    : mismatch
    ? "PINs didn't match. Try again."
    : confirming
    ? 'Enter it again to confirm'
    : `Set a ${LENGTH}-digit PIN`;

  const filled = set ? LENGTH : entry.length;

  return (
    <OnboardingLayout
      stage={3}
      onSkip={() => next({ pin: null, biometric: false })}
      cta="Continue"
      ctaDisabled={!set}
      onCta={() => next()}
      ghost={set ? 'Change PIN' : undefined}
      onGhost={reset}
    >
      <Txt variant="h1" center accessibilityRole="header">
        Lock the app
      </Txt>
      <Txt
        center
        tone={mismatch ? undefined : 'secondary'}
        color={mismatch ? c.status.over : undefined}
        accessibilityLiveRegion="polite"
        style={styles.mt8}
      >
        {subtitle}
      </Txt>

      <View
        style={styles.dots}
        accessible
        accessibilityLabel={`${filled} of ${LENGTH} digits entered`}
      >
        {Array.from({ length: LENGTH }, (_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i < filled
                ? { backgroundColor: c.gold }
                : { borderWidth: 1.5, borderColor: c.textTertiary },
            ]}
          />
        ))}
      </View>

      <View style={styles.pad}>
        {KEYS.map((k, i) =>
          k === '' ? (
            <View key={i} style={styles.key} />
          ) : (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={k === 'del' ? 'Delete' : k}
              onPress={() => press(k)}
              disabled={set}
              style={({ pressed }) => [
                styles.key,
                k !== 'del' && {
                  backgroundColor: c.surface,
                  borderWidth: 1,
                  borderColor: c.border,
                },
                pressed && { backgroundColor: c.goldTint },
                set && styles.disabled,
              ]}
            >
              {k === 'del' ? (
                <Icon name="backspace" size={26} color={c.textPrimary} />
              ) : (
                <Text style={[styles.keyText, { color: c.textPrimary }]}>
                  {k}
                </Text>
              )}
            </Pressable>
          ),
        )}
      </View>

      <View style={styles.spacer} />
      <Card style={styles.bio}>
        <Icon name="fingerprint" size={24} color={c.goldText} />
        <Txt variant="bodyMedium" style={styles.flex}>
          Use fingerprint too
        </Txt>
        <Toggle
          value={state.biometric}
          onChange={v => update({ biometric: v })}
          label="Use fingerprint to unlock"
        />
      </Card>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  mt8: { marginTop: 8 },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 18,
    marginTop: 28,
  },
  dot: { width: 16, height: 16, borderRadius: 8 },
  pad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: 28,
    rowGap: 14,
    marginTop: 32,
    width: 72 * 3 + 28 * 2,
    alignSelf: 'center',
  },
  key: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: { fontFamily: fonts.manropeSemiBold, fontSize: 26 },
  disabled: { opacity: 0.5 },
  spacer: { flexGrow: 1, minHeight: 24 },
  bio: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  flex: { flex: 1 },
});
