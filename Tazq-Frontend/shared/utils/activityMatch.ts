/**
 * HAREKET GÖREVİ EŞLEŞTİRME — hangi plan görevi sağlık verisiyle KANITLANABİLİR.
 *
 * Dönemsel modlar her gün görev üretiyor (bkz. dailyPlanEngine). Bunların bir kısmı
 * cihazın zaten bildiği şeyler: "30+ dk hareket et", "bugünkü koşunu tamamla". Kullanıcı
 * koştuktan sonra bir de uygulamaya girip kutuyu işaretlemek zorunda kalıyordu.
 *
 * ── TEMEL KURAL: MALİYET ASİMETRİK ──────────────────────────────────────────────
 * Yanlış POZİTİF (yapılmamış işi "yapıldı" işaretlemek) uygulamanın en pahalı hatasıdır:
 * kullanıcı bir kez "ben bunu yapmadım ki" derse, o günden sonra hiçbir otomatik
 * işarete güvenmez — üstelik momentum ve seri gibi TÜM türev sayılar da kirlenir.
 * Yanlış NEGATİF ise bir dokunuşa mal olur; kullanıcı zaten elle işaretleyebilir.
 *
 * Bu yüzden eşleştirme bilerek DAR: yalnızca verinin gerçekten kanıtladığı görevler.
 * Şüphe varsa eşleşme yok.
 *
 * ── NEDEN ETİKET DEĞİL METİN ────────────────────────────────────────────────────
 * Görev etiketleri (`fitness`, `kilo`, `maraton`) görevin KONUSUNU söylüyor, EYLEMİNİ
 * değil. `kilo` havuzunda dört görev var ve yalnız biri hareketle ilgili; diğerleri
 * protein, su ve yemek notu. Etikete bakarak otomatik tamamlamak, su içmediğin bir günü
 * "su içtin" diye işaretlerdi.
 *
 * Metin eşleştirme kırılgan görünür ama burada değil: görev metinleri sabit havuzlardan
 * geliyor (dailyPlanEngine), serbest kullanıcı girdisi değil. Ayrıca görev hem TR hem EN
 * başlığını `description` alanında taşıyor, yani dil değişse de eşleşme bozulmuyor.
 */

/** Verinin kanıtlayabildiği hareket türleri. */
export type MovementKind = 'run' | 'workout' | 'move';

export interface ActivityWorkout {
  /** Koşu ve yürüyüş ayrı tutulur: "koşunu tamamla" görevini yürüyüş karşılamaz. */
  kind: 'run' | 'walk' | 'other';
  minutes: number;
  distanceMeters: number;
}

export interface DayActivity {
  steps: number;
  distanceMeters: number;
  /** Platformun "tempolu hareket" saydığı dakika (iOS Egzersiz Süresi karşılığı). */
  exerciseMinutes: number;
  workouts: ActivityWorkout[];
}

/**
 * DIŞLAMA — bu görevleri hiçbir sağlık verisi tamamlayamaz.
 *
 * Üçü de "koşu/antrenman" kelimesi içerdiği için eşleşme kurallarına takılırdı ama
 * hiçbiri hareketin kendisi değil:
 *   • DÜŞÜNME/KAYIT: "mesafeni kaydet", "nasıl hissettiğini not et", "Log run details".
 *     Bunlar kullanıcının kendi değerlendirmesini ister; koşmuş olmak yerine geçmez.
 *   • PLANLAMA: "koşunu iftar sonrasına planla", "Schedule heavy lifts".
 *     Koşmuş olmak planlamayı ima eder gibi görünür ama görev ZAMANLAMAYLA ilgilidir;
 *     kanıtlayamadığımız bir şeyi varsaymak yerine elle bırakıyoruz.
 *   • ESNEME/MOBİLİTE: "koşu öncesi/sonrası 10 dk esneme". Koşu kaydı esnemeyi kanıtlamaz.
 *
 * Dışlama ÖNCE çalışır. "Ağır antrenmanını iftar sonrasına planla ve splitini tamamla"
 * gibi hem planlama hem tamamlama içeren melez bir görev de böylece elle kalır —
 * bilinçli tercih, yukarıdaki asimetrik maliyet kuralının doğrudan sonucu.
 */
const REFLECTION = /(kaydet|not et|planla|schedule|\blog\b)/i;
const STRETCHING = /(esneme|mobilite|stretch|mobility)/i;

/**
 * SIRA ÖNEMLİ — genel hareket, koşu/antrenmandan ÖNCE bakılır.
 *
 * "Bugün 30+ dk hareket et (tempolu yürüyüş veya antrenman)" görevi parantez içinde
 * "antrenman" kelimesini taşıyor. Antrenman önce kontrol edilseydi bu görev `workout`
 * sayılır ve yalnız ağırlık antrenmanıyla tamamlanabilirdi — halbuki görevin kendisi
 * "yürüyüş de olur" diyor. Yani sıra, eşiği de yanlış yerden seçtirirdi.
 */
const MOVEMENT = /(hareket et|aktif ol|yürüyüş|yuruyus|be active|\bwalk|movement|move \d)/i;

