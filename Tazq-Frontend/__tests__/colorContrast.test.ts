import fs from 'fs';
import path from 'path';
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
  // ÜÇÜNCÜL metin — eşik 3.0 çünkü rolü gerçekten yardımcı bilgi (zaman damgası, birim,
  // ipucu). Kıyas: Apple'ın kendi secondaryLabel'ı 3.44:1, tertiaryLabel'ı 1.72:1.
  // Bizim değer ikisinden de iyi (4.40 açık / 4.12 koyu) — yani 4.5 eşiği koymamak
  // gevşeklik değil, rolün doğru tanımı; ölçü yine de Apple'ın üstünde.
  ['üçüncül metin', 'onSurfaceMuted', 'surface', 3.0],
  ['üçüncül metin / kart', 'onSurfaceMuted', 'surfaceContainerHigh', 3.0],
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

/**
 * Kullanım yerinde soluklaştırma yasağı.
 *
 * NEDEN BU TEST VAR: yukarıdaki tablo TOKEN'ları ölçüyor ve hepsi geçiyordu — ama
 * ekranlar token'ı alıp üstüne `opacity` uyguluyordu. 140 yerde. Sonuç ölçülmüş değeri
 * çöpe atıyordu: onSurfaceVariant 7.03:1 iken `opacity: 0.6` onu 2.90:1 yapıyordu.
 *
 * Yani test yeşildi, uygulama kırmızıydı. Testin kendisi kördü: doğru şeyi ölçüyor ama
 * yanlış yerde ölçüyordu. (Aynı sınıf körlük: primary'yi bir ara 3.0 UI eşiğiyle ölçmüş
 * ve koyu temadaki metin hatasını kaçırmıştım.)
 *
 * Çözüm opaklığı düzeltmek değil, ÖLÇÜLMÜŞ bir seviye vermekti: onSurfaceMuted.
 * Soluk metin gerekiyorsa o token kullanılır — palette ölçülür, testte doğrulanır.
 */
describe('metin soluklaştırma', () => {
  const ROOT = path.resolve(__dirname, '..');
  const SKIP = ['node_modules', '.expo', 'android', 'ios', '.git', '__tests__', '__mocks__', 'dist'];
  // Pazarlama sayfası kendi görsel dilinde (bkz. designTokens.test.ts EXEMPT).
  const EXEMPT = new Set(['app/promo.tsx']);

  function walk(dir: string, out: string[] = []): string[] {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (SKIP.includes(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, out);
      else if (e.name.endsWith('.tsx')) out.push(p);
    }
    return out;
  }

/**
   * Blok yorumlarını boşluğa çevirir — satır sayısı korunur.
   * Satır satır tarama yalnızca `//` başlangıcını atlıyordu; bir kuralın NEDENİNİ
   * anlatan JSX blok yorumu (`{/* ... *\/}`) kod sanılıp ihlal sayılıyordu. Yani
   * kuralı açıklamak kuralı çiğnemek oluyordu.
   */
  function stripBlockComments(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  }

  it('metin token’ına opacity uygulanmamalı — ölçülen değeri çöpe atar', () => {
    // [^{}] ile aynı stil nesnesinde kalınır; iç içe nesnedeki opacity yanlışlıkla
    // yakalanmaz. Yalnızca SABİT opaklık aranır: `opacity: isActive ? …` bir durum
    // göstergesidir, soluklaştırma değil.
    // Ağ ÖNCE yalnızca onSurface ailesini kapsıyordu ve `theme.primary + opacity: 0.7`
    // gibi kullanımları kaçırıyordu — dashboard'da tam olarak bu vardı (4.80:1 → 2.90:1).
    // Kural token ailesine değil, ROLE bağlı: metin rengi olarak kullanılan HER palet
    // token'ı ölçülmüştür ve kullanım yerinde kısılamaz.
    const TEXT_TOKENS =
      'onSurface|onSurfaceVariant|onSurfaceMuted|onPrimary|onSecondary|onTertiary|' +
      'primary|secondary|tertiary|error|success|warning|info|streak|priority[A-Za-z]+';
    const pattern = new RegExp(
      `color: theme\\.(?:${TEXT_TOKENS})[^{}]{0,90}opacity: 0\\.\\d+` +
        `|opacity: 0\\.\\d+[^{}]{0,90}color: theme\\.(?:${TEXT_TOKENS})\\b`,
    );

    const hits: string[] = [];
    for (const file of walk(ROOT)) {
      const key = path.relative(ROOT, file).split(path.sep).join('/');
      if (EXEMPT.has(key)) continue;
      const src = fs.readFileSync(file, 'utf8');
      src.split('\n').forEach((line, i) => {
        const s = line.trim();
        if (s.startsWith('//') || s.startsWith('*')) return;
        if (pattern.test(line)) hits.push(`${key}:${i + 1}`);
      });
    }
    // Soluk metin gerekiyorsa: theme.onSurfaceMuted kullan.
    expect(hits).toEqual([]);
  });

  it('StyleSheet’teki opacity ile satır içi metin rengi birleştirilmemeli', () => {
    /**
     * Yukarıdaki test aynı stil NESNESİNE bakar ve 145 kullanımı yakaladı — ama 32
     * tanesini KAÇIRDI, çünkü orada renk ve opaklık ayrı yerlerdeydi:
     *
     *     subGreeting: { fontWeight: '500', opacity: 0.7 }          ← StyleSheet
     *     <Text style={[styles.subGreeting, { color: theme.onSurfaceVariant }]}>  ← inline
     *
     * Etki aynı (7.03:1 → 3.62:1) ama iki nesneye bölündüğü için hiçbir tarama görmüyordu.
     * Dashboard'daki "İyi akşamlar"ın altındaki yazı tam olarak buydu.
     */
    const hits: string[] = [];
    for (const file of walk(ROOT)) {
      const key = path.relative(ROOT, file).split(path.sep).join('/');
      if (EXEMPT.has(key)) continue;
      const src = stripBlockComments(fs.readFileSync(file, 'utf8'));

      for (const m of src.matchAll(/^\s+([a-zA-Z]+): \{([^}]*)\},/gm)) {
        const [, name, body] = m;
        if (!/opacity: 0\.\d+/.test(body)) continue;

        // "Metin stili mi?" sorusunu stil nesnesinin İÇİNDEKİ font prop'larıyla
        // yanıtlamak YANLIŞTI: `email: { opacity: 0.6, marginTop }` gibi bir stil
        // metin olabilir ama fontSize'ı satır içinde gelir. Bu delik profil e-posta
        // satırını kaçırdı (onSurfaceVariant × 0.6 = 2.90:1, WCAG altı).
        //
        // Gerçek sinyal KULLANIM YERİNDE: bu stil bir palet METİN rengiyle birlikte
        // kullanılıyorsa metindir — çünkü View'lar renk almaz. Font prop'u aramaya gerek yok.
        const used = new RegExp(`styles\\.${name}[^\\]]{0,140}?color: theme\\.onSurface\\w*`).test(src);
        if (used) hits.push(`${key} → styles.${name}`);
      }
    }
    // Çözüm: opacity'yi stilden kaldır, kullanım yerinde bir seviye aşağı in
    // (onSurface → onSurfaceVariant → onSurfaceMuted). Hepsi ölçülü.
    expect(hits).toEqual([]);
  });
});
