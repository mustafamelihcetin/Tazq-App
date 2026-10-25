import { AVATAR_RINGS, hasRing } from '@/features/user/utils/avatarRings';

/** Halka paleti: her renk iki temada da halka olarak SEÇİLİR ve renkler birbirinden ayrışır. */
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const lum = (hex: string) => {
  const [r, g, b] = rgb(hex).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

const colors = AVATAR_RINGS.filter((r) => hasRing(r.color)).map((r) => r.color);

describe('AVATAR_RINGS', () => {
  it('ilk seçenek "Yok", sonra 11 renk; anahtarlar ve renkler tekil', () => {
    expect(AVATAR_RINGS[0].key).toBe('none');
    expect(colors).toHaveLength(11);
    expect(new Set(AVATAR_RINGS.map((r) => r.key)).size).toBe(AVATAR_RINGS.length);
    expect(new Set(colors).size).toBe(colors.length);
  });

  it.each(colors)('%s açık (#FFFFFF) ve koyu (#121212) zeminde görünür', (c) => {
    expect(contrast(c, '#FFFFFF')).toBeGreaterThanOrEqual(2);
    expect(contrast(c, '#121212')).toBeGreaterThanOrEqual(2.5);
  });

  it('hiçbir iki renk birbirine çok yakın değil', () => {
    for (let i = 0; i < colors.length; i++) for (let j = i + 1; j < colors.length; j++) {
      const [a, b] = [rgb(colors[i]), rgb(colors[j])];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      expect([colors[i], colors[j], Math.round(d) >= 50]).toEqual([colors[i], colors[j], true]);
    }
  });

  it('saf/neon renk yok (#FFFF00 gibi)', () => {
    for (const c of colors) expect(Math.max(...rgb(c)) - Math.min(...rgb(c))).toBeLessThan(200);
  });
});
