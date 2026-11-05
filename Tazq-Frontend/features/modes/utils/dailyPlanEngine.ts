/**
 * Daily Plan Engine
 *
 * Dönemsel modların ÇEKIRDEĞI. Hiçbir gelecek görevi önceden materyalize edilmez;
 * bunun yerine plan kompakt bir `DailyPlanSpec` olarak saklanır ve her gün
 * yalnızca BUGÜNÜN görevleri üretilir (usePlanAdaptations günde 1 kez çağırır).
 *
 * - Saf fonksiyon: aynı girdiyle aynı çıktıyı verir (gün indeksi hariç).
 * - Yük yok: kullanıcı başına günde sadece 1-3 görev üretilir.
 * - Tekrar koruması: o gün ilgili plandan zaten 'daily' görev varsa boş döner.
 */

import { CreateTaskPayload } from '@/shared/services/api';
import { getPhase, StudyPhase, matchExamName } from '@/shared/utils/examPresets';
import type { RecoveryState } from '@/shared/utils/recovery';

export type Language = 'tr' | 'en';

export type PlanKind = 'exam' | 'tez' | 'mulakat' | 'kilo' | 'maraton' | 'guc' | 'genel' | 'ramazan';

export interface DailyPlanSpec {
  kind: PlanKind;
  name?: string;          // sınav/şirket/tez adı (başlıkta {name} yerine geçer)
  daysLeft: number;       // hedef tarihe kalan gün
  dailyMinutes?: number;  // kullanıcının seçtiği günlük süre → görev yoğunluğu
  /** Seçilen çalışma yöntemi (sınav: active-recall · spaced-repetition · deep-work · sprint · foundation). */
  templateId?: string;
  /** Günlük PLAN BÜTÇESİNDEN bu moda düşen üst sınır (bkz. allocatePlanBudget). Verilmezse sınır yok. */
  maxCount?: number;
  /**
   * Adaptif zorluk sinyali. Kullanıcının son tamamlama davranışına göre günlük
   * görev sayısı YALNIZCA hafifletilir (asla aşırı yüklenmez). Verilmezse temel
   * sayı kullanılır. Detay: {@link adaptiveTaskCount}.
   */
  adherence?: { activeDays7: number; total14: number };
  /**
   * Uykudan türeyen toparlanma durumu (bkz. recovery.ts). Verilmezse 'unknown' —
   * yani sağlık verisi yoksa motor bugünkü gibi çalışır, hiçbir şey değişmez.
   */
  recovery?: RecoveryState;
  /**
   * Slot kimliği (exam/exam2/exam3/spor/spor2/…). Görev etiketi ve günlük
   * dedupe ANAHTARI bu değerdir. Verilmezse `kind`'e düşer.
   *
   * Neden gerekli: aynı `kind`'i paylaşan alt-planlar (KPSS=exam, YDS=exam2)
   * tek bir 'exam' tag'inde çakışıp birbirinin günlük üretimini bloke ediyordu.
   * Ayrıca spor için `kind` ('kilo'/'genel'…) PLAN_TAGS'te olmadığından
   * dedupe/temizlik bu görevleri tanıyamıyordu; slot ('spor') ise tanınıyor.
   */
  slot?: string;
  isRamazan?: boolean;
  /**
   * Bu plan/faz icin BIR KEZ uretilip onbellege alinmis ek gorev varyantlari.
   * Sabit havuza EKLENIR (yerini almaz). Verilmezse motor bugunku gibi calisir —
   * yani bu alan tamamen istege bagli ve basarisizlik sessizdir.
   */
  extraPool?: { tr: string; en: string }[];
}

type Pool = { tr: string; en: string }[];

// ── Görev yoğunluğu: günlük süreye göre kaç mikro-görev üretilsin ───────────────
function taskCountFor(dailyMinutes?: number): number {
  if (!dailyMinutes || dailyMinutes <= 0) return 2;
  if (dailyMinutes <= 60) return 1;
  if (dailyMinutes <= 120) return 2;
  return 3;
}

/**
 * Adaptif zorluk: temel görev sayısını kullanıcının son davranışına göre ayarlar.
 * GÜVENLİ TASARIM — yalnızca HAFİFLETİR, asla artırmaz (aşırı yükleme/demoralizasyon
 * önlenir; kullanıcının seçtiği günlük süre zaten tavanı belirler).
 *
 * - signal yoksa veya yeterli geçmiş yoksa (son 14 günde < 4 plan tamamlaması) → temel sayı.
 * - son 7 günde plan tamamlanan gün ≤ 2 ise (zorlanıyor) → sayı 1 azaltılır (min 1).
 * - aksi halde → temel sayı.
 */
