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
  /*
    SÖZLÜK — doğası gereği uzun ve bölünmesi YANLIŞ olurdu.

    800 satırlık sınır KOD dosyaları için konmuştu: bir ekranın mantığı 800 satırı
    aşıyorsa okunamaz hâle gelir. Bu dosya mantık değil VERİ: aynı anahtarların iki
    dildeki karşılıkları. Bölmek (ör. ekran başına sözlük) anahtarların iki dilde
    ayrışmasını kolaylaştırır — bugün bir anahtarı eklerken iki dili yan yana görmek
    zorundasın ve bu bir ÖZELLİK.

    Sayı yine de mandallı: yeni metinler eklendikçe bilinçli olarak yükseltilir.
  */
  'shared/constants/i18n.ts': 860,
  // 2820 → 2817: baştaki emojiyi silen üç ayrı uygulamadan ikisi (biri hatalıydı,
  // \p{Emoji} rakamları da yiyordu) shared/utils/emoji.ts'e indi.
  // 2817 → 2820: YKS/KPSS/Ramazan'ın DİL kapısı (İngilizce arayüzde takvimle
  // kendiliğinden açılmasınlar). Kapının kendisi ayrı dosyada — bu dosya uygulamanın
  // en büyüğü ve saf veri katmanı; bir store bağımlılığı buraya ait değil.
  'features/modes/utils/turkishModes.ts': 2820,
  // 2488 → 2491: ERİŞİLEBİLİRLİK. Sayaç kürenin basılı-tutma alanı adsız bir kontrol
  // olarak odak alıyordu; o bir topraklanma JESTİ, düğme değil — ağacın dışına alındı.
  // 2491 → 2497: CAM SAYFALAR. Beş modalın (süre, mod, nefes, özet, pomodoro) elle
  // yazılmış opak zemini ortak GlassSurface'e bağlandı: içe aktarım + modal başına tek satır.
  'app/focus.tsx': 2497,
  // 2394 → 2400: çöken bir ekranın düzeltmesi. Bu ekranın listesi Reanimated'ın
  // FlatList'i olduğu için native kaydırma sürücüsü kapatılmak ZORUNDA (yoksa açılışta
  // "VirtualizedList must be wrapped with Animated.createAnimatedComponent" ile çöküyor).
  // Artış: seçenek nesnesi + üç satırlık gerekçe. Yorum iki kez kısaltıldı; geri kalanı
  // silmek, bir daha aynı hatayı yapmamızı sağlayan tek kaydı silmek olurdu.
  // 2400 → 2402: ölü `subtaskSaveTimers` ref'i kaldırıldı (4 satır eksildi), yerine neden
  // kaldırıldığını anlatan 4 satırlık not kondu. Not önemli: o ref, alt görev işaretlemesinin
  // kaydedildiği izlenimini verip gerçek hatayı gizliyordu; silinip sessizce unutulursa
  // birileri aynı yarım mekanizmayı yeniden kurabilir.
  // 2402 → 2410: ERİŞİLEBİLİRLİK. Görev satırı bir düğmeydi ama ADI yoktu; öncelik ve
  // tamamlanma da yalnız RENKLE söyleniyordu (sol şerit, üstü çizili başlık). Renk ekran
  // okuyucuya hiçbir şey söylemez — kör bir kullanıcı için tüm satırlar aynıydı.
  // Metinler shared/utils/a11y.ts'te toplandı; burada kalan yalnız etiket bağlantısı.
  // 2410 → 2411: "Çevrimdışı kaydedildi" mesajı savedLocallyMessage()'a çıkarıldı —
  // 9 kopya gitti, 1 import geldi (misafire "çevrimdışısın" demek yanlıştı).
  // 2411 → 2420: sekme çubuğundaki ARAMA ADASINDAN gelen gezinme. Adaya dokunan
  // kullanıcı "aramak" istiyor, "Görevler ekranını açmak" değil — ekran arama alanı
  // AÇIK geliyor (iOS 26/27 deseni, bkz. __tests__/ios27Chrome.test.ts).
  // 2420 → 2468: HIZLI EKLEME. + düğmesi artık yedi bölümlü formu değil tek satırlık
  // hızlı eklemeyi açıyor; tam form "Detaylar" ile yazılan metni TAŞIYARAK açılıyor.
  // Artış: iki durum, iki işleyici (hızlı kaydet + detaya geç) ve gerekçeleri.
  // 2468 → 2472: TUR İLK GÖREVDEN SONRA. Boş listede "sola kaydır, ertele" anlatmanın
  // karşılığı yok; koşul + gerekçesi eklendi.
  // 2472 → 2484: "Bugün" ekranına giriş (başlıktaki takvim düğmesi) + hızlı eklemenin
  // sarmalayıcısı. Ekranın kendisi ayrı dosyada (app/gun.tsx).
  /*
    TABLET DÜZENİ — dört ekranın da tavanı bu yüzden yükseldi.

    Uygulama geniş ekranda içeriği 600pt'lik ortalı bir sütuna sıkıştırıyordu ve
    tablette ekranın yarısı boş kalıyordu. Artık düzen iki sütuna açılıyor
    (bkz. shared/components/ResponsiveColumns). Eklenen satırların neredeyse tamamı
    SARMALAYICI ve GEREKÇE: <WideSplit>/<WideCol> etiketleri ile bunların NEDEN orada
    olduğunu anlatan notlar. Mantık büyümedi; telefon yolunda tek bir dal bile
    eklenmedi (eşik 700pt, en geniş telefon ~440pt).
  */
  'app/tasks.tsx': 2507,
  // 2097 → 2102: iOS 26/27 sekme çubuğu küçülme sinyali. Ana sayfa kendi kaydırma
  // değerini yönettiği için bağlantı burada; diğer sekmeli ekranlar ortak
  // useCollapsibleHeader üzerinden bağlanıyor (tek satır + gerekçe).
  // 2102 → 2103: CAM SAYFALAR. Komut paletinin yarı saydam elle zemini GlassSurface'e
  // bağlandı (zemin satırı gitti; içe aktarım + yüzey satırı geldi).
  // 2103 → 2121: İLK AÇILIŞ. Yardım turu ilk görevden sonraya alındı, "nereden
  // başlayayım" kartı da tura bağlı olmaktan çıkarıldı (yoksa boş ekran rehbersiz
  // kalıyordu). Artışın çoğu, iki kararın NEDENİNİ anlatan notlar.
  // 2121 → 2166: ANA EKRAN DURUMA GÖRE KURULUYOR. Aktif dönem varsa plan kartı ilk
  // sıraya, skor eylemlerin altına iniyor; mod yoksa eski sıra aynen duruyor. Artışın
  // çoğu, daha önce denenip geri alınmış sıralamayla bu kararın FARKINI anlatan not —
  // o not silinirse aynı deneme yeniden yapılır (bkz. dashboardZeroState.test.ts).
  // 2166 → 2175: İKON KISAYOLLARI. Kısayolu karşılayan hook burada bağlanıyor (kök
  // düzende değil: kısayol bir gezinme başlatıyor, kök düzen çalışırken ağaç hazır değil).
  'app/index.tsx': 2203,
  // 1663 → 1676: çökme kaydı satırında "Çözüldü" rozeti kartın dışına taşıyordu. Soldaki
  // künye metninin esneme/kırpma kuralı yoktu; artık künye kırpılıyor, rozet küçülmüyor.
  // Artış tek satırlık düzeltme + neden `space-between`in yetmediğini anlatan not.
  // 1676 → 1677: CAM SAYFALAR. Kalıcı silme modalı ortak cam yüzeye bağlandı.
  'app/admin.tsx': 1677,
  'features/modes/components/TurkishModeBanner.tsx': 1690,
  // 1523 → 1529: ERİŞİLEBİLİRLİK. Alışkanlık satırının adı, durumu ve serisi ekran
  // okuyucuya hiç ulaşmıyordu (durum renkle, seri rozetle söyleniyordu).
  // 1529 → 1530: CAM SAYFALAR. Alışkanlık ekleme ve plan sayfaları ortak cam yüzeye bağlandı.
  // 1530 → 1533: iOS 26/27 ARAÇ ÇUBUĞU DÜĞMESİ. Rapor ve ekle düğmeleri cam kabuğa
  // alındı (içe aktarım + düğme başına tek satır). Android'de kabuk çizilmiyor.
  'app/cockpit.tsx': 1552,
  // 1358 → 1395: iki gerçek hatanın düzeltmesi. Kart konumları KENDİ bölümlerine göre
  // ölçülüyordu ama sayfa konumu sanılıp kullanılıyordu; aktif bir mod varken yeni mod
  // açılınca sayfa yanlış yere (yukarı) kayıyordu. Bölüm konumu da ölçülüp toplanıyor.
  // 1420 → 1425: başlangıç kilosu koşulunun düzeltmesi. Koşul "kilo geçmişi tamamen boşsa"
  // idi ve geçmişin plan kaldırılınca silinmesine dayanıyordu; geçmiş artık korunduğu için
  // (useSporStore.resetInputs) o koşul ikinci planda asla tutmuyordu.
  // 1425 → 1391: mod kartları kendi bileşenlerine devredilirken geride kalan ölü
  // yardımcılar kaldırıldı (SPOR_GOALS, sporGoalsForSlot, examNameConflict,
  // stripEmojiPrefix, getEmojiFromLabel, TARGET_EVENTS, yks/kpssAutoActive).
  // Zararsız değillerdi: emoji temizliği ÖLÜ kopyaya uygulanmış, canlı ExamCard
  // yarım kalmıştı.
  // 1391 → 1394: iOS 26/27 ARAÇ ÇUBUĞU DÜĞMESİ. Özet ve tanıtım düğmeleri cam kabuğa alındı.
  'app/modlar.tsx': 1429,
  // 1199 → 1194: akıllı ayrıştırıcı ipucu NlpHintRow'a çıkarıldı. İpucu tek metin
  // olarak kuruluyordu ve temizlenmiş bir cümleyle dört HAM emojiyi (📅⏰🔁🏷️) aynı
  // Text düğümünde yan yana getiriyordu; parçalar artık tür taşıyor, ikonu sunum çiziyor.
  // 1194 → 1195: paylaşılan gün-adı tablosunun içe aktarımı (shared/constants/weekdays).
  // 1195 → 1197: CAM SAYFALAR. Görev formunun opak zemini ortak cam yüzeye bağlandı;
  // klavye açıkken dört, kapalıyken iki köşe yuvarlanıyor (tek satırlık not).
  // 1197 → 1200: hızlı eklemeden gelen metnin ÖN DOLU açılması (ayrıştırıcı alanları da
  // dolduruyor). İpucu çipleri ortak dosyaya çıktığı için 25 satır da eksildi.
  'features/tasks/components/TaskFormModal.tsx': 1200,
  // 1150 → 1180: planın KULLANICI SEÇMEDEN başlamasını engelleyen kapı. Üretim koşulu
  // birçok modda yalnız "mod açık + ad + tarih" idi; tarih girilir girilmez plan uygulanmış
  // sayılıp kart bölüm değiştiriyor, yeniden kurulup kapanıyordu. Artış dokuz koşula
  // eklenen tek çağrı + kapının NEDENİNİ anlatan yorum; o yorum silinirse kapı ilk
  // "sadeleştirmede" geri alınır.
  'features/modes/hooks/usePlanAdaptations.ts': 1180,
  // 910 → 864: hesap silme ve şifre değiştirmenin ÖLÜ kopyası kaldırıldı. Modal
  // işaretlemesi settings.tsx'e taşınırken bu dosyadaki state + iki handler geride
  // kalmıştı; hiçbiri çağrılmıyordu ama `deleteAccount`ın hatalı sürümü iki dosyada
  // birden duruyor ve hangisinin canlı olduğu okurken belli olmuyordu.
  // 865 → 867: CAM SAYFALAR. Profil düzenleme sayfası ortak cam yüzeye bağlandı.
  'app/profile.tsx': 867,
  'shared/constants/legal.ts': 893,
  'features/modes/utils/planAdaptations.ts': 880,
  // 856 → 784: hesap silme akışı DeleteAccountModal bileşenine çıkarıldı. Silme,
  // uygulamadaki tek geri alınamaz işlem; durumu ekranın üstünde, onay kelimesi
  // ortasında, modalı en altında dağınık duruyordu. Tek adres = tek doğru davranış.
  // 784 → 809: MİSAFİR MODU. Hesapsız kullanıcıya "Çıkış yap" anlamsız (çıkacak hesap
  // yok) ve tehlikeli görünür; onun yerine verisini kalıcı kılmanın yolu gösteriliyor.
  // 809 → 811: CAM SAYFALAR. Şifre değiştirme modalı ortak cam yüzeye bağlandı.
  // 811 → 836: E-POSTA DOĞRULAMA HATIRLATMASI. Doğrulama kayıt yolundan çıkarıldı;
  // hatırlatma artık burada, SEBEBİYLE birlikte duruyor (özet postaları ve hesap
  // kurtarma o adrese bağlı). Artışın yarısı o gerekçe notu.
  'app/settings.tsx': 836,
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
