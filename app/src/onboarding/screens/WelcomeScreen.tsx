import React, { useRef, useState } from 'react';
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { Card } from '../../components/Card';
import { Icon } from '../../components/Icon';
import { Txt } from '../../components/Txt';
import { useTheme } from '../../theme/ThemeProvider';
import { screenPadding } from '../../theme/tokens';
import { OnboardingLayout } from '../OnboardingLayout';
import { useNextStep } from '../flow';

const PROMISES = [
  { h: 'Open source', b: 'Read every line of code on GitHub.' },
  {
    h: 'No internet access',
    b: 'The app cannot send data out, even if it wanted to.',
  },
  { h: 'No ads, ever', b: 'No trackers, no profiles, no selling.' },
];

export function WelcomeScreen() {
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const list = useRef<FlatList>(null);
  const next = useNextStep('Welcome');
  const last = page === 2;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const p = Math.round(e.nativeEvent.contentOffset.x / width);
    if (p !== page) {
      setPage(p);
    }
  };

  return (
    <OnboardingLayout
      cta={last ? 'Get started' : 'Next'}
      onCta={() =>
        last ? next() : list.current?.scrollToIndex({ index: page + 1 })
      }
      ghost={last ? undefined : 'Skip intro'}
      onGhost={() => next()}
      dots={[page, 3]}
      scroll={false}
    >
      <FlatList
        ref={list}
        style={styles.pager}
        data={[0, 1, 2]}
        keyExtractor={i => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
        renderItem={({ item }) => (
          <View style={[styles.page, { width }]}>
            {item === 0 ? (
              <WelcomeOne />
            ) : item === 1 ? (
              <WelcomeTwo />
            ) : (
              <WelcomeThree />
            )}
          </View>
        )}
      />
    </OnboardingLayout>
  );
}

function WelcomeOne() {
  const { c } = useTheme();
  const bars = [
    { h: 1, color: c.bucket.need },
    { h: 0.72, color: c.bucket.want },
    { h: 0.52, color: c.bucket.investment },
    { h: 0.36, color: c.bucket.loan },
    { h: 0.2, color: c.gold },
  ];
  return (
    <View style={styles.stack28}>
      <View style={styles.bars} accessible={false}>
        {bars.map((b, i) => (
          <View
            key={i}
            style={[
              styles.bar,
              { height: 120 * b.h, backgroundColor: b.color },
            ]}
          />
        ))}
      </View>
      <View>
        <Txt variant="overline" tone="gold" style={styles.brand}>
          Expense Manager
        </Txt>
        <Txt variant="display" accessibilityRole="header" style={styles.mt14}>
          Every rupee, in its place.
        </Txt>
        <Txt tone="secondary" style={styles.mt14}>
          Your bank SMS, turned into a calm budget. Made for salaried life in
          India.
        </Txt>
      </View>
    </View>
  );
}

function WelcomeTwo() {
  const { c } = useTheme();
  return (
    <View style={styles.stack28}>
      <View style={[styles.badge, { backgroundColor: c.goldTint }]}>
        <Icon name="lock" size={44} color={c.goldText} />
      </View>
      <Txt variant="title" accessibilityRole="header">
        Your SMS never leaves your phone
      </Txt>
      <Txt tone="secondary">
        Messages are read and understood on this device. Nothing is uploaded,
        shared or stored anywhere else.
      </Txt>
    </View>
  );
}

function WelcomeThree() {
  const { c } = useTheme();
  return (
    <View style={styles.stack24}>
      <Txt variant="title" accessibilityRole="header">
        {'Open source.\nNo internet access.\nNo ads.'}
      </Txt>
      <View style={styles.promises}>
        {PROMISES.map(p => (
          <Card key={p.h} style={styles.promise}>
            <View style={[styles.tick, { backgroundColor: c.goldTint }]}>
              <Icon name="check" size={20} color={c.goldText} strokeWidth={2} />
            </View>
            <View style={styles.flex}>
              <Txt variant="bodySemi">{p.h}</Txt>
              <Txt variant="label" tone="secondary" style={styles.promiseBody}>
                {p.b}
              </Txt>
            </View>
          </Card>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pager: { marginHorizontal: -screenPadding },
  page: { paddingHorizontal: screenPadding, justifyContent: 'center' },
  stack28: { gap: 28 },
  stack24: { gap: 24 },
  bars: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', height: 120 },
  bar: { width: 44, borderRadius: 12 },
  brand: { fontFamily: 'Manrope-Bold', fontSize: 13, letterSpacing: 2 },
  mt14: { marginTop: 14 },
  badge: {
    width: 88,
    height: 88,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promises: { gap: 12 },
  promise: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  tick: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
  promiseBody: { fontFamily: 'Inter-Regular', marginTop: 2 },
});
