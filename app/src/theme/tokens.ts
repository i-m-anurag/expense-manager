// Design tokens from the App Design Brief ("Midnight & Gold").

export type ThemeName = 'dark' | 'light';

export type Bucket = 'need' | 'want' | 'investment' | 'loan' | 'emergency';

export type Status = 'onTrack' | 'watch' | 'over';

export interface Palette {
  bg: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  gold: string;
  goldText: string;
  goldTint: string;
  onGold: string;
  status: Record<Status, string>;
  bucket: Record<Bucket, string>;
}

export const palettes: Record<ThemeName, Palette> = {
  dark: {
    bg: '#0B1020',
    surface: '#141A2E',
    surfaceRaised: '#1C2340',
    border: '#262F4F',
    textPrimary: '#F2F0EA',
    textSecondary: '#9AA3BF',
    textTertiary: '#6B7494',
    gold: '#D4AF6A',
    goldText: '#E6C584',
    goldTint: 'rgba(212, 175, 106, 0.12)',
    onGold: '#0B1020',
    status: { onTrack: '#34C38F', watch: '#F5913E', over: '#F0616D' },
    bucket: {
      need: '#6FA8DC',
      want: '#C58AE8',
      investment: '#4FC3C9',
      loan: '#8C96B3',
      emergency: '#D4AF6A',
    },
  },
  light: {
    bg: '#F7F5F0',
    surface: '#FFFFFF',
    surfaceRaised: '#FFFFFF',
    border: '#E6E1D6',
    textPrimary: '#0B1020',
    textSecondary: '#4A5270',
    textTertiary: '#7C839C',
    gold: '#D4AF6A',
    goldText: '#8F6F2E',
    goldTint: 'rgba(212, 175, 106, 0.14)',
    onGold: '#0B1020',
    status: { onTrack: '#1F9D6B', watch: '#D9731A', over: '#D64550' },
    bucket: {
      need: '#3A74A8',
      want: '#8E4FB5',
      investment: '#1E8C92',
      loan: '#5B6582',
      emergency: '#8F6F2E',
    },
  },
};

export const radius = { card: 20, button: 14, sheet: 28, chip: 999 };

// 4pt grid.
export const space = (n: number) => n * 4;

export const screenPadding = 20;

// Font files live in android/app/src/main/assets/fonts; names match the file names.
export const fonts = {
  manropeSemiBold: 'Manrope-SemiBold',
  manropeBold: 'Manrope-Bold',
  manropeExtraBold: 'Manrope-ExtraBold',
  inter: 'Inter-Regular',
  interMedium: 'Inter-Medium',
  interSemiBold: 'Inter-SemiBold',
};

export const type = {
  hero: { fontFamily: fonts.manropeBold, fontSize: 38 },
  screenTitle: { fontFamily: fonts.manropeBold, fontSize: 27 },
  sectionTitle: { fontFamily: fonts.manropeSemiBold, fontSize: 19 },
  cardAmount: { fontFamily: fonts.manropeSemiBold, fontSize: 23 },
  body: { fontFamily: fonts.inter, fontSize: 15 },
  label: { fontFamily: fonts.interMedium, fontSize: 13 },
  caption: { fontFamily: fonts.inter, fontSize: 12 },
} as const;

export const motion = { duration: 220 };
