import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Amount } from '../components/Amount';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Icon } from '../components/Icon';
import { Txt } from '../components/Txt';
import { useQuery } from '../data/DataProvider';
import { Bucket, Commitment, getBudgetSnapshot } from '../domain/budget';
import { TabProps } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, screenPadding } from '../theme/tokens';
import { groupINR, istDate } from '../utils/format';
import { BUCKET_META, BucketIcon, PaceBar, StatusLabel } from './parts';

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const shortDate = (iso: string) => {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
};

const KIND_BUCKET: Record<Commitment['kind'], Bucket | 'emergency'> = {
  emi: 'loan',
  sip: 'investment',
  rent: 'need',
  subscription: 'want',
  other: 'want',
  emergency: 'emergency',
};

// Brief §9.6 / PRD §7.6.
export function BudgetScreen({ navigation }: TabProps<'Budget'>) {
  const { c, name } = useTheme();
  const insets = useSafeAreaInsets();
  const budget = useQuery(s => getBudgetSnapshot(s), []);
  const [open, setOpen] = useState<Record<string, boolean>>({
    need: true,
    want: true,
  });

  if (!budget) {
    return <View style={[styles.root, { backgroundColor: c.bg }]} />;
  }
  const { cycle } = budget;
  const nonEmergencyCommitted = budget.commitments
    .filter(x => x.kind !== 'emergency')
    .reduce((s, x) => s + x.amount, 0);

  // Stacked bar: committed money solid, flexible money faded (brief §9.6).
  const committedBy = (b: Bucket) =>
    budget.commitments
      .filter(x => KIND_BUCKET[x.kind] === b)
      .reduce((s, x) => s + x.amount, 0);
  const segments = [
    ...budget.buckets.map(b => ({
      key: `${b.bucket}-c`,
      w: Math.min(b.allocated, committedBy(b.bucket)),
      color: c.bucket[b.bucket],
      o: 1,
    })),
    {
      key: 'emergency',
      w: budget.emergencyAllocation,
      color: c.bucket.emergency,
      o: 1,
    },
    ...budget.buckets.map(b => ({
      key: `${b.bucket}-f`,
      w: Math.max(0, b.allocated - committedBy(b.bucket)),
      color: c.bucket[b.bucket],
      o: 0.35,
    })),
  ].filter(s => s.w > 0);
  const committedTotal = nonEmergencyCommitted + budget.emergencyAllocation;
  const flexibleTotal = Math.max(0, budget.totalBudget - nonEmergencyCommitted);

  const s = istDate(Date.parse(`${cycle.start_date}T12:00:00+05:30`));
  const e = istDate(Date.parse(`${cycle.end_date}T12:00:00+05:30`));
  const range =
    s.m === e.m
      ? `${s.d} – ${e.d} ${MONTHS[e.m]}`
      : `${s.d} ${MONTHS[s.m]} – ${e.d} ${MONTHS[e.m]}`;

  return (
    <View
      style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}
    >
      <StatusBar
        barStyle={name === 'dark' ? 'light-content' : 'dark-content'}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Txt style={styles.title} accessibilityRole="header">
          Budget
        </Txt>
        <Txt variant="label" tone="secondary" style={styles.mt4}>
          {range} · Income ₹{groupINR(cycle.income / 100)}
        </Txt>

        <Card style={styles.mt18}>
          <Txt variant="label" tone="secondary" style={styles.lead}>
            {nonEmergencyCommitted
              ? `₹${groupINR(
                  committedTotal / 100,
                )} is already committed. You have `
              : 'Nothing is committed yet. You have '}
            <Txt variant="label" style={styles.bold}>
              ₹{groupINR(flexibleTotal / 100)}
            </Txt>
            {' to spend freely.'}
          </Txt>
          <View style={styles.stack} accessible={false}>
            {segments.map(seg => (
              <View
                key={seg.key}
                style={{
                  flex: seg.w,
                  backgroundColor: seg.color,
                  opacity: seg.o,
                }}
              />
            ))}
          </View>
          <View style={styles.legend}>
            <Txt variant="caption" tone="secondary">
              ■ Committed ₹{groupINR(committedTotal / 100)}
            </Txt>
            <Txt variant="caption" tone="secondary">
              ▨ Flexible ₹{groupINR(flexibleTotal / 100)}
            </Txt>
          </View>
        </Card>

        {budget.buckets.map(b => {
          const expanded = !!open[b.bucket];
          return (
            <Card key={b.bucket} style={styles.section}>
              <Pressable
                onPress={() =>
                  setOpen(o => ({ ...o, [b.bucket]: !o[b.bucket] }))
                }
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                style={styles.sectionHead}
              >
                <BucketIcon bucket={b.bucket} size={36} />
                <View style={styles.flex}>
                  <Txt variant="bodySemi">{BUCKET_META[b.bucket].label}</Txt>
                  <View style={styles.amtRow}>
                    <Amount
                      value={Math.abs(b.left) / 100}
                      size={18}
                      color={b.left < 0 ? c.status.over : undefined}
                    />
                    <Txt variant="caption" tone="secondary">
                      {b.left < 0 ? ' over · of ' : ' left of '}₹
                      {groupINR(b.allocated / 100)}
                    </Txt>
                  </View>
                </View>
                <StatusLabel status={b.status} />
                <Icon
                  name={expanded ? 'chevronUp' : 'chevronDown'}
                  size={18}
                  color={c.textTertiary}
                />
              </Pressable>
              {expanded ? (
                <View style={styles.subs}>
                  <PaceBar
                    used={b.used}
                    pace={b.pace}
                    status={b.status}
                    color={c.bucket[b.bucket]}
                    showTick={b.bucket === 'need' || b.bucket === 'want'}
                  />
                  {b.subs.length ? (
                    b.subs.map(sub => (
                      <Pressable
                        key={sub.id}
                        onPress={() =>
                          navigation.navigate('Transactions', {
                            bucket: b.bucket,
                          })
                        }
                        accessibilityRole="button"
                        style={[styles.sub, { borderTopColor: c.border }]}
                      >
                        <Txt variant="bodyMedium" style={styles.flex}>
                          {sub.name}
                        </Txt>
                        <Amount value={sub.spent / 100} size={14} />
                        <Txt variant="caption" tone="tertiary">
                          {' '}
                          spent
                        </Txt>
                      </Pressable>
                    ))
                  ) : (
                    <Txt variant="caption" tone="tertiary" style={styles.none}>
                      Nothing spent here yet this cycle.
                    </Txt>
                  )}
                </View>
              ) : null}
            </Card>
          );
        })}

        {budget.uncategorizedSpent > 0 ? (
          <Pressable
            onPress={() =>
              navigation.navigate('Transactions', { bucket: 'uncategorized' })
            }
            accessibilityRole="button"
          >
            <Card style={[styles.section, styles.uncat]}>
              <View style={styles.flex}>
                <Txt variant="bodySemi">Not categorised yet</Txt>
                <Txt variant="caption" tone="secondary">
                  Counted in what's left, but not in any bucket.
                </Txt>
              </View>
              <Amount value={budget.uncategorizedSpent / 100} size={16} />
              <Icon name="chevronRight" size={18} color={c.textTertiary} />
            </Card>
          </Pressable>
        ) : null}

        <Txt style={styles.sectionTitle} accessibilityRole="header">
          Fixed commitments
        </Txt>
        <Card style={styles.list}>
          {budget.commitments.length ? (
            budget.commitments.map((x, i) => (
              <View
                key={x.key}
                style={[
                  styles.fixed,
                  i > 0 && { borderTopWidth: 1, borderTopColor: c.border },
                ]}
              >
                <View style={styles.flex}>
                  <Txt variant="bodyMedium">{x.name}</Txt>
                  <Txt variant="caption" tone="tertiary" style={styles.mt2}>
                    {x.date ? shortDate(x.date) : 'This cycle'}
                  </Txt>
                </View>
                <View style={styles.right}>
                  <Amount value={x.amount / 100} />
                  <Txt
                    variant="caption"
                    color={x.paid ? c.status.onTrack : c.textSecondary}
                    style={styles.mt2}
                  >
                    {x.paid ? 'Paid' : 'Upcoming'}
                  </Txt>
                </View>
              </View>
            ))
          ) : (
            <Txt variant="label" tone="secondary" style={styles.none}>
              EMIs, SIPs, rent and subscriptions show up here once they've
              repeated for two months.
            </Txt>
          )}
        </Card>

        <Button
          label="Edit budget"
          kind="secondary"
          onPress={() => navigation.navigate('EditBudget')}
          style={styles.edit}
        />
      </ScrollView>
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
  title: { fontFamily: fonts.manropeBold, fontSize: 26, letterSpacing: -0.3 },
  mt2: { marginTop: 2 },
  mt4: { marginTop: 4 },
  mt18: { marginTop: 18 },
  lead: { fontFamily: fonts.inter, fontSize: 14, lineHeight: 20 },
  bold: { fontFamily: fonts.interSemiBold, fontSize: 14 },
  stack: {
    flexDirection: 'row',
    height: 14,
    gap: 2,
    marginTop: 14,
    borderRadius: 7,
    overflow: 'hidden',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  section: { marginTop: 12, paddingVertical: 0 },
  sectionHead: {
    minHeight: 72,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  flex: { flex: 1 },
  amtRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 2,
    flexWrap: 'wrap',
  },
  subs: { paddingBottom: 8 },
  sub: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingVertical: 12,
    borderTopWidth: 1,
    marginTop: 4,
  },
  none: { paddingVertical: 12 },
  uncat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
  },
  sectionTitle: {
    fontFamily: fonts.manropeSemiBold,
    fontSize: 18,
    marginTop: 24,
    marginBottom: 12,
  },
  list: { paddingVertical: 0 },
  fixed: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  right: { alignItems: 'flex-end' },
  edit: { marginTop: 20 },
});
