/**
 * Tazq Design System — v4
 *
 * Light: Ceramic White — clean, airy, electric blue accent
 * Dark:  Midnight Indigo — deep zinc with soft indigo/emerald glow
 */

const lightPalette = {
  primary: '#2563EB',           // Blue 600 — modern, confident
  primaryDim: '#1D4ED8',        // Blue 700
  primaryContainer: '#DBEAFE',  // Blue 100
  onPrimary: '#FFFFFF',
  onPrimaryContainer: '#1E3A8A',

  secondary: '#7C3AED',         // Violet 600
  secondaryContainer: '#EDE9FE', // Violet 100
  onSecondary: '#FFFFFF',

  tertiary: '#059669',          // Emerald 600
  tertiaryContainer: '#D1FAE5', // Emerald 100
  onTertiary: '#FFFFFF',

  error: '#DC2626',             // Red 600
  onBackground: '#18181B',
  onSurface: '#18181B',
  onSurfaceVariant: '#52525B',  // Zinc 600

  background: '#F4F4F5',        // Zinc 100
  surface: '#F4F4F5',
  surfaceVariant: '#E4E4E7',
  surfaceContainerLowest: '#FFFFFF',
  surfaceContainerLow: '#FAFAFA',
  surfaceContainer: '#F0F0F2',
  surfaceContainerHigh: '#E8E8EB',
  surfaceContainerHighest: '#E4E4E7',

  outline: 'rgba(0,0,0,0.08)',
  outlineVariant: 'rgba(0,0,0,0.04)',
};

const darkPalette = {
  primary: '#818CF8',           // Indigo 400 — soft, premium, readable on dark
  primaryDim: '#6366F1',        // Indigo 500
  primaryContainer: '#1E1B4B',  // Indigo 950
  onPrimary: '#FFFFFF',
  onPrimaryContainer: '#C7D2FE',

  secondary: '#34D399',         // Emerald 400 — calm green accent
  secondaryContainer: '#064E3B',// Emerald 950
  onSecondary: '#ECFDF5',

  tertiary: '#FB923C',          // Orange 400 — warm energy
  tertiaryContainer: '#431407', // Orange 950
  onTertiary: '#FFF7ED',

  error: '#F87171',             // Red 400

  onBackground: '#F4F4F5',
  onSurface: '#F4F4F5',
  onSurfaceVariant: '#A1A1AA',  // Zinc 400 — perfect secondary text

  background: '#09090B',        // Zinc 950 — true premium dark
  surface: '#09090B',
  surfaceVariant: '#18181B',    // Zinc 900

  // Clearly distinct surface layers (no more merging into one flat black)
  surfaceContainerLowest: '#000000',
  surfaceContainerLow: '#0F0F12',
  surfaceContainer: '#17171C',
  surfaceContainerHigh: '#222228',
  surfaceContainerHighest: '#2C2C34',

  outline: 'rgba(255,255,255,0.07)',
  outlineVariant: 'rgba(255,255,255,0.03)',
};

export const Colors = {
  light: lightPalette,
  dark: darkPalette,
};
