import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../components/Icon';
import { useTheme } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';

export const PIN_LENGTH = 4;

export function PinDots({
  filled,
  error,
}: {
  filled: number;
  error?: boolean;
}) {
  const { c } = useTheme();
  return (
    <View
      style={styles.dots}
      accessible
      accessibilityLabel={`${filled} of ${PIN_LENGTH} digits entered`}
    >
      {Array.from({ length: PIN_LENGTH }, (_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i < filled
              ? { backgroundColor: error ? c.status.over : c.gold }
              : {
                  borderWidth: 1.5,
                  borderColor: error ? c.status.over : c.textTertiary,
                },
          ]}
        />
      ))}
    </View>
  );
}

interface Props {
  onDigit: (d: string) => void;
  onDelete: () => void;
  // Shown bottom-left when fingerprint unlock is available (design 5a).
  onBiometric?: () => void;
  disabled?: boolean;
}

// PIN keypad in the app's style (brief §9.9): 76dp keys, 3 × 4 grid.
export function PinPad({ onDigit, onDelete, onBiometric, disabled }: Props) {
  const { c } = useTheme();
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'bio', '0', 'del'];
  return (
    <View style={styles.pad}>
      {keys.map(k => {
        if (k === 'bio' && !onBiometric) {
          return <View key={k} style={styles.key} />;
        }
        const plain = k === 'bio' || k === 'del';
        return (
          <Pressable
            key={k}
            disabled={disabled}
            onPress={() =>
              k === 'del'
                ? onDelete()
                : k === 'bio'
                ? onBiometric?.()
                : onDigit(k)
            }
            accessibilityRole="button"
            accessibilityLabel={
              k === 'del' ? 'Delete' : k === 'bio' ? 'Use fingerprint' : k
            }
            style={({ pressed }) => [
              styles.key,
              !plain && {
                backgroundColor: c.surface,
                borderWidth: 1,
                borderColor: c.border,
              },
              pressed && { backgroundColor: c.goldTint },
              disabled && styles.disabled,
            ]}
          >
            {k === 'del' ? (
              <Icon name="backspace" size={26} color={c.textPrimary} />
            ) : k === 'bio' ? (
              <Icon name="fingerprint" size={30} color={c.goldText} />
            ) : (
              <Text style={[styles.keyText, { color: c.textPrimary }]}>
                {k}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 18 },
  dot: { width: 16, height: 16, borderRadius: 8 },
  pad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: 28,
    rowGap: 14,
    width: 76 * 3 + 28 * 2,
    alignSelf: 'center',
  },
  key: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: { fontFamily: fonts.manropeSemiBold, fontSize: 28 },
  disabled: { opacity: 0.4 },
});
