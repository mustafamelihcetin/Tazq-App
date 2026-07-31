import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const SKIP = new Set(['node_modules', '.expo', 'android', 'ios', 'dist', '.git', '__tests__']);

function walk(base: string): string[] {
  const abs = path.join(ROOT, base);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap((e) => {
    if (SKIP.has(e.name)) return [];
    const rel = `${base}/${e.name}`;
    if (e.isDirectory()) return walk(rel);
    return /\.tsx?$/.test(e.name) && !e.name.endsWith('.d.ts') ? [rel] : [];
  });
}

const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const importsOf = (rel: string) => [...read(rel).matchAll(/from '@\/(\w+)\//g)].map((m) => m[1]);

/**
 * KATMAN YÖNÜ — `app` → `features` → `shared`.
 *
 * `shared` en alt katman: herkesin kullandığı, kimseyi tanımayan yer. Yukarı uzandığı
 * anda "paylaşılan" olmaktan çıkar; belirli bir özelliğe bağlanır ve o özellik
 * değiştiğinde bütün uygulama etkilenir. Döngüsel bağımlılık riski de buradan doğar.
 *
 * ÖLÇÜM: denetim başladığında `shared` içinden `features`'a 41 bağımlılık vardı ve
 * 6 dosya doğrudan yanlış klasördeydi (mod kartları, alışkanlık bileşenleri, spor
 * store'u `shared`'da duruyordu). Taşımalardan sonra sayı düştü.
 *
 * Kalan bağımlılıklar çoğunlukla ALTYAPININ durum okuması: `api.ts` oturum jetonunu,
 * `useOfflineSync` kuyruğu, `BottomNavBar` tercihleri okuyor. Bunlar bağımlılık
 * enjeksiyonuyla çözülür ve ayrı bir tur işidir; bu yüzden sıfır değil, TAVAN
 * çiviliyoruz — tavan yalnız DÜŞEBİLİR.
 */
/**
 * `shared → features` borç tavanı — İKİ test de bunu okur.
 *
 * Ayrı ayrı yazıldığında biri düşürülüp öteki unutuluyordu: tavan 7'ye indirildiğinde
 * bayatlama koruması hâlâ eski 20'ye göre hesap yapıyordu ve testi kırdı. Tek sabit,
 * ikisinin ayrışmasını imkânsız kılıyor.
 */
const LAYER_CEILING = 7;

describe('katman yönü', () => {
  const sharedFiles = walk('shared');

  it('shared → app bağımlılığı HİÇ olmamalı', () => {
    // Bu asla meşru değil: `app` yönlendirme katmanı, en üstte.
    const offenders = sharedFiles.filter((f) => importsOf(f).includes('app'));
    expect(offenders).toEqual([]);
  });

  it('features → app bağımlılığı HİÇ olmamalı', () => {
    const offenders = walk('features').filter((f) => importsOf(f).includes('app'));
    expect(offenders).toEqual([]);
  });

  /**
   * BORÇ TAVANI. 41 → 20 → 7.
   *
   * ── 20'DEN 7'YE NASIL İNDİ ──────────────────────────────────────────────────
   * İhlallerin çoğu bir bağımlılık sorunu değil, YANLIŞ KLASÖRLEME'ydi: `shared`
   * altında duran altı dosya aslında birer özellik parçasıydı — bir GÖREV formu,
   * kullanıcı profili modalı, başarım kutlaması, momentum geri bildirimi, tanıtım
   * turu ve sistem görev metinleri çevirmeni. Hiçbiri genel değildi; hepsi
   * `features`'a taşındı. Mantık hiç değişmedi, yalnız yerleri düzeldi.
   *
   * ── KALAN 7 NEDEN KALDI ─────────────────────────────────────────────────────
   * Geriye kalanlar ALTYAPININ durum okuması ve tek tek bakıldığında hepsi meşru bir
   * ihtiyaçtan doğuyor:
   *   · api.ts → oturum jetonunu okuyor
   *   · useOfflineSync → kuyruğu boşaltırken görev ve tercih store'unu yazıyor
   *   · usePrefsSync → kullanıcı kimliği ve tercihleri eşitliyor
   *   · BottomNavBar → sade/pro moduna göre sekmeleri belirliyor
   *   · useLanguageStore → dil değişince sistem görev metinlerini çeviriyor
   *
   * Bunları kaldırmanın yolu store'ları `shared`'a taşımak DEĞİL: denendi ve ölçüldü,
   * `useAuthStore` çıkışta her özellik store'unu sıfırladığı için taşıma 2 ihlali
   * kaldırıp 5 yenisini doğuruyordu — yani borcu artırıyordu.
   *
   * Doğru çözüm bağımlılığın YÖNÜNÜ çevirmek (jeton sağlayıcı, sıfırlama kaydı gibi
   * ters bağımlılıklar). Bu, oturum ve eşitleme yollarına dokunan ayrı ve dikkatli bir
   * tur işi; yayın öncesi aceleye getirilecek bir şey değil. Bu yüzden sıfır değil,
   * ölçülmüş bir tavan çiviliyoruz — tavan yalnız DÜŞEBİLİR.
   */
  it('shared → features bağımlılığı tavanın altında', () => {
    const count = sharedFiles.reduce(
      (n, f) => n + importsOf(f).filter((m) => m === 'features').length,
      0,
    );
    expect(count).toBeLessThanOrEqual(LAYER_CEILING);
  });

  it('tavan bayatlamamalı — düşen borç listede kalmasın', () => {
    // Tavan gerçek sayının çok üstünde kalırsa koruma işlevini yitirir: yeni ihlaller
    // sessizce sığar. Bu test tavanı gerçeğe YAKIN tutmaya zorlar — borç düştüğünde
    // tavanı da düşürmek zorunlu hale gelir.
    const count = sharedFiles.reduce(
      (n, f) => n + importsOf(f).filter((m) => m === 'features').length,
      0,
    );
    expect(count).toBeGreaterThan(LAYER_CEILING - 3);
  });
});

/**
 * FEATURE'A AİT DOSYA `shared`'DA DURMAZ.
 *
 * Bir dosyanın adı belirli bir özelliği söylüyorsa (SporCard, HabitBubble…) orası
 * onun evi değildir. Bunlar "paylaşılan" değil, "başka yere konmamış" dosyalardır ve
 * `shared`ı çöp kutusuna çevirirler.
 */
describe('dosya yerleşimi', () => {
  const FEATURE_WORDS = ['Spor', 'Exam', 'Tez', 'Mulakat', 'Ramazan', 'Birakma', 'Tasarruf', 'Habit', 'Weight', 'Momentum', 'MyDay', 'StatusHub'];

  it('shared içinde feature adı taşıyan dosya yok', () => {
    const offenders = walk('shared').filter((f) => {
      const base = path.basename(f);
      return FEATURE_WORDS.some((w) => base.includes(w));
    });
    expect(offenders).toEqual([]);
  });

  it('silinen ölü dosyalar geri gelmemeli', () => {
    // Üçü de hiçbir yerden referans edilmiyordu:
    //  · PromoOverlay  — içi `export {}` olan mezar taşı, tanıtım app/promo.tsx'te
    //  · watchBridge   — projede Apple Watch hedefi yok
    //  · shareService  — hiç bağlanmamış, üstelik `tazq://` yazıyordu (şema `tazq-app`)
    for (const dead of [
      'shared/components/PromoOverlay.tsx',
      'shared/utils/watchBridge.ts',
      'shared/utils/shareService.ts',
    ]) {
      expect(fs.existsSync(path.join(ROOT, dead))).toBe(false);
    }
  });
});
