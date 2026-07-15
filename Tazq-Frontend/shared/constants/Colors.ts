import { Platform } from 'react-native';

/**
 * Tazq Design System — v5
 *
 * Light: Ceramic White — clean, airy, electric blue accent
 * Dark:  Midnight Indigo — deep zinc with soft indigo/violet glow
 *
 * v5 changes:
 * - Light surface hiyerarşisi güçlendirildi (Highest artık Zinc 300)
 * - Dark secondary Violet 400, tertiary Emerald 400 (light mode hue'larıyla tutarlı)
 * - Semantic color token'ları eklendi: warning, priorityHigh/Medium/Low, streak, success, info
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
  surfaceContainerHigh: '#E0E0E4',      // Daha belirgin adım (eski: #E8E8EB)
  surfaceContainerHighest: '#D4D4D8',  // Zinc 300 — açıkça ayırt edilebilir (eski: #E4E4E7)

  outline: Platform.OS === 'android' ? 'rgba(0,0,0,0.05)' : 'rgba(0,0,0,0.08)',
  outlineVariant: Platform.OS === 'android' ? 'rgba(0,0,0,0.03)' : 'rgba(0,0,0,0.04)',

  // Interaction overlays
  pressedOverlay: 'rgba(0, 0, 0, 0.08)',
  hoverOverlay: 'rgba(0, 0, 0, 0.04)',

  // Semantic / status tokens — tema sisteminde merkezi tanım
  warning: '#FF9500',
  priorityHigh: '#FF3B30',
  priorityMedium: '#FF9500',    // warning ile uyumlu hale getirildi (eski: #FF9F0A)
  priorityLow: '#64748B',       // Düşük öncelik için yeşil yerine nötr slate seçildi (eski: #34C759)
  streak: '#FF6B35',
  success: '#059669',          // Marka yeşili (tertiary) ile uyumlu hale getirildi (eski: #34C759)
  info: '#0284C7',             // Daha okunaklı mavi (eski: #4FC3F7)
};

const darkPalette = {
  primary: '#818CF8',           // Indigo 400 — soft, premium, readable on dark
  primaryDim: '#6366F1',        // Indigo 500
  primaryContainer: '#1E1B4B',  // Indigo 950
  onPrimary: '#FFFFFF',
  onPrimaryContainer: '#C7D2FE',

  secondary: '#A78BFA',         // Violet 400 — light mode secondary hue ile tutarlı
  secondaryContainer: '#2D1B69',// Violet 950
  onSecondary: '#F3F0FF',

  tertiary: '#34D399',          // Emerald 400 — light mode tertiary hue ile tutarlı
  tertiaryContainer: '#064E3B', // Emerald 950
  onTertiary: '#ECFDF5',

  error: '#F87171',             // Red 400

  onBackground: '#F4F4F5',
  onSurface: '#F4F4F5',
  onSurfaceVariant: '#A1A1AA',  // Zinc 400 — perfect secondary text

  background: '#09090B',        // Zinc 950 — true premium dark
  surface: '#09090B',
  surfaceVariant: '#18181B',    // Zinc 900

  surfaceContainerLowest: '#000000',
  surfaceContainerLow: '#0F0F12',
  surfaceContainer: '#17171C',
  surfaceContainerHigh: '#222228',
  surfaceContainerHighest: '#2C2C34',

  outline: Platform.OS === 'android' ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.07)',
  outlineVariant: Platform.OS === 'android' ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.03)',

  // Interaction overlays
  pressedOverlay: 'rgba(255, 255, 255, 0.08)',
  hoverOverlay: 'rgba(255, 255, 255, 0.04)',

  // Semantic / status tokens
  warning: '#FFB340',
  priorityHigh: '#F87171',      // Karanlıkta göz almayan uyumlu kırmızı (eski: #FF3B30)
  priorityMedium: '#FFB340',    // warning ile uyumlu hale getirildi (eski: #FF9F0A)
  priorityLow: '#94A3B8',       // Düşük öncelik için yeşil yerine nötr slate seçildi (eski: #34C759)
  streak: '#FF6B35',
  success: '#34D399',          // Marka yeşili (tertiary) ile uyumlu hale getirildi (eski: #34C759)
  info: '#38BDF8',             // Daha okunaklı mavi (eski: #4FC3F7)
};

export const Colors = {
  light: lightPalette,
  dark: darkPalette,
};

/**
 * Bileşenlere geçirilen tema nesnesinin tipi (useAppTheme().theme).
 *
 * Elle yazılmıyor, lightPalette'ten türetiliyor: palet büyüdüğünde tip kendiliğinden
 * büyür ve iki kaynak birbirinden ayrışamaz. Daha önce her bileşen `theme: any`
 * alıyordu — yani var olmayan bir renk token'ı yazmak derlemede yakalanmıyordu.
 */
export type AppTheme = typeof lightPalette;

// darkPalette'in light ile aynı anahtarlara sahip olduğunu derleme zamanında doğrular.
// Biri diğerine token eklenip ötekine eklenmezse burası hata verir.
const _darkPaletteMatchesLight: AppTheme = darkPalette;
void _darkPaletteMatchesLight;
