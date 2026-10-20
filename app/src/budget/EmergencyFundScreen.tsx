import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Amount } from '../components/Amount';
import { Card } from '../components/Card';
import { Icon } from '../components/Icon';
import { Txt } from '../components/Txt';
import { useQuery } from '../data/DataProvider';
import { getEmergencySnapshot } from '../domain/budget';
import { ScreenProps } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, screenPadding } from '../theme/tokens';
import { dayLabel, groupINR, istDate, timeLabel } from '../utils/format';
import { Ring } from './parts';

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
const fullDate = (ms: number) => {
  const d = istDate(ms);
  return `${d.d} ${MONTHS[d.m]} ${d.y}`;
};

// Brief §9.7 / PRD §7.7.
export function EmergencyFundScreen({
  navigation,
}: ScreenProps<'EmergencyFund'>) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const fund = useQuery(s => getEmergencySnapshot(s), []);

  if (!fund) {
    return <View style={[styles.root, { backgroundColor: c.bg }]} />;
  }
  const progress = fund.targetMonths
    ? fund.monthsCovered / fund.targetMonths
    : 0;

  return (
    <View
      style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}
    >
      <View style={styles.topBar}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Icon name="chevronLeft" size={24} color={c.textSecondary} />
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 32 },
        ]}
      >
        <Txt style={styles.title} accessibilityRole="header">
          Emergency fund
        </Txt>

        <Card highlight style={styles.hero}>
          <Ring size={124} stroke={9} progress={progress}>
            <Txt style={styles.months}>{fund.monthsCovered.toFixed(1)}</Txt>
            <Txt variant="caption" tone="secondary">
              of {fund.targetMonths} months
            </Txt>
          </Ring>
          <View style={styles.flex}>
            <Txt variant="label" tone="secondary">
              Months covered
            </Txt>
            <Amount
              value={fund.balance / 100}
              size={26}
              family={fonts.manropeBold}
              style={styles.mt4}
            />
            <Txt variant="label" tone="secondary" style={styles.explain}>
              {fund.averageNeed
                ? `Based on your ${
                    fund.averageFromHistory
                      ? 'average essential spending'
                      : 'Need budget'
                  } of ₹${groupINR(fund.averageNeed / 100)}/month.`
                : 'Set a Need budget to see how many months this covers.'}
            </Txt>
          </View>
        </Card>

        {fund.refillMonthly ? (
          <View
            style={[
              styles.refill,
              { backgroundColor: c.goldTint, borderColor: c.gold },
            ]}
          >
            <Txt variant="bodySemi" tone="gold">
              Refill plan
            </Txt>
            <Txt style={styles.mt6}>
              Add{' '}
              <Txt variant="bodySemi">
                ₹{groupINR(fund.refillMonthly / 100)}/month
              </Txt>{' '}
              for 6 months to get back to target.
            </Txt>
          </View>
        ) : null}

        <Txt style={styles.sectionTitle}>
          {fund.linked.length > 1 ? 'Linked accounts' : 'Linked account'}
        </Txt>
        {fund.linked.length ? (
          fund.linked.map(a => (
            <Card key={a.id} style={styles.linked}>
              <View style={[styles.shield, { backgroundColor: c.goldTint }]}>
                <Icon name="shield" size={20} color={c.goldText} />
              </View>
              <View style={styles.flex}>
                <Txt variant="bodySemi">{a.name}</Txt>
                <Txt variant="caption" tone="tertiary">
                  {a.updatedAt
                    ? `Updated ${dayLabel(
                        a.updatedAt,
                      ).toLowerCase()}, ${timeLabel(a.updatedAt)}`
                    : 'No balance from SMS yet'}
                </Txt>
              </View>
              {a.balance !== null ? (
                <Amount value={a.balance / 100} size={18} />
              ) : null}
            </Card>
          ))
        ) : (
          <Card>
            <Txt variant="label" tone="secondary">
              No account linked, so the balance is tracked by hand. Mark an
              account as "Emergency fund" to follow it from SMS.
            </Txt>
          </Card>
        )}

        <Txt style={styles.sectionTitle}>Contributions</Txt>
        <Card style={styles.list}>
          {fund.contributions.length ? (
            fund.contributions.map((x, i) => (
              <View
                key={`${x.at}-${i}`}
                style={[
                  styles.row,
                  i > 0 && { borderTopWidth: 1, borderTopColor: c.border },
                ]}
              >
                <Txt variant="label" tone="secondary" style={styles.regular}>
                  {fullDate(x.at)}
                </Txt>
                <Amount
                  value={x.amount / 100}
                  sign="+"
                  size={15}
                  color={c.status.onTrack}
                />
              </View>
            ))
          ) : (
            <Txt variant="label" tone="secondary" style={styles.empty}>
              Transfers into your emergency account show up here.
            </Txt>
          )}
        </Card>

        <Txt style={styles.sectionTitle}>Withdrawals</Txt>
        <Card style={styles.list}>
          {fund.withdrawals.length ? (
            fund.withdrawals.map((w, i) => (
              <View
                key={`${w.at}-${i}`}
                style={[
                  styles.row,
                  i > 0 && { borderTopWidth: 1, borderTopColor: c.border },
                ]}
              >
                <View style={styles.flex}>
                  <Txt variant="bodyMedium">
                    {w.reason ?? w.name ?? 'Withdrawal'}
                  </Txt>
                  <Txt variant="caption" tone="tertiary" style={styles.mt2}>
                    {fullDate(w.at)}
                  </Txt>
                </View>
                <Amount value={w.amount / 100} sign="−" size={15} />
              </View>
            ))
          ) : (
            <Txt variant="label" tone="secondary" style={styles.empty}>
              None so far. Open a payment and choose "Paid from emergency fund"
              when you need it.
            </Txt>
          )}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    height: 48,
    paddingHorizontal: screenPadding,
    flexDirection: 'row',
    alignItems: 'center',
  },
  content: { paddingHorizontal: screenPadding },
  title: { fontFamily: fonts.manropeBold, fontSize: 26, letterSpacing: -0.3 },
  hero: {
    marginTop: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  months: { fontFamily: fonts.manropeExtraBold, fontSize: 34, lineHeight: 38 },
  flex: { flex: 1 },
  mt2: { marginTop: 2 },
  mt4: { marginTop: 4 },
  mt6: { marginTop: 6 },
  explain: { fontFamily: fonts.inter, marginTop: 8 },
  refill: { marginTop: 12, borderWidth: 1, borderRadius: 20, padding: 16 },
  sectionTitle: {
    fontFamily: fonts.manropeSemiBold,
    fontSize: 18,
    marginTop: 24,
    marginBottom: 12,
  },
  linked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  shield: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { paddingVertical: 0 },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
  },
  regular: { fontFamily: fonts.inter, fontSize: 14 },
  empty: { paddingVertical: 14 },
});
