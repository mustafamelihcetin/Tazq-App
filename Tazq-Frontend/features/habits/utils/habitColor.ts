import { modeAccent, HabitPalette } from '@/shared/constants/Colors';

/**
 * ALIŞKANLIK RENGİ = NEREDEN GELDİĞİ (2026-10-30). Kullanıcı: "manuel alışkanlıkların rengini user
 * seçiyor (palet geliştirilebilir); modlardakiler neye göre geliyor bilmiyorum — ikisini ayır".
 *
 * Ölçülen durum:
 *  · MOD alışkanlıkları şablonda alışkanlık başına elle yazılmış 89 renkten geliyordu
 *    (turkishModes.ts → CategoryColors): aynı modun alışkanlıkları gökkuşağı, modla bağı yok;
 *    "Hata Defteri" KIRMIZI — hata anlamıyla çakışıyor.
 *  · ELLE eklenenler formdaki 8 tema renginden (primary, secondary, warning, error, …) —
 *    durum renkleri kimlik rengi olarak kullanılıyordu, iki tema için ayrı ton yoktu.
 *
 * Karar:
 *  · MOD alışkanlığı → modunun rengi (ModeAccents; açık/koyu ayrı ölçülü). Bir bakışta "bu
 *    alışkanlık hangi planımın" okunur; aynı modun alışkanlıkları tek aile.
 *  · ELLE eklenen → kullanıcının seçimi, ama ölçülmüş paletten: mod renkleriyle AYNI açıklık/
 *    doygunluk ailesi (yan yana uyumlu). dataviz doğrulayıcısı: açık ve koyu temada açıklık bandı,
 *    doygunluk, normal görüş ayrımı ve ≥3:1 kontrast GEÇTİ; renk körü ayrımı 6.7–7.3 (sınır bandı)
 *    — kimliği renk tek başına taşımaz, simge + ad her zaman yanında (ikincil kodlama).
 *  · Durum biçimle söylenir (dolu = yapıldı, boş = bekliyor), renk tonuyla değil.
 * Kayıtlı renk açık tema tonu olarak saklanır (eşitleme değişmez); koyu ton burada çözülür.
 * Eski renkler en yakın palet rengine eşlenir — kimsenin alışkanlığı renksiz kalmaz.
 */
export interface PaletteColor { id: string; light: string; dark: string }

/** Palet tek kaynakta (Colors.ts → HabitPalette); sıra dataviz doğrulayıcısının en iyi dizilimi. */
export const HABIT_PALETTE: PaletteColor[] = HabitPalette.map(p => ({ ...p }));

const rgb = (hex: string) => [0, 2, 4].map(i => parseInt(hex.replace('#', '').slice(i, i + 2), 16) / 255);
function hueOf(hex: string): number | null {
  const [r, g, b] = rgb(hex);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (!Number.isFinite(d) || d < 0.06) return null;
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}
const PALETTE_HUES = HABIT_PALETTE.map(p => ({ p, h: hueOf(p.light) ?? 0 }));

/** Kayıtlı rengin palet karşılığı: birebir eşleşme, yoksa en yakın ton (gri/bozuk → mavi). */
export function paletteOf(color: string | null | undefined): PaletteColor {
  const c = (color ?? '').toUpperCase();
  const exact = HABIT_PALETTE.find(p => p.light === c || p.dark === c);
  if (exact) return exact;
  const h = /^#[0-9A-F]{6}$/.test(c) ? hueOf(c) : null;
  if (h == null) return HABIT_PALETTE[0];
  const dist = (a: number) => Math.min(Math.abs(a - h), 360 - Math.abs(a - h));
  return PALETTE_HUES.reduce((best, x) => (dist(x.h) < dist(best.h) ? x : best)).p;
}

/** "exam2" → "exam": modun ikinci/üçüncü yuvası aynı ailenin rengini taşır. */
export const modeFamily = (planMode: string) => planMode.replace(/\d+$/, '');

/** Bir alışkanlığın ekranda çizilecek rengi (temaya göre). */
export function habitColor(h: { color?: string | null; planMode?: string | null }, isDark: boolean): string {
  if (h.planMode) return modeAccent(modeFamily(h.planMode), isDark);
  const p = paletteOf(h.color);
  return isDark ? p.dark : p.light;
}