export function adaptiveTaskCount(
  base: number,
  signal?: { activeDays7: number; total14: number },
  recovery: RecoveryState = 'unknown',
): number {
  /*
    TOPARLANMA DA HAFİFLETİR — uyum gibi, ama bağımsız olarak.

    Motor bugüne kadar yalnızca UYUMU biliyordu: "dün görevlerini yaptı mı?". Bilmediği
    şey daha önemliydi: "bugün yapabilir mi?". Üst üste kötü uyumuş bir kullanıcıya
    dünküyle aynı yükü vermek, planı gerçeğe değil takvime bağlar.

    İki sinyal AYRI AYRI düşürüyor ve üst üste binebiliyor: hem zorlanan hem dinlenmemiş
    birine iki kademe hafiflik verilir. Ama taban 1'in altına inmez — plan görünmez
    olursa uygulama da amacını kaybeder; az bir şey her zaman hiçbir şeyden iyidir.

    Sözleşme korunuyor: yalnızca HAFİFLETİR. İyi uyudu diye yük artırılmaz (gerekçe
    için bkz. recovery.ts).
  */
  let count = base;
  if (signal && signal.total14 >= 4 && signal.activeDays7 <= 2) count -= 1;
  if (recovery === 'low') count -= 1;
  return Math.max(1, count);
}

/** Bu modun bugün İSTEDİĞİ görev sayısı (süre + uyum + toparlanma) — bütçe paylaştırması bunu okur. */
export function desiredDailyCount(spec: DailyPlanSpec): number {
  return adaptiveTaskCount(taskCountFor(spec.dailyMinutes), spec.adherence, spec.recovery);
}

/*
  GÜNLÜK PLAN BÜTÇESİ (2026-11-01, kullanıcı: "modların görevlerinde yığılma olmasın"). Her mod kendi başına 1–3 görev
  üretiyordu; 2 sınav + mülakat + spor açıkken günde 9–12 plan görevi çıkabiliyordu ve plan görevleri Zen'de taşınamaz
  sayıldığı için yığılma çözülemiyordu. Artık TÜM modların toplamı bir bütçe:
   · tavan 4; kullanıcının kendi işleri çoksa daralır (bugün ≥3 kendi işi → 3, ≥5 → 2)
   · önce her moda 1 (hedef tarihi EN YAKIN önce), sonra kalan bütçe isteklerine göre aynı sırayla
   · bütçe mod sayısından azsa en uzak tarihli modlar o gün görev almaz (yarın sıra onlara kayar değil — tarih yaklaşınca öne geçerler)
*/
export const PLAN_DAILY_BUDGET = 4;

/**
 * AYNI PLAN İŞİ Mİ (2026-11-05, cihazda görüldü: "Bu hafta ne tamamladın?" hem gecikmiş hem bugün). Aynı gün kopyası ya da
 * henüz bitmemiş ESKİ kopyası varsa yenisi açılmaz: yapılmamış iş tekrar çoğalmaz, kendi gecikmiş satırında kalır.
 */
export function isSamePlanOccurrence(existing: { dueDate?: string | null; isCompleted?: boolean }, incoming: { dueDate?: string | null }): boolean {
  if (!existing.dueDate || !incoming.dueDate) return false;
  const a = new Date(existing.dueDate);
  const b = new Date(incoming.dueDate);
  if (a.toDateString() === b.toDateString()) return true;
  return !existing.isCompleted && a < b;
}

/**
 * SON KAPI (2026-11-05, cihazda görüldü: bugün 6 plan görevi, bütçe 4). Motorun tavanı yalnız kendi ürettiğini sayıyordu;
 * adaptasyon yolları ve önceki çalışmalardan kalanlar bütçeyi aşıyordu. Bugüne düşen her yeni görev burada elenir;
 * tartım gibi tarihi kendi akışına bağlı görevler ve başka güne yazılanlar etkilenmez.
 */
export function trimToPlanBudget<T extends { dueDate?: string | null; tags?: string[] }>(
  incoming: T[],
  tasks: { id: number; dueDate?: string | null; isCompleted?: boolean; isArchived?: boolean }[],
  planTaskIds: Set<number>,
  today: Date,
): T[] {
  const isToday = (iso?: string | null) => {
    if (!iso) return false;
    const d = new Date(iso);
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
  };
  const open = tasks.filter(t => !t.isCompleted && !t.isArchived && isToday(t.dueDate));
  const planToday = open.filter(t => planTaskIds.has(t.id)).length;
  let left = Math.max(0, planBudgetFor(open.length - planToday) - planToday);
  return incoming.filter(t => {
    if (!isToday(t.dueDate) || t.tags?.includes('weight_entry')) return true;
    if (left <= 0) return false;
    left--;
    return true;
  });
}

export function planBudgetFor(ownTasksToday: number): number {
  if (ownTasksToday >= 5) return 2;
  if (ownTasksToday >= 3) return 3;
  return PLAN_DAILY_BUDGET;
}

