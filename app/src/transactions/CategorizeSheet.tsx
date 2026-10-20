import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Amount } from '../components/Amount';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { Txt } from '../components/Txt';
import { useData, useQuery } from '../data/DataProvider';
import { BUCKET_LABELS, bucketOf, listCategories } from '../db/categories';
import { TxnView } from '../db/transactions';
import { pastPaymentsCount, setCategory } from '../domain/actions';
import { useTheme } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';
import { dayLabel, timeLabel } from '../utils/format';
import { CategoryPicker, useBucketColor } from './CategoryPicker';

interface Props {
  txn: TxnView | null;
  onClose: () => void;
}

// Brief §9.5: suggested category pre-selected with a gold outline; Save is
// one tap in the common case.
export function CategorizeSheet({ txn, onClose }: Props) {
  const { c } = useTheme();
  const { sql, refresh } = useData();
  const colorOf = useBucketColor();
  const categories = useQuery(listCategories, []) ?? [];
  const suggested = txn?.category_id ?? txn?.suggested_category_id ?? null;
  const [choice, setChoice] = useState<string | null>(suggested);
  const past = useQuery(
    s => pastPaymentsCount(s, txn?.merchant_key ?? null),
    [txn?.id],
  );

  useEffect(() => setChoice(suggested), [suggested, txn?.id]);

  if (!txn) {
    return null;
  }
  const nameOf = (id: string | null) =>
    id ? categories.find(x => x.id === id)?.name ?? '' : '';
  const label = (id: string) =>
    `${BUCKET_LABELS[bucketOf(id)]} · ${nameOf(id)}`;
  const usingSuggestion = suggested !== null && choice === suggested;

  const save = async () => {
    if (!choice) {
      return;
    }
    await setCategory(sql, txn.id, choice, true);
    refresh();
    onClose();
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      accessibilityLabel={`Categorize ${txn.merchant_name ?? 'payment'}`}
    >
      <View style={styles.head}>
        <View style={styles.flex}>
          <Txt style={styles.merchant} numberOfLines={1}>
            {txn.merchant_name ?? 'Payment'}
          </Txt>
          <Txt variant="label" tone="secondary" style={styles.regular}>
            {dayLabel(txn.occurred_at)}, {timeLabel(txn.occurred_at)}
            {txn.account_name ? ` · ${txn.account_name}` : ''}
          </Txt>
        </View>
        <Amount value={txn.amount / 100} size={26} family={fonts.manropeBold} />
      </View>

      {suggested ? (
        <Pressable
          onPress={() => setChoice(suggested)}
          accessibilityRole="radio"
          accessibilityState={{ selected: usingSuggestion }}
          style={[
            styles.suggestion,
            {
              borderColor: usingSuggestion ? c.gold : c.border,
              backgroundColor: usingSuggestion ? c.goldTint : 'transparent',
            },
          ]}
        >
          <View
            style={[
              styles.dot,
              { backgroundColor: colorOf(bucketOf(suggested)) },
            ]}
          />
          <View style={styles.flex}>
            <Txt variant="bodySemi" tone={usingSuggestion ? 'gold' : 'primary'}>
              {label(suggested)}
            </Txt>
            <Txt variant="caption" tone="secondary" style={styles.mt2}>
              {txn.category_id
                ? 'Current category'
                : past
                ? `Suggested · based on ${past} past payment${
                    past === 1 ? '' : 's'
                  }`
                : 'Suggested'}
            </Txt>
          </View>
          {usingSuggestion ? (
            <Icon name="check" color={c.goldText} strokeWidth={2} />
          ) : null}
        </Pressable>
      ) : null}

      <Txt variant="caption" tone="tertiary" style={styles.or}>
        {suggested ? 'Or choose another' : 'Choose a bucket'}
      </Txt>
      <CategoryPicker value={choice} onChange={setChoice} labels={false} />

      <Button
        label="Save"
        onPress={save}
        disabled={!choice}
        style={styles.save}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  merchant: { fontFamily: fonts.manropeBold, fontSize: 22, lineHeight: 28 },
  regular: { fontFamily: fonts.inter, marginTop: 2 },
  suggestion: {
    marginTop: 18,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  mt2: { marginTop: 2 },
  or: { fontFamily: fonts.interSemiBold, marginTop: 16, marginBottom: 8 },
  save: { marginTop: 20 },
});
