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
