export type ExamCategory = 'university' | 'public' | 'graduate' | 'highschool' | 'language' | 'medical' | 'other';

export interface ExamPreset {
  id: string;
  displayName: string;
  shortName: string;
  aliases: string[];
  category: ExamCategory;
  defaultDailyMinutes: number;
  preferredTemplates: string[];
  tipTr: string;
  tipEn: string;
}

export const EXAM_PRESETS: ExamPreset[] = [
  {
    id: 'yks',
    displayName: 'YKS — TYT / AYT',
    shortName: 'YKS',
    aliases: ['yks', 'tyt', 'ayt', 'tytayt', 'universite', 'üniversite', 'ykssinavi', 'osym', 'ösym', 'universitegirissinavı', 'universitegiriş'],
    category: 'university',
    defaultDailyMinutes: 120,
    preferredTemplates: ['active-recall', 'spaced-repetition', 'deep-work', 'sprint'],
    tipTr: 'Çoktan seçmeli format — günlük soru çözümü ve hata defteri kritik.',
    tipEn: 'Multiple choice — daily question solving and error logs are critical.',
  },
  {
    id: 'kpss',
    displayName: 'KPSS',
    shortName: 'KPSS',
    aliases: ['kpss', 'kamu', 'kamupersonel', 'devletmemur', 'egitimbilimleri', 'kpssegitim', 'kpssgenel', 'kpssonlisans'],
    category: 'public',
    defaultDailyMinutes: 120,
    preferredTemplates: ['spaced-repetition', 'active-recall', 'deep-work', 'sprint'],
    tipTr: 'Ezber yoğun format — Ebbinghaus aralıklı tekrar belirleyici.',
    tipEn: 'Memorization-heavy — Ebbinghaus spaced repetition is decisive.',
  },
  {
    id: 'ales',
    displayName: 'ALES',
    shortName: 'ALES',
    aliases: ['ales', 'akademik', 'lisansustu', 'lisansüstü', 'yukseklisans', 'yükseklisans'],
    category: 'graduate',
    defaultDailyMinutes: 90,
    preferredTemplates: ['active-recall', 'deep-work', 'sprint'],
    tipTr: 'Sözel + Sayısal akıl yürütme — konu ezberi değil, pratik belirleyici.',
    tipEn: 'Verbal + Quantitative reasoning — practice beats memorization here.',
  },
  {
    id: 'lgs',
    displayName: 'LGS',
    shortName: 'LGS',
    aliases: ['lgs', 'lisegeçiş', 'lisegecis', 'ortaokul', 'liseyegecis', 'liseyegeçiş'],
    category: 'highschool',
    defaultDailyMinutes: 75,
    preferredTemplates: ['active-recall', 'spaced-repetition', 'deep-work', 'sprint'],
    tipTr: 'YKS ile aynı format — erken başlanan düzenli çalışma fark yaratır.',
    tipEn: 'Same format as YKS — consistent early preparation makes the difference.',
  },
  {
    id: 'dgs',
    displayName: 'DGS',
    shortName: 'DGS',
    aliases: ['dgs', 'dikey', 'dikeygeçiş', 'dikeygeciş', 'onlisans', 'önlisans'],
    category: 'university',
    defaultDailyMinutes: 90,
    preferredTemplates: ['active-recall', 'sprint', 'deep-work'],
    tipTr: 'Kısa hazırlık — hızlı konu taraması + ağırlıklı soru çözümü.',
    tipEn: 'Short prep window — rapid topic scan + question-heavy study.',
  },
  {
    id: 'yds',
    displayName: 'YDS / YÖKDİL',
    shortName: 'YDS',
    aliases: ['yds', 'yokdil', 'yökdil', 'yabancidil', 'yabancıdil', 'yabancidilsinavi'],
    category: 'language',
    defaultDailyMinutes: 60,
    preferredTemplates: ['spaced-repetition', 'active-recall', 'deep-work'],
    tipTr: 'Kelime temeli kritik — aralıklı tekrarla kalıcı hafıza oluştur.',
    tipEn: 'Vocabulary foundation is critical — build lasting memory with spaced repetition.',
  },
  {
    id: 'ielts',
    displayName: 'IELTS',
    shortName: 'IELTS',
    aliases: ['ielts', 'aylets', 'eylets', 'aylts'],
    category: 'language',
    defaultDailyMinutes: 90,
    preferredTemplates: ['active-recall', 'spaced-repetition', 'deep-work'],
    tipTr: 'Strateji + kelime — band puanını deneme sınavları belirler.',
    tipEn: 'Strategy + vocab — your band score is determined by practice tests.',
  },
  {
    id: 'toefl',
    displayName: 'TOEFL',
    shortName: 'TOEFL',
    aliases: ['toefl', 'tofl', 'tofıl'],
    category: 'language',
    defaultDailyMinutes: 90,
    preferredTemplates: ['active-recall', 'spaced-repetition', 'deep-work'],
    tipTr: 'Akademik İngilizce odaklı — reading + listening en kritik bölümler.',
    tipEn: 'Academic English focused — reading and listening are the most critical.',
  },
  {
    id: 'tus',
    displayName: 'TUS / DUS',
    shortName: 'TUS',
    aliases: ['tus', 'dus', 'tipta', 'tıpta', 'uzmanlik', 'uzmanlık', 'disuzmanlık', 'disuzmanligi'],
    category: 'medical',
    defaultDailyMinutes: 240,
    preferredTemplates: ['spaced-repetition', 'active-recall', 'deep-work'],
    tipTr: 'Devasa konu havuzu — kart sistemi (Anki) olmadan kazanmak çok zor.',
    tipEn: 'Massive knowledge base — winning without a flashcard system is very hard.',
  },
  {
    id: 'usmle',
    displayName: 'USMLE',
    shortName: 'USMLE',
    aliases: ['usmle', 'step', 'step1', 'step2', 'step3', 'usml'],
    category: 'medical',
    defaultDailyMinutes: 360,
    preferredTemplates: ['spaced-repetition', 'active-recall', 'deep-work'],
    tipTr: 'Anki + UWorld kombinasyonu altın standart — klinik akıl yürütme odaklı.',
    tipEn: 'Anki + UWorld is the gold standard — focus on clinical reasoning over rote facts.',
  },
  {
    id: 'gre',
    displayName: 'GRE',
    shortName: 'GRE',
    aliases: ['gre', 'gradrecord', 'graduaterecord'],
    category: 'graduate',
    defaultDailyMinutes: 120,
    preferredTemplates: ['active-recall', 'spaced-repetition', 'deep-work'],
    tipTr: 'Sözel kelime havuzu çok önemli — Quizlet/Anki ile GRE kelime seti çalış.',
    tipEn: 'Verbal vocabulary is critical — study a GRE word list with Quizlet/Anki.',
  },
  {
    id: 'gmat',
    displayName: 'GMAT',
    shortName: 'GMAT',
    aliases: ['gmat'],
    category: 'graduate',
    defaultDailyMinutes: 120,
    preferredTemplates: ['active-recall', 'deep-work', 'sprint'],
    tipTr: 'Veri yeterliliği + eleştirel akıl — taktik ve format alışkanlığı belirleyici.',
    tipEn: 'Data sufficiency + critical reasoning — format familiarity and strategy matter most.',
  },
  {
    id: 'msü',
    displayName: 'MSÜ / Askeri Sınavlar',
    shortName: 'MSÜ',
    aliases: ['msü', 'msu', 'askeri', 'harp', 'harpokulu', 'jandarma', 'subay'],
    category: 'public',
    defaultDailyMinutes: 120,
    preferredTemplates: ['active-recall', 'deep-work', 'spaced-repetition', 'sprint'],
    tipTr: 'YKS formatına benzer — ek olarak fiziksel hazırlık takvimini de planla.',
    tipEn: 'Similar to YKS format — also plan your physical preparation schedule.',
  },
  {
    id: 'pmyo',
    displayName: 'PMYO / Polis Sınavları',
    shortName: 'PMYO',
    aliases: ['pmyo', 'polis', 'polislik', 'emniyet'],
    category: 'public',
    defaultDailyMinutes: 90,
    preferredTemplates: ['active-recall', 'spaced-repetition', 'sprint'],
    tipTr: 'Genel yetenek + Genel kültür ağırlıklı — soru bankası ile hız geliştir.',
    tipEn: 'General aptitude + General knowledge heavy — develop speed with question banks.',
  },
  {
    id: 'oabt',
    displayName: 'ÖABT — Öğretmenlik Alan Bilgisi',
    shortName: 'ÖABT',
    aliases: ['öabt', 'oabt', 'ogretmenlik', 'öğretmenlik', 'alanbilgisi', 'kpssalan', 'alantesti'],
    category: 'public',
    defaultDailyMinutes: 120,
    preferredTemplates: ['spaced-repetition', 'active-recall', 'deep-work', 'sprint'],
    tipTr: 'Alan bilgisi + pedagoji iç içe — önce alan, sonra eğitim bilimleri stratejisi önerilir.',
    tipEn: 'Subject knowledge + pedagogy combined — tackle subject area first, then education sciences.',
  },
  {
    id: 'aof',
    displayName: 'AÖF / Açıköğretim Sınavı',
    shortName: 'AÖF',
    aliases: ['aof', 'aöf', 'acikogretim', 'açıköğretim', 'auzef', 'uzaktan'],
    category: 'university',
    defaultDailyMinutes: 60,
    preferredTemplates: ['spaced-repetition', 'active-recall', 'sprint'],
    tipTr: 'Çoktan seçmeli, ders bazlı sınav — ders başına en az 3 deneme testi çöz.',
    tipEn: 'Multiple choice per course — solve at least 3 practice tests per subject.',
  },
  {
    id: 'pte',
    displayName: 'PTE Academic',
    shortName: 'PTE',
    aliases: ['pte', 'ptea', 'pearson', 'pearsontest'],
    category: 'language',
    defaultDailyMinutes: 90,
    preferredTemplates: ['active-recall', 'spaced-repetition', 'deep-work'],
    tipTr: 'Yapay zeka puanlıyor — konuşma ve yazma pratiğinde tutarlılık ve telaffuz kritik.',
    tipEn: 'AI-scored — consistency and pronunciation in speaking and writing are critical.',
  },
  {
    id: 'bilsem',
    displayName: 'BİLSEM Seçme Sınavı',
    shortName: 'BİLSEM',
    aliases: ['bilsem', 'bilisem', 'zekasinavi', 'zekasınavi', 'üstünyetenekli', 'ustun'],
    category: 'highschool',
    defaultDailyMinutes: 45,
    preferredTemplates: ['active-recall', 'deep-work'],
    tipTr: 'Zeka ve yetenek ağırlıklı — soru tipi pratiği ve sözel/sayısal denge kritik.',
    tipEn: 'Intelligence and aptitude focused — question type practice and verbal/numerical balance matter.',
  },
];

