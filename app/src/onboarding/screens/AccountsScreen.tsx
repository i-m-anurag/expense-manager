import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Card } from '../../components/Card';
import { Chip } from '../../components/Chip';
import { Icon } from '../../components/Icon';
import { Toggle } from '../../components/Toggle';
import { Txt } from '../../components/Txt';
import { useTheme } from '../../theme/ThemeProvider';
import { fonts } from '../../theme/tokens';
import {
  ACCOUNT_TYPE_LABELS,
  AccountType,
  useOnboarding,
} from '../OnboardingContext';
import { OnboardingLayout } from '../OnboardingLayout';
import { useNextStep } from '../flow';
import { ScannedAccount } from '../sampleScan';

const TYPES = Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[];

export function AccountsScreen() {
  const { state, update } = useOnboarding();
  const next = useNextStep('Accounts');

  const patch = (id: string, p: Partial<ScannedAccount>) =>
    update({
      accounts: state.accounts.map(a => (a.id === id ? { ...a, ...p } : a)),
    });

  // An account marked as the emergency fund becomes the fund's linked account
  // and stays out of the monthly budget (ACC-04).
  const setType = (id: string, type: AccountType) => {
    const emergency = type === 'emergency';
    update({
      accounts: state.accounts.map(a =>
        a.id === id
          ? { ...a, type, include: emergency ? false : a.include }
          : a,
      ),
      ...(emergency ? { emergencyAccountId: id } : {}),
    });
  };

  return (
    <OnboardingLayout
      stage={2}
      onSkip={() => next()}
      cta="Continue"
      onCta={() => next()}
    >
      <Txt variant="h1" accessibilityRole="header">
        Accounts we found
      </Txt>
      <Txt tone="secondary" style={styles.mt8}>
        Choose which ones count towards your budget.
      </Txt>
      <View style={styles.list}>
        {state.accounts.map(a => (
          <AccountCard
            key={a.id}
            account={a}
            onRename={name => patch(a.id, { name })}
            onType={type => setType(a.id, type)}
            onInclude={include => patch(a.id, { include })}
          />
        ))}
      </View>
      <Txt variant="caption" tone="tertiary" style={styles.hint}>
        Toggle = include in budget. Tap the pencil to rename, or the label to
        change the type.
      </Txt>
    </OnboardingLayout>
  );
}

interface CardProps {
  account: ScannedAccount;
  onRename: (name: string) => void;
  onType: (type: AccountType) => void;
  onInclude: (include: boolean) => void;
}

function AccountCard({ account, onRename, onType, onInclude }: CardProps) {
  const { c } = useTheme();
  const [editing, setEditing] = useState(false);
  const [picking, setPicking] = useState(false);
  const [draft, setDraft] = useState(account.name);

  const commit = () => {
    setEditing(false);
    if (draft.trim()) {
      onRename(draft.trim());
    } else {
      setDraft(account.name);
    }
  };

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <View
          style={[
            styles.bank,
            { backgroundColor: c.surfaceRaised, borderColor: c.border },
          ]}
        >
          <Icon name="bank" size={20} color={c.textSecondary} />
        </View>
        <View style={styles.flex}>
          {editing ? (
            <TextInput
              value={draft}
              onChangeText={setDraft}
              onBlur={commit}
              onSubmitEditing={commit}
              autoFocus
              selectTextOnFocus
              returnKeyType="done"
              accessibilityLabel="Account name"
              style={[
                styles.input,
                { color: c.textPrimary, borderBottomColor: c.gold },
              ]}
            />
          ) : (
            <Pressable
              onPress={() => setEditing(true)}
              accessibilityRole="button"
              accessibilityLabel={`Rename ${account.name}`}
              style={styles.nameRow}
            >
              <Txt variant="bodySemi" numberOfLines={1} style={styles.shrink}>
                {account.name}
              </Txt>
              <Icon name="pencil" size={13} color={c.textTertiary} />
            </Pressable>
          )}
          <Pressable
            onPress={() => setPicking(p => !p)}
            accessibilityRole="button"
            accessibilityLabel={`Account type: ${
              ACCOUNT_TYPE_LABELS[account.type]
            }. Change`}
            hitSlop={8}
            style={[styles.typePill, { backgroundColor: c.goldTint }]}
          >
            <Txt variant="caption" tone="gold" style={styles.typeText}>
              {ACCOUNT_TYPE_LABELS[account.type]}
            </Txt>
          </Pressable>
        </View>
        <Toggle
          value={account.include}
          onChange={onInclude}
          label={`Include ${account.name} in budget`}
        />
      </View>
      {picking ? (
        <View style={styles.types}>
          {TYPES.map(t => (
            <Chip
              key={t}
              label={ACCOUNT_TYPE_LABELS[t]}
              selected={t === account.type}
              onPress={() => {
                onType(t);
                setPicking(false);
              }}
            />
          ))}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  mt8: { marginTop: 8 },
  list: { marginTop: 16, gap: 10 },
  card: { paddingVertical: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bank: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 24,
  },
  input: {
    fontFamily: fonts.interSemiBold,
    fontSize: 15,
    padding: 0,
    borderBottomWidth: 1,
    minHeight: 24,
  },
  typePill: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: 999,
  },
  typeText: { fontFamily: fonts.interMedium, fontSize: 11 },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  hint: { marginTop: 12, paddingHorizontal: 4 },
});
