import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { useTheme } from '../theme/ThemeProvider';
import { radius, screenPadding } from '../theme/tokens';

interface Props {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  accessibilityLabel?: string;
}

// Bottom sheet (brief §6: 28 top corners, slides up with a slight spring).
export function Sheet({
  visible,
  onClose,
  children,
  accessibilityLabel,
}: Props) {
  const { c, name } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const y = useRef(new Animated.Value(height)).current;

  useEffect(() => {
    if (!visible) {
      return;
    }
    y.setValue(height);
    if (reduceMotion) {
      y.setValue(0);
      return;
    }
    Animated.spring(y, {
      toValue: 0,
      damping: 22,
      stiffness: 220,
      mass: 0.9,
      useNativeDriver: true,
    }).start();
  }, [visible, height, reduceMotion, y]);

  const close = () => {
    if (reduceMotion) {
      onClose();
      return;
    }
    Animated.timing(y, {
      toValue: height,
      duration: 200,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(onClose);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={close}
    >
      <Pressable
        style={styles.backdrop}
        onPress={close}
        accessibilityRole="button"
        accessibilityLabel="Close"
      />
      <Animated.View
        accessibilityViewIsModal
        accessibilityLabel={accessibilityLabel}
        style={[
          styles.sheet,
          {
            backgroundColor: c.surfaceRaised,
            borderColor: c.border,
            paddingBottom: Math.max(insets.bottom, 12) + 16,
            transform: [{ translateY: y }],
          },
          name === 'light' && styles.lightShadow,
        ]}
      >
        <View style={[styles.handle, { backgroundColor: c.border }]} />
        {children}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(5,8,18,0.6)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderTopWidth: 1,
    paddingTop: 12,
    paddingHorizontal: screenPadding,
    maxHeight: '90%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  lightShadow: {
    shadowColor: '#0B1020',
    shadowOpacity: 0.18,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: -8 },
    elevation: 16,
  },
});