// Normalize string: lowercase + remove Turkish special chars + punctuation
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g')
    .replace(/ü/g, 'u').replace(/ö/g, 'o')
    .replace(/ı/g, 'i').replace(/İ/g, 'i').replace(/I(?=[a-z])/g, 'i')
    .replace(/[\s\-\.\/\+_,;:]/g, '');
}

export function matchExamName(input: string): ExamPreset[] {
  const q = norm(input);
  if (q.length < 2) return [];

  const scored: Array<[ExamPreset, number]> = [];

  for (const preset of EXAM_PRESETS) {
    let best = 0;
    for (const alias of preset.aliases) {
      const a = norm(alias);
      if (a === q) { best = Math.max(best, 100); break; }
      if (a.startsWith(q)) best = Math.max(best, 80);
      else if (a.includes(q)) best = Math.max(best, 50);
    }
    if (best === 0 && norm(preset.displayName).includes(q)) best = 30;
    if (best > 0) scored.push([preset, best]);
  }

  return scored
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([p]) => p);
}

// Returns a preset only when input is an exact alias match (e.g. "kpss", "KPSS", "KpSs").
// Partial inputs ("kp", "kps") return null → suggestions dropdown stays visible.
export function detectExamFromInput(input: string): ExamPreset | null {
  const q = norm(input);
  if (q.length < 2) return null;
  for (const preset of EXAM_PRESETS) {
    if (preset.aliases.some(a => norm(a) === q)) return preset;
  }
  return null;
}

