import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  SectionList,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Amount } from '../components/Amount';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { Txt } from '../components/Txt';
import { useQuery } from '../data/DataProvider';
import { listAccounts } from '../db/accounts';
import { BUCKET_LABELS, BUDGET_BUCKETS } from '../db/categories';
import { TxnFilter, TxnView, listTxns } from '../db/transactions';
import { TabProps } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, radius, screenPadding } from '../theme/tokens';
import { dayKey, dayLabel, istDate, monthLabel } from '../utils/format';
import { CategorizeSheet } from './CategorizeSheet';
import { TxnRow } from './TxnRow';

type FilterKey = 'account' | 'bucket' | 'type' | 'month';

interface Option {
  label: string;
  value: string | undefined;
}

// Brief §9.3 / PRD TXN-01.
export function TransactionsScreen({
  navigation,
  route,
}: TabProps<'Transactions'>) {
  const { c, name } = useTheme();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [account, setAccount] = useState<string>();
  const [bucket, setBucket] = useState<string | undefined>(
    route.params?.bucket,
  );
  const [direction, setDirection] = useState<'debit' | 'credit'>();
  const [month, setMonth] = useState<string>(); // "y-m"
  const [open, setOpen] = useState<FilterKey | null>(null);
  const [categorizing, setCategorizing] = useState<TxnView | null>(null);

  React.useEffect(() => {
    if (route.params?.bucket) {
      setBucket(route.params.bucket);
    }
  }, [route.params?.bucket]);

  const filter: TxnFilter = useMemo(() => {
    const f: TxnFilter = { search, accountId: account, bucket, direction };
    if (month) {
      const [y, m] = month.split('-').map(Number);
      f.from = Date.UTC(y, m, 1) - 330 * 60000;
      f.to = Date.UTC(y, m + 1, 1) - 330 * 60000;
    }
    return f;
  }, [search, account, bucket, direction, month]);

  const txns = useQuery(sql => listTxns(sql, filter), [filter]);
  const accounts = useQuery(listAccounts, []) ?? [];

  const sections = useMemo(() => {
    const out: {
      key: string;
      title: string;
      total: number;
      data: TxnView[];
    }[] = [];
    for (const t of txns ?? []) {
      const k = dayKey(t.occurred_at);
      let s = out[out.length - 1];
      if (!s || s.key !== k) {
        s = { key: k, title: dayLabel(t.occurred_at), total: 0, data: [] };
        out.push(s);
      }
      s.data.push(t);
      // Day total counts money out that is real spending (not transfers).
      if (t.direction === 'debit' && !t.is_transfer) {
        s.total += t.amount;
      }
    }
    return out;
  }, [txns]);

  const now = istDate(Date.now());
  const months: Option[] = [{ label: 'All time', value: undefined }];
  for (let i = 0; i < 12; i++) {
    const m = (now.m - i + 12) % 12;
    const y = now.y - (now.m - i < 0 ? 1 : 0);
    months.push({ label: monthLabel(y, m), value: `${y}-${m}` });
  }

  const options: Record<
    FilterKey,
    {
      title: string;
      items: Option[];
      value: string | undefined;
      set: (v: any) => void;
    }
  > = {
    account: {
      title: 'Account',
      items: [
        { label: 'All accounts', value: undefined },
        ...accounts.map(a => ({ label: a.display_name, value: a.id })),
      ],
      value: account,
      set: setAccount,
    },
    bucket: {
      title: 'Bucket',
      items: [
        { label: 'All buckets', value: undefined },
        { label: 'Not categorised', value: 'uncategorized' },
        ...BUDGET_BUCKETS.map(b => ({ label: BUCKET_LABELS[b], value: b })),
        { label: 'Income', value: 'income' },
        { label: 'Transfers', value: 'transfer' },
        { label: 'Emergency fund', value: 'emergency' },
      ],
      value: bucket,
      set: setBucket,
    },
    type: {
      title: 'Type',
      items: [
        { label: 'All', value: undefined },
        { label: 'Money out', value: 'debit' },
        { label: 'Money in', value: 'credit' },
      ],
      value: direction,
      set: setDirection,
    },
    month: { title: 'Month', items: months, value: month, set: setMonth },
  };

  const chipLabel = (k: FilterKey) => {
    const o = options[k];
    return o.value === undefined
      ? k === 'month'
        ? 'All time'
        : o.title
      : o.items.find(i => i.value === o.value)?.label ?? o.title;
  };

  const header = (
    <View>
      <Txt style={styles.title} accessibilityRole="header">
        Transactions
      </Txt>
      <View
        style={[
          styles.search,
          { backgroundColor: c.surface, borderColor: c.border },
        ]}
      >
        <Icon name="search" color={c.textTertiary} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search merchant or amount"
          placeholderTextColor={c.textTertiary}
          accessibilityLabel="Search transactions"
          returnKeyType="search"
          style={[styles.searchInput, { color: c.textPrimary }]}
        />
        {search ? (
          <Pressable
            onPress={() => setSearch('')}
            hitSlop={12}
            accessibilityLabel="Clear search"
          >
            <Icon name="close" color={c.textTertiary} />
          </Pressable>
        ) : null}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        style={styles.chipsScroll}
      >
        {(['account', 'bucket', 'type', 'month'] as FilterKey[]).map(k => {
          const active = options[k].value !== undefined;
          return (
            <Pressable
              key={k}
              onPress={() => setOpen(k)}
              accessibilityRole="button"
              accessibilityLabel={`Filter by ${options[k].title}: ${chipLabel(
                k,
              )}`}
              style={[
                styles.chip,
                {
                  borderColor: active ? c.gold : c.border,
                  backgroundColor: active ? c.goldTint : 'transparent',
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: active ? c.goldText : c.textSecondary },
                ]}
              >
                {chipLabel(k)}
              </Text>
              <Icon
                name="chevronDown"
                size={14}
                strokeWidth={2}
                color={active ? c.goldText : c.textSecondary}
              />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <View
      style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}
    >
      <StatusBar
        barStyle={name === 'dark' ? 'light-content' : 'dark-content'}
      />
      <SectionList
        sections={sections}
        keyExtractor={t => String(t.id)}
        ListHeaderComponent={header}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.list}
        renderSectionHeader={({ section }) => (
          <View style={styles.dayHead}>
            <Txt variant="label" tone="secondary" style={styles.semi}>
              {section.title}
            </Txt>
            {section.total ? (
              <Amount
                value={section.total / 100}
                sign="−"
                size={12}
                family={fonts.interMedium}
                color={c.textSecondary}
              />
            ) : null}
          </View>
        )}
        renderItem={({ item, index, section }) => (
          <View
            style={[
              styles.cardSlice,
              { backgroundColor: c.surface, borderColor: c.border },
              index === 0 && styles.cardTop,
              index === section.data.length - 1 && styles.cardBottom,
            ]}
          >
            <TxnRow
              txn={item}
              first={index === 0}
              onPress={() =>
                navigation.navigate('TransactionDetail', { id: item.id })
              }
              onCategorize={() => setCategorizing(item)}
            />
          </View>
        )}
        ListEmptyComponent={
          txns ? (
            <View style={styles.empty}>
              <Txt variant="bodySemi" center>
                {search || account || bucket || direction || month
                  ? 'Nothing matches'
                  : 'No transactions yet'}
              </Txt>
              <Txt tone="secondary" center style={styles.mt6}>
                {search || account || bucket || direction || month
                  ? 'Try a different search or clear the filters.'
                  : 'Bank SMS will show up here. You can also add a payment yourself.'}
              </Txt>
              {!(search || account || bucket || direction || month) ? (
                <Button
                  label="Add a payment"
                  onPress={() => navigation.navigate('AddTransaction')}
                  style={styles.mt16}
                />
              ) : null}
            </View>
          ) : undefined
        }
      />

      {open ? (
        <Sheet
          visible
          onClose={() => setOpen(null)}
          accessibilityLabel={`Filter by ${options[open].title}`}
        >
          <Txt variant="h1" style={styles.sheetTitle}>
            {options[open].title}
          </Txt>
          <ScrollView>
            {options[open].items.map(item => {
              const on = item.value === options[open].value;
              return (
                <Pressable
                  key={item.label}
                  onPress={() => {
                    options[open].set(item.value);
                    setOpen(null);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  style={[styles.option, { borderTopColor: c.border }]}
                >
                  <Txt
                    variant={on ? 'bodySemi' : 'body'}
                    tone={on ? 'gold' : 'primary'}
                  >
                    {item.label}
                  </Txt>
                  {on ? (
                    <Icon name="check" color={c.goldText} strokeWidth={2} />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </Sheet>
      ) : null}

      <CategorizeSheet
        txn={categorizing}
        onClose={() => setCategorizing(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { paddingHorizontal: screenPadding, paddingBottom: 120 },
  title: {
    fontFamily: fonts.manropeBold,
    fontSize: 26,
    letterSpacing: -0.3,
    marginTop: 8,
  },
  search: {
    marginTop: 14,
    height: 48,
    borderRadius: radius.button,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  searchInput: { flex: 1, fontFamily: fonts.inter, fontSize: 15, padding: 0 },
  chipsScroll: { marginHorizontal: -screenPadding },
  chips: { gap: 8, paddingHorizontal: screenPadding, paddingTop: 12 },
  chip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radius.chip,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chipText: { fontFamily: fonts.interMedium, fontSize: 13 },
  dayHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingTop: 18,
    paddingBottom: 8,
    paddingHorizontal: 2,
  },
  semi: { fontFamily: fonts.interSemiBold },
  cardSlice: { borderLeftWidth: 1, borderRightWidth: 1, paddingHorizontal: 14 },
  cardTop: {
    borderTopWidth: 1,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
  },
  cardBottom: {
    borderBottomWidth: 1,
    borderBottomLeftRadius: radius.card,
    borderBottomRightRadius: radius.card,
  },
  empty: { paddingTop: 48, paddingHorizontal: 12 },
  mt6: { marginTop: 6 },
  mt16: { marginTop: 16 },
  sheetTitle: { marginBottom: 8 },
  option: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
  },
});
