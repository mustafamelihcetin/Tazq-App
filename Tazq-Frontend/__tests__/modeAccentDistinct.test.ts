import { ModeAccents } from '@/shared/constants/Colors';

/**
 * Mod vurgularının AYIRT EDİLEBİLİRLİĞİ — kontrastın yanındaki ikinci eksen.
 *
 * Neden: koyu temada spor (#FCA5A1) ile birakma (#FCA5A5) OKLab'da 0.005 uzaktaydı;
 * algı eşiği ~0.02. Kontrast testi ikisini de geçiriyordu (ikisi de okunaklı) ama
 * kullanıcı iki modu renginden ayıramıyordu. Mesafe RGB'de değil algısal uzayda
 * (OKLab — Radix/Leonardo/Harmony'nin kullandığı ölçü) ölçülür.
 *
 * Bilinçli aynı aile: yks/exam/kpss (üçü de sınav) — muaf.
 */

const SAME_FAMILY = new Set(['yks', 'exam', 'kpss']);
const MIN_DISTANCE = 0.03;

function oklab(hex: string): [number, number, number] {
  const lin = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(hex.substr(i, 2), 16)));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

const dist = (a: string, b: string) => {
  const [x, y] = [oklab(a), oklab(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
};

describe('mod vurguları birbirinden ayırt edilebilir', () => {
  const keys = Object.keys(ModeAccents) as (keyof typeof ModeAccents)[];
  for (const scheme of ['light', 'dark'] as const) {
    it(scheme, () => {
      const tooClose: string[] = [];
      keys.forEach((a, i) => keys.slice(i + 1).forEach((b) => {
        if (SAME_FAMILY.has(a) && SAME_FAMILY.has(b)) return;
        const d = dist(ModeAccents[a][scheme], ModeAccents[b][scheme]);
        if (d < MIN_DISTANCE) tooClose.push(`${a}/${b} ${d.toFixed(3)}`);
      }));
      expect(tooClose).toEqual([]);
    });
  }
});
