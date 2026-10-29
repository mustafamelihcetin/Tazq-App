import fs from 'fs';
import path from 'path';

/**
 * `any` MANDALI — tip kaçışları yalnız azalabilir.
 *
 * Uygulama kodunda 278 `any` var (2026-10-24 ölçümü). Her biri, TypeScript'in
 * yakalayabileceği bir hatayı sessizce geçiren bir delik: örneğin görev satırı
 * `props: any` alıyordu ve 24 prop'un hiçbiri denetlenmiyordu — tip eklenince
 * `language: string`'in a11y sözlüğüne uymadığı hemen göründü.
 *
 * Hepsini tek turda tiplemek, görmediğim akışlarda davranış değiştirme riski demek.
 * Bu yüzden borç ÇİVİLENİYOR: toplam tavanı aşan yeni `any` testi kırar. Bir dosyayı
 * temizlediysen tavanı aynı commit'te düşür — test bunu da ister.
 */
const ROOT = path.resolve(__dirname, '..');
const SKIP_DIRS = ['node_modules', '__tests__', '__mocks__', '.expo', 'android', 'ios', 'dist'];
const ANY = /\bas any\b|:\s*any\b|<any>|any\[\]/g;

const CEILING = 252; // 259 → 252 (2026-10-29): CustomAlert tiplendi (any kalktı) · 260 → 259 (2026-10-25): ayarlar tema satırı ChoiceRow'a geçti · 261 → 260 (2026-10-25): Hoş Geldin ekranı yeniden yazıldı (t: any kalktı) · 262 → 261 (2026-10-25): Ayarlar hesap bölümü ortak satırlara geçti · 265 → 262 (2026-10-25): içgörü modalı tiplendi · 266 → 265 (2026-10-25): Yeni Hedef formu yeniden yazıldı · 278 → 272 (2026-10-24): TaskListItem yeniden yazımı + TaskFormModal etiket başlığı · 272 → 266 (2026-10-25): tur yeniden kuruldu, eski önizleme dosyaları silindi

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name) && !e.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

function countAny(): number {
  let n = 0;
  for (const dir of ['app', 'features', 'shared']) {
    for (const file of walk(path.join(ROOT, dir))) {
      for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
        const s = line.trim();
        if (s.startsWith('//') || s.startsWith('*') || s.startsWith('/*')) continue;
        n += (line.match(ANY) ?? []).length;
      }
    }
  }
  return n;
}

describe('any mandalı', () => {
  const n = countAny();

  it('yeni `any` eklenmez — tipini yaz ya da `unknown` + daraltma kullan', () => {
    expect(n).toBeLessThanOrEqual(CEILING);
  });

  it('tavan bayatlamaz — temizlenen `any` tavandan da düşülür', () => {
    expect(n).toBe(CEILING);
  });
});
