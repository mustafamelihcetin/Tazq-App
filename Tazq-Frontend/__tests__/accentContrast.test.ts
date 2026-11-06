/**
 * Vurgu paletleri — her biri iki temada okunur, hepsi aynı ölçülü aileden; varsayılan marka mavisi.
 * Eşikler tema kurallarıyla aynı (bkz. colorContrast.test.ts).
 */
import { Colors, AccentPalettes, ACCENT_FEATURED, accentOf, DEFAULT_ACCENT } from '@/shared/constants/Colors';

function luminance(hex: string): number {
  const c = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.substr(i, 2), 16) / 255);
  const f = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
const ratio = (a: string, b: string) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

describe('vurgu paletleri', () => {
  it.each(AccentPalettes.map(a => [a.id, a] as const))('%s — açık temada okunur', (_id, a) => {
    expect(ratio(a.light.primary, Colors.light.surface)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(a.light.onPrimaryFill, a.light.primaryFill)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(a.light.onPrimaryContainer, a.light.primaryContainer)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(AccentPalettes.map(a => [a.id, a] as const))('%s — koyu temada okunur', (_id, a) => {
    expect(ratio(a.dark.primary, Colors.dark.surface)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(a.dark.onPrimaryFill, a.dark.primaryFill)).toBeGreaterThanOrEqual(3);
    expect(ratio(a.dark.onPrimaryContainer, a.dark.primaryContainer)).toBeGreaterThanOrEqual(4.5);
  });

  it('varsayılan marka mavisi birebir: seçim yapmayan için hiçbir şey değişmez', () => {
    const a = accentOf(DEFAULT_ACCENT);
    for (const k of Object.keys(a.light) as (keyof typeof a.light)[]) {
      expect(a.light[k]).toBe(Colors.light[k]);
      expect(a.dark[k]).toBe(Colors.dark[k]);
    }
    expect(accentOf('yok').id).toBe('blue');
  });

  it('aynı aile: renkli paletlerin parlaklığı dar bir bantta (biri bağırmaz, biri sönmez)', () => {
    const lums = AccentPalettes.filter(a => !['blue', 'graphite', 'wine', 'sun', 'amber', 'sand'].includes(a.id)).map(a => luminance(a.light.primary));
    expect(Math.max(...lums) - Math.min(...lums)).toBeLessThan(0.06);
  });

  it('hiçbir iki ton yan yana karışmaz (OKLab ΔE×100 ≥ 5)', () => {
    const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    const oklab = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map(i => lin(parseInt(hex.slice(i, i + 2), 16) / 255));
      const [l, m, s] = [
        0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b,
        0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b,
        0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b,
      ].map(Math.cbrt);
      return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
    };
    const ps = AccentPalettes.map(a => [a.id, oklab(a.light.primaryFill)] as const);
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      const d = Math.hypot(...ps[i][1].map((v, k) => (v - ps[j][1][k]) * 100));
      expect([ps[i][0], ps[j][0], d >= 5]).toEqual([ps[i][0], ps[j][0], true]);
    }
  });

  it('renk ailelerinin hepsi var: kırmızı, sarı, yeşil, mavi, mor, pembe, nötr', () => {
    const hue = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
      const max = Math.max(r, g, b); const d = max - Math.min(r, g, b);
      if (d === 0) return 0;
      const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      return (h * 60 + 360) % 360;
    };
    const fills = AccentPalettes.map(a => hue(a.light.primaryFill));
    for (const [from, to] of [[350, 360], [38, 48], [145, 165], [190, 215], [245, 265], [330, 345]]) {
      expect([from, fills.some(h => h >= from && h <= to)]).toEqual([from, true]);
    }
  });

  it('palet Paint gibi bağırmaz: hiçbir dolgu tam doygun değil', () => {
    for (const a of AccentPalettes.filter(x => x.id !== 'blue')) {
      const [r, g, b] = [1, 3, 5].map(i => parseInt(a.light.primaryFill.slice(i, i + 2), 16));
      expect([a.id, Math.max(r, g, b) - Math.min(r, g, b) <= 180]).toEqual([a.id, true]);
    }
  });

  it('kaldırılan tonu seçen kullanıcı maviye düşmez', () => {
    expect(accentOf('orange').id).toBe('coral');
    expect(accentOf('indigo').id).toBe('lavender');
  });

  it('onPrimary her tonda beyaz: yeşil tik ve mod renkleri sarı vurguda siyaha dönmez', () => {
    for (const a of AccentPalettes) {
      expect(a.light.onPrimary).toBe('#FFFFFF');
      expect(a.dark.onPrimary).toBe('#FFFFFF');
    }
  });

  it.each(['sun', 'amber', 'sand'])('%s: açık temada yazı koyu ve rahat okunur, renk dolguda', (id) => {
    const a = AccentPalettes.find(x => x.id === id)!;
    expect(ratio(a.light.primary, Colors.light.surface)).toBeGreaterThanOrEqual(7);
    expect(luminance(a.light.primaryFill)).toBeGreaterThan(0.3);
    expect(a.light.onPrimaryFill).not.toBe('#FFFFFF');
  });

  it('sarı dolgu gerçekten sarı, metni okunur', () => {
    const sun = AccentPalettes.find(a => a.id === 'sun')!;
    expect(luminance(sun.light.primaryFill)).toBeGreaterThan(0.5);
    expect(ratio(sun.light.primary, Colors.light.surface)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(sun.light.onPrimaryFill, sun.light.primaryFill)).toBeGreaterThanOrEqual(4.5);
  });

  it("6'lık sıralar tam; kapalı seçicideki 6 ton palette ve tekil", () => {
    expect(AccentPalettes.length % 6).toBe(0);
    expect(ACCENT_FEATURED).toHaveLength(6);
    expect(new Set(ACCENT_FEATURED).size).toBe(6);
    for (const id of ACCENT_FEATURED) expect(AccentPalettes.some(a => a.id === id)).toBe(true);
    expect(ACCENT_FEATURED[0]).toBe(DEFAULT_ACCENT);
  });
});