/**
 * Eğitim uzmanı fazlama modeli:
 *
 * Faz 1 — Temel İnşa     (270-540 gün): Kavramsal anlama, müfredat tarama, diagnostik
 * Faz 2 — Derinleşme     (120-270 gün): İçerik hakimiyeti, aralıklı tekrar, kart sistemi
 * Faz 3 — Pekiştirme      (60-120 gün): Aktif geri çağırma, soru bankası, zayıf alan tespiti
 * Faz 4 — Hızlanma         (30-60 gün): Mock sınavlar + hata analizi, güçlendirme
 * Faz 5 — Son Sprint         (0-30 gün): Yeni konu yok, sadece tekrar ve deneme
 */
// Eğitim uzmanı faz modelinin tek kaynağı — hem şablon önerisi hem günlük motor bunu kullanır.
export type StudyPhase = 'foundation' | 'deepen' | 'reinforce' | 'accelerate' | 'sprint';

export function getPhase(daysLeft: number): StudyPhase {
  if (daysLeft <= 30) return 'sprint';      // Faz 5 — Son Sprint
  if (daysLeft <= 60) return 'accelerate';  // Faz 4 — Hızlanma
  if (daysLeft <= 120) return 'reinforce';  // Faz 3 — Pekiştirme
  if (daysLeft <= 270) return 'deepen';     // Faz 2 — Derinleşme
  return 'foundation';                       // Faz 1 — Temel İnşa
}

