import { Platform } from 'react-native';

/**
 * Tazq Design System — v7
 *
 * Light: Cool Ceramic — iOS sistem grileriyle hizalı soğuk nötr
 * Dark:  Cool Charcoal — aynı aile, koyu uçta
 *
 * ── Yön: "native iOS uygulaması gibi — kaliteli, elit, minimalist" ─────────────
 *
 * v6'da nötrleri Stone'a (ılık) çevirmiştim. YANLIŞTI ve geri alındı:
 * Apple'ın sistem nötrlerinin HEPSİ soğuktur (mavi alt tonlu) —
 * secondarySystemBackground #F2F2F7, systemGray6 #1C1C1E, secondaryLabel #3C3C43.
 * Zinc bunların Tailwind karşılığıdır (Zinc 100 #F4F4F5 ≈ systemGray6 #F2F2F7),
 * yani v5'in nötrleri zaten doğru yerdeydi. "Ilıklaştırma" iOS'tan uzaklaştırıyordu.
 * Üstelik görünmüyordu da: #F4F4F5 -> #F5F5F4 arasındaki fark 1 RGB birimi.
 *
 * Elit/minimalist his iki şeyden gelir:
 *   (a) Rengin ANLAMI olması. "Renk = anlam" kuralı: bir isim ne eylem ne durum bildirir,
 *       o yüzden renklenmez. Marka mavisiyle boyanan her şey "tıklanabilir/kritik" der;
 *       öyle olmayan şeye söylerse yalan söyler ve ekran ucuzlar.
 *   (b) Rengin AZ kullanılması. Apple uygulamaları büyük ölçüde gri tonlamadır; tint
 *       yalnızca etkileşimli metin, küçük glif ve tek birincil butonda görünür.
 *
 * v7'de korunanlar (v6'nın gerçek kazanımları — hepsi ölçülmüş hatalardı):
 * - Semantik token'lar Apple HIG'den Tailwind ailesine taşındı. Eskiden palet iki
 *   ayrı sistemin karışımıydı ve Apple tarafı %100 doygunluktaydı; tam o dördü
 *   WCAG'den kalıyordu (warning 2.00:1, streak 2.58:1). Apple'ın kendi renkleri
 *   bu değerlerde okunaklı değil — "elit kalite" okunmamayı kapsamaz.
 * - İki farklı kırmızı (error #DC2626 / priorityHigh #FF3B30) tek kırmızıya indi.
 * - Koyu tema birincil butonu: beyaz yazı Indigo 400 üstünde 2.98:1 idi. Artık koyu
 *   tema kendi (daha açık) mavisini kullanıyor — Apple gibi. Bkz. darkPalette.primary.
 * - Marka mavisi hue 221'den (Blue 600) 210'a çekildi. "Sert lacivert" şikayetinin
 *   ölçülebilir sebebi buydu: 221 indigo/mor tarafına bakıyordu. iOS systemBlue 211'dir.
 *   Açıklık meselesi değildi — Blue 600 (%53) systemBlue'dan (%50) daha AÇIKTI bile.
 *
 * Bu dosya ekranların TEK renk kaynağıdır. Eskiden değildi: 870 sabit hex ekranların
 * içine yazılıydı ve paleti değiştirmek hiçbir şeyi değiştirmiyordu. Aşağıdaki üç
 * palet (tema / kategori / mod vurgusu) o dağınıklığın toplanmış hâlidir.
 *
 * Her iki temada WCAG AA ihlali: 0. Ölçüm: metin >= 4.5:1, UI öğesi >= 3:1.
 * Bkz. __tests__/colorContrast.test.ts — palet artık gözle değil testle korunuyor.
 */

