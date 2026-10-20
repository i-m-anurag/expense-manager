import { allSenderCodes, bundledTemplates } from '@expense-manager/parser';
import React, { useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { Toggle } from '../components/Toggle';
import { Txt } from '../components/Txt';
import { useData, useQuery } from '../data/DataProvider';
import { usePrivacy } from '../data/Privacy';
import {
  Account,
  AccountType,
  listAccounts,
  updateAccount,
} from '../db/accounts';
import { SecureStore } from '../db/connection';
import { countUnparsed } from '../db/rawSms';
import { getSetting, setSetting } from '../db/settings';
import { setCycleMode } from '../domain/budget';
import { ingestMessages } from '../domain/ingest';
import { deleteAllData } from '../domain/reset';
import { ScreenProps } from '../navigation/types';
import {
  ACCOUNT_TYPE_LABELS,
  useOnboarding,
} from '../onboarding/OnboardingContext';
import { SCAN_DAYS } from '../sms/scan';
import { SmsInbox } from '../sms/SmsInbox';
import { ThemePref, useTheme } from '../theme/ThemeProvider';
import { fonts, screenPadding } from '../theme/tokens';
import { ordinal } from '../utils/format';
import { APP_VERSION, SOURCE_URL, WEBSITE_URL } from '../version';

type Dialog =
  | { kind: 'name' }
  | { kind: 'cycle' }
  | { kind: 'account'; account: Account }
  | { kind: 'delete' }
  | null;

const THEMES: { id: ThemePref; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

// PRD §7.11 Settings, as a grouped list (brief §9.9).
export function SettingsScreen({ navigation }: ScreenProps<'Settings'>) {
  const { c, pref, setPref } = useTheme();
  const insets = useSafeAreaInsets();
  const { sql, refresh } = useData();
  const { hidden, toggle } = usePrivacy();
  const onboarding = useOnboarding();
  const name = useQuery(s => getSetting(s, 'user_name'), []);
  const mode = useQuery(s => getSetting(s, 'cycle_mode'), []) ?? 'calendar';
  const salaryDay = Number(useQuery(s => getSetting(s, 'salary_day'), []) ?? 1);
  const accounts = useQuery(listAccounts, []) ?? [];
  const unparsed = useQuery(countUnparsed, []) ?? 0;
  const [dialog, setDialog] = useState<Dialog>(null);
  const [text, setText] = useState('');
  const [draftMode, setDraftMode] = useState<'calendar' | 'salary'>('calendar');
  const [draftType, setDraftType] = useState<AccountType>('savings');
  const [scanNote, setScanNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const banks = bundledTemplates().map(t => t.bank);

  const openName = () => {
    setText(name ?? '');
    setDialog({ kind: 'name' });
  };
  const openCycle = () => {
    setDraftMode(mode === 'salary' ? 'salary' : 'calendar');
    setText(String(salaryDay));
    setDialog({ kind: 'cycle' });
  };
  const openAccount = (a: Account) => {
    setText(a.display_name);
    setDraftType(a.type);
    setDialog({ kind: 'account', account: a });
  };

  const saveName = async () => {
    await setSetting(sql, 'user_name', text.trim());
    setDialog(null);
    refresh();
  };
  const saveCycle = async () => {
    const day = Math.min(31, Math.max(1, parseInt(text, 10) || 1));
    await setCycleMode(sql, draftMode, day);
    setDialog(null);
    refresh();
  };
  const saveAccount = async (a: Account) => {
    await updateAccount(sql, a.id, {
      display_name: text.trim() || a.display_name,
      type: draftType,
    });
    setDialog(null);
    refresh();
  };
  const toggleInclude = async (a: Account, include: boolean) => {
    await updateAccount(sql, a.id, { include_in_budget: include });
    refresh();
  };
  const changeTheme = async (p: ThemePref) => {
    setPref(p);
    await setSetting(sql, 'theme', p);
  };

  // SET-06: re-read the last 90 days; anything already stored is skipped.
  const rescan = async () => {
    setBusy(true);
    setScanNote(null);
    try {
      if (!(await SmsInbox.hasPermission())) {
        setScanNote(
          'SMS access is off. Turn it on in Android settings to scan.',
        );
        return;
      }
      const templates = bundledTemplates();
      const messages = await SmsInbox.readInbox(
        Date.now() - SCAN_DAYS * 24 * 3600 * 1000,
        allSenderCodes(templates),
      );
      const r = await ingestMessages(sql, messages, templates);
      setScanNote(
        r.inserted.length
          ? `Added ${r.inserted.length} new transaction${
              r.inserted.length === 1 ? '' : 's'
            }.`
          : 'All caught up. No new transactions found.',
      );
      refresh();
    } finally {
      setBusy(false);
    }
  };

  // SEC-07: delete everything and start again from the welcome screen.
  const deleteEverything = async () => {
    setBusy(true);
    await deleteAllData(sql);
    await SecureStore.clearPin();
    setPref('system');
    if (hidden) toggle();
    onboarding.reset();
    setBusy(false);
    setDialog(null);
    refresh();
    navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
  };

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
          Settings
        </Txt>

        <Group title="Profile">
          <Row
            label="Your name"
            value={name || 'Add your name'}
            onPress={openName}
            first
          />
        </Group>

        <Group title="Budget">
          <Row
            label="Budget resets on"
            value={
              mode === 'salary'
                ? `Salary day (${ordinal(salaryDay)})`
                : '1st of every month'
            }
            onPress={openCycle}
            first
          />
          <Row
            label="Edit budget"
            onPress={() => navigation.navigate('EditBudget')}
          />
          <Row
            label="Emergency fund"
            onPress={() => navigation.navigate('EmergencyFund')}
          />
        </Group>

        <Group
          title="Accounts"
          note="Switch off an account to keep it out of your budget."
        >
          {accounts.map((a, i) => (
            <View
              key={a.id}
              style={[
                styles.row,
                i > 0 && { borderTopWidth: 1, borderTopColor: c.border },
              ]}
            >
              <Pressable
                onPress={() => openAccount(a)}
                accessibilityRole="button"
                accessibilityLabel={`Edit ${a.display_name}`}
                style={styles.flex}
              >
                <Txt variant="bodyMedium">{a.display_name}</Txt>
                <Txt variant="caption" tone="tertiary">
                  {ACCOUNT_TYPE_LABELS[a.type]}
                </Txt>
              </Pressable>
              <Toggle
                value={!!a.include_in_budget}
                onChange={v => toggleInclude(a, v)}
                label={`Include ${a.display_name} in budget`}
              />
            </View>
          ))}
        </Group>

        <Group title="Appearance">
          <View style={styles.row}>
            <Txt variant="bodyMedium" style={styles.flex}>
              Theme
            </Txt>
            <View style={styles.chips}>
              {THEMES.map(t => (
                <Chip
                  key={t.id}
                  label={t.label}
                  selected={pref === t.id}
                  onPress={() => changeTheme(t.id)}
                />
              ))}
            </View>
          </View>
          <View
            style={[
              styles.row,
              { borderTopWidth: 1, borderTopColor: c.border },
            ]}
          >
            <View style={styles.flex}>
              <Txt variant="bodyMedium">Hide amounts</Txt>
              <Txt variant="caption" tone="tertiary">
                Same as the eye on Home. Turns off when you reopen the app.
              </Txt>
            </View>
            <Toggle value={hidden} onChange={toggle} label="Hide amounts" />
          </View>
        </Group>

        <Group
          title="SMS and data"
          note="Everything stays on this phone, encrypted."
        >
          <Row
            label={busy ? 'Scanning…' : 'Re-scan bank SMS'}
            value={scanNote ?? `Last ${SCAN_DAYS} days`}
            onPress={busy ? undefined : rescan}
            first
          />
          <Row
            label="SMS we couldn't read"
            value={unparsed ? `${unparsed}` : 'None'}
            onPress={() => navigation.navigate('UnparsedSms')}
          />
          <Row
            label="Delete all data and start again"
            danger
            onPress={() => setDialog({ kind: 'delete' })}
          />
        </Group>

        <Group title="About">
          <Row label="Version" value={APP_VERSION} first />
          <Row label="Supported banks" value={banks.join(', ')} />
          <Row label="Licence" value="Open source, GPLv3" />
          <Row
            label="Source code"
            value="GitHub"
            onPress={() => Linking.openURL(SOURCE_URL)}
          />
          <Row
            label="Website"
            value="expansemanager.com"
            onPress={() => Linking.openURL(WEBSITE_URL)}
          />
        </Group>
        <Txt variant="caption" tone="tertiary" center style={styles.tagline}>
          Every rupee, in its place.
        </Txt>
      </ScrollView>

      {dialog?.kind === 'name' ? (
        <Sheet
          visible
          onClose={() => setDialog(null)}
          accessibilityLabel="Your name"
        >
          <Txt variant="h1">Your name</Txt>
          <Txt tone="secondary" style={styles.mt8}>
            Used for the greeting on Home.
          </Txt>
          <Input value={text} onChangeText={setText} placeholder="Name" />
          <Button label="Save" onPress={saveName} style={styles.mt16} />
        </Sheet>
      ) : null}

      {dialog?.kind === 'cycle' ? (
        <Sheet
          visible
          onClose={() => setDialog(null)}
          accessibilityLabel="Budget resets on"
        >
          <Txt variant="h1">Budget resets on</Txt>
          <Txt tone="secondary" style={styles.mt8}>
            Your current cycle moves to the new dates straight away. Your plan
            stays the same.
          </Txt>
          <View style={[styles.chips, styles.mt16]}>
            <Chip
              label="1st of every month"
              selected={draftMode === 'calendar'}
              onPress={() => setDraftMode('calendar')}
            />
            <Chip
              label="Salary day"
              selected={draftMode === 'salary'}
              onPress={() => setDraftMode('salary')}
            />
          </View>
          {draftMode === 'salary' ? (
            <>
              <Txt variant="label" tone="secondary" style={styles.mt16}>
                Salary arrives on day
              </Txt>
              <Input
                value={text}
                onChangeText={t => setText(t.replace(/\D/g, '').slice(0, 2))}
                placeholder="1"
                keyboardType="number-pad"
              />
            </>
          ) : null}
          <Button label="Save" onPress={saveCycle} style={styles.mt16} />
        </Sheet>
      ) : null}

      {dialog?.kind === 'account' ? (
        <Sheet
          visible
          onClose={() => setDialog(null)}
          accessibilityLabel="Edit account"
        >
          <Txt variant="h1">Edit account</Txt>
          <Input
            value={text}
            onChangeText={setText}
            placeholder="Account name"
          />
          <Txt variant="label" tone="secondary" style={styles.mt16}>
            Type
          </Txt>
          <View style={[styles.chips, styles.mt8, styles.wrap]}>
            {(Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[]).map(t => (
              <Chip
                key={t}
                label={ACCOUNT_TYPE_LABELS[t]}
                selected={draftType === t}
                onPress={() => setDraftType(t)}
              />
            ))}
          </View>
          <Button
            label="Save"
            onPress={() => saveAccount(dialog.account)}
            style={styles.mt16}
          />
        </Sheet>
      ) : null}

      {dialog?.kind === 'delete' ? (
        <Sheet
          visible
          onClose={() => setDialog(null)}
          accessibilityLabel="Delete all data"
        >
          <Txt variant="h1">Delete all data?</Txt>
          <Txt tone="secondary" style={styles.mt8}>
            This removes every transaction, account, budget, category you taught
            the app and your PIN from this phone. It can't be undone. Your bank
            SMS stay in your inbox, so you can scan them again during
            onboarding.
          </Txt>
          <Pressable
            onPress={busy ? undefined : deleteEverything}
            accessibilityRole="button"
            style={[styles.danger, { backgroundColor: c.status.over }]}
          >
            <Txt variant="bodySemi" color="#FFFFFF">
              {busy ? 'Deleting…' : 'Delete everything and start again'}
            </Txt>
          </Pressable>
          <Button
            label="Keep my data"
            kind="ghost"
            onPress={() => setDialog(null)}
            style={styles.mt8}
          />
        </Sheet>
      ) : null}
    </View>
  );
}

function Group({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.group}>
      <Txt variant="label" tone="secondary" style={styles.groupTitle}>
        {title}
      </Txt>
      <Card style={styles.groupCard}>{children}</Card>
      {note ? (
        <Txt variant="caption" tone="tertiary" style={styles.note}>
          {note}
        </Txt>
      ) : null}
    </View>
  );
}

function Row({
  label,
  value,
  onPress,
  first,
  danger,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  first?: boolean;
  danger?: boolean;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={[
        styles.row,
        !first && { borderTopWidth: 1, borderTopColor: c.border },
      ]}
    >
      <View style={styles.flex}>
        <Txt variant="bodyMedium" color={danger ? c.status.over : undefined}>
          {label}
        </Txt>
        {value ? (
          <Txt variant="caption" tone="tertiary" numberOfLines={2}>
            {value}
          </Txt>
        ) : null}
      </View>
      {onPress ? (
        <Icon name="chevronRight" size={18} color={c.textTertiary} />
      ) : null}
    </Pressable>
  );
}

function Input(props: React.ComponentProps<typeof TextInput>) {
  const { c } = useTheme();
  return (
    <TextInput
      autoFocus
      placeholderTextColor={c.textTertiary}
      {...props}
      style={[
        styles.input,
        {
          color: c.textPrimary,
          borderColor: c.border,
          backgroundColor: c.surface,
        },
      ]}
    />
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
  group: { marginTop: 24 },
  groupTitle: {
    fontFamily: fonts.interSemiBold,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  groupCard: { paddingVertical: 0 },
  note: { marginTop: 8, paddingHorizontal: 4 },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  flex: { flex: 1 },
  chips: { flexDirection: 'row', gap: 6 },
  wrap: { flexWrap: 'wrap' },
  mt8: { marginTop: 8 },
  mt16: { marginTop: 16 },
  input: {
    marginTop: 16,
    height: 52,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontFamily: fonts.inter,
    fontSize: 15,
  },
  danger: {
    marginTop: 20,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagline: { marginTop: 28 },
});