/** Bütçeyi modlara paylaştırır; dönüş: spec sırasıyla her moda düşen üst sınır. */
export function allocatePlanBudget(specs: Pick<DailyPlanSpec, 'daysLeft'>[], desired: number[], budget: number): number[] {
  const order = specs.map((s, i) => i).sort((a, b) => specs[a].daysLeft - specs[b].daysLeft || a - b);
  const out = specs.map(() => 0);
  let left = budget;
  for (const i of order) { if (left <= 0) break; if (desired[i] > 0) { out[i] = 1; left--; } }
  for (const i of order) { if (left <= 0) break; const extra = Math.min(desired[i] - out[i], left); if (extra > 0 && out[i] > 0) { out[i] += extra; left -= extra; } }
  return out;
}

/*
  ÇALIŞMA YÖNTEMİ GERÇEKTEN UYGULANIR (2026-11-01). Kurulumda seçtirilen yöntem motorda hiç okunmuyordu — herkes aynı
  görevleri alıyordu (mağaza metni bunu vaat ediyor). Artık günün İLK görevi yöntemin kendi tarzından gelir
  (dönüşümlü); kalanlar fazın havuzundan. Yöntem seçilmemişse davranış eskisi gibi.
*/
const METHOD_POOLS: Record<string, Pool> = {
  'active-recall': [
    { tr: '{name}: Kitabı kapat, dünkü konuyu boş kâğıda 5 dakikada anlat', en: '{name}: Close the book and explain yesterday’s topic on blank paper in 5 minutes' },
    { tr: '{name}: 10 soruyu cevaplara bakmadan çöz, sonra kontrol et', en: '{name}: Solve 10 questions without peeking, then check' },
    { tr: '{name}: Konuyu kendi sorunla bitir: 3 soru yaz ve cevapla', en: '{name}: Write and answer 3 questions of your own on the topic' },
    { tr: '{name}: Kavram haritasını ezberden çiz, eksikleri sonra tamamla', en: '{name}: Draw the concept map from memory, then fill the gaps' },
  ],
  'spaced-repetition': [
    { tr: '{name}: Dünkü konuyu 10 dakika tekrar et', en: '{name}: Review yesterday’s topic for 10 minutes' },
    { tr: '{name}: 3 gün önceki konudan 5 soru çöz', en: '{name}: Solve 5 questions from the topic you studied 3 days ago' },
    { tr: '{name}: Geçen haftanın konusunu kartlarla gözden geçir', en: '{name}: Go over last week’s topic with flashcards' },
    { tr: '{name}: "Zor" işaretli kartları bitir', en: '{name}: Clear the cards marked “hard”' },
  ],
  'deep-work': [
    { tr: '{name}: Telefonsuz 50 dakikalık tek blok çalış', en: '{name}: One 50-minute block, phone in another room' },
    { tr: '{name}: Güne en zor konuyla başla, 45 dakika kesintisiz', en: '{name}: Start with the hardest topic, 45 minutes uninterrupted' },
    { tr: '{name}: Tek konuya 2 pomodoro, notları tek sayfada topla', en: '{name}: Two pomodoros on one topic, notes on a single page' },
  ],
  sprint: [
    { tr: '{name}: Süre tutarak 30 dakikada 25 soru', en: '{name}: 25 questions in 30 minutes, timed' },
    { tr: '{name}: Mini deneme: 20 soru, ardından hızlı hata analizi', en: '{name}: Mini mock: 20 questions, then a quick error review' },
    { tr: '{name}: Zayıf konudan 15 hızlı soru, süre tut', en: '{name}: 15 quick questions from your weak topic, timed' },
  ],
  foundation: [
    { tr: '{name}: Temel kavramı baştan oku, 5 maddede özetle', en: '{name}: Read the core concept from scratch, summarise in 5 points' },
    { tr: '{name}: Konu anlatımını izle, örnek soruyu kendin çöz', en: '{name}: Watch the lesson, then solve the example yourself' },
    { tr: '{name}: Formül ve tanım listeni temize çek', en: '{name}: Write out a clean list of formulas and definitions' },
  ],
};

