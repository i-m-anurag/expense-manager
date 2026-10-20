import React, { useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import {
  BUCKET_META,
  BucketIcon,
  PaceBar,
  Ring,
  StatusLabel,
  useStatusMeta,
} from '../budget/parts';
import { Amount } from '../components/Amount';
import { Card } from '../components/Card';
import { Icon } from '../components/Icon';
import { Txt } from '../components/Txt';
import { usePrivacy } from '../data/Privacy';
import { useQuery } from '../data/DataProvider';
import { countUnparsed } from '../db/rawSms';
import { getSetting } from '../db/settings';
import { countUncategorized, listTxns } from '../db/transactions';
import { getBudgetSnapshot, getEmergencySnapshot } from '../domain/budget';
import { daysBetween, todayIst } from '../domain/cycle';
import { TabProps } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, radius, screenPadding } from '../theme/tokens';
import { dayLabel, initials, ordinal, timeLabel } from '../utils/format';

// Brief §9.2 / PRD INS-01.
export function HomeScreen({ navigation }: TabProps<'Home'>) {
  const { c, name } = useTheme();
  const insets = useSafeAreaInsets();
  const { hidden, toggle } = usePrivacy();
  const statusMeta = useStatusMeta();
  const userName = useQuery(s => getSetting(s, 'user_name'), []);
  const salaryDay = useQuery(s => getSetting(s, 'salary_day'), []);
  const budget = useQuery(s => getBudgetSnapshot(s), []);
  const emergency = useQuery(s => getEmergencySnapshot(s), []);
  const uncategorized = useQuery(countUncategorized, []) ?? 0;
  const unparsed = useQuery(countUnparsed, []) ?? 0;
  const recent = useQuery(s => listTxns(s, { limit: 5 }), []) ?? [];

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const today = todayIst();
  const upcoming = (budget?.commitments ?? []).filter(
    x =>
      !x.paid && x.date && x.date >= today && daysBetween(today, x.date) <= 7,
  );

  const attention = [
    uncategorized > 0 && {
      text: `${uncategorized} transaction${
        uncategorized === 1 ? '' : 's'
      } to categorize`,
      action: 'Review',
      onPress: () =>
        navigation.navigate('Transactions', { bucket: 'uncategorized' }),
    },
    unparsed > 0 && {
      text: `${unparsed} SMS couldn't be read`,
      action: 'View',
      onPress: () => navigation.navigate('UnparsedSms'),
    },
  ].filter(Boolean) as { text: string; action: string; onPress: () => void }[];

  return (
    <View
      style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}
    >
      <StatusBar
        barStyle={name === 'dark' ? 'light-content' : 'dark-content'}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.flex}>
            <Txt style={styles.greeting} accessibilityRole="header">
              {greeting}
              {userName ? `, ${userName}` : ''}
            </Txt>
            {budget ? (
              <Txt variant="label" tone="secondary" style={styles.mt4}>
                Day {budget.day} of {budget.length} ·{' '}
                {budget.cycle.mode === 'calendar'
                  ? 'resets on the 1st'
                  : `resets on salary${
                      salaryDay ? ` (${ordinal(Number(salaryDay))})` : ''
                    }`}
              </Txt>
            ) : null}
          </View>
          <Pressable
            onPress={toggle}
            accessibilityRole="switch"
            accessibilityLabel="Privacy mode, hide amounts"
            accessibilityState={{ checked: hidden }}
            style={[
              styles.roundBtn,
              { borderColor: c.border, backgroundColor: c.surface },
            ]}
          >
            <Icon
              name={hidden ? 'eyeOff' : 'eye'}
              size={22}
              color={hidden ? c.goldText : c.textSecondary}
            />
          </Pressable>
        </View>

        {budget ? (
          <>
            <HeroCard>
              <View style={styles.heroRow}>
                <View style={styles.heroCol}>
                  <Txt variant="label" tone="secondary">
                    Safe to spend today
                  </Txt>
                  <Amount
                    value={budget.safeToSpendToday / 100}
                    size={36}
                    family={fonts.manropeBold}
                    style={styles.heroNum}
                  />
                  <View style={styles.heroNote}>
                    <View
                      style={[
                        styles.dot,
                        { backgroundColor: statusMeta(budget.overall).color },
                      ]}
                    />
                    <Txt variant="caption" tone="secondary" style={styles.flex}>
                      for each of the next {budget.daysLeft} day
                      {budget.daysLeft === 1 ? '' : 's'}
                    </Txt>
                  </View>
                </View>
                <View style={[styles.vrule, { backgroundColor: c.border }]} />
                <View style={styles.heroCol}>
                  <Txt variant="label" tone="secondary">
                    {budget.left < 0 ? 'Over this cycle' : 'Left this cycle'}
                  </Txt>
                  <Amount
                    value={Math.abs(budget.left) / 100}
                    size={36}
                    family={fonts.manropeBold}
                    color={budget.left < 0 ? c.status.over : undefined}
                    style={styles.heroNum}
                  />
                  <View style={styles.heroNote}>
                    <Txt variant="caption" tone="secondary">
                      of{' '}
                    </Txt>
                    <Amount
                      value={budget.totalBudget / 100}
                      size={12}
                      family={fonts.inter}
                      color={c.textSecondary}
                    />
                    <Txt variant="caption" tone="secondary">
                      {' '}
                      budgeted
                    </Txt>
                  </View>
                </View>
              </View>
              <View style={[styles.cycleTrack, { backgroundColor: c.border }]}>
                <View
                  style={[
                    styles.cycleFill,
                    {
                      width: `${(budget.day / budget.length) * 100}%`,
                      backgroundColor: c.gold,
                    },
                  ]}
                />
              </View>
            </HeroCard>
            <Txt variant="label" tone="secondary" style={styles.insight}>
              {budget.insight}
            </Txt>

            <SectionHead
              title="Your buckets"
              action="See budget"
              onPress={() => navigation.navigate('Budget')}
            />
            <Card style={styles.listCard}>
              {budget.buckets.map((b, i) => (
                <View
                  key={b.bucket}
                  style={[
                    styles.bucket,
                    i > 0 && { borderTopWidth: 1, borderTopColor: c.border },
                  ]}
                >
                  <View style={styles.bucketTop}>
                    <View style={styles.bucketName}>
                      <BucketIcon bucket={b.bucket} />
                      <Txt variant="bodySemi">
                        {BUCKET_META[b.bucket].label}
                      </Txt>
                    </View>
                    <StatusLabel status={b.status} />
                  </View>
                  <View style={styles.bucketAmt}>
                    <Amount
                      value={Math.abs(b.left) / 100}
                      size={22}
                      color={b.left < 0 ? c.status.over : undefined}
                    />
                    <Txt
                      variant="label"
                      tone="secondary"
                      style={styles.regular}
                    >
                      {b.left < 0 ? ' over · ' : ' left of '}
                    </Txt>
                    <Amount
                      value={b.allocated / 100}
                      size={13}
                      family={fonts.inter}
                      color={c.textSecondary}
                    />
                  </View>
                  <View style={styles.mt10}>
                    <PaceBar
                      used={b.used}
                      pace={b.pace}
                      status={b.status}
                      color={c.bucket[b.bucket]}
                      showTick={b.bucket === 'need' || b.bucket === 'want'}
                    />
                  </View>
                </View>
              ))}
              <Txt variant="caption" tone="tertiary" style={styles.footnote}>
                Tick marks where spending should be by today.
              </Txt>
            </Card>
          </>
        ) : null}

        {emergency ? (
          <Pressable
            onPress={() => navigation.navigate('EmergencyFund')}
            accessibilityRole="button"
          >
            <Card style={styles.emergency}>
              <Ring
                size={64}
                stroke={5}
                progress={
                  emergency.targetMonths
                    ? emergency.monthsCovered / emergency.targetMonths
                    : 0
                }
              >
                <Icon name="shield" size={22} color={c.goldText} />
              </Ring>
              <View style={styles.flex}>
                <Txt variant="label" tone="secondary">
                  Emergency fund
                </Txt>
                <Amount
                  value={emergency.balance / 100}
                  size={22}
                  style={styles.mt2}
                />
                <Txt variant="label" tone="gold" style={styles.mt2}>
                  {emergency.monthsCovered.toFixed(1)} of{' '}
                  {emergency.targetMonths} months covered
                </Txt>
              </View>
              <Icon name="chevronRight" size={18} color={c.textTertiary} />
            </Card>
          </Pressable>
        ) : null}

        {attention.length ? (
          <>
            <SectionHead title="Needs your attention" />
            <Card style={styles.listCard}>
              {attention.map((a, i) => (
                <Pressable
                  key={a.text}
                  onPress={a.onPress}
                  accessibilityRole="button"
                  style={[
                    styles.attnRow,
                    i > 0 && { borderTopWidth: 1, borderTopColor: c.border },
                  ]}
                >
                  <View style={[styles.dot, { backgroundColor: c.gold }]} />
                  <Txt variant="bodyMedium" style={styles.flex}>
                    {a.text}
                  </Txt>
                  <Txt variant="label" tone="gold">
                    {a.action}
                  </Txt>
                </Pressable>
              ))}
            </Card>
          </>
        ) : null}

        <SectionHead
          title="Recent"
          action="See all"
          onPress={() => navigation.navigate('Transactions')}
        />
        {recent.length ? (
          <Card style={styles.listCard}>
            {recent.map((t, i) => {
              const merchant = t.merchant_name ?? t.merchant_raw ?? 'Payment';
              const credit = t.direction === 'credit';
              return (
                <Pressable
                  key={t.id}
                  onPress={() =>
                    navigation.navigate('TransactionDetail', { id: t.id })
                  }
                  accessibilityRole="button"
                  style={[
                    styles.recentRow,
                    i > 0 && { borderTopWidth: 1, borderTopColor: c.border },
                  ]}
                >
                  <View
                    style={[
                      styles.avatar,
                      {
                        backgroundColor: c.surfaceRaised,
                        borderColor: c.border,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.avatarText, { color: c.textSecondary }]}
                    >
                      {initials(merchant)}
                    </Text>
                  </View>
                  <View style={styles.flex}>
                    <Txt variant="bodyMedium" numberOfLines={1}>
                      {merchant}
                    </Txt>
                    <Txt
                      variant="caption"
                      tone="tertiary"
                      numberOfLines={1}
                      style={styles.mt2}
                    >
                      {dayLabel(t.occurred_at)}
                      {dayLabel(t.occurred_at) === 'Today'
                        ? `, ${timeLabel(t.occurred_at)}`
                        : ''}
                      {t.account_name ? ` · ${t.account_name}` : ''}
                    </Txt>
                  </View>
                  <Amount
                    value={t.amount / 100}
                    sign={credit ? '+' : '−'}
                    color={credit ? c.status.onTrack : undefined}
                  />
                </Pressable>
              );
            })}
          </Card>
        ) : (
          <Txt tone="secondary">No transactions yet. Tap + to add one.</Txt>
        )}

        {upcoming.length ? (
          <>
            <SectionHead title="Upcoming · next 7 days" />
            <Card style={styles.listCard}>
              {upcoming.map((u, i) => {
                const days = daysBetween(today, u.date!);
                return (
                  <View
                    key={u.key}
                    style={[
                      styles.recentRow,
                      i > 0 && { borderTopWidth: 1, borderTopColor: c.border },
                    ]}
                  >
                    <View
                      style={[
                        styles.upIcon,
                        {
                          backgroundColor: c.surfaceRaised,
                          borderColor: c.border,
                        },
                      ]}
                    >
                      <Icon name="repeat" size={20} color={c.textSecondary} />
                    </View>
                    <View style={styles.flex}>
                      <Txt variant="bodyMedium">{u.name}</Txt>
                      <Txt variant="caption" tone="tertiary" style={styles.mt2}>
                        {days === 0
                          ? 'Today'
                          : days === 1
                          ? 'Tomorrow'
                          : `In ${days} days`}
                      </Txt>
                    </View>
                    <Amount value={u.amount / 100} />
                  </View>
                );
              })}
            </Card>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

// The one card allowed a gold gradient border (brief §3).
function HeroCard({ children }: { children: React.ReactNode }) {
  const { c } = useTheme();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) =>
    setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  return (
    <View style={styles.hero} onLayout={onLayout}>
      {size.w ? (
        <Svg width={size.w} height={size.h} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#F0D9A0" />
              <Stop offset="0.45" stopColor="#D4AF6A" />
              <Stop offset="1" stopColor="#D4AF6A" stopOpacity="0.25" />
            </LinearGradient>
          </Defs>
          <Rect
            x={0}
            y={0}
            width={size.w}
            height={size.h}
            rx={radius.card}
            fill="url(#gold)"
          />
        </Svg>
      ) : null}
      <View style={[styles.heroInner, { backgroundColor: c.surface }]}>
        {children}
      </View>
    </View>
  );
}

function SectionHead({
  title,
  action,
  onPress,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View style={styles.sectionHead}>
      <Txt style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </Txt>
      {action && onPress ? (
        <Pressable onPress={onPress} hitSlop={12} accessibilityRole="button">
          <Txt variant="label" tone="gold">
            {action}
          </Txt>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    paddingHorizontal: screenPadding,
    paddingTop: 8,
    paddingBottom: 40,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  greeting: {
    fontFamily: fonts.manropeBold,
    fontSize: 26,
    lineHeight: 31,
    letterSpacing: -0.3,
  },
  flex: { flex: 1 },
  mt2: { marginTop: 2 },
  mt4: { marginTop: 4 },
  mt10: { marginTop: 10 },
  roundBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: { marginTop: 20, padding: 1, borderRadius: radius.card },
  heroInner: { borderRadius: radius.card - 1, overflow: 'hidden' },
  heroRow: { flexDirection: 'row', paddingTop: 20, paddingBottom: 18 },
  heroCol: { flex: 1, paddingHorizontal: 16 },
  heroNum: { marginTop: 8, letterSpacing: -0.5 },
  heroNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  vrule: { width: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  cycleTrack: { height: 3 },
  cycleFill: { height: 3 },
  insight: { fontFamily: fonts.inter, paddingHorizontal: 4, paddingTop: 10 },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 28,
    marginBottom: 12,
  },
  sectionTitle: { fontFamily: fonts.manropeSemiBold, fontSize: 18 },
  listCard: { paddingVertical: 0 },
  bucket: { paddingVertical: 14 },
  bucketTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bucketName: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bucketAmt: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 10,
    flexWrap: 'wrap',
  },
  regular: { fontFamily: fonts.inter },
  footnote: { paddingBottom: 12 },
  emergency: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  attnRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  recentRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.manropeSemiBold, fontSize: 13 },
  upIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
