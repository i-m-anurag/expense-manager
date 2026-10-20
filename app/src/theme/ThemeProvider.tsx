import React, { createContext, useContext, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { Palette, ThemeName, palettes } from './tokens';

export type ThemePref = 'system' | 'light' | 'dark';

interface Theme {
  name: ThemeName;
  c: Palette;
  pref: ThemePref;
  setPref: (pref: ThemePref) => void;
}

const ThemeContext = createContext<Theme>({
  name: 'dark',
  c: palettes.dark,
  pref: 'system',
  setPref: () => {},
});

// Follows the system theme on first launch (brief §3); Settings can pin light
// or dark (SET-04). The saved choice is loaded by DataProvider once the
// database is open.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const [pref, setPref] = useState<ThemePref>('system');
  const name: ThemeName =
    pref === 'system' ? (scheme === 'light' ? 'light' : 'dark') : pref;
  const value = useMemo(
    () => ({ name, c: palettes[name], pref, setPref }),
    [name, pref],
  );
  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
