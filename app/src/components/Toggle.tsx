import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { motion } from '../theme/tokens';

interface Props {
  value: boolean;
  onChange: (next: boolean) => void;
  label: string; // accessibility label
}

// 44×26 switch from the design, wrapped in a 48dp touch target.
export function Toggle({ value, onChange, label }: Props) {
  const { c } = useTheme();
  const x = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(x, {
      toValue: value ? 1 : 0,
      duration: motion.duration,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [value, x]);
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      hitSlop={11}
      style={[styles.track, { backgroundColor: value ? c.gold : c.border }]}
    >
      <Animated.View
        style={[
          styles.knob,
          {
            backgroundColor: value ? c.onGold : c.textTertiary,
            transform: [
              {
                translateX: x.interpolate({
                  inputRange: [0, 1],
                  outputRange: [3, 21],
                }),
              },
            ],
          },
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { width: 44, height: 26, borderRadius: 13, justifyContent: 'center' },
  knob: { width: 20, height: 20, borderRadius: 10 },
});
