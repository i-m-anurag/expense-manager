import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { Txt } from '../components/Txt';
import { useData } from '../data/DataProvider';
import { SecureStore } from '../db/connection';
import { setSetting } from '../db/settings';
import { ScreenProps } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, screenPadding } from '../theme/tokens';
import { PIN_LENGTH, PinDots, PinPad } from './PinPad';

type Step = 'current' | 'new' | 'confirm';

// Set or change the app-lock PIN from Settings. Changing it asks for the
// current PIN first.
export function SetPinScreen({ navigation }: ScreenProps<'SetPin'>) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { sql, refresh } = useData();
  const [step, setStep] = useState<Step | null>(null);
  const [entry, setEntry] = useState('');
  const [first, setFirst] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    SecureStore.hasPin().then(has => setStep(has ? 'current' : 'new'));
  }, []);

  const press = async (d: string) => {
    const value = (entry + d).slice(0, PIN_LENGTH);
    setEntry(value);
    setError(null);
    if (value.length < PIN_LENGTH) return;
    setEntry('');
    if (step === 'current') {
      if (await SecureStore.verifyPin(value)) setStep('new');
      else setError('That PIN is not right.');
    } else if (step === 'new') {
      setFirst(value);
      setStep('confirm');
    } else if (value === first) {
      await SecureStore.setPin(value);
      await setSetting(sql, 'lock_enabled', '1');
      refresh();
      navigation.goBack();
    } else {
      setError("PINs didn't match. Try again.");
      setStep('new');
    }
  };

  const title =
    step === 'current'
      ? 'Enter your current PIN'
      : step === 'confirm'
      ? 'Enter it again to confirm'
      : `Choose a ${PIN_LENGTH}-digit PIN`;

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
      <Txt style={styles.title} center accessibilityRole="header">
        App lock PIN
      </Txt>
      <Txt
        center
        tone={error ? undefined : 'secondary'}
        color={error ? c.status.over : undefined}
        style={styles.mt8}
        accessibilityLiveRegion="polite"
      >
        {error ?? title}
      </Txt>
      <View style={styles.mt28}>
        <PinDots filled={entry.length} error={!!error} />
      </View>
      <View style={styles.mt36}>
        <PinPad
          onDigit={press}
          onDelete={() => setEntry(e => e.slice(0, -1))}
          disabled={!step}
        />
      </View>
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
  title: { fontFamily: fonts.manropeBold, fontSize: 28, marginTop: 24 },
  mt8: { marginTop: 8 },
  mt28: { marginTop: 28 },
  mt36: { marginTop: 36 },
});
