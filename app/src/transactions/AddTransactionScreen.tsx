import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { Icon } from '../components/Icon';
import { Txt } from '../components/Txt';
import { useData, useQuery } from '../data/DataProvider';
import { CASH_WALLET_ID, listAccounts } from '../db/accounts';
import { addManualTxn } from '../domain/actions';
import { ScreenProps } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, screenPadding } from '../theme/tokens';
import { groupINR } from '../utils/format';
import { CategoryPicker } from './CategoryPicker';

const DAY_MS = 24 * 3600 * 1000;

// PRD TXN-04: cash spending and payments the bank didn't SMS about.
export function AddTransactionScreen({
  navigation,
}: ScreenProps<'AddTransaction'>) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { sql, refresh } = useData();
  const accounts = useQuery(listAccounts, []) ?? [];
  const [amountText, setAmountText] = useState('');
  const [merchant, setMerchant] = useState('');
  const [direction, setDirection] = useState<'debit' | 'credit'>('debit');
  const [accountId, setAccountId] = useState(CASH_WALLET_ID);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [daysAgo, setDaysAgo] = useState(0);

  const rupees = parseInt(amountText.replace(/\D/g, ''), 10) || 0;
  const valid = rupees > 0 && merchant.trim().length > 0;

  const save = async () => {
    await addManualTxn(sql, {
      amountPaise: rupees * 100,
      merchant: merchant.trim(),
      accountId,
      categoryId: direction === 'debit' ? categoryId : 'income.other',
      direction,
      occurredAt: Date.now() - daysAgo * DAY_MS,
    });
    refresh();
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}
      behavior="height"
    >
      <View style={styles.topBar}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Icon name="close" size={24} color={c.textSecondary} />
        </Pressable>
        <Txt variant="bodySemi">Add payment</Txt>
        <View style={styles.spacer} />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.amountRow}>
          <Text style={[styles.rupee, { color: c.textSecondary }]}>₹</Text>
          <TextInput
            value={amountText ? groupINR(rupees) : ''}
            onChangeText={setAmountText}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={c.textTertiary}
            autoFocus
            accessibilityLabel="Amount in rupees"
            style={[styles.amount, { color: c.textPrimary }]}
          />
        </View>
        <View style={styles.row}>
          <Chip
            label="Money out"
            selected={direction === 'debit'}
            onPress={() => setDirection('debit')}
          />
          <Chip
            label="Money in"
            selected={direction === 'credit'}
            onPress={() => setDirection('credit')}
          />
        </View>

        <Txt variant="label" tone="secondary" style={styles.label}>
          {direction === 'debit' ? 'Paid to' : 'Received from'}
        </Txt>
        <TextInput
          value={merchant}
          onChangeText={setMerchant}
          placeholder={
            direction === 'debit'
              ? 'For example, Chai stall'
              : 'For example, Rakesh Kumar'
          }
          placeholderTextColor={c.textTertiary}
          accessibilityLabel={
            direction === 'debit' ? 'Paid to' : 'Received from'
          }
          style={[
            styles.input,
            {
              color: c.textPrimary,
              borderColor: c.border,
              backgroundColor: c.surface,
            },
          ]}
        />

        <Txt variant="label" tone="secondary" style={styles.label}>
          Account
        </Txt>
        <View style={styles.wrap}>
          {accounts.map(a => (
            <Chip
              key={a.id}
              label={a.display_name}
              selected={a.id === accountId}
              onPress={() => setAccountId(a.id)}
            />
          ))}
        </View>

        <Txt variant="label" tone="secondary" style={styles.label}>
          When
        </Txt>
        <View style={styles.row}>
          {['Today', 'Yesterday', '2 days ago'].map((l, i) => (
            <Chip
              key={l}
              label={l}
              selected={daysAgo === i}
              onPress={() => setDaysAgo(i)}
            />
          ))}
        </View>

        {direction === 'debit' ? (
          <View style={styles.section}>
            <CategoryPicker value={categoryId} onChange={setCategoryId} />
          </View>
        ) : null}
      </ScrollView>
      <View
        style={[
          styles.footer,
          { paddingBottom: Math.max(insets.bottom, 12) + 16 },
        ]}
      >
        <Button label="Save" onPress={save} disabled={!valid} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    height: 48,
    paddingHorizontal: screenPadding,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  spacer: { width: 24 },
  content: { paddingHorizontal: screenPadding, paddingBottom: 24 },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginTop: 16,
  },
  rupee: { fontFamily: fonts.manropeSemiBold, fontSize: 28, marginRight: 4 },
  amount: {
    fontFamily: fonts.manropeBold,
    fontSize: 44,
    padding: 0,
    minWidth: 60,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    justifyContent: 'center',
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  label: { marginTop: 22, marginBottom: 10 },
  input: {
    height: 52,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontFamily: fonts.inter,
    fontSize: 15,
  },
  section: { marginTop: 22 },
  footer: { paddingHorizontal: screenPadding, paddingTop: 12 },
});
