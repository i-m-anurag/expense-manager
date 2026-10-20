import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Amount } from '../components/Amount';
import { Txt } from '../components/Txt';
import { BUCKET_LABELS, CategoryBucket } from '../db/categories';
import { TxnView } from '../db/transactions';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, radius } from '../theme/tokens';
import { dayLabel, initials } from '../utils/format';
import { useBucketColor } from './CategoryPicker';

interface Props {
  txn: TxnView;
  first: boolean;
  onPress: () => void;
  onCategorize: () => void;
}

export function tagsFor(t: TxnView): string[] {
  const tags: string[] = [];
  if (t.is_transfer) tags.push('Transfer');
  if (t.is_refund) tags.push('Refund');
  if (t.is_reimbursable) tags.push('Reimbursable');
  if (t.is_emergency) tags.push('Emergency');
  return tags;
}

// Brief §9.3 row: initials, merchant, category chip, account, amount
// (neutral for money out, green "+" for money in).
export function TxnRow({ txn, first, onPress, onCategorize }: Props) {
  const { c } = useTheme();
  const colorOf = useBucketColor();
  const name = txn.merchant_name ?? txn.merchant_raw ?? 'Payment';
  const credit = txn.direction === 'credit';
  const bucket = txn.category_bucket as CategoryBucket | null;
  const catLabel =
    txn.category_name && bucket
      ? bucket === 'transfer' || bucket === 'income' || bucket === 'emergency'
        ? txn.category_name
        : `${txn.category_name} · ${BUCKET_LABELS[bucket].replace(
            ' / EMI',
            '',
          )}`
      : null;
  const tags = tagsFor(txn);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${
        credit ? 'received' : 'paid'
      } ${Math.round(txn.amount / 100)} rupees, ${dayLabel(txn.occurred_at)}, ${
        catLabel ?? 'not categorised'
      }`}
      style={({ pressed }) => [
        styles.row,
        !first && { borderTopWidth: 1, borderTopColor: c.border },
        pressed && { opacity: 0.7 },
      ]}
    >
      <View
        style={[
          styles.avatar,
          { backgroundColor: c.surfaceRaised, borderColor: c.border },
        ]}
      >
        <Text style={[styles.avatarText, { color: c.textSecondary }]}>
          {initials(name)}
        </Text>
      </View>
      <View style={styles.body}>
        <Txt variant="bodyMedium" numberOfLines={1}>
          {name}
        </Txt>
        <View style={styles.meta}>
          {catLabel ? (
            <View style={styles.cat}>
              <View
                style={[styles.dot, { backgroundColor: colorOf(bucket) }]}
              />
              <Txt variant="caption" tone="secondary">
                {catLabel}
              </Txt>
            </View>
          ) : (
            <Pressable
              onPress={onCategorize}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Categorize ${name}`}
              style={[styles.pill, { backgroundColor: c.gold }]}
            >
              <Text style={[styles.pillText, { color: c.onGold }]}>
                Categorize
              </Text>
            </Pressable>
          )}
          {txn.account_mask ? (
            <Txt variant="caption" tone="tertiary">
              ••{txn.account_mask}
            </Txt>
          ) : txn.account_name ? (
            <Txt variant="caption" tone="tertiary">
              {txn.account_name}
            </Txt>
          ) : null}
          {tags.map(tag => (
            <View key={tag} style={[styles.tag, { borderColor: c.border }]}>
              <Text style={[styles.tagText, { color: c.textSecondary }]}>
                {tag}
              </Text>
            </View>
          ))}
        </View>
      </View>
      <Amount
        value={txn.amount / 100}
        sign={credit ? '+' : '−'}
        color={credit ? c.status.onTrack : undefined}
        size={16}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 68,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  body: { flex: 1, minWidth: 0 },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  cat: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  pill: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: radius.chip,
  },
  pillText: { fontFamily: fonts.interSemiBold, fontSize: 12 },
  tag: {
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: radius.chip,
  },
  tagText: { fontFamily: fonts.interMedium, fontSize: 10.5 },
});