// Bugün 09:00 (yerel) ISO — günlük görevler güne tarihlenir
function todayAt9(today: Date): string {
  const d = new Date(today);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

// Gün indeksi — havuzdan her gün farklı görev seçmek için rotasyon
function dayIndex(today: Date): number {
  return Math.floor(today.getTime() / 86400000);
}

// ── Sınav günlük havuzları (faz bazlı) ──────────────────────────────────────────
const EXAM_POOLS: Record<StudyPhase, Pool> = {
  foundation: [
    { tr: '{name}: bugünkü konuyu kavramsal olarak oku — ezberleme, anla', en: '{name}: read today\'s topic conceptually — understand, don\'t memorize' },
    { tr: '{name}: okuduğun konunun kavram haritasını çıkar', en: '{name}: draw a concept map of today\'s topic' },
    { tr: '{name}: bugün öğrendiğini 5 cümleyle kendi kelimelerinle özetle', en: '{name}: summarize what you learned today in 5 of your own sentences' },
    { tr: '{name}: konunun temel sorularından 10 tane çöz', en: '{name}: solve 10 basic questions on the topic' },
  ],
  deepen: [
    { tr: '{name}: bugünkü konudan 20 soru çöz ve yanlışları işaretle', en: '{name}: solve 20 questions on today\'s topic and mark mistakes' },
    { tr: '{name}: dünkü yanlışlarını tekrar et (aralıklı tekrar)', en: '{name}: review yesterday\'s mistakes (spaced repetition)' },
    { tr: '{name}: zorlandığın bir alt başlığa 30 dk derin çalışma ayır', en: '{name}: spend 30 min deep work on a tough subtopic' },
    { tr: '{name}: bugün yeni 15 kart/özet oluştur', en: '{name}: create 15 new cards/summaries today' },
  ],
  reinforce: [
    { tr: '{name}: zayıf konularından birini seç ve 25 soru çöz', en: '{name}: pick a weak topic and solve 25 questions' },
    { tr: '{name}: hata defterindeki son yanlışları tekrar çöz', en: '{name}: re-solve the latest entries in your error log' },
    { tr: '{name}: bugün 1 konu testi çöz ve süre tut', en: '{name}: take 1 topic test today and time yourself' },
  ],
  accelerate: [
    { tr: '{name}: bugün 1 mini deneme çöz ve hatalarını analiz et', en: '{name}: take 1 mini mock today and analyze your errors' },
    { tr: '{name}: dünkü denemenin yanlış konularını tekrar et', en: '{name}: review the wrong topics from yesterday\'s mock' },
    { tr: '{name}: en zayıf 1 konuyu bugün güçlendir', en: '{name}: reinforce your single weakest topic today' },
  ],
  sprint: [
    { tr: '{name}: bugün tam deneme çöz — gerçek sınav koşullarında', en: '{name}: take a full mock today — real exam conditions' },
    { tr: '{name}: yeni konu YOK — sadece tekrar ve hata analizi', en: '{name}: NO new topics — only review and error analysis' },
    { tr: '{name}: en sık yaptığın 3 hatayı gözden geçir', en: '{name}: review your 3 most frequent mistakes' },
  ],
};

// ── Dil sınavı havuzları (YDS/IELTS/TOEFL/PTE/YÖKDİL) ────────────────────────────
// Genel soru-bankası yerine: kelime + 4 beceri (reading/listening/speaking/writing).
const LANG_EXAM_POOLS: Record<StudyPhase, Pool> = {
  foundation: [
    { tr: '{name}: bugün 20 yeni kelime öğren ve örnek cümleyle kaydet', en: '{name}: learn 20 new words today and save them with example sentences' },
    { tr: '{name}: temel bir gramer konusunu çalış ve 10 örnek çöz', en: '{name}: study one core grammar topic and do 10 examples' },
    { tr: '{name}: 15 dk İngilizce dinle (podcast/dizi) ve 3 yeni kelime not al', en: '{name}: listen 15 min of English (podcast/show) and note 3 new words' },
  ],
  deepen: [
    { tr: '{name}: 1 reading parçası çöz, bilmediğin kelimeleri kart yap', en: '{name}: do 1 reading passage, turn unknown words into cards' },
    { tr: '{name}: dünkü kelimeleri aralıklı tekrar et (Anki/Quizlet)', en: '{name}: spaced-review yesterday\'s words (Anki/Quizlet)' },
    { tr: '{name}: 1 listening alıştırması yap ve transkriptle karşılaştır', en: '{name}: do 1 listening exercise and compare with the transcript' },
  ],
  reinforce: [
    { tr: '{name}: en zayıf becerine (reading/listening) 30 dk odaklan', en: '{name}: focus 30 min on your weakest skill (reading/listening)' },
    { tr: '{name}: 1 writing görevi yaz (kısa paragraf) ve kendini düzelt', en: '{name}: write 1 writing task (short paragraph) and self-correct' },
    { tr: '{name}: kelime hata defterindeki son kelimeleri tekrar çöz', en: '{name}: re-test the latest words in your vocab error log' },
  ],
  accelerate: [
    { tr: '{name}: 1 tam bölüm denemesi çöz (zamanlı) ve hatalarını analiz et', en: '{name}: take 1 full section test (timed) and analyze errors' },
    { tr: '{name}: speaking için 2 dk konuş, kaydet ve dinle', en: '{name}: speak 2 min for speaking, record and listen back' },
    { tr: '{name}: sık çıkan kelime köklerini/ifadeleri tekrar et', en: '{name}: review frequent word roots/collocations' },
  ],
  sprint: [
    { tr: '{name}: gerçek koşullarda tam deneme çöz — süreyi tut', en: '{name}: take a full mock in real conditions — keep time' },
    { tr: '{name}: writing/speaking şablonlarını son kez gözden geçir', en: '{name}: review your writing/speaking templates one last time' },
    { tr: '{name}: yeni kelime YOK — bildiğin kelimeleri pekiştir', en: '{name}: NO new words — consolidate what you already know' },
  ],
};

// ── Tıp/uzmanlık havuzları (TUS/DUS/USMLE) ───────────────────────────────────────
// Kart sistemi (Anki) + soru bankası (Qbank) + klinik akıl yürütme.
const MEDICAL_EXAM_POOLS: Record<StudyPhase, Pool> = {
  foundation: [
    { tr: '{name}: bugünkü sistemi sistematik oku ve Anki destesini başlat', en: '{name}: read today\'s system systematically and start an Anki deck' },
    { tr: '{name}: okuduğun konunun yüksek-verimli (high-yield) notunu çıkar', en: '{name}: make a high-yield note of today\'s topic' },
  ],
  deepen: [
    { tr: '{name}: bugünkü Anki tekrarlarını bitir (due kartlar)', en: '{name}: finish today\'s Anki reviews (due cards)' },
    { tr: '{name}: 1 Qbank bloğu çöz (konu bazlı) ve açıklamaları oku', en: '{name}: do 1 Qbank block (topic-based) and read the explanations' },
  ],
  reinforce: [
    { tr: '{name}: en zayıf sistemden 1 Qbank bloğu çöz, hata defterine işle', en: '{name}: do 1 Qbank block on your weakest system, log mistakes' },
    { tr: '{name}: Anki due kartlar + dünkü yanlış konuları tekrar et', en: '{name}: Anki due cards + review yesterday\'s wrong topics' },
  ],
  accelerate: [
    { tr: '{name}: zamanlı 1 Qbank bloğu (random) + klinik vaka analizi', en: '{name}: 1 timed Qbank block (random) + clinical vignette analysis' },
    { tr: '{name}: en sık yaptığın 3 hata kalıbını gözden geçir', en: '{name}: review your 3 most frequent error patterns' },
  ],
  sprint: [
    { tr: '{name}: tam uzunlukta deneme çöz — gerçek sınav temposu', en: '{name}: take a full-length mock — real exam pace' },
    { tr: '{name}: yeni konu YOK — high-yield tekrar + Anki', en: '{name}: NO new topics — high-yield review + Anki' },
  ],
};

// ── Tez/proje günlük havuzları (faz bazlı) ──────────────────────────────────────
const TEZ_POOLS: Record<StudyPhase, Pool> = {
  foundation: [
    { tr: '{name}: bugün 30 dk kaynak/literatür oku ve not al', en: '{name}: read sources/literature 30 min today and take notes' },
    { tr: '{name}: outline\'a bir alt başlık daha ekle', en: '{name}: add one more subsection to your outline' },
  ],
  deepen: [
    { tr: '{name}: bugün en az 300 kelime yaz', en: '{name}: write at least 300 words today' },
    { tr: '{name}: bir bölümün taslağını ilerlet', en: '{name}: advance the draft of one section' },
  ],
  reinforce: [
    { tr: '{name}: yazdığın bir bölümü bugün revize et', en: '{name}: revise one written section today' },
    { tr: '{name}: kaynakça/atıfları güncelle', en: '{name}: update references/citations' },
  ],
  accelerate: [
    { tr: '{name}: eksik bölümlerden birini bugün tamamla', en: '{name}: complete one of the missing sections today' },
    { tr: '{name}: danışman için ilerleme notu hazırla', en: '{name}: prepare a progress note for your advisor' },
  ],
  sprint: [
    { tr: '{name}: yeni içerik yok — bugün revizyon ve düzeltme yap', en: '{name}: no new content — revise and proofread today' },
    { tr: '{name}: format/şablon kontrol listesinden bir madde tamamla', en: '{name}: complete one item from the format checklist' },
  ],
};

// ── Mülakat günlük bantları (daysLeft bazlı) ───────────────────────────────────
type MulakatBand = 'far' | 'mid' | 'near' | 'eve';
function mulakatBand(daysLeft: number): MulakatBand {
  if (daysLeft <= 1) return 'eve';
  if (daysLeft <= 7) return 'near';
  if (daysLeft <= 21) return 'mid';
  return 'far';
}
const MULAKAT_POOLS: Record<MulakatBand, Pool> = {
  far: [
    { tr: '{name}: bugün CV ve LinkedIn profilini pozisyona göre gözden geçir', en: '{name}: review your CV & LinkedIn for the role today' },
    { tr: '{name}: temel teknik/konu çalışmasına 45 dk ayır', en: '{name}: spend 45 min on core technical/topic study' },
  ],
  mid: [
    { tr: '{name}: bugün 1 STAR hikayesi yaz (Durum-Görev-Eylem-Sonuç) ve sesli anlat', en: '{name}: write 1 STAR story (Situation-Task-Action-Result) today and say it aloud' },
    { tr: '{name}: olası mülakat sorularından 3\'üne yazılı cevap hazırla', en: '{name}: prep written answers to 3 likely interview questions' },
  ],
  near: [
    { tr: '{name}: bugün 1 mock mülakat yap ve kaydını izle', en: '{name}: do 1 mock interview today and review the recording' },
    { tr: '{name}: şirket hakkında son haberleri 20 dk araştır', en: '{name}: research the company\'s latest news for 20 min' },
  ],
  eve: [
    { tr: '{name}: kıyafet, rota ve belgeleri bugün hazırla — erken uyu', en: '{name}: prepare outfit, route and documents today — sleep early' },
    { tr: '{name}: en güçlü 3 hikayeni son kez sesli tekrar et', en: '{name}: rehearse your 3 strongest stories aloud one last time' },
  ],
};

// ── Fitness ve Ramazan: tek rotasyonlu havuz (faz planAdaptations\'ta işleniyor) ──
const KILO_POOL: Pool = [
  { tr: 'Bugün 30+ dk hareket et (tempolu yürüyüş veya antrenman)', en: 'Move 30+ min today (brisk walk or workout)' },
  { tr: 'Bugünkü öğünlerinde protein ve sebzeyi önceliklendir', en: 'Prioritize protein and veggies in today\'s meals' },
  { tr: 'Bugün 2+ litre su iç ve şekerli içecekten kaçın', en: 'Drink 2+ liters of water today, skip sugary drinks' },
  { tr: 'Bugün ne yediğini kısaca not et', en: 'Briefly log what you ate today' },
];
const KILO_POOL_RAMAZAN: Pool = [
  { tr: 'İftar sonrası 30+ dk hafif tempolu yürüyüş veya hareket et', en: 'Do 30+ min light walking or movement after Iftar' },
  { tr: 'İftar ve sahurda protein/sebze öncelikli beslen, şekerli içecekten kaçın', en: 'Prioritize protein/veggies at Iftar and Sahur, skip sugary drinks' },
  { tr: 'İftar ve sahur arası 2+ litre su içtiğinden emin ol', en: 'Make sure to drink 2+ liters of water between Iftar and Sahur' },
  { tr: 'Bugün sahur ve iftarda ne yediğini kısaca not et', en: 'Briefly log what you ate at Sahur and Iftar' },
];

const MARATON_POOL: Pool = [
  { tr: 'Bugünkü koşunu planına göre tamamla', en: 'Complete today\'s run per your plan' },
  { tr: 'Koşu öncesi/sonrası 10 dk esneme yap', en: 'Do 10 min stretching before/after your run' },
  { tr: 'Bugünkü mesafeni ve nasıl hissettiğini kaydet', en: 'Log today\'s distance and how you felt' },
];
const MARATON_POOL_RAMAZAN: Pool = [
  { tr: 'Bugünkü koşunu iftar sonrasına veya sahur öncesine planla', en: 'Schedule today\'s run after Iftar or before Sahur' },
  { tr: 'Koşu öncesi/sonrası esneme yap, hidrasyonuna dikkat et', en: 'Do stretching before/after your run, watch your hydration' },
  { tr: 'Koşunun detaylarını ve oruçlu antrenman hissiyatını kaydet', en: 'Log run details and how you felt training while fasting' },
];

const GUC_POOL: Pool = [
  { tr: 'Bugünkü antrenman bölünmeni (split) tamamla', en: 'Complete today\'s training split' },
  { tr: 'Temel hareketlerde ağırlık/tekrarını kaydet', en: 'Log weight/reps on your main lifts' },
  { tr: 'Bugün protein hedefine ulaş (vücut ağırlığı × ~2g/kg)', en: 'Hit your protein target today (bodyweight × ~2g/kg)' },
];
const GUC_POOL_RAMAZAN: Pool = [
  { tr: 'Ağır antrenmanını iftar sonrasına planla ve splitini tamamla', en: 'Schedule heavy lifts after Iftar and complete your split' },
  { tr: 'Güç kaldırışlarında ağırlık/tekrarını kaydet', en: 'Log weight/reps on your main lifts' },
  { tr: 'İftar-sahur arası protein hedefini yakala (vücut ağırlığı × ~2g/kg)', en: 'Hit your protein target between Iftar and Sahur (bodyweight × ~2g/kg)' },
];

const GENEL_POOL: Pool = [
  { tr: 'Bugün en az 30 dk aktif ol', en: 'Be active for at least 30 min today' },
  { tr: 'Bugün 7-8 saat uyku ve 2L su hedefle', en: 'Aim for 7-8h sleep and 2L water today' },
  { tr: 'Bugün 10 dk esneme veya mobilite çalışması yap', en: 'Do 10 min stretching or mobility today' },
];
const GENEL_POOL_RAMAZAN: Pool = [
  { tr: 'İftar sonrası en az 30 dk hafif aktif ol (mobilite/esneme)', en: 'Be active for at least 30 min after Iftar (mobility/stretching)' },
  { tr: 'İftar ve sahur arasında 2L su ve 7-8 saat kaliteli uyku hedefle', en: 'Aim for 2L water between Iftar/Sahur and 7-8h quality sleep' },
  { tr: 'Bugün 10 dk esneme veya mobilite çalışması yap', en: 'Do 10 min stretching or mobility today' },
];

const RAMAZAN_POOL: Pool = [
  { tr: 'Bugün teravih sonrası 30 dk verimli çalışma/okuma yap', en: 'Do 30 min of focused study/reading after Tarawih today' },
  { tr: 'Bugün Kuran okuma hedefini tamamla', en: 'Complete today\'s Quran reading goal' },
  { tr: 'Bugün 3 şükür notu yaz', en: 'Write 3 gratitude notes today' },
];

// Sınav adından kategoriyi türet (ekstra alan saklamadan): dil ve tıp sınavları
// kendi pedagojilerine uygun havuz alır; diğerleri jenerik soru-bankası havuzu.
function examPoolFor(spec: DailyPlanSpec): Pool {
  const phase = getPhase(spec.daysLeft);
  const category = spec.name ? matchExamName(spec.name)[0]?.category : undefined;
  if (category === 'language') return LANG_EXAM_POOLS[phase];
  if (category === 'medical') return MEDICAL_EXAM_POOLS[phase];
  return EXAM_POOLS[phase];
}

function poolFor(spec: DailyPlanSpec): Pool {
  const ramazan = !!spec.isRamazan;
  switch (spec.kind) {
    case 'exam': return examPoolFor(spec);
    case 'tez': return TEZ_POOLS[getPhase(spec.daysLeft)];
    case 'mulakat': return MULAKAT_POOLS[mulakatBand(spec.daysLeft)];
    case 'kilo': return ramazan ? KILO_POOL_RAMAZAN : KILO_POOL;
    case 'maraton': return ramazan ? MARATON_POOL_RAMAZAN : MARATON_POOL;
    case 'guc': return ramazan ? GUC_POOL_RAMAZAN : GUC_POOL;
    case 'genel': return ramazan ? GENEL_POOL_RAMAZAN : GENEL_POOL;
    case 'ramazan': return RAMAZAN_POOL;
  }
}

/**
 * Bu plan/faz için kullanılacak havuz: SABİT havuz + (varsa) genişletilmiş varyantlar.
 *
 * Sabit havuzlar çok küçük (tıp/tez/mülakat fazlarında 2 görev). Günde 1 görev üreten
 * kullanıcı aynı iki görevi aylarca dönüşümlü görüyordu. `extraPool` bu havuzu bir kez
 * genişletilmiş varyantlarla büyütür (bkz. usePlanPoolStore).
 *
 * SABİT HAVUZ ÖNDE: elle yazılmış, gözden geçirilmiş görevler her zaman önce gelir;
 * üretilmiş varyantlar onların üstüne EKLENİR, yerini almaz. `extraPool` boş/gelmemişse
 * sonuç bugünküyle birebir aynıdır — yani bu özellik hiçbir şeyi bozamaz.
 */
function effectivePool(spec: DailyPlanSpec): Pool {
  const base = poolFor(spec);
  const extra = spec.extraPool;
  if (!extra || extra.length === 0) return base;
  // Aynı metin iki kez görünmesin (üretilmiş varyant sabitlerden birini tekrarlayabilir).
  const seen = new Set(base.map(p => p.tr.trim().toLocaleLowerCase('tr')));
  const merged = [...base];
  for (const v of extra) {
    const key = v.tr.trim().toLocaleLowerCase('tr');
    if (!v.tr?.trim() || !v.en?.trim() || seen.has(key)) continue;
    seen.add(key);
    merged.push(v);
  }
  return merged;
}

/**
 * Genişletilmiş havuzun anahtarı — `kind` + faz. Faz ilerledikçe (foundation →
 * sprint) yeni bir havuz üretilir; bir plan ömrü boyunca en fazla 5 kez.
 */
export function planPoolKeyFor(spec: DailyPlanSpec): { kind: string; phase: string } {
  switch (spec.kind) {
    case 'exam': return { kind: 'exam', phase: getPhase(spec.daysLeft) };
    case 'tez': return { kind: 'tez', phase: getPhase(spec.daysLeft) };
    case 'mulakat': return { kind: 'mulakat', phase: mulakatBand(spec.daysLeft) };
    // Spor/Ramazan havuzları faza bölünmüyor — tek havuz.
    default: return { kind: spec.kind, phase: '' };
  }
}

/** O gün ilgili plandan zaten günlük görev üretilmiş mi? */
export function hasDailyToday(
  tasks: { tags?: string[] | null; dueDate?: string | null; isCompleted: boolean; isArchived?: boolean }[],
  key: PlanKind | string,
  today: Date,
): boolean {
  const d0 = new Date(today); d0.setHours(0, 0, 0, 0);
  const d1 = new Date(today); d1.setHours(23, 59, 59, 999);
  return tasks.some(t => {
    // Arşivlenmiş görev "bugün üretildi" saymaz: aksi halde arşivlenen bir plan görevi
    // yerine yenisi gelmez ve o günün planı sessizce eksik kalırdı. Arayüz plan
    // görevlerinin arşivlenmesini engelliyor — bu, o kuralın ikinci savunma hattı.
    if (t.isArchived) return false;
    const tags = t.tags ?? [];
    if (!tags.includes('daily') || !tags.includes(key)) return false;
    if (!t.dueDate) return false;
    const due = new Date(t.dueDate).getTime();
    return due >= d0.getTime() && due <= d1.getTime();
  });
}

/**
 * Bugünün görevlerini üretir. O gün zaten üretilmişse (veya hedef geçmişse) boş döner.
 */
export function buildDailyTasks(
  spec: DailyPlanSpec,
  existingTasks: { title: string; tags?: string[] | null; dueDate?: string | null; isCompleted: boolean }[],
  lang: Language,
  today: Date = new Date(),
): CreateTaskPayload[] {
  if (spec.daysLeft < 0) return [];
  // Dedupe/etiket anahtarı slot'tur (alt-planlar çakışmasın); yoksa kind'e düşer.
  const tagKey = spec.slot ?? spec.kind;
  if (hasDailyToday(existingTasks, tagKey, today)) return [];

  const tr = lang === 'tr';
  const pool = effectivePool(spec);
  if (!pool.length) return [];

  const want = Math.min(desiredDailyCount(spec), pool.length);
  const count = spec.maxCount != null ? Math.min(want, spec.maxCount) : want;
  if (count <= 0) return []; // bütçe bugün bu moda yer bırakmadı
  const offset = dayIndex(today);
  const due = todayAt9(today);
  const name = spec.name?.trim() || (tr ? 'Hedefin' : 'Your goal');

  const out: CreateTaskPayload[] = [];
  const visibleTagsMap: Record<string, string> = {
    exam: 'education',
    tez: 'education',
    mulakat: 'work',
    kilo: 'fitness',
    maraton: 'fitness',
    guc: 'fitness',
    genel: 'fitness',
    ramazan: 'ramazan',
  };
  const extraVisibleTag = visibleTagsMap[spec.kind];

  const method = spec.templateId ? METHOD_POOLS[spec.templateId] : undefined;
  for (let i = 0; i < count; i++) {
    // Yöntemin tarzı günün İLK görevinde (dönüşümlü); kalanlar faz havuzundan.
    const item = i === 0 && method ? method[offset % method.length] : pool[(offset + i - (method ? 1 : 0)) % pool.length];
    const titleTr = item.tr.replace('{name}', name);
    const titleEn = item.en.replace('{name}', name);
    const title = tr ? titleTr : titleEn;

    const finalTags = [tagKey, 'daily'];
    if (extraVisibleTag && !finalTags.includes(extraVisibleTag)) {
      finalTags.push(extraVisibleTag);
    }

    out.push({
      title,
      description: JSON.stringify({ tr: titleTr, en: titleEn }),
      priority: i === 0 ? 'High' : 'Medium',
      dueDate: due,
      isCompleted: false,
      tags: finalTags,
      titleTr,
      titleEn,
    } as any);
  }
  return out;
}

export function getAllDailyPlanPairs(): Array<{ tr: string; en: string }> {
  const pairs: Array<{ tr: string; en: string }> = [];
  const addRecord = (rec: Record<string, { tr: string; en: string }[]>) => {
    Object.values(rec).forEach(pool => pairs.push(...pool));
  };
  addRecord(EXAM_POOLS);
  addRecord(LANG_EXAM_POOLS);
  addRecord(MEDICAL_EXAM_POOLS);
  addRecord(TEZ_POOLS);
  addRecord(MULAKAT_POOLS);
  addRecord(METHOD_POOLS); // yöntem görevleri de dil değişince çevrilsin
  pairs.push(...KILO_POOL, ...MARATON_POOL, ...GUC_POOL, ...GENEL_POOL, ...RAMAZAN_POOL);
  /**
   * RAMAZAN VARYANTLARI DA — eskiden unutulmuşlardı.
   *
   * Bu liste `systemTaskTranslator`ı besliyor: kullanıcı dili değiştirdiğinde sistemin
   * ürettiği görev başlıkları buradaki eşleşmelerden çevriliyor. Ramazan havuzları
   * listede olmadığı için, Ramazan modu açıkken dil değiştiren bir kullanıcının günlük
   * görevleri ESKİ DİLDE kalıyordu — üstelik tam da içerik farkının en görünür olduğu
   * modda (iftar/sahur'a göre yazılmış özel metinler).
   *
   * Sessiz bir hataydı: bir şey çökmüyor, yalnızca çeviri sözlüğünde karşılık
   * bulunamıyor ve metin olduğu gibi bırakılıyordu.
   */
  pairs.push(...KILO_POOL_RAMAZAN, ...MARATON_POOL_RAMAZAN, ...GUC_POOL_RAMAZAN, ...GENEL_POOL_RAMAZAN);
  return pairs;
}
