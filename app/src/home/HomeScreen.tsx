import React from 'react';
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../components/Card';
import { Icon } from '../components/Icon';
import { Txt } from '../components/Txt';
import { useQuery } from '../data/DataProvider';
import { getSetting } from '../db/settings';
import { countUncategorized, listTxns } from '../db/transactions';
import { TabProps } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';
import { screenPadding } from '../theme/tokens';
import { TxnRow } from '../transactions/TxnRow';

// Interim Home until the dashboard (brief §9.2, M5): the "needs your attention"
// card and recent transactions, both backed by real data.
export function HomeScreen({ navigation }: TabProps<'Home'>) {
  const { c, name } = useTheme();
  const insets = useSafeAreaInsets();
  const userName = useQuery(s => getSetting(s, 'user_name'), []);
  const uncategorized = useQuery(countUncategorized, []) ?? 0;
  const recent = useQuery(s => listTxns(s, { limit: 5 }), []) ?? [];
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <View
      style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}
    >
      <StatusBar
        barStyle={name === 'dark' ? 'light-content' : 'dark-content'}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Txt variant="h1" accessibilityRole="header">
          {greeting}
          {userName ? `, ${userName}` : ''}
        </Txt>
        <Txt tone="secondary" style={styles.mt4}>
          Your budget dashboard is coming next.
        </Txt>

        {uncategorized > 0 ? (
          <Pressable
            onPress={() =>
              navigation.navigate('Transactions', { bucket: 'uncategorized' })
            }
            accessibilityRole="button"
          >
            <Card style={styles.attention}>
              <View style={[styles.badge, { backgroundColor: c.goldTint }]}>
                <Txt variant="bodySemi" tone="gold">
                  {uncategorized}
                </Txt>
              </View>
              <View style={styles.flex}>
                <Txt variant="bodySemi">Needs your attention</Txt>
                <Txt variant="label" tone="secondary" style={styles.regular}>
                  {uncategorized} transaction{uncategorized === 1 ? '' : 's'} to
                  categorize
                </Txt>
              </View>
              <Icon name="chevronRight" size={18} color={c.textTertiary} />
            </Card>
          </Pressable>
        ) : null}

        <View style={styles.sectionHead}>
          <Txt variant="bodySemi">Recent transactions</Txt>
          <Pressable
            onPress={() => navigation.navigate('Transactions')}
            hitSlop={12}
            accessibilityRole="button"
          >
            <Txt variant="label" tone="gold">
              See all
            </Txt>
          </Pressable>
        </View>
        {recent.length ? (
          <Card style={styles.list}>
            {recent.map((t, i) => (
              <TxnRow
                key={t.id}
                txn={t}
                first={i === 0}
                onPress={() =>
                  navigation.navigate('TransactionDetail', { id: t.id })
                }
                onCategorize={() =>
                  navigation.navigate('TransactionDetail', { id: t.id })
                }
              />
            ))}
          </Card>
        ) : (
          <Txt tone="secondary">No transactions yet.</Txt>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    paddingHorizontal: screenPadding,
    paddingTop: 16,
    paddingBottom: 40,
  },
  mt4: { marginTop: 4 },
  attention: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  badge: {
    minWidth: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  flex: { flex: 1 },
  regular: { fontFamily: 'Inter-Regular', marginTop: 2 },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 28,
    marginBottom: 10,
  },
  list: { paddingVertical: 0, paddingHorizontal: 14 },
});
