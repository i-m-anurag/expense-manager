import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, IconName } from '../components/Icon';
import { useTheme } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';

const TABS: Record<string, { label: string; icon: IconName }> = {
  Home: { label: 'Home', icon: 'home' },
  // Singular label: "Transactions" doesn't fit the 64dp tab on small phones.
  Transactions: { label: 'Transaction', icon: 'list' },
  Add: { label: 'Add payment', icon: 'plus' },
  Budget: { label: 'Budget', icon: 'wallet' },
  Insights: { label: 'Insights', icon: 'chart' },
};

// Brief §8: Home · Transactions · (+) · Budget · Insights, with a gold centre
// button for manual add.
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: c.surface,
          borderTopColor: c.border,
          paddingBottom: Math.max(insets.bottom, 8),
        },
      ]}
    >
      {state.routes.map((route, i) => {
        const tab = TABS[route.name];
        const focused = state.index === i;
        const isAdd = route.name === 'Add';
        const onPress = () => {
          if (isAdd) {
            navigation.getParent()?.navigate('AddTransaction');
            return;
          }
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };
        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityRole={isAdd ? 'button' : 'tab'}
            accessibilityLabel={tab.label}
            accessibilityState={isAdd ? undefined : { selected: focused }}
            style={styles.tab}
          >
            {isAdd ? (
              <View style={[styles.add, { backgroundColor: c.gold }]}>
                <Icon name="plus" size={24} strokeWidth={2} color={c.onGold} />
              </View>
            ) : (
              <>
                <Icon
                  name={tab.icon}
                  size={24}
                  color={focused ? c.goldText : c.textTertiary}
                />
                <Text
                  style={[
                    styles.label,
                    { color: focused ? c.goldText : c.textTertiary },
                  ]}
                >
                  {tab.label}
                </Text>
              </>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  tab: {
    width: 64,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  add: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontFamily: fonts.interMedium, fontSize: 11 },
});
