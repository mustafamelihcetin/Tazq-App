import type { ComponentType } from 'react';
import type { TextStyle } from 'react-native';
import { Colors } from '@/shared/constants/Colors';

/*
  TANITIM MOCK'UNUN PALETİ VE TİPLERİ — kendi dosyasında.

  Mock motorundan ayrıldılar çünkü ayrı sebeplerle değişiyorlar: burası uygulamanın
  RENK sistemi değişince, oradaki çizim kodu ise arayüz değişince güncelleniyor.
  Ayrıca tanıtım sayfası da (app/promo.tsx) bu vurgu tonlarını kullanıyor; iki dosyanın
  ortak kaynağı tek bir yerde durmalı.
*/

export type PromoMode = 'dark' | 'light';

/**
 * Tek bir lucide glifi.
 *
 * `Ic: any` yazmak kolaydı ama `any` bir bildirimde durduğunda değerin aktığı her yere
 * bulaşır (bkz. __tests__/typeSafety.test.ts). lucide-react-native `LucideIcon` tipini
 * DIŞA AKTARMIYOR; kullandığımız yüzey de zaten bu dört özellikten ibaret.
 */
export type Glyph = ComponentType<{ size?: number; color?: string; strokeWidth?: number; fill?: string }>;

// Vurgu tonları — her biri aydınlık/karanlık çift (uygulama paletiyle aynı: primary/secondary/
// tertiary/warning/streak + CategoryColors indigo/teal). Koyuda parlak, açıkta koyu → iki temada da
// beyaz-glif çipte ve kart üstü yazıda okunur.
export const ACCENTS = {
  dark:  { blue: '#0A84FF', violet: '#A78BFA', indigo: '#6366F1', teal: '#2DD4BF', emerald: '#34D399', amber: '#FBBF24', orange: '#FB923C' },
  light: { blue: '#0B6BCB', violet: '#7C3AED', indigo: '#4F46E5', teal: '#0D9488', emerald: '#047857', amber: '#B45309', orange: '#EA580C' },
} as const;
export type AccentKey = keyof typeof ACCENTS['dark'];

export type PromoKind = 'focus' | 'deepfocus' | 'modes' | 'tasks' | 'momentum' | 'cockpit' | 'home' | 'brand';

/*
  MOCK PALETİ UYDURULMAZ — UYGULAMANIN PALETİNDEN GELİR.

  Buradaki renkler bir zamanlar elle yazılmıştı (#0C0C12 / #F2F2F7) ve uygulamanın
  gerçek zeminlerinden (#09090B / #F4F4F5) farklıydı. Mağaza görselinde görülen ekranla
  indirdikten sonra görülen ekran aynı olmalı; tek tık fark bile "bu o uygulama değil"
  hissi bırakır. Artık tek kaynak `Colors`.
*/
export const NEUTRAL = {
  dark: {
    screen: Colors.dark.background,
    // Kart zemini BentoCard'ın koyu tema kuralı: surfaceContainerHigh + hairline outline.
    card: Colors.dark.surfaceContainerHigh,
    cardLow: Colors.dark.surfaceContainerLow,
    sheet: Colors.dark.surfaceContainer,
    border: Colors.dark.outline,
    text: Colors.dark.onSurface,
    sub: Colors.dark.onSurfaceVariant,
    muted: Colors.dark.onSurfaceMuted,
    track: Colors.dark.surfaceContainerHighest,
    chrome: 'rgba(23,23,28,0.72)',
    // Android'de cam yok: gezinme çubuğu OPAK bir yüzey (bkz. theme.surfaceFloating).
    floating: Colors.dark.surfaceFloating,
    pill: 'rgba(255,255,255,0.06)',
  },
  light: {
    screen: Colors.light.background,
    card: Colors.light.surfaceContainerLowest,
    cardLow: Colors.light.surfaceContainerLow,
    sheet: Colors.light.surfaceContainerLowest,
    /*
      AÇIK TEMADA KARTIN GERÇEKTE ÇERÇEVESİ YOK (beyaz kart / #F4F4F5 zemin; ayıran şey
      kontrast). Mock'ta yine de paletin kendi `outline` jetonu çiziliyor: telefon
      çerçevesi gerçek ekranın ~%60'ı ve mağaza görselleri JPEG sıkıştırmasından geçiyor —
      o iki aşamada %1.5'lik parlaklık farkı yok oluyor ve kartlar zemine yapışıyor.
      Yeni bir renk uydurulmuyor, uygulamanın kendi kenar jetonu kullanılıyor.
    */
    border: Colors.light.outline,
    text: Colors.light.onSurface,
    sub: Colors.light.onSurfaceVariant,
    muted: Colors.light.onSurfaceMuted,
    track: Colors.light.surfaceContainerHighest,
    chrome: 'rgba(255,255,255,0.78)',
    floating: Colors.light.surfaceFloating,
    pill: 'rgba(0,0,0,0.04)',
  },
} as const;

/*
  ── YAZI YÜZÜ PLATFORMA GÖRE DEĞİŞİYOR ────────────────────────────────────────
  Uygulama iOS'ta sistem yüzünü (SF), Android'de Plus Jakarta Sans'ı kullanıyor
  (bkz. FONT_FAMILY). İkisi aynı puntoda farklı genişlikte oturur; Jakarta daha
  yuvarlak ve bir tık geniştir. Mock ikisini de doğru gösterebiliyor, çünkü Jakarta
  uygulamada HER platformda yükleniyor — yani bu ekran iPhone'da açılsa bile Android
  mock'u gerçek yüzüyle çiziliyor.

  RN'de özel bir yüz seçilince `fontWeight` artık kalınlığı seçmez; ağırlık ADIN
  kendisindedir. O yüzden ikisi tek yerde eşleşiyor — ve tek yerde, çünkü mock iki
  dosyaya bölündü ve eşleme kopyalanırsa biri güncellenip öteki unutulur.
*/
const JAKARTA = { '200': 'Jakarta-Regular', '500': 'Jakarta-Medium', '600': 'Jakarta-SemiBold', '700': 'Jakarta-Bold' } as const;

export type PromoWeight = keyof typeof JAKARTA;

export const promoWeight = (isIOS: boolean, w: PromoWeight): TextStyle =>
  isIOS ? { fontWeight: w } : { fontFamily: JAKARTA[w] };
