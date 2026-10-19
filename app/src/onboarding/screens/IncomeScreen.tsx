import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Amount } from '../../components/Amount';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Txt } from '../../components/Txt';
import { useTheme } from '../../theme/ThemeProvider';
import { fonts } from '../../theme/tokens';
import { groupINR, ordinal } from '../../utils/format';
import { useOnboarding } from '../OnboardingContext';
import { OnboardingLayout } from '../OnboardingLayout';
import { useNextStep } from '../flow';
import { sampleScan } from '../sampleScan';

export function IncomeScreen() {
  const { c } = useTheme();
  const { state, update } = useOnboarding();
  const next = useNextStep('Income');
  // Salary was detected only if we scanned SMS; manual mode starts in edit mode (ONB-06).
  const detected = state.scanned;
  const [editing, setEditing] = useState(!detected);
  const [amountText, setAmountText] = useState(String(state.income));
  const [dayText, setDayText] = useState(String(state.cycleDay));

  const amount = parseInt(amountText.replace(/\D/g, ''), 10) || 0;
  const day = Math.min(31, Math.max(1, parseInt(dayText, 10) || 1));
  const valid = amount > 0;

  const save = () => {
    update({ income: amount, cycleDay: day, incomeConfirmed: true });
    setEditing(false);
  };

  return (
    <OnboardingLayout
      stage={2}
      onSkip={() => next()}
      cta="Continue"
      ctaDisabled={editing && !valid}
      onCta={() =>
        next(
          editing
            ? { income: amount, cycleDay: day, incomeConfirmed: true }
            : { incomeConfirmed: true },
        )
      }
      ghost="Use calendar month instead"
      onGhost={() =>
        next({
          cycleMode: 'calendar',
          cycleDay: 1,
          income: valid ? amount : state.income,
        })
      }
    >
      <Txt variant="h1" accessibilityRole="header">
        {detected ? 'We found your salary' : 'Your monthly income'}
      </Txt>

      <Card highlight style={styles.card}>
        {editing ? (
          <>
            <Txt variant="label" tone="secondary">
              Monthly salary
            </Txt>
            <View style={[styles.inputRow, { borderBottomColor: c.gold }]}>
              <Text style={[styles.rupee, { color: c.textSecondary }]}>₹</Text>
              <TextInput
                value={amountText ? groupINR(amount) : ''}
                onChangeText={setAmountText}
                keyboardType="number-pad"
                accessibilityLabel="Monthly salary in rupees"
                placeholder="0"
                placeholderTextColor={c.textTertiary}
                style={[styles.amountInput, { color: c.textPrimary }]}
              />
            </View>
            <Txt variant="label" tone="secondary" style={styles.mt20}>
              Salary day (day of month)
            </Txt>
            <TextInput
              value={dayText}
              onChangeText={t => setDayText(t.replace(/\D/g, '').slice(0, 2))}
              keyboardType="number-pad"
              accessibilityLabel="Salary day of month"
              style={[
                styles.dayInput,
                { color: c.textPrimary, borderBottomColor: c.border },
              ]}
            />
            <Button
              label="Save"
              onPress={save}
              disabled={!valid}
              style={styles.mt20}
              height={48}
            />
          </>
        ) : (
          <>
            <Txt variant="label" tone="secondary">
              Monthly salary
              {detected ? ` · ${sampleScan.salary.accountName}` : ''}
            </Txt>
            <Amount
              value={state.income}
              size={40}
              family={fonts.manropeBold}
              style={styles.hero}
            />
            <Txt tone="secondary" style={styles.mt12}>
              Credited on the{' '}
              <Txt variant="bodySemi">{ordinal(state.cycleDay)}</Txt> of each
              month
              {detected && !state.incomeConfirmed
                ? ` for the last ${sampleScan.salary.monthsSeen} months.`
                : '.'}
            </Txt>
            <View style={styles.actions}>
              <Button
                label={state.incomeConfirmed ? 'Confirmed' : 'Confirm'}
                onPress={() => update({ incomeConfirmed: true })}
                height={48}
                style={styles.flex}
              />
              <Button
                label="Edit"
                kind="secondary"
                onPress={() => setEditing(true)}
                style={styles.flex}
              />
            </View>
          </>
        )}
      </Card>
      <Txt tone="secondary" style={styles.mt20}>
        Your budget cycle will start on salary day and reset each month when
        your pay arrives.
      </Txt>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 24, padding: 24 },
  hero: { marginTop: 10, letterSpacing: -0.6 },
  mt12: { marginTop: 12 },
  mt20: { marginTop: 20 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  flex: { flex: 1 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    borderBottomWidth: 1,
    marginTop: 10,
  },
  rupee: { fontFamily: fonts.manropeSemiBold, fontSize: 26, marginRight: 4 },
  amountInput: {
    flex: 1,
    fontFamily: fonts.manropeBold,
    fontSize: 36,
    padding: 0,
  },
  dayInput: {
    fontFamily: fonts.manropeSemiBold,
    fontSize: 22,
    padding: 0,
    borderBottomWidth: 1,
    marginTop: 6,
    width: 80,
  },
});