const lightPalette = {
  // Marka mavisi, iOS'un hue bandında (210). Eski Blue 600 hue 221'deydi: indigo/mor
  // tarafına kayık olduğu için "sert lacivert" okunuyordu. iOS systemBlue hue 211'dir
  // ve turkuaz tarafına bakar — canlı görünmesinin sebebi bu, açıklık değil (systemBlue
  // %50, Blue 600 %53 — yani eskisi daha AÇIKTI ama daha lacivert duruyordu).
  // Beyaz yazı 5.28:1 (AA) · açık zemin 4.80:1 · koyu zemin 3.77:1 — üçü de geçiyor.
  primary: '#0B6BCB',
  primaryDim: '#08528F',        // basılı durum
  primaryContainer: '#DBEAFE',  // Blue 100
  onPrimary: '#FFFFFF',         // 5.17:1
  onPrimaryContainer: '#0A3D62',  // primary'nin koyu ucu (hue 210 ailesi)

  secondary: '#7C3AED',         // Violet 600
  secondaryContainer: '#EDE9FE', // Violet 100
  onSecondary: '#FFFFFF',       // 5.70:1

  tertiary: '#047857',          // Emerald 700 — beyaz yazı için 5.48:1 (Emerald 600 3.77:1 ile kalıyordu)
  tertiaryContainer: '#D1FAE5', // Emerald 100
  onTertiary: '#FFFFFF',

  error: '#B91C1C',             // Red 700 — Red 600 (#DC2626) 4.43:1 ile kıl payı kalıyordu
  onBackground: '#18181B',      // Zinc 900
  onSurface: '#18181B',         // Zinc 900 — 16.12:1
  onSurfaceVariant: '#52525B',  // Zinc 600 — 7.03:1

  background: '#F4F4F5',        // Zinc 100 — iOS systemGray6 (#F2F2F7) hizasında
  surface: '#F4F4F5',
  surfaceVariant: '#E4E4E7',    // Zinc 200
  surfaceContainerLowest: '#FFFFFF',
  surfaceContainerLow: '#FAFAFA',
  surfaceContainer: '#F0F0F2',
  surfaceContainerHigh: '#E0E0E4',
  surfaceContainerHighest: '#D4D4D8',   // Zinc 300 — ikincil metin için 5.10:1

  outline: Platform.OS === 'android' ? 'rgba(0,0,0,0.05)' : 'rgba(0,0,0,0.08)',
  outlineVariant: Platform.OS === 'android' ? 'rgba(0,0,0,0.03)' : 'rgba(0,0,0,0.04)',

  // Interaction overlays
  pressedOverlay: 'rgba(0, 0, 0, 0.08)',
  hoverOverlay: 'rgba(0, 0, 0, 0.04)',

  // Semantic / status tokens — tema sisteminde merkezi tanım.
  // Hepsi Tailwind ailesinden ve AA geçen tonlarda. v5'teki Apple HIG karşılıkları
  // %100 doygunluktaydı: ılık zeminde yabancı duruyor ve kontrasttan kalıyorlardı.
  warning: '#B45309',          // Amber 700 — 4.60:1 (eski #FF9500: 2.00:1 ✗)
  priorityHigh: '#B91C1C',     // error ile aynı: "dikkat gerekiyor" tek kırmızı (eski #FF3B30)
  priorityMedium: '#B45309',   // Amber 700 — warning ile aynı ton (eski #FF9500: 2.00:1 ✗)
  priorityLow: '#71717A',      // Zinc 500 — nötr aileyle aynı (eski Slate 500)
  streak: '#EA580C',           // Orange 600 — 3.26:1, ödül rengi sıcak kalmalı (eski #FF6B35: 2.58:1 ✗)
  success: '#047857',          // Emerald 700 — tertiary ile aynı marka yeşili
  info: '#0284C7',             // Sky 600 — 3.75:1
};

const darkPalette = {
  // Koyu temanın mavisi AÇIK temanınkinden daha AÇIK — bu kasıtlı.
  // Bir ara "tek marka mavisi" diye ikisini eşitledim, YANLIŞTI: açık zeminde çalışan
  // #0B6BCB koyu zeminde metin olarak 3.77:1 veriyor (gereken 4.5) ve bölüm başlıkları
  // ("Bugünkü Alışkanlıklarım", "Günlük Görevler") okunmuyordu. Apple'ın da iki mavisi
  // olmasının sebebi bu: systemBlue açıkta #007AFF, koyuda #0A84FF. Aşağıdaki değer
  // Apple'ın koyu tema mavisinin ta kendisi — metin olarak 5.45:1.
  primary: '#0A84FF',
  primaryDim: '#0B6BCB',        // basılı durum — açık temanın mavisi
  primaryContainer: '#0A2A4A',  // primary'nin koyu ucu (hue 210 ailesi)
  // Material 3 kuralı: koyu temada primary AÇIK olduğu için onPrimary KOYU olur.
  // iOS burada beyaz kullanır ama kendi ölçümü 3.65:1 — AA'dan kalıyor. Okunabilirlik
  // "elit kalite"nin parçası, o yüzden AA tercih edildi (5.45:1).
  onPrimary: '#09090B',
  onPrimaryContainer: '#C7D2FE',

  secondary: '#A78BFA',         // Violet 400
  secondaryContainer: '#2D1B69',// Violet 950
  onSecondary: '#18181B',       // 6.38:1 (eski #F3F0FF: açık yazı açık zeminde)

  tertiary: '#34D399',          // Emerald 400
  tertiaryContainer: '#064E3B', // Emerald 950
  onTertiary: '#052E16',        // 7.75:1 (eski #ECFDF5: 1.4:1 ✗)

  error: '#F87171',             // Red 400

  onBackground: '#F4F4F5',      // Zinc 100
  onSurface: '#F4F4F5',         // 18.24:1
  onSurfaceVariant: '#A1A1AA',  // Zinc 400 — 7.76:1

  background: '#09090B',        // Zinc 950 — iOS systemBackground (dark) hizasında
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

  // Semantic / status tokens — açık tema ile aynı aile, koyuda okunur tonlarda.
  warning: '#FBBF24',          // Amber 400 — 11.83:1
  priorityHigh: '#F87171',     // error ile aynı: tek kırmızı (açık tema ile tutarlı)
  priorityMedium: '#FBBF24',   // Amber 400 — warning ile aynı ton
  priorityLow: '#A1A1AA',      // Zinc 400 — nötr aileyle aynı
  streak: '#FB923C',           // Orange 400 — 8.73:1 (eski #FF6B35 iki temada da aynıydı)
  success: '#34D399',          // Emerald 400 — tertiary ile aynı marka yeşili
  info: '#38BDF8',             // Sky 400 — 9.22:1
};

