import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Amount } from '../components/Amount';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { Toggle } from '../components/Toggle';
import { Txt } from '../components/Txt';
import { useData, useQuery } from '../data/DataProvider';
import { getTxn } from '../db/transactions';
import {
  Flag,
  markEmergency,
  pastPaymentsCount,
  setCategory,
  setNote,
  toggleFlag,
  unmarkEmergency,
} from '../domain/actions';
import { ScreenProps } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, screenPadding } from '../theme/tokens';
import { dateTimeLabel } from '../utils/format';
import { CategoryPicker } from './CategoryPicker';

type Dialog = 'emergency' | 'note' | null;

// Brief §9.4 / PRD TXN-02, TXN-05.
export function TransactionDetailScreen({
  navigation,
  route,
}: ScreenProps<'TransactionDetail'>) {
  const { c, name } = useTheme();
  const insets = useSafeAreaInsets();
  const { sql, refresh } = useData();
  const txn = useQuery(s => getTxn(s, route.params.id), [route.params.id]);
  const past = useQuery(
    s => pastPaymentsCount(s, txn?.merchant_key ?? null),
    [txn?.merchant_key],
  );
  const [remember, setRemember] = useState(true);
  const [smsOpen, setSmsOpen] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [text, setText] = useState('');

  if (!txn) {
    return <View style={[styles.root, { backgroundColor: c.bg }]} />;
  }
  const merchant = txn.merchant_name ?? txn.merchant_raw ?? 'Payment';
  const credit = txn.direction === 'credit';
  const selected = txn.category_id ?? txn.suggested_category_id;

  const pick = async (categoryId: string) => {
    await setCategory(sql, txn.id, categoryId, remember);
    refresh();
  };
  const flag = async (f: Flag) => {
    await toggleFlag(sql, txn.id, f, !txn[f]);
    refresh();
  };

  const confidence =
    txn.categorization_source === 'memory'
      ? `Auto-categorized · based on ${past ?? 0} past payment${
          past === 1 ? '' : 's'
        }`
      : txn.categorization_source === 'user'
      ? 'You chose this'
      : txn.suggested_category_id
      ? 'Suggested · tap a bucket to confirm'
      : txn.category_id
      ? 'Set automatically'
      : 'Not categorised yet';

  const actions: {
    label: string;
    on?: boolean;
    onPress?: () => void;
    hint?: string;
  }[] = [
    { label: 'Split this payment', hint: 'Coming soon' },
    {
      label: 'Mark as transfer',
      on: !!txn.is_transfer,
      onPress: () => flag('is_transfer'),
    },
    {
      label: 'Mark as refund',
      on: !!txn.is_refund,
      onPress: () => flag('is_refund'),
    },
    {
      label: 'Mark as reimbursable',
      on: !!txn.is_reimbursable,
      onPress: () => flag('is_reimbursable'),
    },
    {
      label: 'Paid from emergency fund',
      on: !!txn.is_emergency,
      onPress: async () => {
        if (txn.is_emergency) {
          await unmarkEmergency(sql, txn.id);
          refresh();
        } else {
          setText('');
          setDialog('emergency');
        }
      },
    },
    {
      label: txn.note ? 'Edit note' : 'Add note',
      hint: txn.note ?? undefined,
      onPress: () => {
        setText(txn.note ?? '');
        setDialog('note');
      },
    },
  ];

  const submitDialog = async () => {
    if (dialog === 'emergency') {
      if (!text.trim()) {
        return;
      }
      await markEmergency(sql, txn.id, text.trim());
    } else if (dialog === 'note') {
      await setNote(sql, txn.id, text);
    }
    setDialog(null);
    refresh();
  };

  return (
    <View
      style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}
    >
      <StatusBar
        barStyle={name === 'dark' ? 'light-content' : 'dark-content'}
      />
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
          { paddingBottom: insets.bottom + 28 },
        ]}
      >
        <View style={styles.hero}>
          <Amount
            value={txn.amount / 100}
            size={40}
            family={fonts.manropeBold}
            sign={credit ? '+' : undefined}
            color={credit ? c.status.onTrack : undefined}
            showPaise
          />
          <Txt style={styles.merchant}>{merchant}</Txt>
          <Txt variant="label" tone="secondary" style={styles.regular}>
            {dateTimeLabel(txn.occurred_at)}
            {txn.account_name ? ` · ${txn.account_name}` : ''}
          </Txt>
        </View>

        {!credit && !txn.is_transfer && !txn.is_emergency ? (
          <View style={styles.section}>
            <CategoryPicker value={selected} onChange={pick} />
            {txn.merchant_key ? (
              <Card style={styles.remember}>
                <View style={styles.flex}>
                  <Txt variant="bodyMedium">Always use this for {merchant}</Txt>
                  <Txt variant="caption" tone="tertiary" style={styles.mt2}>
                    {confidence}
                  </Txt>
                </View>
                <Toggle
                  value={remember}
                  onChange={setRemember}
                  label={`Always use this category for ${merchant}`}
                />
              </Card>
            ) : null}
          </View>
        ) : (
          <Card style={[styles.section, styles.categoryNote]}>
            <Txt variant="bodyMedium">
              {txn.category_name ??
                (credit ? 'Money in' : 'Not counted in budget')}
            </Txt>
            <Txt variant="caption" tone="tertiary" style={styles.mt2}>
              {txn.is_transfer
                ? 'Moved between your own accounts. Not counted as spending.'
                : txn.is_emergency
                ? `Paid from the emergency fund${
                    txn.note ? ` · ${txn.note}` : ''
                  }. Not counted in the monthly budget.`
                : 'Money in is not part of your spending budget.'}
            </Txt>
          </Card>
        )}

        <Card style={styles.actions}>
          {actions.map((a, i) => (
            <Pressable
              key={a.label}
              onPress={a.onPress}
              disabled={!a.onPress}
              accessibilityRole={a.on !== undefined ? 'switch' : 'button'}
              accessibilityState={
                a.on !== undefined
                  ? { checked: a.on }
                  : { disabled: !a.onPress }
              }
              style={[
                styles.action,
                i > 0 && { borderTopWidth: 1, borderTopColor: c.border },
              ]}
            >
              <View style={styles.flex}>
                <Txt
                  variant="bodyMedium"
                  tone={a.onPress ? 'primary' : 'tertiary'}
                >
                  {a.label}
                </Txt>
                {a.hint ? (
                  <Txt variant="caption" tone="tertiary" numberOfLines={1}>
                    {a.hint}
                  </Txt>
                ) : null}
              </View>
              {a.on ? (
                <Icon name="check" color={c.goldText} strokeWidth={2} />
              ) : a.onPress ? (
                <Icon name="chevronRight" size={18} color={c.textTertiary} />
              ) : null}
            </Pressable>
          ))}
        </Card>

        {txn.sms_body ? (
          <Card style={styles.sms}>
            <Pressable
              onPress={() => setSmsOpen(o => !o)}
              accessibilityRole="button"
              accessibilityState={{ expanded: smsOpen }}
              style={styles.smsHead}
            >
              <Txt variant="label" tone="secondary" style={styles.semi}>
                Source SMS
              </Txt>
              <Icon
                name={smsOpen ? 'chevronUp' : 'chevronDown'}
                size={18}
                color={c.textSecondary}
              />
            </Pressable>
            {smsOpen ? (
              <Text style={[styles.smsBody, { color: c.textSecondary }]}>
                {highlight(txn.sms_body, [
                  txn.merchant_raw,
                  txn.account_mask,
                  amountText(txn.amount),
                ]).map((part, i) =>
                  part.hit ? (
                    <Text
                      key={i}
                      style={[
                        styles.hit,
                        { backgroundColor: c.goldTint, color: c.goldText },
                      ]}
                    >
                      {part.text}
                    </Text>
                  ) : (
                    part.text
                  ),
                )}
              </Text>
            ) : null}
          </Card>
        ) : null}
      </ScrollView>

      {dialog ? (
        <Sheet
          visible
          onClose={() => setDialog(null)}
          accessibilityLabel={
            dialog === 'note' ? 'Note' : 'Paid from emergency fund'
          }
        >
          <Txt variant="h1">
            {dialog === 'note' ? 'Note' : 'Paid from emergency fund'}
          </Txt>
          <Txt tone="secondary" style={styles.mt8}>
            {dialog === 'note'
              ? 'Only you can see this.'
              : "It won't count against this month's budget. What was it for?"}
          </Txt>
          <TextInput
            value={text}
            onChangeText={setText}
            autoFocus
            placeholder={
              dialog === 'note' ? 'Add a note' : 'For example, hospital bill'
            }
            placeholderTextColor={c.textTertiary}
            accessibilityLabel={dialog === 'note' ? 'Note' : 'Reason'}
            style={[
              styles.input,
              {
                color: c.textPrimary,
                borderColor: c.border,
                backgroundColor: c.surface,
              },
            ]}
          />
          <Button
            label={dialog === 'note' ? 'Save note' : 'Mark as emergency'}
            onPress={submitDialog}
            disabled={dialog === 'emergency' && !text.trim()}
            style={styles.mt16}
          />
        </Sheet>
      ) : null}
    </View>
  );
}

