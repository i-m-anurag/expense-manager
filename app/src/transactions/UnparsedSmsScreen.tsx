import React from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Icon } from '../components/Icon';
import { Txt } from '../components/Txt';
import { useData, useQuery } from '../data/DataProvider';
import { dismissUnparsed, listUnparsed } from '../db/rawSms';
import { ScreenProps } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, screenPadding } from '../theme/tokens';
import { dayLabel, timeLabel } from '../utils/format';

// PRD SMS-09: bank messages we couldn't read. The user can add the payment by
// hand or dismiss the message. Each one tells us a parser template is missing.
export function UnparsedSmsScreen({ navigation }: ScreenProps<'UnparsedSms'>) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { sql, refresh } = useData();
  const items = useQuery(listUnparsed, []) ?? [];

  const dismiss = async (id: number) => {
    await dismissUnparsed(sql, id);
    refresh();
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
      <FlatList
        data={items}
        keyExtractor={i => String(i.id)}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 32 },
        ]}
        ListHeaderComponent={
          <View style={styles.head}>
            <Txt style={styles.title} accessibilityRole="header">
              SMS we couldn't read
            </Txt>
            <Txt tone="secondary" style={styles.mt6}>
              These came from your bank but didn't match a format we know. Add
              the payment yourself, or dismiss it if it isn't one.
            </Txt>
          </View>
        }
        ListEmptyComponent={
          <Txt tone="secondary" style={styles.mt6}>
            All clear. Every bank SMS has been read.
          </Txt>
        }
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <View style={styles.meta}>
              <Icon name="message" size={16} color={c.textTertiary} />
              <Txt variant="caption" tone="tertiary" style={styles.flex}>
                {item.sender} · {dayLabel(item.received_at)},{' '}
                {timeLabel(item.received_at)}
              </Txt>
            </View>
            <Txt variant="label" style={styles.body}>
              {item.body}
            </Txt>
            <View style={styles.actions}>
              <Button
                label="Add payment"
                kind="secondary"
                height={44}
                onPress={() => navigation.navigate('AddTransaction')}
                style={styles.flex}
              />
              <Button
                label="Dismiss"
                kind="ghost"
                height={44}
                onPress={() => dismiss(item.id)}
                style={styles.flex}
              />
            </View>
          </Card>
        )}
      />
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
  content: { paddingHorizontal: screenPadding },
  head: { marginBottom: 16 },
  title: {
    fontFamily: fonts.manropeBold,
    fontSize: 26,
    lineHeight: 31,
    letterSpacing: -0.3,
  },
  mt6: { marginTop: 6 },
  card: { marginBottom: 12 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flex: { flex: 1 },
  body: { fontFamily: fonts.inter, fontSize: 14, lineHeight: 21, marginTop: 8 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
});
