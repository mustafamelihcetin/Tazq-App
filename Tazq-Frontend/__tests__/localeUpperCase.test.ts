import fs from 'fs';
import path from 'path';

/**
 * TÜRKÇE BÜYÜK HARF MANDALI.
 *
 * `toUpperCase()` dili bilmez: "Eki" → "EKI", "Bitiş tarihi" → "BITIŞ TARIHI".
 * Türkçe'de i'nin büyüğü İ'dir. Haftalık Merkez'in başlığı ("19 – 25 EKI") ve görev
 * formunun bölüm etiketleri bu yüzden yanlış yazılıyordu. Doğrusu:
 * `s.toLocaleUpperCase(tr ? 'tr-TR' : 'en-US')` (bkz. SectionHeader).
 *
 * Kalanlar ASCII veriler (admin log seviyeleri, dil kodu "TR", e-posta baş harfi,
 * sınav adı karşılaştırması). Tavan yalnız DÜŞER.
 */
const CEILING = 18;

const ROOT = path.resolve(__dirname, '..');
const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });

it('dil belirtmeden büyük harfe çevirme artmaz', () => {
  const count = ['app', 'features', 'shared']
    .flatMap((d) => walk(path.join(ROOT, d)))
    .map((f) => fs.readFileSync(f, 'utf8').split('\n').filter((l) => !l.trim().startsWith('//') && l.includes('.toUpperCase()')).length)
    .reduce((a, b) => a + b, 0);
  expect(count).toBeLessThanOrEqual(CEILING);
});
