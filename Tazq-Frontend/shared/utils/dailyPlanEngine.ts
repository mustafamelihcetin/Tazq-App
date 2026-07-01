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
import { getPhase, StudyPhase, matchExamName } from './examPresets';

export type Language = 'tr' | 'en';

export type PlanKind = 'exam' | 'tez' | 'mulakat' | 'kilo' | 'maraton' | 'guc' | 'genel' | 'ramazan';

export interface DailyPlanSpec {
  kind: PlanKind;
  name?: string;          // sınav/şirket/tez adı (başlıkta {name} yerine geçer)
  daysLeft: number;       // hedef tarihe kalan gün
  dailyMinutes?: number;  // kullanıcının seçtiği günlük süre → görev yoğunluğu
  templateId?: string;    // (opsiyonel) ileride faz override için
  /**
   * Adaptif zorluk sinyali. Kullanıcının son tamamlama davranışına göre günlük
   * görev sayısı YALNIZCA hafifletilir (asla aşırı yüklenmez). Verilmezse temel
   * sayı kullanılır. Detay: {@link adaptiveTaskCount}.
   */
  adherence?: { activeDays7: number; total14: number };
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
export function adaptiveTaskCount(base: number, signal?: { activeDays7: number; total14: number }): number {
  if (!signal || signal.total14 < 4) return base;
  if (signal.activeDays7 <= 2) return Math.max(1, base - 1);
  return base;
}

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
    { tr: '{name}: bugün 1 STAR hikayesi yaz ve sesli anlat', en: '{name}: write and say aloud 1 STAR story today' },
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
const MARATON_POOL: Pool = [
  { tr: 'Bugünkü koşunu planına göre tamamla', en: 'Complete today\'s run per your plan' },
  { tr: 'Koşu öncesi/sonrası 10 dk esneme yap', en: 'Do 10 min stretching before/after your run' },
  { tr: 'Bugünkü mesafeni ve nasıl hissettiğini kaydet', en: 'Log today\'s distance and how you felt' },
];
const GUC_POOL: Pool = [
  { tr: 'Bugünkü antrenman bölünmeni (split) tamamla', en: 'Complete today\'s training split' },
  { tr: 'Temel hareketlerde ağırlık/tekrarını kaydet', en: 'Log weight/reps on your main lifts' },
  { tr: 'Bugün protein hedefine ulaş (vücut ağırlığı × ~2g/kg)', en: 'Hit your protein target today (bodyweight × ~2g/kg)' },
];
const GENEL_POOL: Pool = [
  { tr: 'Bugün en az 30 dk aktif ol', en: 'Be active for at least 30 min today' },
  { tr: 'Bugün 7-8 saat uyku ve 2L su hedefle', en: 'Aim for 7-8h sleep and 2L water today' },
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
  switch (spec.kind) {
    case 'exam': return examPoolFor(spec);
    case 'tez': return TEZ_POOLS[getPhase(spec.daysLeft)];
    case 'mulakat': return MULAKAT_POOLS[mulakatBand(spec.daysLeft)];
    case 'kilo': return KILO_POOL;
    case 'maraton': return MARATON_POOL;
    case 'guc': return GUC_POOL;
    case 'genel': return GENEL_POOL;
    case 'ramazan': return RAMAZAN_POOL;
  }
}

/** O gün ilgili plandan zaten günlük görev üretilmiş mi? */
export function hasDailyToday(
  tasks: { tags?: string[] | null; dueDate?: string | null; isCompleted: boolean }[],
  key: PlanKind | string,
  today: Date,
): boolean {
  const d0 = new Date(today); d0.setHours(0, 0, 0, 0);
  const d1 = new Date(today); d1.setHours(23, 59, 59, 999);
  return tasks.some(t => {
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
  const pool = poolFor(spec);
  if (!pool.length) return [];

  const count = Math.min(adaptiveTaskCount(taskCountFor(spec.dailyMinutes), spec.adherence), pool.length);
  const offset = dayIndex(today);
  const due = todayAt9(today);
  const name = spec.name?.trim() || (tr ? 'Hedefin' : 'Your goal');

  const out: CreateTaskPayload[] = [];
  for (let i = 0; i < count; i++) {
    const item = pool[(offset + i) % pool.length];
    const titleTr = item.tr.replace('{name}', name);
    const titleEn = item.en.replace('{name}', name);
    const title = tr ? titleTr : titleEn;
    out.push({
      title,
      description: '',
      priority: i === 0 ? 'High' : 'Medium',
      dueDate: due,
      isCompleted: false,
      tags: [tagKey, 'daily'],
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
  pairs.push(...KILO_POOL, ...MARATON_POOL, ...GUC_POOL, ...GENEL_POOL, ...RAMAZAN_POOL);
  return pairs;
}