/**
 * `(?!l)` — "koşu" ile "koşul" ayrımı. TESTİN YAKALADIĞI GERÇEK HATA.
 *
 * Desen önce düz `koşu` idi. Sınav havuzundaki "bugün tam deneme çöz — gerçek sınav
 * KOŞULlarında" görevi bu yüzden `run` sayılıyordu: kullanıcı koşuya çıktığında sınav
 * çalışma görevi kendiliğinden tamamlanacaktı. Türkçede alakasız iki kelimenin ilk dört
 * harfi aynı; kelime sınırı (`\b`) burada işe yaramıyor çünkü "koşul" da "koşu" ile
 * başlıyor. Negatif ileri bakış çekimleri korur (koşun, koşuya, koşusu) ama
 * koşul/koşullar/koşullarında'yı dışarıda tutar.
 */
const RUNNING = /(koşu(?!l)|kosu(?!l)|\brun\b|\brunning\b)/i;
const WORKOUT = /(antrenman|\bsplit|training|workout)/i;

/**
 * Bir plan görevini, sağlık verisinin kanıtlayabileceği bir hareket türüne eşler.
 *
 * @param text Görev metni. Hem TR hem EN başlık verilmeli (ikisi birleştirilerek) —
 *             görevler `description` alanında iki dili de taşıyor, böylece kullanıcı
 *             dili değiştirse bile eşleşme bozulmaz.
 * @returns Kanıtlanabilir tür ya da `null` (elle bırak).
 */
export function classifyMovementTask(text: string): MovementKind | null {
  if (!text) return null;

  // Görevin ANA FİİLİ karar verir; parantez içi ve yan cümleler öneridir.
  //
  // Bu sıra bir hatadan sonra netleşti: esneme dışlaması hareket kontrolünden önceydi ve
  // "İftar sonrası en az 30 dk hafif aktif ol (MOBİLİTE/ESNEME)" görevini eliyordu.
  // Halbuki görevin istediği şey 30 dk aktif olmak; parantez sadece nasıl olabileceğini
  // söylüyor — tıpkı "30+ dk hareket et (tempolu yürüyüş veya ANTRENMAN)" görevinde
  // parantezin görevi antrenmana çevirmemesi gerektiği gibi. Aynı kural iki yerde de
  // aynı şekilde işlemeli.
  //
  // Kayıt/planlama dışlaması yine EN ÖNDE: orada ana fiilin kendisi "kaydet"/"planla".
  if (REFLECTION.test(text)) return null;
  if (MOVEMENT.test(text)) return 'move';
  if (STRETCHING.test(text)) return null;
  if (RUNNING.test(text)) return 'run';
  if (WORKOUT.test(text)) return 'workout';
  return null;
}

/**
 * EŞİKLER — hepsi "şüphede kalırsan tamamlama" yönünde seçildi.
 */
/** Koşu sayılması için en az: kısa bir ısınma koşusu bile bunu geçer. */
const MIN_RUN_MIN = 10;
/** Süre yoksa mesafeden karar: 1.5 km altı "koşu" saymıyoruz. */
const MIN_RUN_METERS = 1500;
/** Antrenman seansı sayılması için en az — 20 dk altı ısınma/yarım seans olabilir. */
const MIN_WORKOUT_MIN = 20;
/** Görev metninin kendi hedefi: "30+ dk hareket et". */
const MIN_MOVE_MIN = 30;
/**
 * Adım eşiği YÜKSEK bilerek. 8000 adım ≈ 6 km; hareketsiz bir gün 2-4 binde kalır.
 * Daha düşük bir eşik (mesela 5000) hiç egzersiz yapmadan, gün içinde oradan oraya
 * yürüyerek de geçilebilirdi — yani görevi yapmamış birine "yaptın" derdi.
 */
const MIN_MOVE_STEPS = 8000;

/**
 * Günün verisi, o hareket görevini tamamlamaya yetiyor mu.
 *
 * Adım sayısı YALNIZCA genel hareket için kabul ediliyor. "Koşunu tamamla" görevini
 * 20 bin adımla geçmek yanlış olurdu: çok yürümek koşmak değildir ve maraton modunda
 * bu ayrım antrenman planının kendisidir.
 */
export function isMovementGoalMet(kind: MovementKind, a: DayActivity): boolean {
  switch (kind) {
    case 'run':
      return a.workouts.some(
        (w) => w.kind === 'run' && (w.minutes >= MIN_RUN_MIN || w.distanceMeters >= MIN_RUN_METERS),
      );

    case 'workout':
      // Yürüyüş antrenman sayılmaz; koşu sayılır (koşu da bir antrenmandır).
      return a.workouts.some((w) => w.kind !== 'walk' && w.minutes >= MIN_WORKOUT_MIN);

    case 'move':
      return (
        a.exerciseMinutes >= MIN_MOVE_MIN ||
        a.workouts.some((w) => w.minutes >= MIN_MOVE_MIN) ||
        a.steps >= MIN_MOVE_STEPS
      );
  }
}

/** Boş gün — veri okunamadığında "sıfır aktivite" ile karıştırılmasın diye ayrı üretilir. */
export function emptyActivity(): DayActivity {
  return { steps: 0, distanceMeters: 0, exerciseMinutes: 0, workouts: [] };
}