const amountText = (paise: number) => {
  const r = paise / 100;
  return Number.isInteger(r) ? String(r) : r.toFixed(2);
};

// Splits the SMS into plain and highlighted runs for the extracted fields.
function highlight(body: string, needles: (string | null)[]) {
  const ranges: [number, number][] = [];
  for (const n of needles) {
    if (!n) {
      continue;
    }
    const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Amounts may carry thousands separators in the SMS ("1,00,000.00").
    const pattern = /^\d/.test(n)
      ? escaped.split('').join(',?') + '(?:\\.0+)?'
      : escaped;
    const m = new RegExp(pattern, 'i').exec(body);
    if (m) {
      ranges.push([m.index, m.index + m[0].length]);
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const parts: { text: string; hit: boolean }[] = [];
  let pos = 0;
  for (const [s, e] of ranges) {
    if (s < pos) {
      continue;
    }
    parts.push(
      { text: body.slice(pos, s), hit: false },
      { text: body.slice(s, e), hit: true },
    );
    pos = e;
  }
  parts.push({ text: body.slice(pos), hit: false });
  return parts;
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
  hero: { alignItems: 'center', paddingTop: 8 },
  merchant: { fontFamily: fonts.manropeSemiBold, fontSize: 18, marginTop: 12 },
  regular: { fontFamily: fonts.inter, marginTop: 4 },
  section: { marginTop: 22 },
  categoryNote: { paddingVertical: 14 },
  remember: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  flex: { flex: 1 },
  mt2: { marginTop: 2 },
  mt8: { marginTop: 8 },
  mt16: { marginTop: 16 },
  actions: { marginTop: 12, paddingVertical: 0 },
  action: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  sms: { marginTop: 12, paddingVertical: 14 },
  smsHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 24,
  },
  semi: { fontFamily: fonts.interSemiBold },
  smsBody: {
    fontFamily: fonts.inter,
    fontSize: 13,
    lineHeight: 25,
    marginTop: 8,
  },
  hit: { fontFamily: fonts.interSemiBold },
  input: {
    marginTop: 16,
    height: 52,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontFamily: fonts.inter,
    fontSize: 15,
  },
});