export const Colors = {
  light: lightPalette,
  dark: darkPalette,
};

/**
 * Kategori paleti — mod alışkanlıklarının/görevlerinin kimlik renkleri.
 *
 * Neden ayrı: bunlar semantik değil KATEGORİK. "Hata Defteri kırmızı, Konu Testi yeşil"
 * demek bir durum bildirmez, sadece kalemleri birbirinden ayırır. Apple'ın Hatırlatıcılar'ı
 * da liste başına renk verir — meşru bir desen.
 *
 * Neden burada: bu 8 renk zaten kullanılıyordu ama HİÇBİR YERDE TANIMLI DEĞİLDİ —
 * turkishModes.ts içine 270 kez elle yazılmıştı. Sonuç: uygulamada paralel bir "gölge
 * palet" (Tailwind 500 serisi) tema paletiyle (600/700 serisi) yan yana çalışıyordu.
 * Aynı anda iki renk sistemi = renklerin birbirini tutmaması. Artık tek kaynak burası.
 *
 * Neden temaya duyarlı değil: bu renkler alışkanlık kaydına YAZILIYOR (kalıcı veri).
 * Temaya göre değişen bir değer saklanamaz — bu yüzden her ton İKİ temada da >= 3:1
 * verecek şekilde seçildi. Parlak 500 serisi açık temada kalıyordu (Amber 500: 1.95:1),
 * o yüzden yeşil/amber/turuncu bir ton koyulaştırıldı.
 *
 * Doğrulama: __tests__/colorContrast.test.ts — her renk iki zeminde de test edilir.
 */
export const CategoryColors = {
  blue:    '#3B82F6', // Blue 500    — açık 3.35:1 · koyu 5.41:1
  green:   '#059669', // Emerald 600 — açık 3.43:1 · koyu 5.28:1  (500 açıkta 2.31 ✗)
  violet:  '#8B5CF6', // Violet 500  — açık 3.85:1 · koyu 4.70:1
  amber:   '#B45309', // Amber 700   — açık 4.57:1 · koyu 3.96:1  (500 açıkta 1.95 ✗)
  red:     '#EF4444', // Red 500     — açık 3.42:1 · koyu 5.29:1
  indigo:  '#6366F1', // Indigo 500  — açık 4.06:1 · koyu 4.45:1
  pink:    '#EC4899', // Pink 500    — açık 3.21:1 · koyu 5.64:1
  orange:  '#EA580C', // Orange 600  — açık 3.24:1 · koyu 5.59:1  (500 açıkta 2.55 ✗)
} as const;

export type CategoryColor = typeof CategoryColors[keyof typeof CategoryColors];

/**
 * Mod vurgu renkleri — her dönemsel modun kimliği (Ramazan, YKS, Tez, Mülakat, Spor…).
 *
 * CategoryColors'tan farkı: bunlar KALICI VERİYE YAZILMIYOR, render sırasında moda göre
 * seçiliyor. Bu yüzden temaya duyarlı olabiliyorlar — açık temada derin, koyu temada
 * açık ton. (CategoryColors alışkanlık kaydına yazıldığı için bu lüksü taşımıyor.)
 *
 * Eskiden TurkishModeBanner.tsx ve modlar.tsx içinde ayrı ayrı, iç içe ternary'lerle
 * elle yazılıydı — iki yerde tutulan, hiçbir yerde tanımlı olmayan bir palet daha.
 *
 * Doğrulama: __tests__/colorContrast.test.ts — her mod, kendi temasının zemininde >= 3:1.
 */
export const ModeAccents = {
  ramazan: { light: '#6366F1', dark: '#A5B4FC' }, // Indigo
  yks:     { light: '#3B82F6', dark: '#93C5FD' }, // Blue
  exam:    { light: '#3B82F6', dark: '#93C5FD' }, // Blue — yks ile aynı aile (ikisi de sınav)
  kpss:    { light: '#3B82F6', dark: '#93C5FD' }, // Blue
  tez:     { light: '#8B5CF6', dark: '#C4B5FD' }, // Violet
  mulakat: { light: '#059669', dark: '#6EE7B7' }, // Emerald — açıkta 600 (500 = 2.31:1 ✗)
  spor:    { light: '#EA580C', dark: '#FCA5A1' }, // Orange — açıkta 600 (500 = 2.55:1 ✗)
  default: { light: '#EC4899', dark: '#F9A8D4' }, // Pink
} as const;

export type ModeAccentKey = keyof typeof ModeAccents;

/** Modun vurgu rengini aktif temaya göre çözer. Bilinmeyen mod → default. */
export function modeAccent(type: string | undefined, isDark: boolean): string {
  const entry = (ModeAccents as Record<string, { light: string; dark: string }>)[type ?? ''] ?? ModeAccents.default;
  return isDark ? entry.dark : entry.light;
}

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
