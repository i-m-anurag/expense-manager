import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { BUCKET_META } from '../budget/parts';
import { Amount } from '../components/Amount';
import { Card } from '../components/Card';
import { Icon } from '../components/Icon';
import { Txt } from '../components/Txt';
import { useQuery } from '../data/DataProvider';
import { usePrivacy } from '../data/Privacy';
import { earliestTransaction, getInsights } from '../domain/insights';
import { istDayStartMs } from '../domain/cycle';
import { TabProps } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, radius, screenPadding } from '../theme/tokens';
import { groupINR, initials } from '../utils/format';

const DONUT = 132;
const STROKE = 14;
const BAR_MAX = 110;

// Brief §9.8 / PRD INS-02..07.
export function InsightsScreen({ navigation }: TabProps<'Insights'>) {
  const { c, name } = useTheme();
  const insets = useSafeAreaInsets();
  const { hidden } = usePrivacy();
  const [offset, setOffset] = useState(0);
  const data = useQuery(s => getInsights(s, offset), [offset]);
  const earliest = useQuery(earliestTransaction, []);
  const canGoBack =
    !!data &&
    earliest !== null &&
    earliest !== undefined &&
    earliest < istDayStartMs(data.range.start) &&
    offset < 11;

  const toneColor = {
    watch: c.status.watch,
    good: c.status.onTrack,
    gold: c.gold,
  };
  const money = (paise: number) =>
    hidden ? '₹••••' : `₹${groupINR(Math.round(paise / 100))}`;
  const compact = (paise: number) => {
    if (hidden) return '••';
    const r = paise / 100;
    return r >= 100000
      ? `${(r / 100000).toFixed(1)}L`
      : r >= 1000
      ? `${Math.round(r / 1000)}K`
      : `${Math.round(r)}`;
  };

  return (
    <View
      style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}
    >
      <StatusBar
        barStyle={name === 'dark' ? 'light-content' : 'dark-content'}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Txt style={styles.title} accessibilityRole="header">
            Insights
          </Txt>
          <View
            style={[
              styles.picker,
              { borderColor: c.border, backgroundColor: c.surface },
            ]}
          >
            <Pressable
              onPress={() => setOffset(o => o + 1)}
              disabled={!canGoBack}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Previous cycle"
              style={styles.pickerBtn}
            >
              <Icon
                name="chevronLeft"
                size={18}
                color={canGoBack ? c.textSecondary : c.border}
              />
            </Pressable>
            <Txt variant="label" style={styles.pickerLabel}>
              {data?.label ?? ''}
            </Txt>
            <Pressable
              onPress={() => setOffset(o => Math.max(0, o - 1))}
              disabled={offset === 0}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Next cycle"
              style={styles.pickerBtn}
            >
              <Icon
                name="chevronRight"
                size={18}
                color={offset === 0 ? c.border : c.textSecondary}
              />
            </Pressable>
          </View>
        </View>

        {data ? (
          <>
            {data.notes.length ? (
              <View style={styles.notes}>
                {data.notes.map(n => (
                  <Card key={n.text} style={styles.note}>
                    <View
                      style={[
                        styles.noteDot,
                        { backgroundColor: toneColor[n.tone] },
                      ]}
                    />
                    <Txt style={styles.flex}>{n.text}</Txt>
                  </Card>
                ))}
              </View>
            ) : null}

            <Section title="Where it went" />
            <Card style={styles.pad20}>
              <Txt variant="label" tone="secondary" style={styles.regular}>
                {data.splitSentence}
              </Txt>
              <View style={styles.donutRow}>
                <View
                  style={styles.donut}
                  accessible
                  accessibilityLabel={`Spent ${money(
                    data.totalSpent,
                  )}. ${data.split
                    .map(
                      x =>
                        `${BUCKET_META[x.bucket].label} ${Math.round(
                          x.share * 100,
                        )} percent`,
                    )
                    .join(', ')}`}
                >
                  <Donut
                    parts={data.split.map(x => ({
                      share: x.share,
                      color: c.bucket[x.bucket],
                    }))}
                  />
                  <View style={styles.donutCenter}>
                    <Amount
                      value={data.totalSpent / 100}
                      size={20}
                      family={fonts.manropeBold}
                    />
                    <Txt variant="caption" tone="secondary">
                      spent
                    </Txt>
                  </View>
                </View>
                <View style={styles.legend}>
                  {data.split.map(x => (
                    <View key={x.bucket} style={styles.legendRow}>
                      <View
                        style={[
                          styles.swatch,
                          { backgroundColor: c.bucket[x.bucket] },
                        ]}
                      />
                      <Txt variant="label" style={styles.flex}>
                        {BUCKET_META[x.bucket].label}
                      </Txt>
                      <Txt variant="label" tone="secondary">
                        {Math.round(x.share * 100)}%
                      </Txt>
                    </View>
                  ))}
                </View>
              </View>
            </Card>

            {data.categories.length ? (
              <>
                <Section title="Top categories" />
                <Card style={styles.list}>
                  {data.categories.map((cat, i) => (
                    <Pressable
                      key={cat.id}
                      onPress={() =>
                        navigation.navigate('Transactions', {
                          bucket: cat.bucket ?? undefined,
                        })
                      }
                      accessibilityRole="button"
                      style={[
                        styles.catRow,
                        i > 0 && {
                          borderTopWidth: 1,
                          borderTopColor: c.border,
                        },
                      ]}
                    >
                      <View style={styles.catHead}>
                        <Txt variant="bodyMedium" style={styles.flex}>
                          {cat.name}
                        </Txt>
                        <Amount value={cat.amount / 100} size={14} />
                      </View>
                      <View
                        style={[styles.catTrack, { backgroundColor: c.border }]}
                      >
                        <View
                          style={[
                            styles.catFill,
                            {
                              width: `${
                                (cat.amount / data.categories[0].amount) * 100
                              }%`,
                              backgroundColor:
                                c.bucket[cat.bucket as keyof typeof c.bucket] ??
                                c.textTertiary,
                            },
                          ]}
                        />
                      </View>
                    </Pressable>
                  ))}
                </Card>
              </>
            ) : null}

            <Section title="Last 6 cycles" />
            <Card style={styles.pad20}>
              <Txt variant="label" tone="secondary" style={styles.regular}>
                {data.cyclesSentence}
              </Txt>
              <View style={styles.bars}>
                {(() => {
                  const max = Math.max(1, ...data.cycles.map(x => x.total));
                  return data.cycles.map((x, i) => (
                    <View
                      key={`${x.label}-${i}`}
                      style={styles.barCol}
                      accessible
                      accessibilityLabel={`${x.label}: ${money(x.total)}${
                        x.current ? ', selected cycle' : ''
                      }`}
                    >
                      <Text
                        style={[styles.barValue, { color: c.textSecondary }]}
                      >
                        {x.total ? compact(x.total) : ''}
                      </Text>
                      <View
                        style={[
                          styles.bar,
                          {
                            height: Math.max(4, (x.total / max) * BAR_MAX),
                            backgroundColor: x.current
                              ? 'transparent'
                              : name === 'dark'
                              ? '#2C3558'
                              : '#D9D4C7',
                            borderWidth: x.current ? 1.5 : 0,
                            borderColor: c.gold,
                          },
                        ]}
                      />
                      <Text
                        style={[
                          styles.barLabel,
                          { color: x.current ? c.goldText : c.textTertiary },
                        ]}
                      >
                        {x.label}
                      </Text>
                    </View>
                  ));
                })()}
              </View>
            </Card>

            {data.forecast ? (
              <Card style={[styles.pad20, styles.mt16]}>
                <View style={styles.forecastHead}>
                  <Icon
                    name={data.forecast.over ? 'alert' : 'check'}
                    size={14}
                    strokeWidth={2}
                    color={
                      data.forecast.over ? c.status.watch : c.status.onTrack
                    }
                  />
                  <Txt
                    variant="caption"
                    color={
                      data.forecast.over ? c.status.watch : c.status.onTrack
                    }
                    style={styles.medium}
                  >
                    Month-end forecast
                  </Txt>
                </View>
                <View style={styles.forecastNum}>
                  <Amount
                    value={data.forecast.total / 100}
                    size={30}
                    family={fonts.manropeBold}
                  />
                  <Txt variant="label" tone="secondary" style={styles.regular}>
                    {' '}
                    of {money(data.forecast.budget)}
                  </Txt>
                </View>
                <Txt
                  variant="label"
                  tone="secondary"
                  style={[styles.regular, styles.mt8]}
                >
                  {data.forecast.text}
                </Txt>
              </Card>
            ) : null}

            {data.subscriptions.length ? (
              <>
                <View style={styles.sectionRow}>
                  <Txt style={styles.sectionTitle}>Subscriptions</Txt>
                  <View style={styles.inline}>
                    <Amount value={data.subscriptionsTotal / 100} size={15} />
                    <Txt variant="caption" tone="secondary">
                      {' '}
                      /month
                    </Txt>
                  </View>
                </View>
                <Card style={styles.list}>
                  {data.subscriptions.map((x, i) => (
                    <View
                      key={x.name}
                      style={[
                        styles.simpleRow,
                        i > 0 && {
                          borderTopWidth: 1,
                          borderTopColor: c.border,
                        },
                      ]}
                    >
                      <Txt variant="bodyMedium" style={styles.flex}>
                        {x.name}
                      </Txt>
                      <Amount value={x.amount / 100} size={15} />
                    </View>
                  ))}
                </Card>
              </>
            ) : null}

            {data.saved.income ? (
              <Card style={[styles.pad20, styles.mt16]}>
                <Txt variant="label" tone="secondary">
                  Saved and invested
                </Txt>
                <View style={styles.forecastNum}>
                  <Txt style={styles.rate}>
                    {Math.round(data.saved.rate * 100)}%
                  </Txt>
                  <Txt variant="label" tone="secondary" style={styles.regular}>
                    {' '}
                    of income ·{' '}
                    {money(data.saved.investment + data.saved.emergency)}
                  </Txt>
                </View>
                <View
                  style={[styles.savedTrack, { backgroundColor: c.border }]}
                >
                  <View
                    style={{
                      width: `${Math.min(
                        100,
                        (data.saved.investment / data.saved.income) * 100,
                      )}%`,
                      backgroundColor: c.bucket.investment,
                    }}
                  />
                  <View
                    style={{
                      width: `${Math.min(
                        100,
                        (data.saved.emergency / data.saved.income) * 100,
                      )}%`,
                      backgroundColor: c.bucket.emergency,
                    }}
                  />
                </View>
                <View style={styles.savedLegend}>
                  <Txt variant="caption" tone="secondary">
                    ■ Investments {money(data.saved.investment)}
                  </Txt>
                  <Txt variant="caption" tone="secondary">
                    ■ Emergency {money(data.saved.emergency)}
                  </Txt>
                </View>
              </Card>
            ) : null}

            {data.merchants.length ? (
              <>
                <Section title="Top merchants" />
                <Card style={styles.list}>
                  {data.merchants.map((m, i) => (
                    <View
                      key={m.name}
                      style={[
                        styles.simpleRow,
                        i > 0 && {
                          borderTopWidth: 1,
                          borderTopColor: c.border,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.avatar,
                          { backgroundColor: c.bg, borderColor: c.border },
                        ]}
                      >
                        <Text
                          style={[
                            styles.avatarText,
                            { color: c.textSecondary },
                          ]}
                        >
                          {initials(m.name)}
                        </Text>
                      </View>
                      <Txt variant="bodyMedium" style={styles.flex}>
                        {m.name}
                      </Txt>
                      <Amount value={m.amount / 100} size={15} />
                    </View>
                  ))}
                </Card>
              </>
            ) : null}

            {!data.totalSpent ? (
              <Txt tone="secondary" style={styles.mt16}>
                No spending recorded in this cycle yet.
              </Txt>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

// The one donut in the app (brief §7.5), with 2px gaps between segments.
function Donut({ parts }: { parts: { share: number; color: string }[] }) {
  const { c } = useTheme();
  const r = (DONUT - STROKE) / 2;
  const circ = 2 * Math.PI * r;
  const shown = parts.filter(p => p.share > 0);
  let acc = 0;
  return (
    <Svg width={DONUT} height={DONUT} style={styles.rotate}>
      <Circle
        cx={DONUT / 2}
        cy={DONUT / 2}
        r={r}
        fill="none"
        stroke={c.border}
        strokeWidth={STROKE}
      />
      {shown.map((p, i) => {
        const len = circ * p.share;
        const gap = shown.length > 1 ? 3 : 0;
        const el = (
          <Circle
            key={i}
            cx={DONUT / 2}
            cy={DONUT / 2}
            r={r}
            fill="none"
            stroke={p.color}
            strokeWidth={STROKE}
            strokeDasharray={`${Math.max(0, len - gap)} ${circ - len + gap}`}
            strokeDashoffset={-acc}
          />
        );
        acc += len;
        return el;
      })}
    </Svg>
  );
}

function Section({ title }: { title: string }) {
  return (
    <Txt style={styles.sectionTitle} accessibilityRole="header">
      {title}
    </Txt>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    paddingHorizontal: screenPadding,
    paddingTop: 8,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontFamily: fonts.manropeBold, fontSize: 26, letterSpacing: -0.3 },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingHorizontal: 4,
    borderRadius: radius.chip,
    borderWidth: 1,
  },
  pickerBtn: {
    width: 32,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerLabel: { minWidth: 70, textAlign: 'center' },
  notes: { marginTop: 16, gap: 10 },
  note: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    paddingVertical: 14,
  },
  noteDot: { width: 8, height: 8, borderRadius: 4, marginTop: 7 },
  flex: { flex: 1 },
  regular: { fontFamily: fonts.inter, fontSize: 14, lineHeight: 20 },
  medium: { fontFamily: fonts.interMedium },
  mt8: { marginTop: 8 },
  mt16: { marginTop: 16 },
  pad20: { padding: 20 },
  sectionTitle: {
    fontFamily: fonts.manropeSemiBold,
    fontSize: 18,
    marginTop: 28,
    marginBottom: 12,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  inline: { flexDirection: 'row', alignItems: 'baseline' },
  donutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginTop: 16,
  },
  donut: { width: DONUT, height: DONUT },
  rotate: { transform: [{ rotate: '-90deg' }] },
  donutCenter: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legend: { flex: 1, gap: 10 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  swatch: { width: 10, height: 10, borderRadius: 5 },
  list: { paddingVertical: 0 },
  catRow: { paddingVertical: 12 },
  catHead: { flexDirection: 'row', alignItems: 'baseline' },
  catTrack: { height: 6, borderRadius: 3, marginTop: 8 },
  catFill: { height: 6, borderRadius: 3 },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: BAR_MAX + 44,
    marginTop: 16,
  },
  barCol: { width: 40, alignItems: 'center', gap: 6 },
  barValue: { fontFamily: fonts.interMedium, fontSize: 11 },
  bar: {
    width: 32,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  barLabel: { fontFamily: fonts.interMedium, fontSize: 11 },
  forecastHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  forecastNum: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 10,
    flexWrap: 'wrap',
  },
  rate: { fontFamily: fonts.manropeBold, fontSize: 30 },
  savedTrack: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    marginTop: 14,
    gap: 2,
    overflow: 'hidden',
  },
  savedLegend: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  simpleRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.manropeSemiBold, fontSize: 11 },
});
