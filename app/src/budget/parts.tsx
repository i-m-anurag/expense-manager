import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Icon, IconName } from '../components/Icon';
import type { Bucket, BucketStatus } from '../domain/budget';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { useTheme } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';

export const BUCKET_META: Record<Bucket, { label: string; icon: IconName }> = {
  need: { label: 'Need', icon: 'home' },
  want: { label: 'Want', icon: 'sparkle' },
  investment: { label: 'Investment', icon: 'trendingUp' },
  loan: { label: 'Loan / EMI', icon: 'repeat' },
};

// Brief §4.2: every status has an icon and a label, never colour alone.
export function useStatusMeta() {
  const { c } = useTheme();
  return (status: BucketStatus) =>
    ({
      onTrack: {
        label: 'On track',
        color: c.status.onTrack,
        icon: 'check' as IconName,
      },
      watch: {
        label: 'Watch',
        color: c.status.watch,
        icon: 'alert' as IconName,
      },
      over: { label: 'Over', color: c.status.over, icon: 'alert' as IconName },
      paid: {
        label: 'Paid',
        color: c.textSecondary,
        icon: 'check' as IconName,
      },
    }[status]);
}

export function StatusLabel({
  status,
  small,
}: {
  status: BucketStatus;
  small?: boolean;
}) {
  const meta = useStatusMeta()(status);
  return (
    <View style={styles.status}>
      <Icon
        name={meta.icon}
        size={small ? 12 : 14}
        strokeWidth={2}
        color={meta.color}
      />
      <Text
        style={[
          styles.statusText,
          small && styles.statusSmall,
          { color: meta.color },
        ]}
      >
        {meta.label}
      </Text>
    </View>
  );
}

// Progress bar with the pace tick (brief §7.3). Fills once on mount.
export function PaceBar({
  used,
  pace,
  status,
  color,
  height = 8,
  showTick = true,
}: {
  used: number;
  pace: number;
  status: BucketStatus;
  color: string;
  height?: number;
  showTick?: boolean;
}) {
  const { c } = useTheme();
  const reduceMotion = useReduceMotion();
  const fill = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(fill, {
      toValue: 1,
      duration: reduceMotion ? 0 : 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [fill, reduceMotion]);
  const barColor =
    status === 'over'
      ? c.status.over
      : status === 'watch'
      ? c.status.watch
      : status === 'paid'
      ? c.bucket.loan
      : color;
  return (
    <View
      style={[
        styles.track,
        { height, borderRadius: height / 2, backgroundColor: c.border },
      ]}
    >
      <Animated.View
        style={[
          styles.fill,
          {
            width: `${Math.min(100, used * 100)}%`,
            height,
            borderRadius: height / 2,
            backgroundColor: barColor,
            transform: [{ scaleX: fill }],
          },
        ]}
      />
      {showTick ? (
        <View
          style={[
            styles.tick,
            {
              left: `${Math.min(100, pace * 100)}%`,
              height: height + 6,
              top: -3,
              backgroundColor: c.textPrimary,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

export function Ring({
  size,
  stroke,
  progress,
  children,
}: {
  size: number;
  stroke: number;
  progress: number;
  children?: React.ReactNode;
}) {
  const { c } = useTheme();
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={styles.rotate}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={c.border}
          strokeWidth={stroke}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={c.gold}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - Math.max(0, Math.min(1, progress)))}
        />
      </Svg>
      <View style={styles.ringCenter}>{children}</View>
    </View>
  );
}

export function BucketIcon({
  bucket,
  size = 32,
}: {
  bucket: Bucket;
  size?: number;
}) {
  const { c } = useTheme();
  const color = c.bucket[bucket];
  return (
    <View
      style={[
        styles.iconTile,
        {
          width: size,
          height: size,
          borderRadius: size * 0.31,
          backgroundColor: color + '22',
        },
      ]}
    >
      <Icon name={BUCKET_META[bucket].icon} size={size * 0.56} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  status: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusText: { fontFamily: fonts.interMedium, fontSize: 12 },
  statusSmall: { fontSize: 11 },
  track: { position: 'relative', overflow: 'visible' },
  fill: { transformOrigin: 'left' },
  tick: { position: 'absolute', width: 2, borderRadius: 1, opacity: 0.85 },
  rotate: { transform: [{ rotate: '-90deg' }] },
  ringCenter: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconTile: { alignItems: 'center', justifyContent: 'center' },
});
