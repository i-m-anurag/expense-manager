import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { Palette, ThemeName, palettes } from './tokens';

interface Theme {
  name: ThemeName;
  c: Palette;
}

const ThemeContext = createContext<Theme>({ name: 'dark', c: palettes.dark });

// Follows the system theme (brief §3). A manual override comes with Settings (SET-04).
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const name: ThemeName = scheme === 'light' ? 'light' : 'dark';
  const value = useMemo(() => ({ name, c: palettes[name] }), [name]);
  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
