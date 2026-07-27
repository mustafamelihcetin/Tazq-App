import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const stripComments = (src: string) =>
  src.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
    .split('\n')
    .filter((l) => !l.trim().startsWith('//'))
    .join('\n');

/**
 * ADMIN PANELİNDE "VAR AMA GÖRÜNMEYEN KAYIT" KUSURU.
 *
 * Üç listede de aynı hata vardı: sunucu N kayıt gönderiyor, istemci bir kez daha
 * kırpıp M tanesini çiziyordu. Yani kayıtlar veritabanında/tamponda DURUYOR ama
 * panelden ulaşılamıyordu — üstelik sessizce, hiçbir uyarı vermeden:
 *
 *   sunucu logları   500 tutuluyor → 200 isteniyor → 60 çiziliyor
 *   denetim günlüğü  100 isteniyor → 40 çiziliyor   (60'ı ağa gidip çöpe atılıyordu)
 *   kilitlenmeler    15 isteniyor  → gerisine erişim yok
 *
 * Bu sınıf sinsi: panel "çalışıyor" görünür, sayılar makul durur, ve 16. kilitlenmeyi
 * arayan kişi onun hiç kaydedilmediğini sanır.
 */
describe('admin panel — hiçbir liste sessizce kırpılmaz', () => {
  const admin = stripComments(read('app/admin.tsx'));

  it('istemci tarafı kırpma yok', () => {
    // `.slice(0, N)` bir LİSTE üzerinde = "gerisini gösterme". Sayfalama varken
    // ikinci bir kırpma, sayfalamayı işlevsiz bırakır.
    const offenders = [
      ['sysLogs', /sysLogs\.slice\(/],
      ['auditLogs', /auditLogs\.slice\(/],
      ['crashes', /crashes\.slice\(/],
    ].filter(([, re]) => (re as RegExp).test(admin)).map(([n]) => n);
    expect(offenders).toEqual([]);
  });

  it('üç liste de sayfalama denetimi çiziyor', () => {
    // Aynı JSX'i üç kez kopyalamak üç ayrı davranış demekti (biri "Sonraki"yi boşta
    // bırakır, biri aralığı yanlış sayar). Tek bileşen bunu imkânsız kılıyor.
    expect((admin.match(/<Pager/g) ?? [])).toHaveLength(3);
  });

  it('sayfa boyutları tek yerde tanımlı', () => {
    for (const c of ['LOG_PAGE_SIZE', 'CRASH_PAGE_SIZE', 'AUDIT_PAGE_SIZE']) {
      expect(admin).toContain(`const ${c} = `);
    }
  });

  /**
   * Filtre değişince sayfa BAŞA dönmeli: 4. sayfadayken filtreyi daraltınca sonuç
   * 2 sayfaya düşüyor ve kullanıcı boş bir sayfaya bakıyordu.
   */
  it('filtre değişince sayfa sıfırlanır', () => {
    expect(admin).toMatch(/setSysLogPage\(0\); \}, \[sysLogLevel, sysLogSource\]/);
    expect(admin).toMatch(/setCrashPage\(0\); \}, \[crashUnresolvedOnly\]/);
  });

  /**
   * Rozet sayısı SUNUCUDAN gelmeli. Eskiden `crashes.filter(...)` ile yalnız eldeki
   * sayfa sayılıyordu: 200 kayıtlı sistemde "3 ÇÖZÜLMEMİŞ" yazıyordu, çünkü istemciye
   * 15 kayıt gelmişti. Yanlış sayı, sayı olmamasından kötüdür.
   */
  it('sayaçlar eldeki sayfadan değil toplamdan okunur', () => {
    expect(admin).not.toMatch(/crashes\.filter\(c => !c\.isResolved\)\.length/);
    expect(admin).toContain('crashMeta.total');
    expect(admin).toContain('sysLogMeta.total');
    expect(admin).toContain('auditMeta.total');
  });
});

describe('Pager bileşeni', () => {
  const src = read('shared/components/Pager.tsx');

  it('tek sayfaya sığan listede hiç çizilmez', () => {
    // Boş bir "1–12 / 12" satırı bilgi vermez, yalnız yer kaplar.
    expect(src).toContain('if (!unknownTotal && total <= pageSize) return null;');
  });

  /**
   * Sunucu `total` göndermezse (eski sürüm) eskiden `items.length` varsayılıyordu.
   * Tam dolu bir sayfada bu `total === pageSize` yapıyor, denetim de "tek sayfa" sanıp
   * KENDİNİ GİZLİYORDU — özellik eksiksiz çalışırken kullanıcıya "sayfalama yok" gibi
   * görünüyordu. Bir özelliğin en kötü hâli, var olup görünmemesidir.
   */
  it('sunucu toplamı bildirmezse denetim yine görünür', () => {
    expect(src).toContain('const unknownTotal = total < 0;');
    const api = read('shared/services/api.ts');
    expect(api).toContain('function pageMeta(');
    expect(api).toMatch(/total: full \? -1 : items\.length/);
  });

  it('son sayfada "Sonraki" gerçekten kapanır', () => {
    // `hasMore` sunucudan geliyor; istemci tahmin etmiyor. Tahmin etseydi son
    // sayfada kullanıcıyı boş bir sayfaya tıklatırdı.
    expect(src).toContain('disabled={!hasMore}');
    expect(src).toContain('accessibilityState={{ disabled: !hasMore }}');
  });

  it('devre dışı düğme kaybolmaz, soluklaşır', () => {
    // Kaybolsaydı düğmelerin yeri değişir ve kullanıcı her sayfada hedefi yeniden arardı.
    expect(src).toContain('opacity: disabled ? 0.4 : 1');
  });
});
