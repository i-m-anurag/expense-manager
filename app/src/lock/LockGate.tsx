import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StatusBar, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { Txt } from '../components/Txt';
import { useData } from '../data/DataProvider';
import { usePrivacy } from '../data/Privacy';
import { SecureStore } from '../db/connection';
import { getSetting, isOn } from '../db/settings';
import { deleteAllData } from '../domain/reset';
import { navigationRef } from '../navigation/navigationRef';
import { Biometric } from '../notify/native';
import { useOnboarding } from '../onboarding/OnboardingContext';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, screenPadding } from '../theme/tokens';
import { PIN_LENGTH, PinDots, PinPad } from './PinPad';

const MAX_TRIES = 5;
const COOLDOWN_MS = 30_000;

interface LockConfig {
  enabled: boolean;
  biometric: boolean;
  afterMs: number;
  name: string | null;
}

// PRD SEC-03: lock on launch and after the app has been in the background for
// the chosen time (default 1 minute). Also applies screenshot blocking (SEC-09).
// The app stays mounted underneath, so unlocking returns to where you were.
export function LockGate({ children }: { children: React.ReactNode }) {
  const { sql, version } = useData();
  const [config, setConfig] = useState<LockConfig | null>(null);
  const [locked, setLocked] = useState(false);
  const leftAt = useRef<number | null>(null);
  const booted = useRef(false);

  useEffect(() => {
    (async () => {
      const hasPin = await SecureStore.hasPin();
      const cfg: LockConfig = {
        enabled:
          hasPin &&
          (await getSetting(sql, 'onboarded')) === '1' &&
          (await isOn(sql, 'lock_enabled')),
        biometric: await isOn(sql, 'lock_biometric'),
        afterMs: Number((await getSetting(sql, 'lock_after')) ?? 60) * 1000,
        name: await getSetting(sql, 'user_name'),
      };
      setConfig(cfg);
      SecureStore.setSecureWindow(await isOn(sql, 'block_screenshots'));
      if (!booted.current) {
        booted.current = true;
        setLocked(cfg.enabled);
      }
    })().catch(() => undefined);
  }, [sql, version]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', s => {
      if (s === 'background') {
        leftAt.current = Date.now();
      } else if (s === 'active' && leftAt.current !== null) {
        const away = Date.now() - leftAt.current;
        leftAt.current = null;
        if (config?.enabled && away >= config.afterMs) {
          setLocked(true);
        }
      }
    });
    return () => sub.remove();
  }, [config]);

  return (
    <View style={styles.flex}>
      {children}
      {locked && config ? (
        <View style={StyleSheet.absoluteFill}>
          <LockScreen config={config} onUnlock={() => setLocked(false)} />
        </View>
      ) : null}
    </View>
  );
}

