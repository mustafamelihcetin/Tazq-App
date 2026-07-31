import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const SKIP = ['node_modules', '.expo', 'android', 'ios', 'dist', '.git', '__tests__', '__mocks__'];

function walk(dir: string): string[] {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap((e) => {
    if (SKIP.includes(e.name)) return [];
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) return walk(rel);
    return /\.tsx?$/.test(e.name) ? [rel] : [];
  });
}

const FILES = ['app', 'shared', 'features'].flatMap(walk);

/** Yorumlar hariç — gerekçe metninde `any`den söz etmek serbest. */
const code = (rel: string) =>
  fs
    .readFileSync(path.join(ROOT, rel), 'utf8')
    .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
    .split('\n')
    .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
    .join('\n');

/**
 * TİP GÜVENLİĞİ BORÇ TAVANI.
 *
 * `any` tip sisteminin kapısını açık bırakır: derleyici o noktadan sonra hiçbir şey
 * doğrulamaz. Bunun ne kadar pahalı olabildiğini bu kod tabanında ölçtük —
 * `sleepHealth.ts`te Health Connect uyku evresi `any[]` olduğu için, kod SAYI dönen
 * bir alanda METİN araması yapıyordu (`String(stage).includes('AWAKE')`). Derleyici
 * uyaramadı; hata her gece 20-60 dakika fazla uyku olarak sessizce birikti.
 *
 * Tipler eklendiği anda derleyici ikinci bir sorunu daha gösterdi: `new Date(undefined)`.
 *
 * NEDEN TOPLU TEMİZLİK DEĞİL: 244 kullanımın çoğu kütüphane arayüzü (`as any`) ve her
 * biri ayrı bir modelleme kararı. Kör bir süpürme, davranışı maskeleyen tipler üretir —
 * `any`den beter olur. Bunun yerine TAVAN: yeni borç eklenemez, mevcut borç zamanla
 * düşürülür. Aynı disiplin palet ve titreşim tavanlarında da uygulanıyor.
 */
describe('tip güvenliği borç tavanı', () => {
  const count = (re: RegExp) =>
    FILES.reduce((n, f) => n + (code(f).match(re) ?? []).length, 0);

  it('`x: any` bildirimleri tavanın altında', () => {
    // Bildirimler cast'lerden DAHA zararlı: değer akıp gittiği her yere `any` taşır.
    // 102 → yalnız düşebilir.
    expect(count(/\w+\s*:\s*any\b/g)).toBeLessThanOrEqual(102);
  });

  it('`as any` cast\'leri tavanın altında', () => {
    // Cast tek noktada kalır; kütüphane arayüzlerinde bazen kaçınılmaz.
    expect(count(/\bas any\b/g)).toBeLessThanOrEqual(142);
  });

  it('@ts-ignore / @ts-expect-error HİÇ yok', () => {
    // Bunlar `any`den de ağır: hatayı tipleme değil, SUSTURMA.
    expect(count(/@ts-(ignore|expect-error)/g)).toBe(0);
  });
});

/**
 * SAĞLIK VERİSİ TİPLENMİŞ — en pahalı `any`nin geri dönmemesi için.
 *
 * Platform kayıtları (HealthKit örneği, Health Connect oturumu/evresi) artık
 * isimlendirilmiş. Tipler bilinçli olarak GEVŞEK: amaç kütüphane şemasını taklit etmek
 * değil, OKUDUĞUMUZ alanları adlandırmak. Sıkı yazmak sürüm değişince derlemeyi kırardı.
 */
describe('sağlık verisi şekilleri tanımlı', () => {
  const src = fs.readFileSync(path.join(ROOT, 'shared/services/sleepHealth.ts'), 'utf8');

  it('platform kayıtları `any[]` değil', () => {
    expect(src).not.toMatch(/const samples: any\[\]/);
    expect(src).not.toMatch(/const records: any\[\]/);
    expect(src).not.toMatch(/const stages: any\[\]/);
  });

  it('uyku evresi tipi sayıyı KABUL ediyor — metin varsayımı bir daha kurulmasın', () => {
    // Hatanın kökü buydu: alan sayı, kod metin arıyordu.
    expect(src).toContain('stage?: number | string;');
  });

  it('tarih alanları boş değeri açıkça karşılıyor', () => {
    expect(src).toContain('type DateLike = string | number | Date | null | undefined;');
    expect(src).toContain('if (a == null || b == null) return null;');
  });
});
