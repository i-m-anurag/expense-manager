import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '../data/DataProvider';
import {
  BUCKET_LABELS,
  BUDGET_BUCKETS,
  Category,
  CategoryBucket,
  bucketOf,
  listCategories,
} from '../db/categories';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, radius } from '../theme/tokens';
import { Txt } from '../components/Txt';

export type BudgetBucket = (typeof BUDGET_BUCKETS)[number];

// Money in can go to any bucket: a refund in Want offsets Want spending,
// salary goes to Income, a top-up to the emergency fund.
export const CREDIT_BUCKETS: CategoryBucket[] = [
  ...BUDGET_BUCKETS,
  'emergency',
  'income',
];

export function useBucketColor() {
  const { c } = useTheme();
  // Income is green like other money in; transfers and uncategorised rows
  // get a neutral dot.
  return (bucket: string | null | undefined) =>
    bucket && bucket in c.bucket
      ? c.bucket[bucket as keyof typeof c.bucket]
      : bucket === 'income'
      ? c.status.onTrack
      : c.textTertiary;
}

interface Props {
  value: string | null; // selected category id
  onChange: (categoryId: string) => void;
  labels?: boolean;
  buckets?: CategoryBucket[];
  // Sub-categories to leave out (e.g. "Withdrawal" when money comes in).
  exclude?: string[];
}

// Bucket chips, then sub-category chips for the chosen bucket (brief §9.4).
// One tap on a bucket picks its first sub-category, so the common case is a
// single tap; a second tap refines it.
export function CategoryPicker({
  value,
  onChange,
  labels = true,
  buckets = [...BUDGET_BUCKETS],
  exclude = [],
}: Props) {
  const { c } = useTheme();
  const colorOf = useBucketColor();
  const categories = useQuery(listCategories, []) ?? [];
  const selectedBucket = value ? bucketOf(value) : null;
  const subs = categories.filter(
    x => x.bucket === selectedBucket && !exclude.includes(x.id),
  );

  const pickBucket = (b: CategoryBucket) => {
    if (b === selectedBucket) {
      return;
    }
    const first = categories.find(
      (x: Category) => x.bucket === b && !exclude.includes(x.id),
    );
    if (first) {
      onChange(first.id);
    }
  };

  return (
    <View>
      {labels ? (
        <Txt variant="label" tone="secondary" style={styles.label}>
          Bucket
        </Txt>
      ) : null}
      <View style={styles.wrap}>
        {buckets.map(b => {
          const on = b === selectedBucket;
          return (
            <Pressable
              key={b}
              onPress={() => pickBucket(b)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              style={[
                styles.bucket,
                {
                  borderColor: on ? c.gold : c.border,
                  backgroundColor: on ? c.goldTint : 'transparent',
                },
              ]}
            >
              <View style={[styles.dot, { backgroundColor: colorOf(b) }]} />
              <Text
                style={[
                  styles.bucketText,
                  { color: on ? c.goldText : c.textPrimary },
                ]}
              >
                {BUCKET_LABELS[b]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {subs.length ? (
        <>
          {labels ? (
            <Txt variant="label" tone="secondary" style={styles.label2}>
              Sub-category
            </Txt>
          ) : null}
          <View style={[styles.wrap, !labels && styles.mt10]}>
            {subs.map(s => {
              const on = s.id === value;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => onChange(s.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  style={[
                    styles.sub,
                    {
                      borderColor: on ? c.gold : c.border,
                      backgroundColor: on ? c.goldTint : 'transparent',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.subText,
                      { color: on ? c.goldText : c.textSecondary },
                    ]}
                  >
                    {s.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: 10 },
  label2: { marginTop: 16, marginBottom: 10 },
  mt10: { marginTop: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bucket: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: radius.chip,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  bucketText: { fontFamily: fonts.interSemiBold, fontSize: 14 },
  sub: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: radius.chip,
    borderWidth: 1,
    justifyContent: 'center',
  },
  subText: { fontFamily: fonts.interMedium, fontSize: 13 },
});
