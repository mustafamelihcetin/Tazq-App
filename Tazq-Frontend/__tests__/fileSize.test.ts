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
  // 860 → 870: misafirin "cihazdaki verileri sil" metinleri (iki dil).
  // 870 → 874: tasarruf ve bırakma da birer mod adı — özet ikisini hiç görmüyordu.
  'shared/constants/i18n.ts': 874,
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
  /*
    2497 → 2558: ODAK EKRANI DENETİMİ (iki tur). Eklenen işlevsel kod azdır; artışın
    çoğu iki sessiz kusurun NEDENİNİ anlatan notlar:

     · Arka plana atılınca o ana kadarki dakikalar sunucuya "tamamlanmamış seans"
       olarak yazılıyor, dönünce sayaç devam edip seans bitince TAM SÜRE bir kez daha
       yazılıyordu. 25 dakikalık bir seans, bir kez telefona bakıldığında sunucuda 35
       dakika görünüyordu — her gidiş-geliş bir kayıt daha ekliyordu.
     · `saveSession` altı yerden çağrılıyordu ve kopyalar ayrışmıştı: çarpıyla çıkış
       5 saniyelik bir seansı 1 dakika olarak kaydediyor (uygulamanın kendi kuralının
       tersi) ve puan vermiyordu. Karar tek yere toplandı.
     · ÇEVRİMDIŞI seans sunucuya hiç ulaşmıyordu — kuyrukta odak seansı diye bir tür
       yoktu. Uygulamanın geri kalanı çevrimdışı-önce çalışırken burası istisnaydı.
  */
  /*
    2558 → 2599: ODAK EKRANI DENETİMİ (3. tur). Üç düzeltme:
     · setAudioModeAsync race condition: iOS'ta ses bazen gelmiyordu. Kuruluş bitmeden
       gelen çalma isteği (ör. kalıcı ses tercihi varsa mount anında tetiklenir) artık
       audioModeReadyRef ile bekleniyor ve kuruluş sonrasında yeniden deneniyor.
     · finishEarly → startBreak ses sorunu: "Erken Bitir" özetinden "Mola Başlat"a
       geçişte ses tercih 'off' yapılıyordu. Mola da bir seans olduğu için ses efekti
       tetikleniyor ama tercih zaten 'off'; kullanıcı sesi kapatıp açmak zorunda kalıyordu.
     · Boş if: `if (pomodoroMode) {};` — ölü dal kaldırıldı.
    Artışın büyük kısmı ses race condition'ın nedenini ve çözümünü anlatan notlar.
  */
  'app/focus.tsx': 2608, // +9: ortak tur kapısı (tur arka planda / seans sırasında açılmasın)
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
  /*
    2513 → 2543: ilk kullanım akışının İKİ kusuru burada düzeltildi ve ikisi de
    gerekçesiyle yazıldı — demo verinin gerçek görevleri gizlemesi, ve turun
    kullanıcının eylemine tepki olarak açılması. Eklenen kodun kendisi beş satır
    (bir ref, bir state, bir useFocusEffect); gerisi NEDEN olduğunu anlatan not.
    Bu ikisi canlıya kadar gitti çünkü akışı yalnız yeni bir hesabın ilk dakikası
    tetikliyor; notlar olmasa aynı tuzağa yeniden düşülür (bkz. activationFlow.test).
  */
  /*
    2543 → 2549: AKSİYON MERKEZİ DENETİMİ (1. tur). Üç kusur, üçü de sessizdi:
     · Kutlama konfetisi Sade mod kapısından geçmiyordu (aynı blok başarım rozetini
       susturuyordu ama iki satır yukarısını değil) — ortak `celebrate`e bağlandı.
     · Arama ham `title` üzerindeydi ve `toLowerCase()` kullanıyordu; liste ise
       yerelleştirilmiş adı çiziyor. Kullanıcı GÖRDÜĞÜ kelimeyi aratınca bulamıyordu.
     · Haftalık Merkez'den gelen GÜN süzgeci hem tarihsiz görevleri atlıyor hem de
       "etkin filtre" satırında hiç görünmüyordu: liste daralıyor, nedeni söylenmiyor,
       "Tümü" düğmesi de onu temizlemiyordu.
  */
  /*
    2549 → 2545 (KÜÇÜLDÜ): silme temizliği ortak yardımcıya çıkarıldı (forgetTask).
    On bir satırlık plan yuvası listesi elle yazılıydı ve EKSİKTİ (mağazada on üç mod
    var, `tasarruf` ile `birakma` unutulmuştu); aynı temizlik toplu silmede ve
    "tamamlananları temizle"de hiç yoktu — silinen görevlerin hatırlatıcıları çalmaya
    devam ediyordu. Liste artık mağazanın kendi tipinden türüyor.
  */
  /*
    2549 → 2541 (beş tur): silme temizliği (forgetTask) ve tekrar aralığı
    ayrıştırıcısı (recurrenceInterval) kendi dosyalarına çıktı. İkisi de bu dosyanın
    içinde test EDİLEMEZ hâldeydi ve ikisi de sessiz kusur taşıyordu: toplu silmede
    hiçbir temizlik yapılmıyordu, ayrıştırıcı ise 'İ' harfiyle yazılan başlıkları
    tanımıyordu (kullanıcının nasıl yazdığına göre çalışan bir tekrar özelliği).
  */
  // 2544 → 2552: "BELKİ BİR GÜN" görünümü. Zen'in rafa kaldırdığı işler hiçbir yerde toplu
  // görünmüyordu (kullanıcı için "işim silindi"). Filtre menüsündeki tek satır iki satırlık
  // bir listeye döndü ve ana sayfanın "rafta N iş var" hatırlatması bu görünümü açıyor.
  // 2552 → 2543: kayıttaki gizli kategori motoru (taskIntelligence) kaldırıldı.
  // 2543 → 2553: UFUK. "İleri tarihlileri göster" anahtarı kalktı; yerine uzak işleri
  // katlayan bağlantı, "yalnız ileride iş var" boş durumu ve "yarın için eklendi"
  // mesajı geldi. Mantık utils/horizon'da; burada yalnız bağlantı.
  // 2553 → 2561: görev oluşturma anahtarı (utils/clientKey) — canlıda görülen ikiz görevlerin çaresi.
  // 2561 → 2577: raf görünümü geçici (ekrandan çıkınca normal liste) + liste kimliği sabit.
  'app/tasks.tsx': 2577,
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
  /*
    İLK KULLANIM AKIŞI — üç ekranın tavanı bu yüzden yükseldi (index, cockpit, tasks).

    Aynı iki karar (örnek veri ne zaman görünür, tur ne zaman açılır) üç ekranda üç ayrı
    şekilde yazılmıştı ve üçü de farklı davranıyordu. Kural tek modüle taşındı
    (features/onboarding/utils/firstRun); ekranlara eklenen kod bir kapı çağrısı ve bir
    ref. Artan satırların çoğu NEDEN olduğunu anlatan not — bu akışa yalnız yeni bir
    hesabın ilk dakikasında düşülüyor, yani notlar olmadan aynı tuzağa yeniden düşülür
    (bkz. __tests__/activationFlow.test.ts).
  */
  /*
    2233 → 2509: ANA EKRANIN DENETİMİ (yedi geçiş). Eklenen işlevsel kod azdır; ÖLÜ kod da çıktı
    (kullanılmayan beş hesap, iki mağaza aboneliği). Artışın büyük kısmı, bulunan
    kusurların NEDEN kusur olduğunu anlatan notlar — hiçbiri "ekrana bakınca"
    görünmüyordu:

     · Komut paletinden eklenen görev sunucuya hiç gitmiyordu; ekran her odaklandığında
       liste sunucununkiyle değiştiği için görev sessizce kayboluyordu.
     · Günlük listeden görev TAMAMLANAMIYORDU: seksen satırlık işleyici hiçbir yerden
       çağrılmıyordu.
     · Seri hesabı üç ayrı "bugün" tanımı kullanıyordu; biri hiç tutmayan bir
       karşılaştırmaydı (odak seansları seriye hiç sayılmıyordu).
     · Halka ile liste farklı kümeleri sayıyordu.

    İkinci geçişte beş kusur daha çıktı: sahte satırlar gerçek kutlamayı tetikliyordu,
    atlanan ritüel "bekleyen" sayılıyordu, haftalık ipuçları ivme geçmişini boş
    görüyordu, kullanıcının seçtiği verimli saat yok sayılıyordu ve haftalık tamamlama
    sayısı `completedAt` olmayan her kaydı "bu hafta" sayıyordu.

    2501 → 2315: KOMUT PALETİ kendi bileşenine çıktı (features/dashboard/components/
    CommandPortal.tsx). TAZQZen/Core eklenince dosya 2547'ye çıkmıştı; ayıklama bu
    büyümeyi karşıladı ve tavanı eskisinin de altına indirdi. Davranış aynen taşındı.
  */
  // 2315 → 2311: haftalık raf hatırlatması (SomedayNudge) ve taşan gün kartı bağlandı; ara menü
  // (TazqCoreMenu) kaldırıldı, logo paleti doğrudan açıyor.
  // Mantık kancada ve bileşende; burada yalnız bağlantı.
  // 2311 → 2315: hızlı eklemede "… yarın için eklendi" (ana sayfa yalnız bugünü gösterir).
  // 2315 → 2318: hızlı eklemede görev oluşturma anahtarı (ikiz görev önlemi).
  'app/index.tsx': 2351, // +3 tur kapısı · +1 hızlı odak store yolu · +25 haftalık sayılar ortak motordan (yerel gün; sunucunun UTC kırılımı üç ekranda farklı sayı veriyordu)
  // 1663 → 1676: çökme kaydı satırında "Çözüldü" rozeti kartın dışına taşıyordu. Soldaki
  // künye metninin esneme/kırpma kuralı yoktu; artık künye kırpılıyor, rozet küçülmüyor.
  // Artış tek satırlık düzeltme + neden `space-between`in yetmediğini anlatan not.
  // 1676 → 1677: CAM SAYFALAR. Kalıcı silme modalı ortak cam yüzeye bağlandı.
  /*
    +3 SATIR × ÜÇ DOSYA — hepsi aynı sebepten: tablette içerik 600pt'lik bir şeride
    sıkışıyordu. Eklenen şey iki satır (kanca çağrısı + gerekçesi) ve bir import;
    mantık değişmedi (bkz. useContentMaxWidth).
  */
  'app/admin.tsx': 1680,
  // 1690 → 1718: plan başlatılmadan ÖNCE mevcut yük söyleniyor (kaç aktif hedef,
  // bugün kaç plan işi). Kullanıcı toplamı ancak uyguladıktan SONRA öğreniyordu.
  'features/modes/components/TurkishModeBanner.tsx': 1718,
  // 1523 → 1529: ERİŞİLEBİLİRLİK. Alışkanlık satırının adı, durumu ve serisi ekran
  // okuyucuya hiç ulaşmıyordu (durum renkle, seri rozetle söyleniyordu).
  // 1529 → 1530: CAM SAYFALAR. Alışkanlık ekleme ve plan sayfaları ortak cam yüzeye bağlandı.
  // 1530 → 1533: iOS 26/27 ARAÇ ÇUBUĞU DÜĞMESİ. Rapor ve ekle düğmeleri cam kabuğa
  // alındı (içe aktarım + düğme başına tek satır). Android'de kabuk çizilmiyor.
  // 1565 → 1577: ritüel kutlaması ORTAK kapıya bağlandı. Konfeti burada doğrudan
  // tetikleniyordu ve Sade mod kapısı yoktu — modu kapatan kullanıcı yine tam ekran
  // kutlama alıyordu. Artış, gözden nasıl kaçtığını anlatan not (kutlama kararı tek
  // yere toplanmıştı ama bekçi test yalnız ana ekranı tarıyordu).
  'app/cockpit.tsx': 1709, // +6 geri bakış bağlantısı · +96 gün seçimi ekranın tamamını kapsıyor (alışkanlıklar seçili güne yazılır), jestler sadeleşti, metinler DAY_COPY sözlüğüne taşındı
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
  // 1435 → 1442: turun ORTAK kapıya bağlanması. Bu ekran tanıtımını koşulsuz
  // çiziyordu; sekmeli gezinmede ekran sökülmediği için arka planda açık kalan bir
  // bayrak başka sayfada patlayabiliyordu (kullanıcı Modlar'dayken Haftalık Merkez'in
  // anlatımını gördü). Artış tek çağrı + sarmalama.
  // 1576 → 1617: durum kartı ÇOKLU hedefi gösteriyor (deste + noktalar) ve geçmiş
  // hedefler bölümü eklendi. Kart eskiden kaç hedef olursa olsun yalnız birini
  // gösteriyordu; diğerleri için tek işaret hiçbir yere götürmeyen bir '+2' yazısıydı.
  // 1737 → 1560: durum kartının ~170 satırlık çizimi kendi bileşenine çıktı
  // (bkz. features/modes/components/ModeStatusCard.tsx). Tavan da onunla birlikte
  // İNDİ — borç kapandıysa tavan da kapanmalı, yoksa yer açılmış olur.
  // 1560 → 1565: geçmiş hedef kartının kopya hatası düzeltildi (süre bilinmiyor ≠
  // tamamlandı) + Bırakma'nın kendi başlangıcını okuyan yol.
  'app/modlar.tsx': 1565, // +70: yaşayan plan ortak özete taşındı, durum kartı kahraman satırı, kartlar sırayla süzülüyor // +72: özet kartı yedi modun hepsini sayar (tasarruf/bırakma görünmüyordu), plan uygulanınca toplam günlük yük söylenir
  // 1199 → 1194: akıllı ayrıştırıcı ipucu NlpHintRow'a çıkarıldı. İpucu tek metin
  // olarak kuruluyordu ve temizlenmiş bir cümleyle dört HAM emojiyi (📅⏰🔁🏷️) aynı
  // Text düğümünde yan yana getiriyordu; parçalar artık tür taşıyor, ikonu sunum çiziyor.
  // 1194 → 1195: paylaşılan gün-adı tablosunun içe aktarımı (shared/constants/weekdays).
  // 1195 → 1197: CAM SAYFALAR. Görev formunun opak zemini ortak cam yüzeye bağlandı;
  // klavye açıkken dört, kapalıyken iki köşe yuvarlanıyor (tek satırlık not).
  // 1197 → 1200: hızlı eklemeden gelen metnin ÖN DOLU açılması (ayrıştırıcı alanları da
  // dolduruyor). İpucu çipleri ortak dosyaya çıktığı için 25 satır da eksildi.
  /*
    1200 → 1233: FORM ALANLARININ GÖRÜNÜR OLMASI. Aydınlık temada alan zemini #FAFAFA,
    sayfa zemini #FFFFFF idi: 1.04:1 kontrast, yani kullanıcı yazı kutusunun ve tarih
    seçicinin nerede olduğunu göremiyordu (koyu temada fark TAM SIFIRDI — ikisi de aynı
    token). Alanlar artık tek jetona bağlı (Colors.surfaceField/outlineField), kenarları
    var ve yazılan alanın kenarı markanın mavisine dönüyor. Artışın çoğu bu üç kararın
    NEDENİNİ taşıyan notlar; kusurun kendisi "ekrana bakınca" görünmüyordu, çünkü alan
    oradaydı ve çalışıyordu — yalnız görünmüyordu.
  */
  // 1233 → 1214: başlık işleyicisi taslak denetimine (features/tasks/nlp/draft) devredildi.
  // 1214 → 1215: hazır etiketlerin dili ortak yardımcıdan (langOf) — satır içi dil dallanması yok.
  'features/tasks/components/TaskFormModal.tsx': 1215,
  // 1150 → 1180: planın KULLANICI SEÇMEDEN başlamasını engelleyen kapı. Üretim koşulu
  // birçok modda yalnız "mod açık + ad + tarih" idi; tarih girilir girilmez plan uygulanmış
  // sayılıp kart bölüm değiştiriyor, yeniden kurulup kapanıyordu. Artış dokuz koşula
  // eklenen tek çağrı + kapının NEDENİNİ anlatan yorum; o yorum silinirse kapı ilk
  // "sadeleştirmede" geri alınır.
  // 1180 → 1199: duraklatma kapısı. Görev üreten dört ayrı yol var; kapı hepsinin
  // geçtiği tek noktaya (applyTasks) kondu, çağrı yerlerine dağıtılmadı.
  'features/modes/hooks/usePlanAdaptations.ts': 1199,
  // 910 → 864: hesap silme ve şifre değiştirmenin ÖLÜ kopyası kaldırıldı. Modal
  // işaretlemesi settings.tsx'e taşınırken bu dosyadaki state + iki handler geride
  // kalmıştı; hiçbiri çağrılmıyordu ama `deleteAccount`ın hatalı sürümü iki dosyada
  // birden duruyor ve hangisinin canlı olduğu okurken belli olmuyordu.
  // 865 → 867: CAM SAYFALAR. Profil düzenleme sayfası ortak cam yüzeye bağlandı.
  // 870 → 888: MİSAFİR PROFİLİ — uydurma ad/e-posta yerine misafir durumu ve "hesap oluştur".
  // 888 → 892: profil kaydı seçilmemiş avatarı artık "Atlas" (erkek) diye yazmıyor.
  // 894 → 899: koyu temada okunmayan 'Kaydet' butonu (sabit beyaz yazı) + ham hex
  // trophy ikonu tema token'larına bağlandı.
  'app/profile.tsx': 899, // +2: seri tek kaynaktan (sunucunun vade-günü sayısı profilde gösteriliyordu)
  'shared/constants/legal.ts': 893,
  // İlk kez 800 satırı geçti: duraklatma + geçmiş hedefler + bulut/yerel bozuk
  // veriye karşı tek nokta koruma (bkz. PLAN_ID_KEYS/sanitizePlanIds). Sözlük gibi
  // değil, bölünebilir — bir sonraki büyüme bu dosyayı gerçekten küçültmeli.
  'features/modes/store/usePrefsStore.ts': 833,
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
  /*
    839 → 888: ayar ekranının denetimi. Eklenen işlevsel kod azdır — ekranın GERÇEK
    durumu okuması (bildirim izni + takvim bayrağı; ikisi de yalnız yazılıyor, hiç
    okunmuyordu), üç anahtarın izin yokken kilitlenmesi ve sabah özetinin gerçek
    saatini üreten küçük bir tablo. Gerisi, her birinin NEDEN yanlış olduğunu anlatan
    notlar: bu kusurlar "ekranı açıp bakmakla" görünmüyordu (anahtar doğru çalışıyor
    ama yanlış durum gösteriyordu), o yüzden gerekçe kodda duruyor.
  */
  /*
    888 → 911: "Bildirimde içeriği gizle" ayarının GERİYE DÖNÜK uygulanması. Ayar yalnız
    o andan sonra kurulan bildirimleri etkiliyordu; zaten zamanlanmış hatırlatıcılar görev
    adını taşımaya devam ediyordu. Gizlilik ayarının en çok işe yarayacağı an (telefonu
    biri eline aldığında) tam da eski bildirimlerin göründüğü andır, yani ayar sessizce
    sözünü tutmuyordu. Anahtar artık mevcut hatırlatıcıları yeniden kuruyor ve kaç tanesinin
    yenilendiğini söylüyor — söz verilen şeyin OLDUĞU görünsün diye.
  */
  // 911 → 925: misafirde "Hesabımı Sil" yerine "Bu cihazdaki verileri sil" (onaylı).
  // 925 → 928: Admin Paneli düğmesindeki ham indigo hex, zaten var olan A.system
  // token'ına bağlandı (iki ayrı kopya aynı rengi taşıyordu).
  'app/settings.tsx': 928,
  // Turun 5 sayfasının (dashboard/tasks/focus/modlar/cockpit) HER adımı için gerçek
  // bileşenlerden kurulan bir mockup çiziyor — doğası gereği uzun, bölünmesi bu
  // switch-case yapısını bozardı. 800'ü ilk kez geçti: turun güncellik denetiminde
  // (2026-09-20) üç adım gerçeğe uydurulup bir yeni adım eklendi.
  'features/onboarding/components/TourFeaturePreview.tsx': 840,
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
