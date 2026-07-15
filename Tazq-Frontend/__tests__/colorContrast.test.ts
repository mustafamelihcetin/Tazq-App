import { Colors, AppTheme, CategoryColors } from '@/shared/constants/Colors';

/**
 * Paletin WCAG AA uyumunu derleme/test zamanında koruyan bekçi.
 *
 * Neden: v5'te 5 token AA'dan kalıyordu ve bunu kimse fark etmiyordu — kontrast
 * gözle tahmin edilemez, hesaplanır. En ciddi olanı koyu temadaki birincil butondu
 * (beyaz yazı / Indigo 400 = 2.98:1) ve 66 kullanım yerini birden etkiliyordu.
 *
 * Eşikler (WCAG 2.1): normal metin 4.5:1, büyük metin ve UI öğeleri 3:1.
 */

function luminance(hex: string): number {
  const c = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.substr(i, 2), 16) / 255);
  const f = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrastRatio(fg: string, bg: string): number {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

/** [ad, ön plan token'ı, arka plan token'ı, gereken oran] */
type Check = [string, keyof AppTheme, keyof AppTheme, number];

const CHECKS: Check[] = [
  // Metin — 4.5:1
  ['ana metin', 'onSurface', 'surface', 4.5],
  ['ikincil metin', 'onSurfaceVariant', 'surface', 4.5],
  ['ikincil metin / kart', 'onSurfaceVariant', 'surfaceContainerHigh', 4.5],
  ['ikincil metin / en üst kart', 'onSurfaceVariant', 'surfaceContainerHighest', 4.5],
  ['hata mesajı', 'error', 'surface', 4.5],
  ['container yazısı', 'onPrimaryContainer', 'primaryContainer', 4.5],

  // Buton yazıları — 4.5:1. Koyu temada Material 3 gereği onPrimary KOYU olmalı.
  ['birincil buton yazısı', 'onPrimary', 'primary', 4.5],
  ['ikincil buton yazısı', 'onSecondary', 'secondary', 4.5],
  ['üçüncül buton yazısı', 'onTertiary', 'tertiary', 4.5],

  // primary METİN olarak da kullanılıyor (bölüm başlıkları, etkileşimli yazı),
  // sadece ikon/çerçeve olarak değil. Bu yüzden eşiği 3.0 değil 4.5.
  // Bu satır önce 3.0 idi ve gerçek bir hatayı kaçırdı: koyu temada primary metin
  // olarak 3.77:1 veriyordu, "Bugünkü Alışkanlıklarım" gibi başlıklar okunmuyordu —
  // ama test UI eşiğine baktığı için yeşil geçiyordu.
  ['primary (metin olarak)', 'primary', 'surface', 4.5],

  // UI öğeleri / ikonlar / durum renkleri — 3:1
  ['secondary vurgu', 'secondary', 'surface', 3.0],
  ['tertiary vurgu', 'tertiary', 'surface', 3.0],
  ['başarı', 'success', 'surface', 3.0],
  ['uyarı', 'warning', 'surface', 3.0],
  ['bilgi', 'info', 'surface', 3.0],
  ['öncelik: yüksek', 'priorityHigh', 'surface', 3.0],
  ['öncelik: orta', 'priorityMedium', 'surface', 3.0],
  ['öncelik: düşük', 'priorityLow', 'surface', 3.0],
  ['seri rozeti', 'streak', 'surface', 3.0],
];

describe.each([
  ['açık tema', Colors.light],
  ['koyu tema', Colors.dark],
])('%s — WCAG AA kontrastı', (_label, palette) => {
  it.each(CHECKS)('%s en az %s:1 olmalı', (_name, fgKey, bgKey, required) => {
    const fg = palette[fgKey] as string;
    const bg = palette[bgKey] as string;
    const ratio = contrastRatio(fg, bg);

    // Hata mesajı gerçek oranı göstersin ki düzeltme yönü belli olsun.
    expect({ ratio: Number(ratio.toFixed(2)), fg, bg }).toEqual({
      ratio: expect.any(Number),
      fg: expect.any(String),
      bg: expect.any(String),
    });
    expect(ratio).toBeGreaterThanOrEqual(required);
  });
});

describe('kategori paleti', () => {
  // Bu renkler alışkanlık kaydına yazılır (kalıcı), yani temaya göre değişemezler.
  // Bu yüzden HER İKİ zeminde de okunur olmak zorundalar. Eskiden Tailwind 500
  // serisiydiler ve açık temada kalıyorlardı (Amber 500: 1.95:1).
  const entries = Object.entries(CategoryColors);

  it.each(entries)('%s açık temada en az 3:1 olmalı', (_name, hex) => {
    expect(contrastRatio(hex, Colors.light.surface)).toBeGreaterThanOrEqual(3);
  });

  it.each(entries)('%s koyu temada en az 3:1 olmalı', (_name, hex) => {
    expect(contrastRatio(hex, Colors.dark.surface)).toBeGreaterThanOrEqual(3);
  });

  it('kategoriler birbirinden ayırt edilebilmeli', () => {
    // Aynı renk iki kategoriye atanırsa kimlik işlevini kaybeder.
    const values = Object.values(CategoryColors);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('palet bütünlüğü', () => {
  it('iki tema da aynı token setine sahip olmalı', () => {
    expect(Object.keys(Colors.dark).sort()).toEqual(Object.keys(Colors.light).sort());
  });

  it('priorityHigh ve error tek bir kırmızı olmalı', () => {
    // v5'te iki farklı kırmızı vardı (hue 0 ve hue 3) — kaza gibi görünüyordu.
    expect(Colors.light.priorityHigh).toBe(Colors.light.error);
    expect(Colors.dark.priorityHigh).toBe(Colors.dark.error);
  });

  it('warning ve priorityMedium aynı tonu paylaşmalı', () => {
    expect(Colors.light.warning).toBe(Colors.light.priorityMedium);
    expect(Colors.dark.warning).toBe(Colors.dark.priorityMedium);
  });

  it('success marka yeşiliyle (tertiary) aynı olmalı', () => {
    expect(Colors.light.success).toBe(Colors.light.tertiary);
    expect(Colors.dark.success).toBe(Colors.dark.tertiary);
  });
});