export function recommendTemplateId(
  daysLeft: number,
  category: ExamCategory,
  preferredTemplates: string[],
  dailyMinutes: number
): string {
  const langOrMedical = category === 'language' || category === 'medical';
  switch (getPhase(daysLeft)) {
    case 'sprint':     return 'sprint';
    case 'accelerate': return 'active-recall';
    case 'reinforce':  return langOrMedical ? 'spaced-repetition' : 'active-recall';
    case 'deepen':     return langOrMedical ? 'spaced-repetition' : (dailyMinutes >= 120 ? 'deep-work' : 'spaced-repetition');
    case 'foundation': return 'foundation';
  }
}

export const HOURS_OPTIONS: Array<{ labelTr: string; labelEn: string; minutes: number }> = [
  { labelTr: '30–60 dk', labelEn: '30–60 min', minutes: 45 },
  { labelTr: '1–2 saat', labelEn: '1–2 hrs', minutes: 90 },
  { labelTr: '2–3 saat', labelEn: '2–3 hrs', minutes: 150 },
  { labelTr: '3+ saat', labelEn: '3+ hrs', minutes: 210 },
];

export const TEMPLATE_DISPLAY: Record<string, { emoji: string; nameTr: string; nameEn: string; basisTr: string; basisEn: string }> = {
  'foundation': {
    emoji: '🏗️',
    nameTr: 'Temel İnşa',
    nameEn: 'Foundation Build',
    basisTr: 'Bloom taksonomisi — kavramsal anlama ezberden önce gelir',
    basisEn: 'Bloom\'s taxonomy — conceptual understanding before memorization',
  },
  'active-recall': {
    emoji: '🧪',
    nameTr: 'Aktif Geri Çağırma',
    nameEn: 'Active Recall',
    basisTr: 'Roediger & Karpicke — test etkisi',
    basisEn: 'Roediger & Karpicke — testing effect',
  },
  'spaced-repetition': {
    emoji: '🗂️',
    nameTr: 'Aralıklı Tekrar',
    nameEn: 'Spaced Repetition',
    basisTr: 'Ebbinghaus — unutma eğrisi',
    basisEn: 'Ebbinghaus — forgetting curve',
  },
  'deep-work': {
    emoji: '🔒',
    nameTr: 'Derin Çalışma',
    nameEn: 'Deep Work',
    basisTr: 'Cal Newport — odak kalitesi',
    basisEn: 'Cal Newport — quality of focus',
  },
  'sprint': {
    emoji: '⚡',
    nameTr: 'Son Sprint',
    nameEn: 'Exam Sprint',
    basisTr: 'Distributed practice — yoğunlaştırılmış tekrar',
    basisEn: 'Distributed practice — intensified review',
  },
};
