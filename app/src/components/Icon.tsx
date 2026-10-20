import React from 'react';
import Svg, { Path } from 'react-native-svg';

// Outline icons, 1.5px stroke, rounded ends (brief §6). Paths copied from the design.
const PATHS = {
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 018 0v3',
  check: 'M5 12l5 5L20 7',
  bank: 'M3 10l9-6 9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18',
  pencil: 'M4 20h4L19 9l-4-4L4 16z',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  fingerprint:
    'M12 11v4M8 9a4 4 0 018 0v6M5 12a7 7 0 0114 0v4M9 21c1-2 1-4 1-6',
  smsOff: 'M21 15a2 2 0 01-2 2H8l-5 4V5a2 2 0 012-2h14a2 2 0 012 2zM3 3l18 18',
  backspace: 'M21 5H8l-6 7 6 7h13zM12 9l6 6M18 9l-6 6',
  search: 'M11 18a7 7 0 100-14 7 7 0 000 14zM21 21l-5-5',
  chevronDown: 'M6 9l6 6 6-6',
  chevronUp: 'M6 15l6-6 6 6',
  chevronLeft: 'M15 6l-6 6 6 6',
  chevronRight: 'M9 6l6 6-6 6',
  close: 'M6 6l12 12M18 6L6 18',
  home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  plus: 'M12 5v14M5 12h14',
  wallet:
    'M3 7h16a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2zM3 7V6a2 2 0 012-2h11M16 14h.01',
  chart: 'M4 20V10M10 20V4M16 20v-8M22 20H2',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 100 6 3 3 0 000-6z',
  eyeOff:
    'M3 3l18 18M10.6 5.1A10 10 0 0112 5c6 0 10 7 10 7a17 17 0 01-3.2 3.9M6.6 6.6A17 17 0 002 12s4 7 10 7a10 10 0 005.4-1.6M9.9 9.9a3 3 0 004.2 4.2',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 4-6 8-6s8 2 8 6',
  sparkle: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z',
  trendingUp: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  repeat:
    'M17 2l4 4-4 4M3 11V9a3 3 0 013-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 01-3 3H3',
  alert:
    'M12 8v5M12 17h.01M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
  message: 'M21 15a2 2 0 01-2 2H8l-5 4V5a2 2 0 012-2h14a2 2 0 012 2z',
};

export type IconName = keyof typeof PATHS;

interface Props {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 20, color, strokeWidth = 1.5 }: Props) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d={PATHS[name]} />
    </Svg>
  );
}
