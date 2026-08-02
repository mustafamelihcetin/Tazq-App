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
const lines = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8').split('\n').length;

/**
 * DOSYA BOYUTU — büyüyen borcu SINIRLAMA testi.
 *
 * ── NEDEN SİLMİYORUZ DA SINIRLIYORUZ ────────────────────────────────────────────
 * Uygulamada 1000 satırı aşan on dosya var; en büyüğü 2666 satır. Bunları bölmek
 * gerçek bir iyileştirme olurdu ama BUGÜN yapılacak iş değil, üç sebeple:
 *
 *  1. HİÇBİRİ HATA ÜRETMİYOR. Büyük dosya bakımı zorlaştırır; çalışmayı bozmaz.
 *     Kullanıcı açısından 2400 satırlık bir ekran ile 6×400 satırlık aynı ekran
 *     arasında hiçbir fark yok.
 *  2. DAVRANIŞ TESTİ YOK. Bu ekranların çoğunun render testi var ama akış testi yok.
 *     Testsiz bir god dosyayı bölmek, kırılıp kırılmadığını ancak kullanıcının
 *     fark edeceği bir değişiklik demek. Doğru sıra önce test, sonra bölme.
 *  3. RİSK/GETİRİ TERS. Yayın öncesi en riskli refactor türü tam olarak budur:
 *     çok dosyaya dokunur, durum ve prop bağlantılarını yeniden kurar, getirisi ise
 *     yalnızca okunabilirliktir.
 *
 * O yüzden borç SİLİNMİYOR ama SINIRLANMIŞ hâle getiriliyor: mevcut büyük dosyalar
 * tek tek listelenmiş ve yalnızca KÜÇÜLEBİLİRLER; yeni bir dosya sınırı aşamaz.
 * Ölçülmemiş borç kontrolsüz büyür — ölçülmüş borç bir sonraki turda planlanabilir.
 */

/** Yeni dosyalar için üst sınır. 800 satır: bir ekran + yardımcıları için geniş, bir modül için fazla. */
const NEW_FILE_LIMIT = 800;

/**
 * Bilinen büyük dosyalar ve BUGÜNKÜ satır sayıları.
 *
 * Sayılar yalnızca düşebilir. Biri küçüldüğünde buradaki değer de düşürülmeli —
 * aksi halde liste bayatlar ve koruma işlevini yitirir (bkz. aşağıdaki test).
 */
const KNOWN_LARGE: Record<string, number> = {
  'features/modes/utils/turkishModes.ts': 2820,
  'app/focus.tsx': 2488,
  // 2394 → 2400: çöken bir ekranın düzeltmesi. Bu ekranın listesi Reanimated'ın
  // FlatList'i olduğu için native kaydırma sürücüsü kapatılmak ZORUNDA (yoksa açılışta
  // "VirtualizedList must be wrapped with Animated.createAnimatedComponent" ile çöküyor).
  // Artış: seçenek nesnesi + üç satırlık gerekçe. Yorum iki kez kısaltıldı; geri kalanı
  // silmek, bir daha aynı hatayı yapmamızı sağlayan tek kaydı silmek olurdu.
  // 2400 → 2402: ölü `subtaskSaveTimers` ref'i kaldırıldı (4 satır eksildi), yerine neden
  // kaldırıldığını anlatan 4 satırlık not kondu. Not önemli: o ref, alt görev işaretlemesinin
  // kaydedildiği izlenimini verip gerçek hatayı gizliyordu; silinip sessizce unutulursa
  // birileri aynı yarım mekanizmayı yeniden kurabilir.
  'app/tasks.tsx': 2402,
  'app/index.tsx': 2097,
  // 1663 → 1676: çökme kaydı satırında "Çözüldü" rozeti kartın dışına taşıyordu. Soldaki
  // künye metninin esneme/kırpma kuralı yoktu; artık künye kırpılıyor, rozet küçülmüyor.
  // Artış tek satırlık düzeltme + neden `space-between`in yetmediğini anlatan not.
  'app/admin.tsx': 1676,
  'features/modes/components/TurkishModeBanner.tsx': 1690,
  'app/cockpit.tsx': 1523,
  // 1358 → 1395: iki gerçek hatanın düzeltmesi. Kart konumları KENDİ bölümlerine göre
  // ölçülüyordu ama sayfa konumu sanılıp kullanılıyordu; aktif bir mod varken yeni mod
  // açılınca sayfa yanlış yere (yukarı) kayıyordu. Bölüm konumu da ölçülüp toplanıyor.
  // 1420 → 1425: başlangıç kilosu koşulunun düzeltmesi. Koşul "kilo geçmişi tamamen boşsa"
  // idi ve geçmişin plan kaldırılınca silinmesine dayanıyordu; geçmiş artık korunduğu için
  // (useSporStore.resetInputs) o koşul ikinci planda asla tutmuyordu.
  'app/modlar.tsx': 1425,
  'features/tasks/components/TaskFormModal.tsx': 1199,
  // 1150 → 1180: planın KULLANICI SEÇMEDEN başlamasını engelleyen kapı. Üretim koşulu
  // birçok modda yalnız "mod açık + ad + tarih" idi; tarih girilir girilmez plan uygulanmış
  // sayılıp kart bölüm değiştiriyor, yeniden kurulup kapanıyordu. Artış dokuz koşula
  // eklenen tek çağrı + kapının NEDENİNİ anlatan yorum; o yorum silinirse kapı ilk
  // "sadeleştirmede" geri alınır.
  'features/modes/hooks/usePlanAdaptations.ts': 1180,
  'app/profile.tsx': 910,
  'shared/constants/legal.ts': 893,
  'features/modes/utils/planAdaptations.ts': 880,
  'app/settings.tsx': 856,
};

describe('dosya boyutu', () => {
  it('yeni dosyalar sınırı aşmıyor', () => {
    const offenders = FILES.filter((f) => !KNOWN_LARGE[f] && lines(f) > NEW_FILE_LIMIT).map(
      (f) => `${f} (${lines(f)} satır)`,
    );
    expect(offenders).toEqual([]);
  });

  it('bilinen büyük dosyalar BÜYÜMÜYOR', () => {
    // Her biri kendi tavanının altında kalmalı. Bir god dosyaya satır eklemek, borcu
    // "zaten büyüktü" gerekçesiyle sessizce artırmanın en kolay yolu.
    const grown = Object.entries(KNOWN_LARGE)
      .filter(([f]) => fs.existsSync(path.join(ROOT, f)))
      .filter(([f, cap]) => lines(f) > cap)
      .map(([f, cap]) => `${f}: ${lines(f)} > ${cap}`);
    expect(grown).toEqual([]);
  });

  it('liste bayatlamamalı — silinen dosyalar listede kalmasın', () => {
    // Dosya taşındığında/silindiğinde girdisi de kalkmalı; yoksa liste zamanla
    // gerçekle ilgisi olmayan bir kalıntıya döner.
    const stale = Object.keys(KNOWN_LARGE).filter((f) => !fs.existsSync(path.join(ROOT, f)));
    expect(stale).toEqual([]);
  });
});