function LockScreen({
  config,
  onUnlock,
}: {
  config: LockConfig;
  onUnlock: () => void;
}) {
  const { c, name, setPref } = useTheme();
  const insets = useSafeAreaInsets();
  const { sql, refresh } = useData();
  const onboarding = useOnboarding();
  const { hidden, toggle } = usePrivacy();
  const [entry, setEntry] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  const [waitUntil, setWaitUntil] = useState(0);
  const [forgot, setForgot] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const coolingDown = Date.now() < waitUntil;

  const tryBiometric = useCallback(async () => {
    if (await Biometric.authenticate('Unlock Expense Manager')) {
      onUnlock();
    }
  }, [onUnlock]);

  useEffect(() => {
    Biometric.isAvailable().then(ok => {
      const use = ok && config.biometric;
      setBioAvailable(use);
      if (use) {
        tryBiometric();
      }
    });
  }, [config.biometric, tryBiometric]);

  useEffect(() => {
    if (!coolingDown) return;
    const t = setTimeout(() => setWaitUntil(0), waitUntil - Date.now());
    return () => clearTimeout(t);
  }, [coolingDown, waitUntil]);

  const press = async (d: string) => {
    if (coolingDown) return;
    const value = (entry + d).slice(0, PIN_LENGTH);
    setEntry(value);
    setError(null);
    if (value.length < PIN_LENGTH) return;
    if (await SecureStore.verifyPin(value)) {
      setTries(0);
      setEntry('');
      onUnlock();
      return;
    }
    const n = tries + 1;
    setTries(n);
    setEntry('');
    if (n >= MAX_TRIES) {
      setWaitUntil(Date.now() + COOLDOWN_MS);
      setTries(0);
      setError('Too many tries. Wait 30 seconds.');
    } else {
      setError(
        `Wrong PIN. ${MAX_TRIES - n} tr${
          MAX_TRIES - n === 1 ? 'y' : 'ies'
        } left.`,
      );
    }
  };

  // The PIN can't be recovered (it never leaves the phone), so the only way
  // back in is to start over.
  const resetApp = async () => {
    await deleteAllData(sql);
    await SecureStore.clearPin();
    setPref('system');
    if (hidden) toggle();
    onboarding.reset();
    setForgot(false);
    onUnlock();
    refresh();
    navigationRef.current?.reset({ index: 0, routes: [{ name: 'Welcome' }] });
  };

  return (
    <View
      style={[
        styles.lock,
        {
          backgroundColor: c.bg,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
        },
      ]}
    >
      <StatusBar
        barStyle={name === 'dark' ? 'light-content' : 'dark-content'}
      />
      <Txt style={styles.brand} tone="gold">
        EXPENSE MANAGER
      </Txt>
      <View style={[styles.badge, { backgroundColor: c.goldTint }]}>
        <Icon name="lock" size={34} color={c.goldText} />
      </View>
      <Txt style={styles.welcome} center accessibilityRole="header">
        Welcome back{config.name ? `, ${config.name}` : ''}
      </Txt>
      <Txt
        tone={error ? undefined : 'secondary'}
        color={error ? c.status.over : undefined}
        center
        style={styles.mt6}
        accessibilityLiveRegion="polite"
      >
        {error ?? 'Enter your PIN to unlock'}
      </Txt>
      <View style={styles.mt28}>
        <PinDots filled={entry.length} error={!!error} />
      </View>
      <View style={styles.mt36}>
        <PinPad
          onDigit={press}
          onDelete={() => setEntry(e => e.slice(0, -1))}
          onBiometric={bioAvailable ? tryBiometric : undefined}
          disabled={coolingDown}
        />
      </View>
      <View style={styles.bottom}>
        <Pressable
          onPress={() => setForgot(true)}
          hitSlop={12}
          accessibilityRole="button"
        >
          <Txt variant="bodyMedium" tone="gold" center>
            Forgot PIN?
          </Txt>
        </Pressable>
        <Txt variant="caption" tone="tertiary" center style={styles.mt10}>
          Every rupee, in its place.
        </Txt>
      </View>

      {forgot ? (
        <Sheet
          visible
          onClose={() => setForgot(false)}
          accessibilityLabel="Forgot PIN"
        >
          <Txt variant="h1">Forgot your PIN?</Txt>
          <Txt tone="secondary" style={styles.mt8}>
            Your PIN never leaves this phone, so nobody can reset it for you, us
            included. To get back in, you can delete all data and set up the app
            again. Your bank SMS stay in your inbox and can be scanned again.
          </Txt>
          <Pressable
            onPress={resetApp}
            accessibilityRole="button"
            style={[styles.danger, { backgroundColor: c.status.over }]}
          >
            <Txt variant="bodySemi" color="#FFFFFF">
              Delete all data and start again
            </Txt>
          </Pressable>
          <Button
            label="Try my PIN again"
            kind="ghost"
            onPress={() => setForgot(false)}
            style={styles.mt8}
          />
        </Sheet>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  lock: { flex: 1, alignItems: 'center', paddingHorizontal: screenPadding },
  brand: { fontFamily: fonts.manropeBold, fontSize: 12, letterSpacing: 2 },
  badge: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 36,
  },
  welcome: {
    fontFamily: fonts.manropeBold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.4,
    marginTop: 20,
  },
  mt6: { marginTop: 6 },
  mt8: { marginTop: 8 },
  mt10: { marginTop: 10 },
  mt28: { marginTop: 28 },
  mt36: { marginTop: 36 },
  bottom: { marginTop: 'auto' },
  danger: {
    marginTop: 20,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
