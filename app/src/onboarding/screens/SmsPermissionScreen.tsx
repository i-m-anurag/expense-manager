import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '../../components/Card';
import { Txt } from '../../components/Txt';
import { ScreenProps } from '../../navigation/types';
import { requestSms } from '../../permissions';
import { useTheme } from '../../theme/ThemeProvider';
import { fonts } from '../../theme/tokens';
import { OnboardingLayout } from '../OnboardingLayout';
import { useNextStep } from '../flow';

export function SmsPermissionScreen({
  navigation,
}: ScreenProps<'SmsPermission'>) {
  const { c } = useTheme();
  const next = useNextStep('SmsPermission');

  const allow = async () => {
    const result = await requestSms();
    if (result === 'granted') {
      next({ smsGranted: true, manualMode: false });
    } else {
      navigation.navigate('SmsDenied');
    }
  };

  return (
    <OnboardingLayout
      stage={0}
      cta="Allow SMS access"
      onCta={allow}
      ghost="Add payments manually"
      onGhost={() => navigation.navigate('SmsDenied')}
    >
      <Txt variant="h1" accessibilityRole="header">
        Read only bank messages
      </Txt>
      <Txt tone="secondary" style={styles.mt8}>
        We pick out the amount, account and merchant. Everything else is
        ignored.
      </Txt>

      <Card highlight style={styles.mt20}>
        <Txt variant="overline" tone="gold">
          What we read
        </Txt>
        <Text style={[styles.sms, { color: c.textPrimary }]}>
          HDFC Bank: <Hl>Rs 450.00</Hl> debited from <Hl>A/c XX4521</Hl> on
          18-Sep at <Hl>SWIGGY</Hl>.
        </Text>
      </Card>

      <View style={styles.ignored}>
        <IgnoredCard kind="OTP" body="Your OTP is ●●●●●●. Do not share it." />
        <IgnoredCard kind="Personal" body="Hey, dinner at 8 tonight?" />
      </View>
    </OnboardingLayout>
  );
}

// Highlighted field inside the sample SMS ("what we read").
function Hl({ children }: { children: string }) {
  const { c } = useTheme();
  return (
    <Text
      style={[styles.hl, { backgroundColor: c.goldTint, color: c.goldText }]}
    >
      {` ${children} `}
    </Text>
  );
}

function IgnoredCard({ kind, body }: { kind: string; body: string }) {
  return (
    <Card dashed style={styles.ignoredCard}>
      <View style={styles.ignoredHead}>
        <Txt variant="overline" tone="tertiary">
          Ignored
        </Txt>
        <Txt variant="overline" tone="tertiary">
          {kind}
        </Txt>
      </View>
      <Txt variant="label" tone="tertiary" style={styles.ignoredBody}>
        {body}
      </Txt>
    </Card>
  );
}

const styles = StyleSheet.create({
  mt8: { marginTop: 8 },
  mt20: { marginTop: 20 },
  sms: { fontFamily: fonts.inter, fontSize: 14, lineHeight: 28, marginTop: 8 },
  hl: { fontFamily: fonts.interSemiBold, borderRadius: 6 },
  ignored: { marginTop: 12, gap: 10 },
  ignoredCard: { opacity: 0.7, paddingVertical: 14 },
  ignoredHead: { flexDirection: 'row', justifyContent: 'space-between' },
  ignoredBody: { fontFamily: fonts.inter, fontSize: 14, marginTop: 6 },
});
