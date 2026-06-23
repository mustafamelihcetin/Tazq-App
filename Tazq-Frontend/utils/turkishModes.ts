export type ModeType = 'ramazan' | 'yks' | 'kpss' | 'exam' | 'tez' | 'mulakat' | 'spor';

export interface ModeHabit {
  name: string;
  nameTr: string;
  emoji: string;
  color: string;
}

export interface ModeTask {
  titleTr: string;
  titleEn: string;
  priority: 'High' | 'Medium' | 'Low';
  tags?: string[];
  daysFromNow?: number; // gün 0 = bugün, 7 = 1 hafta sonra, vs.
}

export interface StudyTemplate {
  id: string;
  titleTr: string;
  titleEn: string;
  descTr: string;
  descEn: string;
  targetTr: string;
  targetEn: string;
  emoji: string;
  dailyGoalMinutes: number;
  habits: ModeHabit[];
  tasks: ModeTask[];
}

export interface TurkishMode {
  type: ModeType;
  labelTr: string;
  labelEn: string;
  subtitleTr: string;
  subtitleEn: string;
  emoji: string;
  daysLeft: number;
  habits: ModeHabit[];
  tasks: ModeTask[];
  templates?: StudyTemplate[];
  tipTr?: string;
  tipEn?: string;
}

// ── Date ranges ──────────────────────────────────────────────────────────────

export const RAMAZAN: { start: string; end: string }[] = [
  { start: '2025-03-01', end: '2025-03-30' },
  { start: '2026-02-18', end: '2026-03-19' },
  { start: '2027-02-07', end: '2027-03-08' },
  { start: '2028-01-28', end: '2028-02-25' },
];

const YKS: { start: string; end: string }[] = [
  { start: '2025-06-14', end: '2025-06-15' },
  { start: '2026-06-13', end: '2026-06-14' },
  { start: '2027-06-12', end: '2027-06-13' },
];

const KPSS: { start: string; end: string }[] = [
  { start: '2025-10-26', end: '2025-10-26' },
  { start: '2026-10-25', end: '2026-10-25' },
  { start: '2027-10-24', end: '2027-10-24' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysUntilEnd(endStr: string): number {
  const end = new Date(endStr);
  end.setHours(23, 59, 59, 999);
  return Math.ceil((end.getTime() - Date.now()) / 86400000);
}

// Kaç gün kaldığını ve tarihin geçip geçmediğini döner
function daysLeftInfo(dateStr: string): { days: number; isPast: boolean; isToday: boolean } {
  const end = new Date(dateStr);
  end.setHours(23, 59, 59, 999);
  const diff = Math.ceil((end.getTime() - Date.now()) / 86400000);
  const isPast = diff < 0;
  const isToday = diff === 0;
  return { days: Math.max(0, diff), isPast, isToday };
}

function modeSubtitle(
  dateStr: string,
  tr: { future: string; today: string; past: string },
  en: { future: string; today: string; past: string },
): { tr: string; en: string } {
  const { days, isPast, isToday } = daysLeftInfo(dateStr);
  if (isPast) return { tr: tr.past, en: en.past };
  if (isToday) return { tr: tr.today, en: en.today };
  return {
    tr: tr.future.replace('{days}', String(days)),
    en: en.future.replace('{days}', String(days)),
  };
}

function isActive(start: string, end: string, leadDays = 0): number {
  const s = new Date(start);
  s.setDate(s.getDate() - leadDays);
  s.setHours(0, 0, 0, 0);
  const e = new Date(end);
  e.setHours(23, 59, 59, 999);
  const now = Date.now();
  if (now >= s.getTime() && now <= e.getTime()) return daysUntilEnd(end);
  return -1;
}

// ── Study templates ───────────────────────────────────────────────────────────

// Kanıt: Roediger & Karpicke (2006) — retrieval practice, pasif okumadan %40-50 daha etkili
const TEMPLATE_ACTIVE_RECALL = (examName = 'Sınav'): StudyTemplate => ({
  id: 'active-recall',
  titleTr: 'Aktif Geri Çağırma',
  titleEn: 'Active Recall',
  descTr: 'Oku değil, sorgula. Her oturumda kendini test ederek öğren.',
  descEn: 'Don\'t just read — test yourself. Learn by retrieving, not reviewing.',
  targetTr: 'Çoktan seçmeli sınavlar · Olgusal bilgi',
  targetEn: 'Multiple choice · Fact-heavy exams',
  emoji: '🧪',
  dailyGoalMinutes: 90,
  habits: [
    { name: 'Günlük Soru Çözümü', nameTr: 'Günlük Soru Çözümü', emoji: '📝', color: '#3B82F6' },
    { name: 'Hata Defteri', nameTr: 'Hata Defteri', emoji: '❌', color: '#EF4444' },
    { name: 'Konu Mini Testi', nameTr: 'Konu Mini Testi', emoji: '🎯', color: '#10B981' },
  ],
  tasks: [
    { titleTr: `${examName} için soru bankası bul veya satın al`, titleEn: `Get a question bank for ${examName}`, priority: 'High' },
    { titleTr: 'Hata defteri oluştur (fiziksel veya Notion)', titleEn: 'Create error log (physical or Notion)', priority: 'High' },
    { titleTr: 'İlk tarama denemesini çöz ve zayıfları belirle', titleEn: 'Solve a diagnostic test and identify weak areas', priority: 'High' },
    { titleTr: 'Günlük soru hedefini belirle (en az 30 soru)', titleEn: 'Set daily question target (min 30 questions)', priority: 'Medium' },
  ],
});

// Kanıt: Ebbinghaus Forgetting Curve (1885) + Anki SM-2 algoritması — uzun vadeli hafıza için en bilimsel yöntem
const TEMPLATE_SPACED_REPETITION = (examName = 'Sınav'): StudyTemplate => ({
  id: 'spaced-repetition',
  titleTr: 'Aralıklı Tekrar',
  titleEn: 'Spaced Repetition',
  descTr: 'Unutmadan hemen önce tekrar et. Aralıkları artırarak kalıcı hafıza oluştur.',
  descEn: 'Review just before you forget. Space repetitions to build lasting memory.',
  targetTr: 'Tıp · Hukuk · Dil sınavları · Tarih ağırlıklı',
  targetEn: 'Medicine · Law · Language · History-heavy exams',
  emoji: '🗂️',
  dailyGoalMinutes: 60,
  habits: [
    { name: 'Kart Tekrarı', nameTr: 'Kart Tekrarı', emoji: '🔄', color: '#6366F1' },
    { name: 'Yeni Kart Ekleme', nameTr: 'Yeni Kart Ekleme', emoji: '➕', color: '#8B5CF6' },
    { name: 'Konu Özeti Yazma', nameTr: 'Konu Özeti Yazma', emoji: '✍️', color: '#EC4899' },
  ],
  tasks: [
    { titleTr: 'Anki veya Quizlet kur ve ilk desteyi oluştur', titleEn: 'Set up Anki or Quizlet and create first deck', priority: 'High' },
    { titleTr: `${examName} konu listesini kartlara böl`, titleEn: `Break ${examName} syllabus into card topics`, priority: 'High' },
    { titleTr: '7 günlük tekrar takvimi oluştur', titleEn: 'Create 7-day review schedule', priority: 'Medium' },
    { titleTr: 'İlk 50 kartı bugün oluştur', titleEn: 'Create the first 50 cards today', priority: 'Medium' },
  ],
});

// Kanıt: Cal Newport "Deep Work" (2016) + Pomodoro Tekniği (Cirillo) — dikkat kalitesi, miktardan önemlidir
const TEMPLATE_DEEP_WORK = (examName = 'Sınav'): StudyTemplate => ({
  id: 'deep-work',
  titleTr: 'Derin Çalışma',
  titleEn: 'Deep Work',
  descTr: 'Bloklara ayrılmış, derin odak seansları. Dikkat kalitesi miktardan önemlidir.',
  descEn: 'Blocked, distraction-free focus sessions. Quality of attention beats quantity.',
  targetTr: 'Yazılı sınavlar · Proje tabanlı · Kapsamlı konular',
  targetEn: 'Written exams · Project-based · Broad curriculum',
  emoji: '🔒',
  dailyGoalMinutes: 120,
  habits: [
    { name: 'Sabah Odak Bloğu', nameTr: 'Sabah Odak Bloğu', emoji: '🌅', color: '#F59E0B' },
    { name: 'Öğleden Sonra Bloğu', nameTr: 'Öğleden Sonra Bloğu', emoji: '☀️', color: '#3B82F6' },
    { name: 'Günlük 3 Hedef', nameTr: 'Günlük 3 Hedef', emoji: '📋', color: '#10B981' },
  ],
  tasks: [
    { titleTr: 'Çalışma alanını düzenle — telefon başka odada', titleEn: 'Set up study space — phone in another room', priority: 'High' },
    { titleTr: `${examName} için haftalık konu planı oluştur`, titleEn: `Create weekly topic plan for ${examName}`, priority: 'High' },
    { titleTr: 'Sabah bloğu için alarm kur (en geç 08:00)', titleEn: 'Set alarm for morning block (by 08:00)', priority: 'Medium' },
    { titleTr: 'Site engelleyici (Cold Turkey vb.) kur', titleEn: 'Install site blocker (Cold Turkey etc.)', priority: 'Low' },
  ],
});

// Kanıt: Distributed practice + retrieval practice kombinasyonu — sınava yakın en etkili strateji
const TEMPLATE_SPRINT = (examName = 'Sınav'): StudyTemplate => ({
  id: 'sprint',
  titleTr: 'Son Sprint',
  titleEn: 'Exam Sprint',
  descTr: 'Yeni konu öğrenme yok. Sadece deneme, hata analizi ve güçlendirme.',
  descEn: 'No new topics. Only mock exams, error analysis, and reinforcement.',
  targetTr: '60 günden az kaldı · Maksimum verim modu',
  targetEn: 'Less than 60 days left · Max performance mode',
  emoji: '⚡',
  dailyGoalMinutes: 180,
  habits: [
    { name: 'Sabah Denemesi', nameTr: 'Sabah Denemesi', emoji: '📊', color: '#EF4444' },
    { name: 'Hata Analizi', nameTr: 'Hata Analizi', emoji: '🔍', color: '#F59E0B' },
    { name: 'Akşam Tekrarı', nameTr: 'Akşam Tekrarı', emoji: '🌙', color: '#6366F1' },
  ],
  tasks: [
    { titleTr: 'Mock sınav takvimini oluştur: hangi günler deneme, hangi günler hata analizi', titleEn: 'Build mock exam schedule: which days for tests, which for error analysis', priority: 'High' },
    { titleTr: 'En zayıf 5 konuyu listele ve her birine bu haftadan başlayarak gün ata', titleEn: 'List 5 weakest topics and assign each a day starting this week', priority: 'High' },
    { titleTr: 'Bir önceki denemeni çıkar: hangi sorular gitti, hangi konular tekrar lazım', titleEn: 'Review your last mock: which questions failed, which topics need review', priority: 'High' },
    { titleTr: 'Son haftayı sadece tekrara ayır — o haftadan itibaren yeni konu açma', titleEn: 'Designate final week as review-only — no new topics after that point', priority: 'Medium' },
  ],
});

// Kanıt: Bloom's taxonomy — bilgi inşası kavramsal anlayışla başlamalıdır (uzun vadeli sınav hazırlığı)
const TEMPLATE_FOUNDATION = (examName = 'Sınav'): StudyTemplate => ({
  id: 'foundation',
  titleTr: 'Temel İnşa',
  titleEn: 'Foundation Build',
  descTr: 'Ezber değil, anlama. Uzun vadeli sınav için kavramsal zemin şimdi atılır — üstüne her şey inşa edilecek.',
  descEn: 'Understanding over memorization. The conceptual foundation for a long-term exam is laid now — everything else builds on this.',
  targetTr: '270+ gün kaldı · Temelden başlamak · Uzun vadeli program',
  targetEn: '270+ days left · Starting from the ground · Long-term plan',
  emoji: '🏗️',
  dailyGoalMinutes: 60,
  habits: [
    { name: 'Konu Okuma', nameTr: 'Günlük Konu Okuma', emoji: '📖', color: '#3B82F6' },
    { name: 'Kavram Haritası', nameTr: 'Kavram Haritası Çıkarma', emoji: '🗺️', color: '#8B5CF6' },
    { name: 'Temel Soru Çözümü', nameTr: 'Temel Soru Çözümü', emoji: '✏️', color: '#10B981' },
  ],
  tasks: [
    { titleTr: `${examName} müfredatını listele ve konulara böl`, titleEn: `List ${examName} syllabus and break it into topics`, priority: 'High' },
    { titleTr: 'Kaynak kitapları belirle (en fazla 2-3 kaynak)', titleEn: 'Choose study books (2-3 sources max)', priority: 'High' },
    { titleTr: 'Aylık konu takvimi oluştur — acele etme', titleEn: 'Create monthly topic calendar — no rush', priority: 'High' },
    { titleTr: 'Teşhis denemesi çöz, zayıf alanları işaretle', titleEn: 'Take a diagnostic test, mark weak areas', priority: 'Medium' },
  ],
});

// Kanıt: Oruçluyken bilişsel yorgunluk gece azalır; Ramadan productivity research (Afandi et al., 2020)
const TEMPLATE_RAMAZAN_GECE: StudyTemplate = {
  id: 'ramazan-gece',
  titleTr: 'Gece Odağı',
  titleEn: 'Night Focus',
  descTr: 'Teravih sonrası zihin taze, ev sessiz. İbadet ve üretkenliği dengeleyen karma bir rutin — hem huzur hem ilerleme.',
  descEn: 'Mind is fresh after Tarawih, house is quiet. A balanced routine blending worship and productivity — peace and progress together.',
  targetTr: '🌙 Teravih kılıyor · Gece uyuyor · Gündüz odaklanmakta zorlananlar',
  targetEn: '🌙 Prays Tarawih · Sleeps at night · Struggles to focus during the day',
  emoji: '🌙',
  dailyGoalMinutes: 60,
  habits: [
    { name: 'Teravih Namazı', nameTr: 'Teravih Namazı', emoji: '🤲', color: '#6366F1' },
    { name: 'Teravih Sonrası Çalışma', nameTr: 'Teravih Sonrası Çalışma', emoji: '📚', color: '#8B5CF6' },
    { name: 'Gece Kuran Okuma', nameTr: 'Gece Kuran Okuma', emoji: '📖', color: '#10B981' },
    { name: 'Şükür Günlüğü', nameTr: 'Şükür Günlüğü', emoji: '🙏', color: '#EC4899' },
  ],
  tasks: [
    { titleTr: 'Gece çalışma alanını hazırla: masa, lamba, su, telefon sessiz modda', titleEn: 'Set up night study space: desk, lamp, water, phone on silent', priority: 'High' },
    { titleTr: 'Bu akşam teravih saatini öğren ve bittikten sonraki 60 dk\'lık çalışma bloğunu takvine ekle', titleEn: "Find tonight's Tarawih time and block 60 min after it in your calendar", priority: 'High' },
    { titleTr: '3 ibadet + 3 dünya hedefi yaz ve çalışma alanına as', titleEn: 'Write 3 spiritual + 3 worldly goals and post them in your study area', priority: 'Medium' },
  ],
};

// Kanıt: Kahve etkisi + uyku araştırmaları — sahurdan sonra 1 saat içinde zihin en tazedir
const TEMPLATE_RAMAZAN_SABAH: StudyTemplate = {
  id: 'ramazan-sabah',
  titleTr: 'Sahur Bereketi',
  titleEn: 'Suhoor Blessing',
  descTr: 'Sahur bereketi sadece ruhani değil — taze zihinle ders ya da işe başlamak için de en doğal vakit. Gün ilerledikçe ibadet ritmi alışkanlığı destekler.',
  descEn: 'Suhoor blessing isn\'t only spiritual — it\'s the most natural time to start studying or working with a fresh mind. Daily worship rhythm reinforces the habit.',
  targetTr: '🌅 Erken uyuyor · Sabah çalışmayı seviyor · Oruç + verimlilik dengesini arıyor',
  targetEn: '🌅 Early sleeper · Loves morning work · Seeking balance between fasting and productivity',
  emoji: '🌅',
  dailyGoalMinutes: 45,
  habits: [
    { name: 'Sahur Uyanışı', nameTr: 'Sahur Uyanışı', emoji: '⏰', color: '#F59E0B' },
    { name: 'Sahur Sonrası Çalışma', nameTr: 'Sahur Sonrası Çalışma', emoji: '📚', color: '#3B82F6' },
    { name: 'Dua & Zikir', nameTr: 'Dua & Zikir', emoji: '☪️', color: '#6366F1' },
    { name: 'İftar Hazırlığı', nameTr: 'İftar Hazırlığı', emoji: '🍽️', color: '#10B981' },
  ],
  tasks: [
    { titleTr: 'Sahur alarmını kur (çalışma için 30 dk erken)', titleEn: 'Set Suhoor alarm (30 min early for study)', priority: 'High' },
    { titleTr: 'Sahur masasına çalışma materyalini hazırla', titleEn: 'Prepare study material on Suhoor table', priority: 'Medium' },
    { titleTr: 'Günlük niyet kartı yaz (1 ibadet + 1 dünya hedefi)', titleEn: 'Write daily intention card (1 spiritual + 1 worldly)', priority: 'Medium' },
  ],
};

// Default habits/tasks for modes that don't use template selection
const RAMAZAN_DEFAULT_HABITS: ModeHabit[] = [
  { name: 'Teravih Namazı', nameTr: 'Teravih Namazı', emoji: '🤲', color: '#6366F1' },
  { name: 'Kuran Okuma', nameTr: 'Kuran Okuma', emoji: '📖', color: '#8B5CF6' },
  { name: 'Sahur Uyanışı', nameTr: 'Sahur Uyanışı', emoji: '⏰', color: '#F59E0B' },
  { name: 'Dua & Zikir', nameTr: 'Dua & Zikir', emoji: '☪️', color: '#10B981' },
];

const RAMAZAN_DEFAULT_TASKS: ModeTask[] = [
  { titleTr: 'Zekat hesapla ve öde', titleEn: 'Calculate and pay Zakat', priority: 'High' },
  { titleTr: 'Bu hafta için iftar menüsü hazırla: 3 ana yemek + sahur listesi yap', titleEn: 'Plan this week\'s iftar menu: 3 main dishes + suhoor shopping list', priority: 'Medium' },
  { titleTr: '3 ibadet + 3 dünya hedefi yaz ve görünür bir yere as (telefon kilidi veya duvar)', titleEn: 'Write 3 spiritual + 3 worldly goals and put them somewhere visible (phone lock screen or wall)', priority: 'Medium' },
];

// ── Mode definitions ───────────────────────────────────────────────────────────

const RAMAZAN_MODE = (days: number): TurkishMode => ({
  type: 'ramazan',
  labelTr: 'Ramazan Modu',
  labelEn: 'Ramadan Mode',
  subtitleTr: `${days} gün kaldı · Rutinini seç`,
  subtitleEn: `${days} days left · Choose your routine`,
  emoji: '🌙',
  daysLeft: days,
  habits: RAMAZAN_DEFAULT_HABITS,
  tasks: RAMAZAN_DEFAULT_TASKS,
  templates: [TEMPLATE_RAMAZAN_GECE, TEMPLATE_RAMAZAN_SABAH],
});

const YKS_MODE = (days: number): TurkishMode => ({
  type: 'yks',
  labelTr: 'YKS Modu',
  labelEn: 'YKS Mode',
  subtitleTr: `${days} gün kaldı · Çalışma planını seç`,
  subtitleEn: `${days} days left · Choose your study plan`,
  emoji: '📚',
  daysLeft: days,
  habits: [],
  tasks: [],
  templates: [
    TEMPLATE_FOUNDATION('YKS'),
    TEMPLATE_ACTIVE_RECALL('YKS'),
    TEMPLATE_SPACED_REPETITION('YKS'),
    TEMPLATE_DEEP_WORK('YKS'),
    TEMPLATE_SPRINT('YKS'),
  ],
});

const KPSS_MODE = (days: number): TurkishMode => ({
  type: 'kpss',
  labelTr: 'KPSS Modu',
  labelEn: 'KPSS Mode',
  subtitleTr: `${days} gün kaldı · Çalışma planını seç`,
  subtitleEn: `${days} days left · Choose your study plan`,
  emoji: '🏛️',
  daysLeft: days,
  habits: [],
  tasks: [],
  templates: [
    TEMPLATE_FOUNDATION('KPSS'),
    TEMPLATE_ACTIVE_RECALL('KPSS'),
    TEMPLATE_SPACED_REPETITION('KPSS'),
    TEMPLATE_DEEP_WORK('KPSS'),
    TEMPLATE_SPRINT('KPSS'),
  ],
});

// ── Tez / Proje templates ──────────────────────────────────────────────────────

const TEMPLATE_TEZ_WRITING = (projectName = 'Tez'): StudyTemplate => ({
  id: 'tez-writing',
  titleTr: 'Günlük Yazım',
  titleEn: 'Daily Writing',
  descTr: 'Her gün biraz yaz — 200 kelime bile olsa. Süreklilik kaliteyi getirir.',
  descEn: 'Write something every day — even 200 words. Consistency brings quality.',
  targetTr: 'Tez · Kitap · Uzun form akademik yazım',
  targetEn: 'Thesis · Book · Long-form academic writing',
  emoji: '✍️',
  dailyGoalMinutes: 120,
  habits: [
    { name: 'Günlük Yazım Oturumu', nameTr: 'Günlük Yazım Oturumu', emoji: '✍️', color: '#8B5CF6' },
    { name: 'Kaynak & Literatür Okuma', nameTr: 'Kaynak & Literatür Okuma', emoji: '📚', color: '#6366F1' },
    { name: 'Danışman İletişimi', nameTr: 'Danışman İletişimi', emoji: '🤝', color: '#10B981' },
  ],
  tasks: [
    { titleTr: `${projectName} için taslak outline oluştur`, titleEn: `Create rough outline for ${projectName}`, priority: 'High' },
    { titleTr: 'Kaynak yöneticisi kur (Zotero, Mendeley vb.)', titleEn: 'Set up reference manager (Zotero, Mendeley etc.)', priority: 'High' },
    { titleTr: 'Günlük yazım hedefini belirle ve bugün ilk 500 kelimeyi yaz', titleEn: 'Set daily writing target and write the first 500 words today', priority: 'Medium' },
    { titleTr: 'Danışmanına bu hafta e-posta gönder: ilerleme özeti + bir sonraki toplantı tarihi iste', titleEn: 'Email your advisor this week: progress update + request next meeting date', priority: 'Medium' },
  ],
});

const TEMPLATE_TEZ_MILESTONE = (projectName = 'Tez'): StudyTemplate => ({
  id: 'tez-milestone',
  titleTr: 'Milestone Odaklı',
  titleEn: 'Milestone-Driven',
  descTr: 'Büyük projeyi küçük milestonelarla yönet. Her tamamlama seni hedefe taşır.',
  descEn: 'Break the big project into milestones. Each completion moves you forward.',
  targetTr: 'Araştırma projeleri · Uzun vadeli çalışmalar',
  targetEn: 'Research projects · Long-term academic work',
  emoji: '🏁',
  dailyGoalMinutes: 90,
  habits: [
    { name: 'Araştırma / Veri Toplama', nameTr: 'Araştırma / Veri Toplama', emoji: '🔬', color: '#3B82F6' },
    { name: 'Yaratıcı Düşünme Bloğu', nameTr: 'Yaratıcı Düşünme Bloğu', emoji: '💡', color: '#F59E0B' },
    { name: 'Günlük İlerleme Notu', nameTr: 'Günlük İlerleme Notu', emoji: '📔', color: '#EC4899' },
  ],
  tasks: [
    { titleTr: `${projectName} için 3 aylık milestone planı oluştur`, titleEn: `Create 3-month milestone plan for ${projectName}`, priority: 'High' },
    { titleTr: 'Proje takip tahtası kur (Notion/Trello)', titleEn: 'Set up project tracking board (Notion/Trello)', priority: 'High' },
    { titleTr: 'Bu hafta tamamlanacak ilk milestone\'u tanımla ve bitiş tarihini takvine ekle', titleEn: 'Define the first milestone to complete this week and add its deadline to your calendar', priority: 'High' },
    { titleTr: 'Bugün 30 dk beyin fırtınası yap: araştırma sorusunu, ana argümanı ve 3 olası bölüm başlığını yaz', titleEn: 'Do a 30-min brainstorm today: write the research question, core argument, and 3 possible chapter titles', priority: 'Low' },
  ],
});

const TEMPLATE_TEZ_SOFTWARE = (projectName = 'Proje'): StudyTemplate => ({
  id: 'tez-software',
  titleTr: 'Yazılım / Teknik Proje',
  titleEn: 'Software / Technical Project',
  descTr: 'Sprint döngüleri, kod kalitesi ve teslim takibi. Geliştirme projelerini yönetmenin kanıtlanmış yolu.',
  descEn: 'Sprint cycles, code quality, and delivery tracking. The proven way to manage dev projects.',
  targetTr: 'Uygulama · API · Sistem geliştirme · Teknik proje',
  targetEn: 'App · API · System development · Technical project',
  emoji: '💻',
  dailyGoalMinutes: 120,
  habits: [
    { name: 'Günlük Kod', nameTr: 'Günlük kod yazımı / commit', emoji: '💻', color: '#3B82F6' },
    { name: 'Sprint Review', nameTr: 'Haftalık sprint review & planlama', emoji: '🔄', color: '#8B5CF6' },
    { name: 'Test', nameTr: 'Test yaz / çalıştır', emoji: '🧪', color: '#10B981' },
  ],
  tasks: [
    { titleTr: `${projectName} için kullanıcı hikayeleri (user stories) listesi oluştur`, titleEn: `Create user stories list for ${projectName}`, priority: 'High' },
    { titleTr: 'GitHub / GitLab repo kur, branching stratejisini belirle', titleEn: 'Set up GitHub / GitLab repo and define branching strategy', priority: 'High' },
    { titleTr: 'Bu hafta için MVP kapsamını tanımla: en basit çalışır halini listele (maksimum 3 özellik)', titleEn: 'Define MVP scope for this week: list the simplest working version (max 3 features)', priority: 'High' },
    { titleTr: 'CI/CD pipeline kur (GitHub Actions, Vercel vb.)', titleEn: 'Set up CI/CD pipeline (GitHub Actions, Vercel etc.)', priority: 'Medium' },
  ],
});

const TEMPLATE_TEZ_IS = (projectName = 'Proje'): StudyTemplate => ({
  id: 'tez-is',
  titleTr: 'İş / Strateji Projesi',
  titleEn: 'Business / Strategy Project',
  descTr: 'Paydaş yönetimi, çıktı takibi ve iş hedeflerine odaklı proje yönetimi.',
  descEn: 'Stakeholder management, output tracking, and business goal-driven project management.',
  targetTr: 'Raporlar · Strateji · Kurumsal proje · Sunum hazırlığı',
  targetEn: 'Reports · Strategy · Corporate project · Presentation prep',
  emoji: '📊',
  dailyGoalMinutes: 90,
  habits: [
    { name: 'Günlük İlerleme', nameTr: 'Günlük ilerleme notu ve çıktı kaydı', emoji: '📋', color: '#F59E0B' },
    { name: 'Paydaş İletişimi', nameTr: 'Paydaş güncelleme / e-posta / toplantı', emoji: '🤝', color: '#10B981' },
    { name: 'Risk Takibi', nameTr: 'Risk ve engel takibi', emoji: '⚠️', color: '#EF4444' },
  ],
  tasks: [
    { titleTr: `${projectName} için proje şartnamesi (scope) ve başarı kriterleri yaz`, titleEn: `Write project scope and success criteria for ${projectName}`, priority: 'High' },
    { titleTr: 'Paydaşları belirle ve iletişim planı oluştur', titleEn: 'Identify stakeholders and create a communication plan', priority: 'High' },
    { titleTr: 'Proje takip aracı kur (Jira, Notion, Trello vb.)', titleEn: 'Set up project tracking tool (Jira, Notion, Trello etc.)', priority: 'Medium' },
    { titleTr: 'Haftalık durum raporu şablonu hazırla', titleEn: 'Prepare a weekly status report template', priority: 'Medium' },
  ],
});

const TEMPLATE_TEZ_SPRINT = (projectName = 'Proje'): StudyTemplate => ({
  id: 'tez-sprint',
  titleTr: 'Son Sprint',
  titleEn: 'Final Sprint',
  descTr: 'Yeni içerik ekleme yok. Sadece yazım tamamlama, revizyon ve teslim hazırlığı. Kalite artık önceliktir.',
  descEn: 'No new content. Completing writing, revisions, and submission prep. Quality is the priority now.',
  targetTr: 'Teslime 60 gün kaldı · Revizyon · Son okuma · Format & teslim kontrolü',
  targetEn: '60 days to deadline · Revision · Proofreading · Format & submission check',
  emoji: '⚡',
  dailyGoalMinutes: 150,
  habits: [
    { name: 'Yazım Tamamlama', nameTr: 'Günlük yazım/revizyon bloğu (3+ saat)', emoji: '✍️', color: '#EF4444' },
    { name: 'Bölüm Revizyonu', nameTr: 'Bölüm revizyonu & danışman bildirimi', emoji: '🔍', color: '#F59E0B' },
    { name: 'Format Kontrolü', nameTr: 'Kaynakça & format standartları kontrolü', emoji: '📋', color: '#6366F1' },
  ],
  tasks: [
    { titleTr: `${projectName} tamamlama yüzdesini hesapla ve kalan bölümleri listele`, titleEn: `Calculate ${projectName} completion % and list remaining sections`, priority: 'High' },
    { titleTr: 'Danışmana son taslağı gönder — geri bildirim tarihi belirle', titleEn: 'Send final draft to advisor — set feedback deadline', priority: 'High' },
    { titleTr: 'Kaynakça ve atıf formatını kontrol et (APA/MLA/IEEE)', titleEn: 'Check references and citation format (APA/MLA/IEEE)', priority: 'High' },
    { titleTr: 'Teslim gereksinimlerini oku: format, sayfa sayısı, bağlama kuralları', titleEn: 'Read submission requirements: format, page count, binding rules', priority: 'Medium' },
  ],
});

function detectTezType(name: string): 'akademik' | 'yazilim' | 'is' {
  const upper = name.toUpperCase();
  const yazilimKeywords = ['UYGULAMA', 'APP', 'YAZILIM', 'SİSTEM', 'SISTEM', 'API', 'WEB', 'MOBİL', 'MOBIL', 'BACKEND', 'FRONTEND', 'DATABASE', 'PROJE', 'PROJECT', 'KOD', 'DEV', 'SOFTWARE'];
  const isKeywords = ['RAPOR', 'STRATEJİ', 'STRATEJİ', 'STRATEJI', 'İŞ', 'IS ', 'SUNUM', 'ANALIZ', 'ANALİZ', 'PAZARLAMA', 'YÖNETİM', 'YONETIM', 'KURUMSAL'];
  if (yazilimKeywords.some(k => upper.includes(k))) return 'yazilim';
  if (isKeywords.some(k => upper.includes(k))) return 'is';
  return 'akademik';
}

// ── İş Mülakatı templates ─────────────────────────────────────────────────────

const TEMPLATE_MULAKAT_TEKNIK = (company = 'Şirket'): StudyTemplate => ({
  id: 'mulakat-teknik',
  titleTr: 'Teknik Mülakat',
  titleEn: 'Technical Interview',
  descTr: 'Algoritma, sistem tasarımı ve gerçek kod pratiği. Teknik mülakatın formülü.',
  descEn: 'Algorithms, system design and real coding practice. The technical interview formula.',
  targetTr: 'Yazılım · Mühendislik · Data Science mülakatları',
  targetEn: 'Software · Engineering · Data Science interviews',
  emoji: '💻',
  dailyGoalMinutes: 90,
  habits: [
    { name: 'Günlük LeetCode / Algoritma', nameTr: 'Günlük LeetCode / Algoritma', emoji: '💻', color: '#10B981' },
    { name: 'Sistem Tasarımı Çalışması', nameTr: 'Sistem Tasarımı Çalışması', emoji: '🏗️', color: '#3B82F6' },
    { name: 'Mock Mülakat', nameTr: 'Mock Mülakat', emoji: '🎙️', color: '#8B5CF6' },
  ],
  tasks: [
    { titleTr: `${company} için araştır: son çeyrek haberlerini oku, iş ilanının her satırını analiz et, şirket değerlerini not al`, titleEn: `Research ${company}: read recent news, analyze every line of the job posting, note company values`, priority: 'High' },
    { titleTr: 'CV\'yi pozisyona göre güncelle: ilandaki anahtar kelimeleri CV\'ye yansıt', titleEn: 'Update CV for the position: reflect the job posting\'s keywords in your CV', priority: 'High' },
    { titleTr: 'En zayıf teknik konularını listele ve önceliklendir (veri yapıları, sistem tasarımı, dil temelleri)', titleEn: 'List and prioritize your weakest technical topics (data structures, system design, language basics)', priority: 'High' },
    { titleTr: 'Bu hafta 10 medium LeetCode çöz: Array ve String konularından başla', titleEn: 'Solve 10 medium LeetCode problems this week: start with Array and String topics', priority: 'Medium' },
  ],
});

const TEMPLATE_MULAKAT_BEHAVIORAL = (company = 'Şirket'): StudyTemplate => ({
  id: 'mulakat-behavioral',
  titleTr: 'Davranışsal Hazırlık',
  titleEn: 'Behavioral Prep',
  descTr: 'STAR metodu, öz tanıma ve şirket kültürüne uyum. Soft mülakatta öne geç.',
  descEn: 'STAR method, self-awareness and culture fit. Stand out in behavioral interviews.',
  targetTr: 'Yönetim · Danışmanlık · Kurumsal pozisyonlar',
  targetEn: 'Management · Consulting · Corporate positions',
  emoji: '🎯',
  dailyGoalMinutes: 60,
  habits: [
    { name: 'STAR Hikaye Pratiği', nameTr: 'STAR Hikaye Pratiği', emoji: '⭐', color: '#F59E0B' },
    { name: 'Özgüven / Ses Tonu Pratiği', nameTr: 'Özgüven / Ses Tonu Pratiği', emoji: '🎙️', color: '#10B981' },
    { name: 'Günlük Öz-Yansıma', nameTr: 'Günlük Öz-Yansıma', emoji: '🪞', color: '#EC4899' },
  ],
  tasks: [
    { titleTr: `${company} değerleri ve kültürünü oku`, titleEn: `Read ${company} values and culture`, priority: 'High' },
    { titleTr: '5 güçlü STAR hikayesi yaz', titleEn: 'Write 5 strong STAR stories', priority: 'High' },
    { titleTr: 'Sık sorulan davranışsal soruları listele', titleEn: 'List frequently asked behavioral questions', priority: 'Medium' },
    { titleTr: 'Aynaya bakarak 3 kez mock mülakat yap', titleEn: 'Do 3 mirror mock interviews', priority: 'Medium' },
  ],
});

const TEMPLATE_MULAKAT_CASE = (company = 'Şirket'): StudyTemplate => ({
  id: 'mulakat-case',
  titleTr: 'Case / Vaka Mülakatı',
  titleEn: 'Case Interview',
  descTr: 'Danışmanlık ve strateji pozisyonları için yapılandırılmış problem çözme. Framework + pratik.',
  descEn: 'Structured problem-solving for consulting and strategy roles. Framework + practice.',
  targetTr: 'McKinsey · BCG · Bain · Danışmanlık · Strateji · Finans pozisyonları',
  targetEn: 'McKinsey · BCG · Bain · Consulting · Strategy · Finance roles',
  emoji: '🧩',
  dailyGoalMinutes: 75,
  habits: [
    { name: 'Case Pratik', nameTr: 'Günlük case çözümü (1 case/gün)', emoji: '🧩', color: '#6366F1' },
    { name: 'Framework', nameTr: 'Framework ezber ve uygulama (MECE, Profitability)', emoji: '📐', color: '#3B82F6' },
    { name: 'Math Drill', nameTr: 'Mental math hız pratiği (10 dk)', emoji: '🔢', color: '#F59E0B' },
  ],
  tasks: [
    { titleTr: `${company} için şirket araştırması yap: değerler, son projeler, pazar pozisyonu`, titleEn: `Research ${company}: values, recent projects, market position`, priority: 'High' },
    { titleTr: 'Case kitabı edin: Case in Point veya Victor Cheng LOMS', titleEn: 'Get a case book: Case in Point or Victor Cheng LOMS', priority: 'High' },
    { titleTr: '5 temel framework\'ü öğren: Profitability, Market Entry, M&A, Operations, Pricing', titleEn: 'Learn 5 core frameworks: Profitability, Market Entry, M&A, Operations, Pricing', priority: 'High' },
    { titleTr: 'Peer ile 3 mock case çöz — ses kaydı al ve dinle', titleEn: 'Solve 3 mock cases with a peer — record and review', priority: 'Medium' },
  ],
});

const TEMPLATE_MULAKAT_AKADEMIK = (company = 'Kurum'): StudyTemplate => ({
  id: 'mulakat-akademik',
  titleTr: 'Akademik / Kurumsal Mülakat',
  titleEn: 'Academic / Institutional Interview',
  descTr: 'Araştırma sunumu, pedagoji soruları ve akademik kimlik. Üniversite ve araştırma pozisyonları için.',
  descEn: 'Research presentation, pedagogy questions, and academic identity. For university and research roles.',
  targetTr: 'Profesörlük · Araştırmacı · Doktora başvurusu · Kamu kurumları',
  targetEn: 'Professorship · Researcher · PhD application · Public institutions',
  emoji: '🎓',
  dailyGoalMinutes: 60,
  habits: [
    { name: 'Araştırma Özeti', nameTr: 'Araştırma özetini sesli anlat (3 dk)', emoji: '🔬', color: '#8B5CF6' },
    { name: 'Pedagoji', nameTr: 'Ders planı / öğretim felsefesi hazırlığı', emoji: '📚', color: '#3B82F6' },
    { name: 'Soru Pratiği', nameTr: 'Muhtemel soruları yüksek sesle yanıtla', emoji: '🎙️', color: '#10B981' },
  ],
  tasks: [
    { titleTr: `${company} araştırma önceliklerini ve yayınlarını incele`, titleEn: `Review ${company} research priorities and recent publications`, priority: 'High' },
    { titleTr: 'Araştırma özetini (research statement) 2 sayfada hazırla', titleEn: 'Prepare 2-page research statement', priority: 'High' },
    { titleTr: 'Job talk sunumunu hazırla: 45 dk + 15 dk soru bölümü', titleEn: 'Prepare job talk: 45 min presentation + 15 min Q&A', priority: 'High' },
    { titleTr: 'Öğretim felsefeni (teaching philosophy) 1 sayfada özetle', titleEn: 'Summarize your teaching philosophy in 1 page', priority: 'Medium' },
  ],
});

const TEMPLATE_MULAKAT_SPRINT = (company = 'Şirket'): StudyTemplate => ({
  id: 'mulakat-sprint',
  titleTr: 'Son Hafta Sprinti',
  titleEn: 'Final Week Sprint',
  descTr: 'Yeni konu öğrenme yok. Sadece mock mülakat, STAR hikayelerini pekiştirme ve zihinsel hazırlık.',
  descEn: 'No new studying. Only mock interviews, reinforcing STAR stories, and mental preparation.',
  targetTr: '7 günden az kaldı · Mock mülakat · Pekiştirme · Lojistik hazırlık',
  targetEn: 'Less than 7 days left · Mock interviews · Reinforcement · Logistics',
  emoji: '⚡',
  dailyGoalMinutes: 60,
  habits: [
    { name: 'Mock Mülakat', nameTr: 'Günlük mock mülakat (sesli/video)', emoji: '🎙️', color: '#EF4444' },
    { name: 'STAR Tekrar', nameTr: 'STAR hikayelerini sesli tekrar et', emoji: '⭐', color: '#F59E0B' },
    { name: 'Şirket Tarama', nameTr: 'Son dakika şirket/sektör haberleri', emoji: '🔍', color: '#10B981' },
  ],
  tasks: [
    { titleTr: `${company} için son dakika haber ve gelişmeleri tara`, titleEn: `Scan latest news and developments for ${company}`, priority: 'High' },
    { titleTr: 'En güçlü 3 STAR hikayeni sesli anlat ve zamanla', titleEn: 'Tell your 3 strongest STAR stories aloud and time them', priority: 'High' },
    { titleTr: 'En zor sorunu belirle ve cevabını bir kez daha hazırla', titleEn: 'Identify your hardest question and prep the answer one more time', priority: 'High' },
    { titleTr: 'Giysi, rota ve lojistik planını bugün tamamla — mülakat sabahını boşalt', titleEn: 'Plan outfit, route and logistics today — free up the interview morning', priority: 'Medium' },
  ],
});

function detectMulakatType(company: string): 'teknik' | 'case' | 'akademik' | 'behavioral' {
  const upper = company.toUpperCase();
  const caseKeywords = ['MCKINSEY', 'BCG', 'BAIN', 'DELOITTE', 'ACCENTURE', 'KPMG', 'PWC', 'EY', 'DANIŞMAN', 'CONSULTING', 'STRATEGY'];
  const akademikKeywords = ['ÜNİVERSİTE', 'UNIVERSITE', 'UNIVERSITY', 'COLLEGE', 'ARAŞTIRMA', 'ARASTIRMA', 'RESEARCH', 'AKADEMI', 'AKADEMİ', 'DOKTORA', 'PHD'];
  const teknikKeywords = ['GOOGLE', 'META', 'AMAZON', 'APPLE', 'MICROSOFT', 'NETFLIX', 'UBER', 'AIRBNB', 'TRENDYOL', 'GETIR', 'YAZILIM', 'SOFTWARE', 'TECH'];
  if (caseKeywords.some(k => upper.includes(k))) return 'case';
  if (akademikKeywords.some(k => upper.includes(k))) return 'akademik';
  if (teknikKeywords.some(k => upper.includes(k))) return 'teknik';
  return 'behavioral';
}

// ── Spor / Fiziksel Hedef ────────────────────────────────────────────────────

export interface SporInputs {
  currentWeight?: number;  // kg
  targetWeight?: number;   // kg
  weeklyKm?: number;       // mevcut haftalık km
  targetEvent?: string;    // '5K' | '10K' | 'Yarı' | 'Tam'
  trainingDays?: number;   // 3 | 4 | 5
  gender?: 'male' | 'female' | '';
}

export type SporType = 'kilo' | 'maraton' | 'guc' | 'genel' | 'yaris';

export function detectSporType(goalLabel: string): SporType {
  if (goalLabel.includes('Kilo') || goalLabel.includes('Weight')) return 'kilo';
  if (goalLabel.includes('Maraton') || goalLabel.includes('Marathon') || goalLabel.includes('Koşu') || goalLabel.includes('Running')) return 'maraton';
  if (goalLabel.includes('Güç') || goalLabel.includes('Strength') || goalLabel.includes('Kas') || goalLabel.includes('Muscle')) return 'guc';
  if (goalLabel.includes('Yarışma') || goalLabel.includes('Competition')) return 'yaris';
  return 'genel';
}

// Returns the split label for a given day count and day index (0-based Mon)
function splitDay(days: number, idx: number, lang: 'tr' | 'en'): string {
  const splits3 = lang === 'tr'
    ? ['Push (Göğüs·Omuz·Triceps)', 'Pull (Sırt·Biceps)', 'Legs (Bacak·Core)']
    : ['Push (Chest·Shoulders·Triceps)', 'Pull (Back·Biceps)', 'Legs (Legs·Core)'];
  const splits4 = lang === 'tr'
    ? ['Push', 'Pull', 'Legs', 'Üst Vücut']
    : ['Push', 'Pull', 'Legs', 'Upper Body'];
  const splits5 = lang === 'tr'
    ? ['Push', 'Pull', 'Legs', 'Push (hafif)', 'Pull (hafif)']
    : ['Push', 'Pull', 'Legs', 'Push (light)', 'Pull (light)'];
  const arr = days === 3 ? splits3 : days === 4 ? splits4 : splits5;
  return arr[idx % arr.length];
}

const GUN_TR = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const GUN_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Pick evenly-spaced training days given count, returns 0-based Monday indices
// Max 2 consecutive training days to allow muscle recovery
function pickTrainingDays(count: number): number[] {
  const options: Record<number, number[]> = {
    3: [0, 2, 4],     // Mon Wed Fri — 1 rest day between each
    4: [0, 1, 3, 4],  // Mon Tue | rest Wed | Thu Fri — 2+2 with midweek rest
    5: [0, 1, 3, 4, 6], // Mon Tue | rest Wed | Thu Fri | rest Sat | Sun — max 2 consecutive
  };
  return options[count] ?? options[3];
}

function buildKiloTemplate(inputs: SporInputs, days: number): StudyTemplate {
  const cw = inputs.currentWeight ?? 0;
  const tw = inputs.targetWeight ?? 0;
  const diff = Math.abs(cw - tw);
  const losing = tw < cw;
  const isFemale = inputs.gender === 'female';

  // Safe weekly rate: loss max 1 kg/week, gain max 0.5 kg/week
  const maxRate = losing ? 1.0 : 0.5;
  const defaultRate = losing ? 0.5 : 0.25;
  const weeks = Math.max(1, Math.round(days / 7));
  const rawRate = weeks > 0 ? Math.round((diff / weeks) * 10) / 10 : defaultRate;
  const safeRate = Math.min(rawRate, maxRate);
  const realWeeks = safeRate > 0 ? Math.ceil(diff / safeRate) : weeks;

  const cwStr = cw > 0 ? `${cw} kg` : '__ kg';
  const twStr = tw > 0 ? `${tw} kg` : '__ kg';
  const rateStr = safeRate > 0 ? `${safeRate} kg` : `${defaultRate} kg`;
  const weekStr = realWeeks > 0 ? `${realWeeks} haftada` : '';

  // Plan süresi kadar görev üret — cap yok, süre ne kadarsa o dolar
  const planWeeks = Math.max(1, Math.ceil(days / 7));

  // 2 haftada 1 tartı — haftalık tartı yorgunluk yaratır, çift haftalar yeterli
  const weighInTasks: ModeTask[] = Array.from({ length: Math.ceil(planWeeks / 2) }, (_, i) => {
    const w = (i + 1) * 2; // Hafta 2, 4, 6, 8...
    return {
      titleTr: i === 0
        ? `Hafta ${w} tartısı — sabah aç karna, başlangıç kilosunla kıyasla`
        : `Hafta ${w} tartısı — sabah aç karna`,
      titleEn: i === 0
        ? `Week ${w} weigh-in — fasted morning, compare with starting weight`
        : `Week ${w} weigh-in — fasted morning`,
      priority: 'High' as const,
      tags: ['weight_entry'],
      daysFromNow: w * 7,
    };
  });

  // Tek haftalarda (1, 3, 5...) faz bazlı alışkanlık/aktivite kontrolü
  const weeklyHabitChecks: ModeTask[] = Array.from({ length: Math.ceil((planWeeks - 1) / 2) }, (_, i) => {
    const w = (i + 1) * 2 - 1; // Hafta 1, 3, 5, 7...
    if (w === 1) return null as any; // Hafta 1 setup görevlerden geliyor
    const progress = w / planWeeks;
    if (losing) {
      if (progress < 0.3) return {
        titleTr: `Hafta ${w}: bu haftaki hareketliliği değerlendir — kaç gün aktif oldun?`,
        titleEn: `Week ${w}: review this week's activity — how many days were you active?`,
        priority: 'Medium' as const, daysFromNow: w * 7 + 2,
      };
      if (progress < 0.6) return {
        titleTr: `Hafta ${w}: porsiyon ve öğün saatlerini gözden geçir — plato var mı?`,
        titleEn: `Week ${w}: review portions and meal timing — hitting a plateau?`,
        priority: 'Medium' as const, daysFromNow: w * 7 + 2,
      };
      return {
        titleTr: `Hafta ${w}: son sprint — kalori açığını koru, antrenman yoğunluğunu artır`,
        titleEn: `Week ${w}: final sprint — maintain calorie deficit, increase workout intensity`,
        priority: 'High' as const, daysFromNow: w * 7 + 2,
      };
    } else {
      if (progress < 0.4) return {
        titleTr: `Hafta ${w}: antrenman günlüğüne bak — ağırlıklar artıyor mu?`,
        titleEn: `Week ${w}: check training log — are weights progressing?`,
        priority: 'Medium' as const, daysFromNow: w * 7 + 2,
      };
      return {
        titleTr: `Hafta ${w}: protein günlüğünü kontrol et — günlük hedefe ulaşıyor musun?`,
        titleEn: `Week ${w}: check protein log — hitting your daily target?`,
        priority: 'Medium' as const, daysFromNow: w * 7 + 2,
      };
    }
  }).filter(Boolean) as ModeTask[];

  // Aylık değerlendirme görevleri — her 4 haftada bir faz bazlı kontrol
  const monthlyChecks: ModeTask[] = Array.from({ length: Math.floor(planWeeks / 4) }, (_, i) => {
    const month = i + 1;
    const w = month * 4;
    const progress = w / planWeeks;
    const isLast = w >= planWeeks - 2;
    const isEarlyPhase = progress < 0.3;
    const isMidPhase = progress >= 0.3 && progress < 0.7;
    return {
      titleTr: isLast
        ? `Son aylık değerlendirme: ${cwStr} → ${twStr} hedefine ulaştın mı? Ölçüm al ve kaydet`
        : isEarlyPhase
        ? `Ay ${month} değerlendirmesi: tartı trendine bak — ortalama ${rateStr}/hafta mı? Rota doğru`
        : isMidPhase
        ? `Ay ${month} değerlendirmesi: rutinin tutarlı mı? Plato varsa kalori veya aktiviteyi gözden geçir`
        : `Ay ${month} son sprint: hedeften kaç kg uzakta? Son düzlemeyi planla`,
      titleEn: isLast
        ? `Final monthly review: did you reach your ${cwStr} → ${twStr} goal? Measure and record`
        : isEarlyPhase
        ? `Month ${month} review: check weight trend — averaging ${rateStr}/week? On track`
        : isMidPhase
        ? `Month ${month} review: is your routine consistent? If plateau, recalibrate calories or activity`
        : `Month ${month} final sprint: how many kg left? Plan the final stretch`,
      priority: (isLast ? 'High' : 'Medium') as 'High' | 'Medium',
      daysFromNow: w * 7 + 1,
    };
  });

  const lossSetupTasks: ModeTask[] = [
    {
      titleTr: `İlk antrenman: bugün 30 dk tempolu yürüyüş yap — nefes biraz zorlanmalı, konuşabilmeli`,
      titleEn: `First workout: 30 min brisk walk today — slightly breathless but able to talk`,
      priority: 'High',
      daysFromNow: 0,
    },
    {
      titleTr: `Mutfak düzenlemesi: şekerli içecek, beyaz ekmek ve paketli atıştırmalıkları kaldır`,
      titleEn: `Kitchen reset: remove sugary drinks, white bread and packaged snacks`,
      priority: 'High',
      daysFromNow: 0,
    },
    {
      titleTr: `Günlük protein hedefini belirle: ${cw > 0 ? Math.round(cw * (isFemale ? 1.4 : 1.6)) : (isFemale ? 90 : 100)}–${cw > 0 ? Math.round(cw * (isFemale ? 1.8 : 2.0)) : (isFemale ? 115 : 130)} g/gün`,
      titleEn: `Set daily protein target: ${cw > 0 ? Math.round(cw * (isFemale ? 1.4 : 1.6)) : (isFemale ? 90 : 100)}–${cw > 0 ? Math.round(cw * (isFemale ? 1.8 : 2.0)) : (isFemale ? 115 : 130)} g/day`,
      priority: 'Medium',
      daysFromNow: 1,
    },
    {
      titleTr: `Hedef: ${cwStr} → ${twStr} · ${planWeeks} haftada ${rateStr}/hafta — bugün planı kaydet`,
      titleEn: `Goal: ${cwStr} → ${twStr} · ${rateStr}/week for ${planWeeks} weeks — save the plan today`,
      priority: 'Medium',
      daysFromNow: 2,
    },
  ];

  const gainSetupTasks: ModeTask[] = [
    {
      titleTr: `Günlük kalori hedefini hesapla: TDEE + 300–500 kcal fazlası — myfitnesspal veya benzeri uygulama kullan`,
      titleEn: `Calculate daily calorie target: TDEE + 300–500 kcal surplus — use myfitnesspal or similar`,
      priority: 'High',
      daysFromNow: 0,
    },
    {
      titleTr: `Direnç antrenmanı programı seç ve ilk seansı yap (haftada 3–4 gün) — kas için antrenman zorunlu`,
      titleEn: `Choose a resistance training program and do first session (3–4 days/week) — training is mandatory for muscle`,
      priority: 'High',
      daysFromNow: 0,
    },
    {
      titleTr: `Günlük protein hedefi: ${cw > 0 ? Math.round(cw * (isFemale ? 1.6 : 1.8)) : (isFemale ? 105 : 120)}–${cw > 0 ? Math.round(cw * (isFemale ? 2.0 : 2.2)) : (isFemale ? 130 : 150)} g/gün — yumurta, tavuk, yoğurt, baklagil`,
      titleEn: `Daily protein target: ${cw > 0 ? Math.round(cw * (isFemale ? 1.6 : 1.8)) : (isFemale ? 105 : 120)}–${cw > 0 ? Math.round(cw * (isFemale ? 2.0 : 2.2)) : (isFemale ? 130 : 150)} g/day — eggs, chicken, yogurt, legumes`,
      priority: 'High',
      daysFromNow: 1,
    },
    {
      titleTr: `Hedef: ${cwStr} → ${twStr} · ${planWeeks} haftada ${rateStr}/hafta — bugün planı kaydet`,
      titleEn: `Goal: ${cwStr} → ${twStr} · ${rateStr}/week for ${planWeeks} weeks — save the plan today`,
      priority: 'Medium',
      daysFromNow: 2,
    },
  ];

  const lossTasks: ModeTask[] = [...lossSetupTasks, ...weighInTasks, ...weeklyHabitChecks, ...monthlyChecks];
  const gainTasks: ModeTask[] = [...gainSetupTasks, ...weighInTasks, ...weeklyHabitChecks, ...monthlyChecks];

  const lossHabits = [
    { name: 'Hareket', nameTr: 'Günlük hareket (yürüyüş / egzersiz)', emoji: '🚶', color: '#10B981' },
    { name: 'Öğün', nameTr: 'Öğünleri atlamama & porsiyon kontrolü', emoji: '🥗', color: '#F59E0B' },
    { name: 'Su', nameTr: 'Su tüketimi (günde 2–3 lt)', emoji: '💧', color: '#3B82F6' },
    { name: 'Uyku', nameTr: 'Düzenli uyku (7–9 saat)', emoji: '😴', color: '#8B5CF6' },
  ];

  const gainHabits = [
    { name: 'Antrenman', nameTr: 'Direnç antrenmanı (programdaki günler)', emoji: '🏋️', color: '#F97316' },
    { name: 'Protein', nameTr: 'Günlük protein hedefine ulaş', emoji: '🥩', color: '#EF4444' },
    { name: 'Kalori', nameTr: 'Kalori fazlası ile beslen (TDEE + 300-500)', emoji: '🍽️', color: '#F59E0B' },
    { name: 'Uyku', nameTr: 'Düzenli uyku (7–9 saat) — kas onarımı için kritik', emoji: '😴', color: '#8B5CF6' },
  ];

  return {
    id: 'spor-kilo',
    titleTr: losing ? 'Kilo Verme' : 'Kilo Alma',
    titleEn: losing ? 'Weight Loss' : 'Weight Gain',
    descTr: `${cwStr} → ${twStr} · Haftada ${rateStr} ${losing ? 'azalma' : 'artış'} · Sürdürülebilir tempo`,
    descEn: `${cwStr} → ${twStr} · ${rateStr}/week ${losing ? 'loss' : 'gain'} · Sustainable pace`,
    targetTr: losing
      ? `✓ Günlük hareket · Porsiyon farkındalığı · Haftalık tartı takibi`
      : `✓ Direnç antrenmanı · Yeterli protein · Kalori fazlası · Haftalık tartı`,
    targetEn: losing
      ? `✓ Daily movement · Portion awareness · Weekly weigh-in`
      : `✓ Resistance training · Adequate protein · Calorie surplus · Weekly weigh-in`,
    emoji: '⚖️',
    dailyGoalMinutes: 40,
    habits: losing ? lossHabits : gainHabits,
    tasks: losing ? lossTasks : gainTasks,
  };
}

// Realistic peak weekly km targets by event (for recreational runners)
const PEAK_WEEKLY_KM: Record<string, number> = { '5K': 30, '10K': 50, 'Yarı': 65, 'Tam': 80 };

function buildMaratonTemplate(inputs: SporInputs, days: number): StudyTemplate {
  const km = inputs.weeklyKm ?? 0;
  const event = inputs.targetEvent ?? '';
  const targetDistances: Record<string, number> = { '5K': 5, '10K': 10, 'Yarı': 21, 'Tam': 42 };
  const targetKm = targetDistances[event] ?? 21;
  const peakKm = PEAK_WEEKLY_KM[event] ?? 65;
  const kmStr = km > 0 ? `${km} km/hft` : '—';
  const weeks = Math.max(1, Math.round(days / 7));

  // Beginner starting long run by event (conservative, injury-safe)
  const BEGINNER_LONG_RUN: Record<string, number> = { '5K': 2, '10K': 3, 'Yarı': 5, 'Tam': 6 };
  const longRunKm = km > 0
    ? Math.min(Math.round(km * 0.4), Math.round(targetKm * 0.6))
    : (BEGINNER_LONG_RUN[event] ?? 5);
  const longRunStr = `${Math.max(1, longRunKm)} km`;

  // If already above peak, user doesn't need to increase — just maintain/taper
  const alreadyReady = km > 0 && km >= peakKm;
  // 10% rule with realistic cap — never exceed peakKm
  const projectedWeeklyKm = km > 0
    ? Math.min(peakKm, Math.round(km * Math.pow(1.1, Math.min(weeks, 16))))
    : Math.round(peakKm * 0.5);

  // Minimum safe training weeks by event
  const MIN_WEEKS: Record<string, number> = { '5K': 6, '10K': 8, 'Yarı': 12, 'Tam': 16 };
  const minWeeks = MIN_WEEKS[event] ?? 12;
  const tooShort = weeks < minWeeks && !alreadyReady;

  const tasks: ModeTask[] = alreadyReady
    ? [
        {
          titleTr: `Haftalık km bazın ${km} km — ${event} için yeterli! Taper haftasını planla`,
          titleEn: `Your weekly base of ${km} km is sufficient for ${event}! Plan your taper week`,
          priority: 'High',
        },
        {
          titleTr: `Taper planını bugün oluştur: önümüzdeki 3 haftanın km hedeflerini yaz (%80, %60, %40 azaltarak)`,
          titleEn: `Create your taper plan today: write the km targets for the next 3 weeks (reduce by 80%, 60%, 40%)`,
          priority: 'High',
        },
        {
          titleTr: `Yarış günü stratejisini belirle: pace hedefi, beslenme, giyim`,
          titleEn: `Set race day strategy: target pace, nutrition, gear`,
          priority: 'Medium',
        },
        {
          titleTr: `Koşu ayakkabısını kontrol et: taban aşınması varsa yeni çift al`,
          titleEn: `Check running shoes: replace if the sole is worn`,
          priority: 'Medium',
        },
      ]
    : [
        {
          titleTr: `Bu haftaki antrenman günlerini belirle: hafta içi 2 kısa koşu + Pazar uzun koşusu`,
          titleEn: `Set this week's training days: 2 short runs on weekdays + Sunday long run`,
          priority: 'High',
        },
        {
          titleTr: `Pazar uzun koşusu: ${longRunStr} ile başla, her hafta %10 artır (yaralanma önleme)`,
          titleEn: `Sunday long run: start at ${longRunStr}, increase 10% each week (injury prevention)`,
          priority: 'High',
        },
        {
          titleTr: `Koşu ayakkabısını kontrol et: taban aşınması varsa değiştir`,
          titleEn: `Check your running shoes: replace if the sole is worn`,
          priority: 'Medium',
        },
        {
          titleTr: `Koşu takip uygulaması kur (Strava / Garmin / Nike Run) ve bu haftaki ilk koşunu kaydet — hedef baz: ~${projectedWeeklyKm} km/hft`,
          titleEn: `Set up a running tracker (Strava / Garmin / Nike Run) and log this week's first run — target base: ~${projectedWeeklyKm} km/week`,
          priority: 'Medium',
        },
        ...(tooShort ? [{
          titleTr: `⚠️ Dikkat: ${event} için ideal hazırlık ${minWeeks} haftadır — tarihi uzatmayı düşün`,
          titleEn: `⚠️ Note: Ideal prep for ${event} is ${minWeeks} weeks — consider extending your date`,
          priority: 'High' as const,
          daysFromNow: 0,
        }] : []),
        // Haftalık ilerleme kontrolleri — tüm plan süresince
        ...Array.from({ length: weeks - 1 }, (_, i) => {
          const w = i + 2;
          const expectedKm = Math.min(peakKm, Math.round((km > 0 ? km : peakKm * 0.4) * Math.pow(1.1, w - 1)));
          const isTaper = w >= weeks - 2;
          return {
            titleTr: isTaper
              ? `Hafta ${w}: taper başlıyor — km'yi %20 azalt, dinlenmeye odaklan`
              : `Hafta ${w}: uzun koşu kontrolü — bu haftaki hedef ~${expectedKm} km/hft`,
            titleEn: isTaper
              ? `Week ${w}: taper begins — reduce km by 20%, focus on rest`
              : `Week ${w}: long run check — this week's target ~${expectedKm} km/week`,
            priority: (isTaper ? 'High' : 'Medium') as 'High' | 'Medium',
            daysFromNow: (w - 1) * 7 + 1,
          };
        }),
      ];

  return {
    id: 'spor-dayaniklilik',
    titleTr: `Dayanıklılık — ${event || 'Koşu'}`,
    titleEn: `Endurance — ${event || 'Running'}`,
    descTr: alreadyReady
      ? `${kmStr} baz km — ${event} için hazırsın. Artık taper ve yarış stratejisi.`
      : `${kmStr} bazından ${event} hedefine. %10 kuralıyla güvenli artış, yaralanma riskini minimumda tut.`,
    descEn: alreadyReady
      ? `Base ${kmStr} — ready for ${event}. Now it's taper and race strategy.`
      : `From ${kmStr} base to ${event} goal. Safe 10% weekly progression to minimize injury risk.`,
    targetTr: alreadyReady
      ? `✓ Taper · Yarış stratejisi · Dinlenme · Ekipman kontrolü`
      : `✓ Haftada 3 seans · Uzun koşu · Mobilite · Dinlenme günleri`,
    targetEn: alreadyReady
      ? `✓ Taper · Race strategy · Rest · Gear check`
      : `✓ 3 sessions/week · Long run · Mobility · Rest days`,
    emoji: '🏃',
    dailyGoalMinutes: 50,
    habits: [
      { name: 'Koşu', nameTr: 'Planlı koşu seansı', emoji: '🏃', color: '#EF4444' },
      { name: 'Mobilite', nameTr: 'Isınma + koşu sonrası esneme (10 dk)', emoji: '🧘', color: '#10B981' },
      { name: 'Hidrasyon', nameTr: 'Antrenman öncesi / sonrası sıvı alımı', emoji: '💧', color: '#3B82F6' },
      { name: 'Uyku', nameTr: 'Kaliteli uyku — kaslar geceleri onarılır', emoji: '😴', color: '#8B5CF6' },
    ],
    tasks,
  };
}

function buildGucTemplate(inputs: SporInputs, days: number, goalType: SporType): StudyTemplate {
  const d = inputs.trainingDays ?? 3;
  const indices = pickTrainingDays(d);
  const dayListTr = indices.map(i => GUN_TR[i]).join(' · ');
  const dayListEn = indices.map(i => GUN_EN[i]).join(' · ');
  const splitListTr = indices.map((_, i) => splitDay(d, i, 'tr')).join(' → ');
  const splitListEn = indices.map((_, i) => splitDay(d, i, 'en')).join(' → ');

  const isYaris = goalType === 'yaris';
  const isGenel = goalType === 'genel';

  // Yarışma için spor-agnostik görevler (güreş/yüzme/basketbol/futbol da olabilir)
  const yarisTasks: ModeTask[] = [
    {
      titleTr: `Yarışma takvimini araştır ve en yakın etkinliğe kayıt yaptır`,
      titleEn: `Research competition calendar and register for the nearest event`,
      priority: 'High',
    },
    {
      titleTr: `Antrenman günlerini takvime ekle: ${dayListTr}`,
      titleEn: `Add training days to calendar: ${dayListEn}`,
      priority: 'High',
    },
    {
      titleTr: `Geçen antrenmanlarında en çok zorlandığın anı düşün: o zayıf noktayı yaz ve bu hafta bir seans sadece ona ayır`,
      titleEn: `Think of your most struggled moment in recent training: write that weak point and dedicate one session to it this week`,
      priority: 'Medium',
    },
    {
      titleTr: `Takvime taper haftasını işaretle: yarışmadan 7 gün önce antrenmanı %40 azalt, erken uyu`,
      titleEn: `Mark taper week in your calendar: reduce training by 40% starting 7 days before the competition, sleep early`,
      priority: 'Medium',
    },
  ];

  const gucTasks: ModeTask[] = [
    {
      titleTr: `Antrenman günlerini takvime ekle: ${dayListTr}`,
      titleEn: `Add training days to calendar: ${dayListEn}`,
      priority: 'High',
    },
    {
      titleTr: `Split programını kaydet ve ilk seansı başlat: ${splitListTr} sırasıyla devam et`,
      titleEn: `Save your split program and start the first session: continue in order ${splitListEn}`,
      priority: 'High',
    },
    {
      titleTr: `Başlangıç ölçümleri al: kilo + bel çevresi + göğüs çevresi — kaydet ve fotoğrafla`,
      titleEn: `Take baseline measurements: weight + waist + chest — record them and take a photo`,
      priority: 'Medium',
    },
    {
      titleTr: `Antrenman günlüğü için uygulama aç (Strong, Hevy veya not defteri) ve ilk seansı kaydet`,
      titleEn: `Open a training log app (Strong, Hevy or a notebook) and log your first session`,
      priority: 'Medium',
    },
  ];

  const genelTasks: ModeTask[] = [
    {
      titleTr: `Antrenman günlerini takvime ekle: ${dayListTr}`,
      titleEn: `Add training days to calendar: ${dayListEn}`,
      priority: 'High',
    },
    {
      titleTr: `İlk seans: hafif ağırlıkla form öğren, ağırlıktan önce teknik`,
      titleEn: `First session: learn form with light weights, technique before load`,
      priority: 'High',
    },
    {
      titleTr: `Split programını kaydet: ${splitListTr} sırasıyla devam et`,
      titleEn: `Save your split program: continue in order ${splitListEn}`,
      priority: 'Medium',
    },
    {
      titleTr: `Antrenman günlüğü için uygulama aç (Strong, Hevy veya not defteri) ve ilk seansı kaydet`,
      titleEn: `Open a training log app (Strong, Hevy or a notebook) and log your first session`,
      priority: 'Medium',
    },
  ];

  const tasks = isYaris ? yarisTasks : isGenel ? genelTasks : gucTasks;

  const yarisHabits = [
    { name: 'Antrenman', nameTr: `${dayListTr} — spor pratiği`, emoji: '🏆', color: '#EF4444' },
    { name: 'Dinlenme', nameTr: 'Toparlanma: uyku + aktif dinlenme', emoji: '😴', color: '#8B5CF6' },
    { name: 'Beslenme', nameTr: 'Performans beslenmesi: yeterli karbonhidrat + protein', emoji: '🥗', color: '#F59E0B' },
    { name: 'Mental', nameTr: 'Mental hazırlık: görselleştirme / nefes egzersizi', emoji: '🧠', color: '#10B981' },
  ];

  const gucHabits = [
    { name: 'Antrenman', nameTr: `${dayListTr} — planlı seans`, emoji: '🏋️', color: '#EF4444' },
    { name: 'Protein', nameTr: 'Günlük protein alımı (her öğünde yeterli kaynak)', emoji: '🥩', color: '#F59E0B' },
    { name: 'Uyku', nameTr: 'Uyku kalitesi — kaslar uyurken büyür', emoji: '😴', color: '#8B5CF6' },
    { name: 'Kayıt', nameTr: 'Antrenman günlüğü: set · tekrar · ağırlık', emoji: '📊', color: '#10B981' },
  ];

  return {
    id: goalType === 'genel' ? 'spor-genel' : goalType === 'yaris' ? 'spor-yaris' : 'spor-guc',
    titleTr: isGenel ? 'Genel Fitness' : isYaris ? 'Yarışma Hazırlığı' : 'Güç & Kas',
    titleEn: isGenel ? 'General Fitness' : isYaris ? 'Competition Prep' : 'Strength & Muscle',
    descTr: isYaris
      ? `Haftada ${d} seans · Spor pratiği + güç · Yarışma öncesi taper`
      : `Haftada ${d} seans · ${splitListTr} · Aşamalı yüklenme`,
    descEn: isYaris
      ? `${d} sessions/week · Sport practice + strength · Pre-competition taper`
      : `${d} sessions/week · ${splitListEn} · Progressive overload`,
    targetTr: isYaris
      ? `✓ ${dayListTr} · Zayıf alan odağı · Taper · Mental hazırlık`
      : `✓ ${dayListTr} · Antrenman kaydı · Uyku & toparlanma`,
    targetEn: isYaris
      ? `✓ ${dayListEn} · Weak area focus · Taper · Mental prep`
      : `✓ ${dayListEn} · Training log · Sleep & recovery`,
    emoji: isGenel ? '✨' : isYaris ? '🏆' : '💪',
    dailyGoalMinutes: 60,
    habits: isYaris ? yarisHabits : gucHabits,
    tasks,
  };
}

function buildGucTemplateWithProgram(inputs: SporInputs, days: number, goalType: SporType): StudyTemplate {
  const base = buildGucTemplate(inputs, days, goalType);
  return withWeeklyProgram(base, days, base.titleTr, 'guc');
}

export function getSporMode(goalLabel: string, goalDate: string, inputs?: SporInputs): TurkishMode {
  const { days } = daysLeftInfo(goalDate);
  const sporSub = modeSubtitle(goalDate,
    { future: '{days} gün kaldı · Programını önizle', today: 'Bugün · Hedef günü!', past: 'Tarih geçti · Güncelle' },
    { future: '{days} days left · Preview your program', today: 'Today · Goal day!', past: 'Date passed · Update' },
  );
  const name = goalLabel.trim() || 'Spor Hedefi';
  const sporType = detectSporType(name);
  const inp = inputs ?? {};

  let template: StudyTemplate;
  if (sporType === 'kilo') {
    template = buildKiloTemplate(inp, days);
  } else if (sporType === 'maraton' || sporType === 'yaris') {
    template = sporType === 'maraton' ? buildMaratonTemplate(inp, days) : buildGucTemplateWithProgram(inp, days, sporType);
  } else {
    template = buildGucTemplateWithProgram(inp, days, sporType);
  }

  // Chip label'ından baştaki emojiyi sil (ör. "💪 Güç & Kas" → "Güç & Kas")
  const cleanName = name.replace(/^[\p{Emoji}\s]+/u, '').trim() || name;

  return {
    type: 'spor',
    labelTr: cleanName,
    labelEn: cleanName,
    subtitleTr: sporSub.tr,
    subtitleEn: sporSub.en,
    emoji: sporType === 'kilo' ? '⚖️' : sporType === 'maraton' ? '🏃' : sporType === 'yaris' ? '🏆' : sporType === 'genel' ? '✨' : '💪',
    daysLeft: days,
    habits: [],
    tasks: [],
    templates: [template],
  };
}

export function getTezMode(projectName: string, deadline: string): TurkishMode {
  const { days } = daysLeftInfo(deadline);
  const sub = modeSubtitle(deadline,
    { future: '{days} gün kaldı · Çalışma planını seç', today: 'Bugün · Teslim günü!', past: 'Tarih geçti · Güncelle' },
    { future: '{days} days left · Pick your plan', today: 'Today · Deadline!', past: 'Date passed · Update' },
  );
  const name = projectName.trim() || 'Proje';
  const tezType = detectTezType(name);

  // Faz 1: Başlangıç & Planlama (180+ gün) → milestone önce
  // Faz 2: Aktif Çalışma (60-180 gün)       → yazım/geliştirme önce
  // Faz 3: Son Sprint (<60 gün)              → teslim odaklı sprint önce
  let templates: StudyTemplate[];
  const addTezProgram = (t: StudyTemplate) => withWeeklyProgram(t, days, name, 'tez');
  if (days <= 60) {
    const typeTemplate = tezType === 'yazilim'
      ? TEMPLATE_TEZ_SOFTWARE(name)
      : tezType === 'is'
      ? TEMPLATE_TEZ_IS(name)
      : TEMPLATE_TEZ_WRITING(name);
    templates = [TEMPLATE_TEZ_SPRINT(name), typeTemplate, TEMPLATE_TEZ_MILESTONE(name)].map(addTezProgram);
  } else if (days <= 180) {
    if (tezType === 'yazilim') {
      templates = [TEMPLATE_TEZ_SOFTWARE(name), TEMPLATE_TEZ_MILESTONE(name), TEMPLATE_TEZ_WRITING(name)].map(addTezProgram);
    } else if (tezType === 'is') {
      templates = [TEMPLATE_TEZ_IS(name), TEMPLATE_TEZ_MILESTONE(name), TEMPLATE_TEZ_WRITING(name)].map(addTezProgram);
    } else {
      templates = [TEMPLATE_TEZ_WRITING(name), TEMPLATE_TEZ_MILESTONE(name)].map(addTezProgram);
    }
  } else {
    if (tezType === 'yazilim') {
      templates = [TEMPLATE_TEZ_MILESTONE(name), TEMPLATE_TEZ_SOFTWARE(name), TEMPLATE_TEZ_WRITING(name)].map(addTezProgram);
    } else if (tezType === 'is') {
      templates = [TEMPLATE_TEZ_MILESTONE(name), TEMPLATE_TEZ_IS(name), TEMPLATE_TEZ_WRITING(name)].map(addTezProgram);
    } else {
      templates = [TEMPLATE_TEZ_MILESTONE(name), TEMPLATE_TEZ_WRITING(name)].map(addTezProgram);
    }
  }

  return {
    type: 'tez',
    labelTr: `${name} Hazırlığı`,
    labelEn: `${name} Prep`,
    subtitleTr: sub.tr,
    subtitleEn: sub.en,
    emoji: '📝',
    daysLeft: days,
    habits: [],
    tasks: [],
    templates,
  };
}

export function getMulakatMode(company: string, date: string): TurkishMode {
  const { days } = daysLeftInfo(date);
  const sub = modeSubtitle(date,
    { future: '{days} gün kaldı · Hazırlık planını seç', today: 'Bugün · Mülakat günü!', past: 'Tarih geçti · Güncelle' },
    { future: '{days} days left · Pick your prep plan', today: 'Today · Interview day!', past: 'Date passed · Update' },
  );
  const name = company.trim() || '';
  const labelTr = name ? `${name} Mülakatı` : 'İş Mülakatı';
  const labelEn = name ? `${name} Interview` : 'Job Interview';

  const detected = detectMulakatType(name);
  const all = [
    TEMPLATE_MULAKAT_TEKNIK(name),
    TEMPLATE_MULAKAT_BEHAVIORAL(name),
    TEMPLATE_MULAKAT_CASE(name),
    TEMPLATE_MULAKAT_AKADEMIK(name),
  ];
  const order: Record<string, number> = { teknik: 0, behavioral: 1, case: 2, akademik: 3 };
  const priority = order[detected] ?? 0;
  const sorted = [all[priority], ...all.filter((_, i) => i !== priority)];

  // Faz 1: Kapsamlı Hazırlık (30+ gün) → tüm templateler, en uygun önce
  // Faz 2: Odaklanmış Hazırlık (7-30 gün) → sadece en ilgili 2 template
  // Faz 3: Son Hafta Sprinti (<7 gün)      → mock sprint önce
  let templates: StudyTemplate[];
  const addMulakatProgram = (t: StudyTemplate) => withWeeklyProgram(t, days, name || 'Mülakat', 'mulakat');
  if (days <= 7) {
    templates = [TEMPLATE_MULAKAT_SPRINT(name), sorted[0], sorted[1]].map(addMulakatProgram);
  } else if (days <= 30) {
    templates = [sorted[0], sorted[1]].map(addMulakatProgram);
  } else {
    templates = sorted.map(addMulakatProgram);
  }

  return {
    type: 'mulakat',
    labelTr,
    labelEn,
    subtitleTr: sub.tr,
    subtitleEn: sub.en,
    emoji: '💼',
    daysLeft: days,
    habits: [],
    tasks: [],
    templates,
  };
}

// Plan süresi boyunca faz bazlı haftalık görevler üretir — cap yok, süre ne kadarsa o dolar
function withWeeklyProgram(template: StudyTemplate, totalDays: number, name: string, type: 'exam' | 'tez' | 'mulakat' | 'guc'): StudyTemplate {
  const totalWeeks = Math.max(2, Math.ceil(totalDays / 7));

  const weeklyTasks: ModeTask[] = [];

  for (let w = 2; w <= totalWeeks; w++) {
    const daysFromNow = (w - 1) * 7;
    const weeksLeft = totalWeeks - w;
    const progress = w / totalWeeks; // 0→1 arası ilerleme oranı

    if (type === 'exam') {
      // Faz 1 — Temel (ilk %30): konu tarama ve kavram oluşturma
      // Faz 2 — Aktif (%30-60): soru pratiği yoğunlaşıyor
      // Faz 3 — Yoğunlaşma (%60-85): hata analizi ve zayıf konular
      // Faz 4 — Sprint (son %15, min son 4 hafta): tam deneme
      // Faz 5 — Son hafta
      if (weeksLeft === 0) {
        weeklyTasks.push({ titleTr: `${name} son hazırlık haftası: yeni konu yok — tüm notlarını tekrar et ve zihinsel hazırlık yap`, titleEn: `${name} final week: no new topics — review all notes and prepare mentally`, priority: 'High', daysFromNow });
      } else if (weeksLeft <= 1) {
        weeklyTasks.push({ titleTr: `Hafta ${w}: deneme sonuçlarını değerlendir — hangi sorular gitti, hangileri kazandırdı`, titleEn: `Week ${w}: evaluate mock results — which questions cost you, which earned points`, priority: 'High', daysFromNow });
      } else if (weeksLeft <= Math.max(3, Math.round(totalWeeks * 0.15))) {
        weeklyTasks.push({ titleTr: `Hafta ${w} sprint: tam ${name} denemesi çöz, süreli → hataları aynı gün analiz et`, titleEn: `Week ${w} sprint: full timed ${name} mock → analyze errors same day`, priority: 'High', daysFromNow });
      } else if (progress >= 0.60) {
        weeklyTasks.push({ titleTr: `Hafta ${w} yoğunlaşma: hata defterindeki en sık yanlış konuyu bu hafta bitir`, titleEn: `Week ${w} intensive: finish the most repeated wrong topic from your error log`, priority: 'High', daysFromNow });
      } else if (progress >= 0.30) {
        weeklyTasks.push({ titleTr: `Hafta ${w} pratik: bu haftaki konulara ait 30+ soru çöz ve hata defterini güncelle`, titleEn: `Week ${w} practice: solve 30+ questions on this week's topics and update error log`, priority: 'Medium', daysFromNow });
      } else {
        weeklyTasks.push({ titleTr: `Hafta ${w} temel: bu haftaki konuyu oku, kavram haritası çıkar, 10 temel soru çöz`, titleEn: `Week ${w} foundation: read this week's topic, draw concept map, solve 10 basic questions`, priority: 'Medium', daysFromNow });
      }
    }

    else if (type === 'tez') {
      // Faz 1 — Araştırma & Planlama (ilk %25)
      // Faz 2 — Yazım (%25-75)
      // Faz 3 — Revizyon (son %25)
      if (weeksLeft === 0) {
        weeklyTasks.push({ titleTr: `${name} teslim haftası: format, kaynakça ve bağlama kontrolü yap`, titleEn: `${name} submission week: check format, references and binding requirements`, priority: 'High', daysFromNow });
      } else if (weeksLeft <= 2) {
        weeklyTasks.push({ titleTr: `Hafta ${w}: danışmana son taslağı gönder — geri bildirim tarihini netleştir`, titleEn: `Week ${w}: send final draft to advisor — confirm feedback deadline`, priority: 'High', daysFromNow });
      } else if (progress >= 0.75) {
        weeklyTasks.push({ titleTr: `Hafta ${w} revizyon: bir bölümü baştan sona gözden geçir, danışman notlarını uygula`, titleEn: `Week ${w} revision: review one section end-to-end, apply advisor notes`, priority: 'High', daysFromNow });
      } else if (progress >= 0.25) {
        weeklyTasks.push({ titleTr: `Hafta ${w} yazım: bu haftaki hedef bölümü yaz — en az 500 kelime`, titleEn: `Week ${w} writing: write this week's target section — at least 500 words`, priority: 'Medium', daysFromNow });
      } else {
        weeklyTasks.push({ titleTr: `Hafta ${w} araştırma: bu haftaki literatürü tara, 3 kaynak oku ve özet çıkar`, titleEn: `Week ${w} research: scan this week's literature, read 3 sources and summarize`, priority: 'Medium', daysFromNow });
      }
    }

    else if (type === 'mulakat') {
      // Faz 1 — Araştırma & Hazırlık (ilk %40)
      // Faz 2 — Pratik & Pekiştirme (%40-85)
      // Faz 3 — Son Sprint (son %15)
      if (weeksLeft === 0) {
        weeklyTasks.push({ titleTr: `${name || 'Mülakat'} haftası: lojistik tamamla — giysi, rota, saat, uyku düzeni`, titleEn: `${name || 'Interview'} week: finalize logistics — outfit, route, time, sleep schedule`, priority: 'High', daysFromNow });
      } else if (progress >= 0.85) {
        weeklyTasks.push({ titleTr: `Hafta ${w}: video kaydıyla tam mock mülakat yap ve izleyerek düzelt`, titleEn: `Week ${w}: do a full video mock interview and review it to improve`, priority: 'High', daysFromNow });
      } else if (progress >= 0.40) {
        weeklyTasks.push({ titleTr: `Hafta ${w}: en zayıf soru tipini belirle, 3 farklı versiyonunu sesli çalış`, titleEn: `Week ${w}: identify your weakest question type, rehearse 3 versions aloud`, priority: 'Medium', daysFromNow });
      } else {
        weeklyTasks.push({ titleTr: `Hafta ${w}: şirketi/pozisyonu araştır — 1 yeni STAR hikayesi yaz`, titleEn: `Week ${w}: research company/role — write 1 new STAR story`, priority: 'Medium', daysFromNow });
      }
    }

    else if (type === 'guc') {
      // Faz 1 — Temel & Form (ilk %20): teknik öğrenme
      // Faz 2 — Hacim/Hipertrofi (%20-50): set/rep artışı
      // Faz 3 — Güç (%50-80): yoğunluk artışı
      // Faz 4 — Deload & Test (son %20): dinlenme ve max test
      const isDeload = w % 4 === 0; // Her 4. hafta deload
      if (weeksLeft === 0) {
        weeklyTasks.push({ titleTr: `Final haftası: başlangıç ölçümleriyle kıyasla — kilo, bel, göğüs & güç testi`, titleEn: `Final week: compare with starting measurements — weight, waist, chest & strength test`, priority: 'High', daysFromNow });
      } else if (isDeload) {
        weeklyTasks.push({ titleTr: `Hafta ${w} deload: ağırlıkları %40 düşür, form çalış — kaslar bu haftada onarılır`, titleEn: `Week ${w} deload: reduce weights 40%, focus on form — muscles recover this week`, priority: 'High', daysFromNow });
      } else if (progress >= 0.50) {
        weeklyTasks.push({ titleTr: `Hafta ${w} güç fazı: ana harekette (squat/deadlift/bench) yeni ağırlık dene`, titleEn: `Week ${w} strength phase: attempt a new weight on main lift (squat/deadlift/bench)`, priority: 'Medium', daysFromNow });
      } else if (progress >= 0.20) {
        weeklyTasks.push({ titleTr: `Hafta ${w} hacim: tüm setlerde son 2 tekrarda zorlanıyorsan ağırlığı artır`, titleEn: `Week ${w} volume: if the last 2 reps of every set are hard, increase the weight`, priority: 'Medium', daysFromNow });
      } else {
        weeklyTasks.push({ titleTr: `Hafta ${w} form: ayna veya video ile her hareketi kontrol et — teknik önce`, titleEn: `Week ${w} form: check every movement in a mirror or on video — technique first`, priority: 'Medium', daysFromNow });
      }
    }
  }

  return { ...template, tasks: [...template.tasks, ...weeklyTasks] };
}

function examTemplateTargetTr(id: string, name: string, isMemHeavy: boolean, isQHeavy: boolean, isLanguage: boolean, isMedical: boolean): string {
  switch (id) {
    case 'spaced-repetition':
      if (isMedical) return `✓ ${name} için kritik · Devasa konu havuzu — kartsız kazanmak çok zor`;
      if (isLanguage) return `✓ ${name} için kritik · Kelime ve gramer kalıcı hafızaya alınmalı`;
      if (isMemHeavy) return `✓ ${name} için ideal · Ezber yoğun konu havuzu için bilimsel yöntem`;
      return 'Tıp · Hukuk · Dil sınavları · Tarih ağırlıklı konular';
    case 'active-recall':
      if (isQHeavy) return `✓ ${name} için ideal · Çoktan seçmeli, soru çözme hızı belirleyici`;
      if (isLanguage) return `✓ ${name} için güçlü · Parça anlama ve dinleme pratiği kritik`;
      return 'Çoktan seçmeli sınavlar · Olgusal bilgi · Soru bankası çalışması';
    case 'deep-work':
      return `${name} için uzun oturum çalışması · Konu geçişlerini minimize et`;
    case 'sprint':
      return `${name}'a 60 gün kala başla · Yeni konu yok, sadece pekiştirme`;
    default:
      return 'Çoktan seçmeli sınavlar · Olgusal bilgi';
  }
}

function examTemplateTargetEn(id: string, name: string, isMemHeavy: boolean, isQHeavy: boolean, isLanguage: boolean, isMedical: boolean): string {
  switch (id) {
    case 'spaced-repetition':
      if (isMedical) return `✓ Critical for ${name} · Massive syllabus — nearly impossible without flashcards`;
      if (isLanguage) return `✓ Critical for ${name} · Vocabulary and grammar must enter long-term memory`;
      if (isMemHeavy) return `✓ Ideal for ${name} · Scientific method for memory-heavy syllabi`;
      return 'Medicine · Law · Language exams · History-heavy topics';
    case 'active-recall':
      if (isQHeavy) return `✓ Ideal for ${name} · Multiple choice — question speed is decisive`;
      if (isLanguage) return `✓ Strong for ${name} · Reading comprehension and listening practice matter`;
      return 'Multiple choice exams · Factual knowledge · Question bank practice';
    case 'deep-work':
      return `Long study sessions for ${name} · Minimize topic-switching`;
    case 'sprint':
      return `Start 60 days before ${name} · No new topics — reinforcement only`;
    default:
      return 'Multiple choice exams · Factual knowledge';
  }
}

// ── Exam-specific content packages ────────────────────────────────────────────

interface ExamContent {
  emoji: string;
  temelHabits: ModeHabit[];
  ortaHabits: ModeHabit[];
  ileriHabits: ModeHabit[];
  setupTasks: ModeTask[];
  sprintTasks: ModeTask[];
}

const EXAM_CONTENT: Record<string, ExamContent> = {
  yks: {
    emoji: '📚',
    temelHabits: [
      { name: 'Konu Kavrama', nameTr: 'Konu kavrama okuma (TYT)', emoji: '📖', color: '#3B82F6' },
      { name: 'Mini Soru', nameTr: 'Günlük mini soru (10–20)', emoji: '📝', color: '#10B981' },
    ],
    ortaHabits: [
      { name: 'Matematik Soru', nameTr: 'Matematik günlük soru', emoji: '📐', color: '#3B82F6' },
      { name: 'Türkçe Paragraf', nameTr: 'Türkçe paragraf tekrarı', emoji: '📖', color: '#10B981' },
      { name: 'AYT Konu Özeti', nameTr: 'Fen/AYT konu özeti', emoji: '🔬', color: '#8B5CF6' },
      { name: 'Hata Defteri', nameTr: 'Hata defteri güncelle', emoji: '❌', color: '#EF4444' },
    ],
    ileriHabits: [
      { name: 'Deneme Analizi', nameTr: 'Günlük deneme analizi', emoji: '📊', color: '#EF4444' },
      { name: 'AYT Mat Yoğun', nameTr: 'AYT matematik yoğun', emoji: '📐', color: '#3B82F6' },
      { name: 'TYT Hız', nameTr: 'TYT hız & doğruluk pratiği', emoji: '⚡', color: '#F59E0B' },
      { name: 'Zayıf Konu', nameTr: 'Zayıf konu sprint', emoji: '🎯', color: '#8B5CF6' },
      { name: 'Hata Defteri', nameTr: 'Hata defteri & tekrar', emoji: '❌', color: '#EF4444' },
    ],
    setupTasks: [
      { titleTr: 'TYT ve AYT konu dağılımını ÖSYM sitesinden incele', titleEn: 'Review TYT and AYT topic breakdown on ÖSYM website', priority: 'High' },
      { titleTr: 'Kaynak kitaplar ve soru bankaları temin et', titleEn: 'Get study books and question banks', priority: 'High' },
      { titleTr: 'Haftalık deneme sınavı takvimi oluştur', titleEn: 'Create weekly mock exam schedule', priority: 'Medium' },
    ],
    sprintTasks: [
      { titleTr: 'Her gün tam TYT denemesi çöz ve analiz et', titleEn: 'Solve and analyze a full TYT mock daily', priority: 'High' },
      { titleTr: 'AYT hedef bölüm için odak çalışma bloğu ayır', titleEn: 'Allocate a focus block for your AYT target section', priority: 'High' },
      { titleTr: 'Hata defterini baştan sona tekrar et', titleEn: 'Review your error log from start to finish', priority: 'Medium' },
    ],
  },
  kpss: {
    emoji: '🏛️',
    temelHabits: [
      { name: 'GY-GK Konu', nameTr: 'GY-GK konu okuma', emoji: '📚', color: '#3B82F6' },
      { name: 'Mini Soru', nameTr: 'Mini soru çözümü (20)', emoji: '📝', color: '#10B981' },
    ],
    ortaHabits: [
      { name: 'Tarih-Coğrafya', nameTr: 'Tarih/Coğrafya/Vatandaşlık', emoji: '📚', color: '#3B82F6' },
      { name: 'Anayasa', nameTr: 'Anayasa & Hukuk özeti', emoji: '⚖️', color: '#F59E0B' },
      { name: 'Eğitim Bil.', nameTr: 'Eğitim Bilimleri flashcard', emoji: '🧠', color: '#8B5CF6' },
      { name: 'GY-GK Soru', nameTr: 'GY-GK soru bankası', emoji: '📝', color: '#10B981' },
    ],
    ileriHabits: [
      { name: 'Soru Bankası', nameTr: 'Günlük soru bankası (60+)', emoji: '📝', color: '#EF4444' },
      { name: 'Eğitim Bil.', nameTr: 'Eğitim Bilimleri yoğun', emoji: '🧠', color: '#8B5CF6' },
      { name: 'Çıkmış Sorular', nameTr: 'Çıkmış KPSS soru analizi', emoji: '📊', color: '#3B82F6' },
      { name: 'Hata Analizi', nameTr: 'Hata analizi & tekrar', emoji: '❌', color: '#EF4444' },
      { name: 'Konu Haritası', nameTr: 'Konu haritası çıkarma', emoji: '🗂️', color: '#10B981' },
    ],
    setupTasks: [
      { titleTr: 'KPSS puan türünü belirle (P1–P10, KPSS-A/B)', titleEn: 'Identify your KPSS score type (P1–P10, KPSS-A/B)', priority: 'High' },
      { titleTr: 'Eğitim Bilimleri kaynak kitap temin et', titleEn: 'Get an Education Sciences resource book', priority: 'High' },
      { titleTr: 'Son 5 yıl KPSS çıkmış sorularını indir', titleEn: 'Download the last 5 years of KPSS past questions', priority: 'High' },
    ],
    sprintTasks: [
      { titleTr: 'Branş ağırlığına göre öncelik listesi yap', titleEn: 'Prioritize topics by exam weight', priority: 'High' },
      { titleTr: 'Her gün tüm alanlardan karma soru çöz', titleEn: 'Solve mixed questions from all areas daily', priority: 'High' },
      { titleTr: 'Eğitim Bilimleri zayıf konuları yoğunlaştır', titleEn: 'Intensify weak Education Sciences topics', priority: 'Medium' },
    ],
  },
  ales: {
    emoji: '🎓',
    temelHabits: [
      { name: 'Sayısal Giriş', nameTr: 'Sayısal muhakeme giriş soruları', emoji: '🔢', color: '#3B82F6' },
      { name: 'Sözel Giriş', nameTr: 'Sözel analoji çalışması', emoji: '📝', color: '#10B981' },
    ],
    ortaHabits: [
      { name: 'Sayısal Muhakeme', nameTr: 'Sayısal muhakeme soruları', emoji: '🔢', color: '#3B82F6' },
      { name: 'Sözel Paragraf', nameTr: 'Sözel paragraf & analoji', emoji: '📝', color: '#10B981' },
      { name: 'Süreli Çözüm', nameTr: 'Süreli çözüm pratiği', emoji: '⏱️', color: '#F59E0B' },
    ],
    ileriHabits: [
      { name: 'ALES Sayısal', nameTr: 'ALES sayısal yoğun (45 dk)', emoji: '🔢', color: '#3B82F6' },
      { name: 'Sözel Tam Set', nameTr: 'Sözel tam set çözümü', emoji: '📝', color: '#10B981' },
      { name: 'Zaman Yönetimi', nameTr: 'Zaman yönetimi simülasyonu', emoji: '⏱️', color: '#F59E0B' },
      { name: 'Hata Analizi', nameTr: 'Hata analizi & tekrar', emoji: '❌', color: '#EF4444' },
    ],
    setupTasks: [
      { titleTr: 'ALES sayısal/sözel ağırlık dengesini belirle', titleEn: 'Determine your ALES quantitative/verbal balance', priority: 'High' },
      { titleTr: 'Resmi ALES örnek sınavlarını ÖSYM\'den indir', titleEn: 'Download official ALES sample exams from ÖSYM', priority: 'High' },
    ],
    sprintTasks: [
      { titleTr: 'Her gün tam ALES denemesi çöz', titleEn: 'Solve a full ALES mock exam every day', priority: 'High' },
      { titleTr: 'Sayısal/sözel hız pratiği yap', titleEn: 'Practice quantitative/verbal speed drills', priority: 'High' },
    ],
  },
  lgs: {
    emoji: '🏫',
    temelHabits: [
      { name: 'Matematik Temel', nameTr: 'Matematik temel konu', emoji: '📐', color: '#3B82F6' },
      { name: 'Türkçe Paragraf', nameTr: 'Türkçe paragraf okuma', emoji: '📖', color: '#10B981' },
    ],
    ortaHabits: [
      { name: 'Matematik', nameTr: 'Matematik konu + soru', emoji: '📐', color: '#3B82F6' },
      { name: 'Türkçe', nameTr: 'Türkçe dil bilgisi & paragraf', emoji: '📖', color: '#10B981' },
      { name: 'Fen Bilimleri', nameTr: 'Fen Bilimleri konu özeti', emoji: '🔬', color: '#8B5CF6' },
      { name: 'Sosyal', nameTr: 'Sosyal Bilgiler harita çalışması', emoji: '🌍', color: '#F59E0B' },
    ],
    ileriHabits: [
      { name: 'Matematik', nameTr: 'Matematik deneme soruları', emoji: '📐', color: '#3B82F6' },
      { name: 'Türkçe Hız', nameTr: 'Türkçe hız çözüm', emoji: '📖', color: '#10B981' },
      { name: 'Fen Tarama', nameTr: 'Fen tam konu taraması', emoji: '🔬', color: '#8B5CF6' },
      { name: 'Sosyal+İnkılap', nameTr: 'Sosyal + İnkılap tarih özeti', emoji: '🌍', color: '#F59E0B' },
      { name: 'İngilizce', nameTr: 'İngilizce kelime & okuma', emoji: '🇬🇧', color: '#EC4899' },
    ],
    setupTasks: [
      { titleTr: 'LGS müfredatına göre ders ders konu tarama listesi çıkar', titleEn: 'Create a topic checklist for each LGS subject', priority: 'High' },
      { titleTr: 'Her ders için kaynak kitap ve soru bankası belirle', titleEn: 'Identify study books and question banks for each subject', priority: 'High' },
    ],
    sprintTasks: [
      { titleTr: 'Her gün tam LGS denemesi çöz ve analiz et', titleEn: 'Solve and analyze a full LGS mock daily', priority: 'High' },
      { titleTr: 'Zayıf derste odak çalışması yap', titleEn: 'Do focused study on your weakest subject', priority: 'High' },
    ],
  },
  dgs: {
    emoji: '🔄',
    temelHabits: [
      { name: 'Sayısal Temel', nameTr: 'Sayısal yetenek temel soruları', emoji: '🔢', color: '#3B82F6' },
      { name: 'Sözel Giriş', nameTr: 'Sözel yetenek giriş', emoji: '📝', color: '#10B981' },
    ],
    ortaHabits: [
      { name: 'Sayısal', nameTr: 'Sayısal yetenek soruları', emoji: '🔢', color: '#3B82F6' },
      { name: 'Sözel Paragraf', nameTr: 'Sözel yetenek paragraf', emoji: '📝', color: '#10B981' },
    ],
    ileriHabits: [
      { name: 'DGS Sayısal', nameTr: 'DGS sayısal yoğun', emoji: '🔢', color: '#3B82F6' },
      { name: 'Sözel Tam Set', nameTr: 'Sözel tam set çözümü', emoji: '📝', color: '#10B981' },
      { name: 'Süreli Deneme', nameTr: 'Süreli deneme çözümü', emoji: '⏱️', color: '#F59E0B' },
    ],
    setupTasks: [
      { titleTr: 'Önlisans programına göre DGS bölüm seçimini araştır', titleEn: 'Research DGS program options for your associate degree', priority: 'High' },
      { titleTr: 'ÖSYM DGS örnek sorularını indir', titleEn: 'Download official DGS sample questions from ÖSYM', priority: 'High' },
    ],
    sprintTasks: [
      { titleTr: 'Her gün tam DGS denemesi çöz', titleEn: 'Solve a full DGS mock exam every day', priority: 'High' },
      { titleTr: 'Sayısal/sözel zayıf alan odak çalışması', titleEn: 'Focus on your weaker quantitative or verbal area', priority: 'Medium' },
    ],
  },
  yds: {
    emoji: '🌐',
    temelHabits: [
      { name: 'Metin Okuma', nameTr: 'Günlük akademik İngilizce metin', emoji: '📖', color: '#3B82F6' },
      { name: 'Kelime', nameTr: 'Kelime listesi (5–10/gün)', emoji: '🗃️', color: '#8B5CF6' },
    ],
    ortaHabits: [
      { name: 'Akademik Okuma', nameTr: 'Akademik metin okuma & anlama', emoji: '📖', color: '#3B82F6' },
      { name: 'Kelime', nameTr: 'Akademik kelime listesi (15/gün)', emoji: '🗃️', color: '#8B5CF6' },
      { name: 'Gramer', nameTr: 'Gramer yapıları tekrarı', emoji: '✏️', color: '#EC4899' },
      { name: 'YDS Soru', nameTr: 'YDS format soruları çözümü', emoji: '📝', color: '#10B981' },
    ],
    ileriHabits: [
      { name: 'Hız Okuma', nameTr: 'Hız okuma pratiği', emoji: '📖', color: '#3B82F6' },
      { name: 'AWL Kelime', nameTr: 'COCA/AWL kelime seti (20/gün)', emoji: '🗃️', color: '#8B5CF6' },
      { name: 'İleri Gramer', nameTr: 'İleri gramer (inversion/cleft)', emoji: '✏️', color: '#EC4899' },
      { name: 'Çıkmış YDS', nameTr: 'Çıkmış YDS tam set çözümü', emoji: '📝', color: '#10B981' },
      { name: 'Hata Analizi', nameTr: 'Yanlış soru analizi', emoji: '❌', color: '#EF4444' },
    ],
    setupTasks: [
      { titleTr: 'Academic Word List (AWL) kelime setini indir', titleEn: 'Download the Academic Word List (AWL)', priority: 'High' },
      { titleTr: 'Son 3 yıl YDS/YÖKDİL sorularını temin et', titleEn: 'Get the last 3 years of YDS/YÖKDİL questions', priority: 'High' },
    ],
    sprintTasks: [
      { titleTr: 'Süreli tam YDS denemesi çöz', titleEn: 'Solve a full timed YDS mock exam', priority: 'High' },
      { titleTr: 'Yanlış sorulardan kelime kartı oluştur', titleEn: 'Create vocabulary cards from your wrong answers', priority: 'Medium' },
    ],
  },
  ielts: {
    emoji: '🇬🇧',
    temelHabits: [
      { name: 'Listening', nameTr: 'Listening pratik (podcast)', emoji: '👂', color: '#3B82F6' },
      { name: 'Reading', nameTr: 'Reading passage (1 metin/gün)', emoji: '📖', color: '#10B981' },
    ],
    ortaHabits: [
      { name: 'Listening', nameTr: 'Listening: not alma pratiği', emoji: '👂', color: '#3B82F6' },
      { name: 'Reading', nameTr: 'Reading: skimming & scanning', emoji: '📖', color: '#10B981' },
      { name: 'Writing', nameTr: 'Writing Task 1 taslak', emoji: '✍️', color: '#F59E0B' },
      { name: 'Speaking', nameTr: 'Speaking monologue kaydı', emoji: '🗣️', color: '#8B5CF6' },
    ],
    ileriHabits: [
      { name: 'Listening', nameTr: 'Listening: Section 3–4 (academic)', emoji: '👂', color: '#3B82F6' },
      { name: 'Reading', nameTr: 'Reading: T/F/NG stratejisi', emoji: '📖', color: '#10B981' },
      { name: 'Writing', nameTr: 'Writing Task 1 & 2 tam pratik', emoji: '✍️', color: '#F59E0B' },
      { name: 'Speaking', nameTr: 'Speaking: Part 2 cue card', emoji: '🗣️', color: '#8B5CF6' },
      { name: 'Mock Analiz', nameTr: 'Mock test hata analizi', emoji: '📊', color: '#EF4444' },
    ],
    setupTasks: [
      { titleTr: 'Cambridge IELTS kitaplarından en az 2 tane temin et', titleEn: 'Get at least 2 Cambridge IELTS practice books', priority: 'High' },
      { titleTr: 'Hedef band skoru belirle (okul/vize gereksinimine göre)', titleEn: 'Set your target band score (based on school/visa requirement)', priority: 'High' },
    ],
    sprintTasks: [
      { titleTr: 'Tam IELTS mock test çöz (4 bölüm aynı günde)', titleEn: 'Complete a full IELTS mock (all 4 sections in one day)', priority: 'High' },
      { titleTr: 'Writing Task 2 essay sayısını artır', titleEn: 'Increase your Writing Task 2 essay practice count', priority: 'High' },
    ],
  },
  toefl: {
    emoji: '🇺🇸',
    temelHabits: [
      { name: 'Listening', nameTr: 'Integrated Listening (kısa lecture)', emoji: '👂', color: '#3B82F6' },
      { name: 'Reading', nameTr: 'Reading passage çözümü', emoji: '📖', color: '#10B981' },
    ],
    ortaHabits: [
      { name: 'Listening', nameTr: 'Integrated Listening + notları', emoji: '👂', color: '#3B82F6' },
      { name: 'Reading', nameTr: 'Academic reading passage', emoji: '📖', color: '#10B981' },
      { name: 'Writing', nameTr: 'Independent Writing taslak', emoji: '✍️', color: '#F59E0B' },
      { name: 'Speaking', nameTr: 'Speaking template pratiği', emoji: '🎙️', color: '#8B5CF6' },
    ],
    ileriHabits: [
      { name: 'Listening', nameTr: 'Listening: pragmatic purpose soruları', emoji: '👂', color: '#3B82F6' },
      { name: 'Reading', nameTr: 'Reading: prose summary soruları', emoji: '📖', color: '#10B981' },
      { name: 'Writing', nameTr: 'Integrated & Independent Writing', emoji: '✍️', color: '#F59E0B' },
      { name: 'Speaking', nameTr: 'Speaking: template + içerik', emoji: '🎙️', color: '#8B5CF6' },
      { name: 'TPO Mock', nameTr: 'TPO mock test pratiği', emoji: '📊', color: '#EF4444' },
    ],
    setupTasks: [
      { titleTr: 'ETS Official TOEFL Guide temin et', titleEn: 'Get the ETS Official TOEFL Guide', priority: 'High' },
      { titleTr: 'TPO (TOEFL Practice Online) hesabı aç', titleEn: 'Create a TPO (TOEFL Practice Online) account', priority: 'High' },
    ],
    sprintTasks: [
      { titleTr: 'Tam TPO denemesi çöz', titleEn: 'Complete a full TPO mock exam', priority: 'High' },
      { titleTr: 'Speaking & Writing independent tam set çalış', titleEn: 'Complete full sets of Speaking & Writing independent tasks', priority: 'High' },
    ],
  },
  tus: {
    emoji: '🩺',
    temelHabits: [
      { name: 'Temel Bilim', nameTr: 'Temel bilim konu okuma', emoji: '🧬', color: '#3B82F6' },
      { name: 'Mini Soru', nameTr: 'Günlük mini soru (20–30)', emoji: '📝', color: '#10B981' },
    ],
    ortaHabits: [
      { name: 'Temel Bilim', nameTr: 'Temel bilim konu + soru (50/gün)', emoji: '🧬', color: '#3B82F6' },
      { name: 'Klinik Özet', nameTr: 'Klinik özet (Dahiliye/Cerrahi)', emoji: '🏥', color: '#10B981' },
      { name: 'Yanlış Tekrar', nameTr: 'Yanlış soru tekrarı', emoji: '🔄', color: '#8B5CF6' },
      { name: 'Kontrol Listesi', nameTr: 'Konu kontrol listesi', emoji: '📋', color: '#F59E0B' },
    ],
    ileriHabits: [
      { name: 'Temel Bilim', nameTr: 'Temel bilim yoğun (Biyokimya/Patoloji)', emoji: '🧬', color: '#3B82F6' },
      { name: 'Klinik Vaka', nameTr: 'Klinik vaka çalışması', emoji: '🏥', color: '#10B981' },
      { name: 'Soru Bankası', nameTr: 'Soru bankası (80+ soru/gün)', emoji: '📝', color: '#EF4444' },
      { name: 'Sistematik Tekrar', nameTr: 'Yanlış soru sistematik tekrar', emoji: '🔄', color: '#8B5CF6' },
      { name: 'Alan Takibi', nameTr: 'Alan bazlı performans takibi', emoji: '📊', color: '#F59E0B' },
    ],
    setupTasks: [
      { titleTr: 'TUS konu dağılımını ÖSYM verilerine göre analiz et', titleEn: 'Analyze TUS topic distribution using ÖSYM data', priority: 'High' },
      { titleTr: 'Online soru bankası aboneliği al (Tustime, Akdeniz vb.)', titleEn: 'Subscribe to an online question bank (Tustime, Akdeniz, etc.)', priority: 'High' },
      { titleTr: 'Temel bilim → klinik geçiş planı oluştur', titleEn: 'Create a plan for transitioning from basic sciences to clinical', priority: 'Medium' },
    ],
    sprintTasks: [
      { titleTr: 'Klinik dersler odak çalışması yap', titleEn: 'Focus intensively on clinical subjects', priority: 'High' },
      { titleTr: 'Günlük 100+ soru hedefle', titleEn: 'Aim for 100+ questions per day', priority: 'High' },
      { titleTr: 'Patoloji/Farmakoloji zayıf alan tekrarı', titleEn: 'Review weak areas in Pathology/Pharmacology', priority: 'Medium' },
    ],
  },
  usmle: {
    emoji: '🏥',
    temelHabits: [
      { name: 'Soru Bankası', nameTr: 'UWorld/Amboss günlük soru (20–30)', emoji: '📱', color: '#3B82F6' },
      { name: 'First Aid', nameTr: 'First Aid konu okuma', emoji: '📚', color: '#10B981' },
    ],
    ortaHabits: [
      { name: 'Soru Bankası', nameTr: 'Soru bankası (40 soru/gün)', emoji: '📱', color: '#3B82F6' },
      { name: 'Kaynak', nameTr: 'First Aid + Pathoma/Sketchy', emoji: '📚', color: '#10B981' },
      { name: 'Anki', nameTr: 'Anki deck tekrarı', emoji: '🔄', color: '#8B5CF6' },
      { name: 'Zayıf Alan', nameTr: 'Zayıf alan performans takibi', emoji: '📊', color: '#F59E0B' },
    ],
    ileriHabits: [
      { name: 'Soru Bankası', nameTr: 'Soru bankası (60+ soru/gün)', emoji: '📱', color: '#EF4444' },
      { name: 'Anki', nameTr: 'Anki 200+ kart/gün', emoji: '🔄', color: '#8B5CF6' },
      { name: 'First Aid', nameTr: 'Kaynak sistematik tarama', emoji: '📚', color: '#10B981' },
      { name: 'Klinik Vaka', nameTr: 'Clinical vignette analizi', emoji: '🏥', color: '#3B82F6' },
      { name: 'NBME', nameTr: 'NBME/UWSim performans takibi', emoji: '📊', color: '#F59E0B' },
    ],
    setupTasks: [
      { titleTr: 'First Aid for USMLE Step temin et', titleEn: 'Get First Aid for the USMLE Step you\'re targeting', priority: 'High' },
      { titleTr: 'UWorld veya Amboss aboneliği al', titleEn: 'Subscribe to UWorld or Amboss', priority: 'High' },
      { titleTr: 'NBME practice exam takvimi oluştur', titleEn: 'Create an NBME practice exam schedule', priority: 'Medium' },
    ],
    sprintTasks: [
      { titleTr: 'NBME practice test çöz ve skor analizi yap', titleEn: 'Complete an NBME practice test and analyze your score', priority: 'High' },
      { titleTr: 'Zayıf sistem üzerinde First Aid tekrar', titleEn: 'Review weak organ systems in First Aid', priority: 'High' },
    ],
  },
  gre: {
    emoji: '🎓',
    temelHabits: [
      { name: 'Vocabulary', nameTr: 'Vocabulary: 10 kelime/gün', emoji: '📝', color: '#3B82F6' },
      { name: 'Quant Temel', nameTr: 'Quant temel konular', emoji: '🔢', color: '#10B981' },
    ],
    ortaHabits: [
      { name: 'Verbal', nameTr: 'Verbal: vocabulary + RC passage', emoji: '📝', color: '#3B82F6' },
      { name: 'Quant', nameTr: 'Quant: DS & Problem Solving', emoji: '🔢', color: '#10B981' },
      { name: 'AWA', nameTr: 'AWA essay taslak pratiği', emoji: '✍️', color: '#F59E0B' },
    ],
    ileriHabits: [
      { name: 'Verbal', nameTr: 'Verbal: Full RC + Text Completion', emoji: '📝', color: '#3B82F6' },
      { name: 'Quant', nameTr: 'Quant: yoğun problem çözme', emoji: '🔢', color: '#10B981' },
      { name: 'AWA', nameTr: 'AWA: Issue + Argument essay', emoji: '✍️', color: '#F59E0B' },
      { name: 'PowerPrep', nameTr: 'ETS PowerPrep simülasyonu', emoji: '📊', color: '#8B5CF6' },
    ],
    setupTasks: [
      { titleTr: 'ETS Official GRE Guide temin et (Big Book)', titleEn: 'Get the ETS Official GRE Guide (Big Book)', priority: 'High' },
      { titleTr: 'Hedef programın minimum GRE skoru gereksinimini öğren', titleEn: 'Find out the minimum GRE score for your target program', priority: 'High' },
    ],
    sprintTasks: [
      { titleTr: 'ETS PowerPrep tam deneme çöz', titleEn: 'Complete an ETS PowerPrep full mock exam', priority: 'High' },
      { titleTr: 'AWA essay sayısını artır, geri bildirim al', titleEn: 'Write more AWA essays and get feedback', priority: 'Medium' },
    ],
  },
  gmat: {
    emoji: '💼',
    temelHabits: [
      { name: 'Quant Giriş', nameTr: 'Quant: Problem Solving giriş', emoji: '🔢', color: '#3B82F6' },
      { name: 'Verbal Temel', nameTr: 'Verbal: SC temelleri', emoji: '📝', color: '#10B981' },
    ],
    ortaHabits: [
      { name: 'Quant', nameTr: 'Quant: DS + PS karma çalışma', emoji: '🔢', color: '#3B82F6' },
      { name: 'Verbal', nameTr: 'Verbal: CR + SC günlük pratik', emoji: '📝', color: '#10B981' },
      { name: 'AWA & IR', nameTr: 'AWA & IR çalışması', emoji: '✍️', color: '#F59E0B' },
    ],
    ileriHabits: [
      { name: 'Quant 700+', nameTr: 'Quant yoğun (700+ sorular)', emoji: '🔢', color: '#3B82F6' },
      { name: 'Verbal', nameTr: 'Verbal: RC + CR + SC tam set', emoji: '📝', color: '#10B981' },
      { name: 'CAT Deneme', nameTr: 'CAT adaptif test simülasyonu', emoji: '📊', color: '#8B5CF6' },
      { name: 'AWA', nameTr: 'AWA essay pratiği', emoji: '✍️', color: '#F59E0B' },
    ],
    setupTasks: [
      { titleTr: 'GMAT Official Guide temin et', titleEn: 'Get the GMAT Official Guide', priority: 'High' },
      { titleTr: 'Hedef MBA programı için minimum GMAT skoru belirle', titleEn: 'Find the minimum GMAT score for your target MBA program', priority: 'High' },
    ],
    sprintTasks: [
      { titleTr: 'GMAT CAT tam deneme çöz ve analiz et', titleEn: 'Complete and analyze a full GMAT CAT mock', priority: 'High' },
      { titleTr: 'Verbal zayıf alan odak çalışması yap', titleEn: 'Do focused study on your weak Verbal area', priority: 'High' },
    ],
  },
  msü: {
    emoji: '🎖️',
    temelHabits: [
      { name: 'Kondisyon', nameTr: 'Temel kondisyon (koşu 20 dk)', emoji: '💪', color: '#EF4444' },
      { name: 'Akademik', nameTr: 'TYT düzeyinde konu tekrarı', emoji: '📚', color: '#3B82F6' },
    ],
    ortaHabits: [
      { name: 'Koşu', nameTr: 'Koşu antrenmanı (30 dk)', emoji: '🏃', color: '#EF4444' },
      { name: 'Kalistenik', nameTr: 'Kalistenik egzersiz (şınav/mekik)', emoji: '💪', color: '#F59E0B' },
      { name: 'Akademik', nameTr: 'Akademik soru çalışması', emoji: '📚', color: '#3B82F6' },
      { name: 'Süreli Test', nameTr: 'Süreli test simülasyonu', emoji: '⏱️', color: '#10B981' },
    ],
    ileriHabits: [
      { name: 'Uzun Koşu', nameTr: 'Uzun koşu (45+ dk)', emoji: '🏃', color: '#EF4444' },
      { name: 'Maksimum Kal.', nameTr: 'Maksimum kalistenik', emoji: '💪', color: '#F59E0B' },
      { name: 'Akademik', nameTr: 'Akademik tam deneme', emoji: '📚', color: '#3B82F6' },
      { name: 'Parkur', nameTr: 'Parkur simülasyonu', emoji: '⏱️', color: '#10B981' },
      { name: 'Mental', nameTr: 'Fiziksel + mental hazırlık', emoji: '🧠', color: '#8B5CF6' },
    ],
    setupTasks: [
      { titleTr: 'MSÜ fiziki test standartlarını incele (şınav/mekik/koşu süreleri)', titleEn: 'Review MSÜ physical fitness standards (push-up/sit-up/run times)', priority: 'High' },
      { titleTr: 'MSÜ akademik sınav konularını ve kontenjanları araştır', titleEn: 'Research MSÜ academic exam topics and quotas', priority: 'High' },
    ],
    sprintTasks: [
      { titleTr: 'MSÜ fiziki standartlarını tam olarak karşıla ve aş', titleEn: 'Meet and exceed all MSÜ physical fitness standards', priority: 'High' },
      { titleTr: 'Akademik deneme + fiziksel antrenman kombine günler yap', titleEn: 'Combine academic mocks with physical training days', priority: 'High' },
    ],
  },
  pmyo: {
    emoji: '👮',
    temelHabits: [
      { name: 'Koşu', nameTr: 'Koşu (2–3 km, günlük)', emoji: '🏃', color: '#EF4444' },
      { name: 'Genel Kültür', nameTr: 'Genel kültür konu okuma', emoji: '📚', color: '#3B82F6' },
    ],
    ortaHabits: [
      { name: 'Koşu', nameTr: 'Koşu antrenmanı (3–5 km)', emoji: '🏃', color: '#EF4444' },
      { name: 'Kalistenik', nameTr: 'Kalistenik egzersiz', emoji: '💪', color: '#F59E0B' },
      { name: 'Genel Kültür', nameTr: 'Genel kültür & güncel olaylar', emoji: '📚', color: '#3B82F6' },
      { name: 'PMYO Soru', nameTr: 'PMYO soru çalışması', emoji: '📝', color: '#10B981' },
    ],
    ileriHabits: [
      { name: 'Interval Koşu', nameTr: 'Uzun mesafe + interval koşu', emoji: '🏃', color: '#EF4444' },
      { name: 'Kalistenik', nameTr: 'Kalistenik maksimum set', emoji: '💪', color: '#F59E0B' },
      { name: 'Genel Kültür', nameTr: 'Genel kültür yoğun', emoji: '📚', color: '#3B82F6' },
      { name: 'PMYO Deneme', nameTr: 'PMYO full deneme çözümü', emoji: '📝', color: '#10B981' },
      { name: 'Mental', nameTr: 'Psikolojik dayanıklılık', emoji: '🧠', color: '#8B5CF6' },
    ],
    setupTasks: [
      { titleTr: 'PMYO fiziki test standartlarını incele', titleEn: 'Review PMYO physical fitness test standards', priority: 'High' },
      { titleTr: 'PMYO sınav konularını ve kaynaklarını araştır', titleEn: 'Research PMYO exam topics and recommended resources', priority: 'High' },
    ],
    sprintTasks: [
      { titleTr: 'Tüm fiziki kriterleri karşıla ve aş', titleEn: 'Meet and exceed all physical test criteria', priority: 'High' },
      { titleTr: 'PMYO full akademik deneme çöz', titleEn: 'Complete a full PMYO academic mock exam', priority: 'High' },
    ],
  },
  oabt: {
    emoji: '📐',
    temelHabits: [
      { name: 'Alan Bilgisi', nameTr: 'Alan bilgisi konu okuma', emoji: '📚', color: '#3B82F6' },
      { name: 'Mini Soru', nameTr: 'Mini soru çözümü', emoji: '📝', color: '#10B981' },
    ],
    ortaHabits: [
      { name: 'Alan Bilgisi', nameTr: 'Alan bilgisi sistematik tarama', emoji: '📚', color: '#3B82F6' },
      { name: 'ÖABT Soru', nameTr: 'ÖABT format soru çözümü', emoji: '📝', color: '#10B981' },
      { name: 'Eğitim Bil.', nameTr: 'Eğitim Bilimleri tekrarı', emoji: '🧠', color: '#8B5CF6' },
    ],
    ileriHabits: [
      { name: 'Alan Yoğun', nameTr: 'Alan bilgisi yoğun (zayıf konular)', emoji: '📚', color: '#3B82F6' },
      { name: 'Çıkmış Soru', nameTr: 'Çıkmış ÖABT soruları', emoji: '📝', color: '#10B981' },
      { name: 'Eğitim Bil.', nameTr: 'Eğitim Bilimleri + pedagoji', emoji: '🧠', color: '#8B5CF6' },
      { name: 'Hata Analizi', nameTr: 'Hata analizi & tekrar', emoji: '❌', color: '#EF4444' },
    ],
    setupTasks: [
      { titleTr: 'Branşına özel ÖABT konu listesini ÖSYM\'den indir', titleEn: 'Download your branch-specific ÖABT topic list from ÖSYM', priority: 'High' },
      { titleTr: 'Son 3 yıl ÖABT sorularını temin et', titleEn: 'Get the last 3 years of ÖABT past questions', priority: 'High' },
    ],
    sprintTasks: [
      { titleTr: 'Branş + Eğitim Bilimleri karma deneme çöz', titleEn: 'Solve mixed mocks covering both branch and Education Sciences', priority: 'High' },
      { titleTr: 'Zayıf alan odak çalışması yap', titleEn: 'Do targeted study on your weakest area', priority: 'Medium' },
    ],
  },
  aof: {
    emoji: '💻',
    temelHabits: [
      { name: 'Ünite Okuma', nameTr: 'Ders kitabı ünite okuma (1/gün)', emoji: '📖', color: '#3B82F6' },
      { name: 'Özet', nameTr: 'Ünite özeti çıkarma', emoji: '📝', color: '#10B981' },
    ],
    ortaHabits: [
      { name: 'Ders Okuma', nameTr: 'Ders okuma + not alma', emoji: '📖', color: '#3B82F6' },
      { name: 'Ünite Sonu', nameTr: 'Ünite sonu soruları çözme', emoji: '📝', color: '#10B981' },
      { name: 'Haftalık Tekrar', nameTr: 'Haftalık tekrar oturumu', emoji: '🔄', color: '#8B5CF6' },
    ],
    ileriHabits: [
      { name: 'Hızlı Okuma', nameTr: 'Hızlı okuma + aktif not', emoji: '📖', color: '#3B82F6' },
      { name: 'Çıkmış Soru', nameTr: 'Çıkmış soru analizi', emoji: '📝', color: '#10B981' },
      { name: 'Sistematik Tekrar', nameTr: 'Sistematik tekrar programı', emoji: '🔄', color: '#8B5CF6' },
      { name: 'Hata Takibi', nameTr: 'Hata takibi & güçlendirme', emoji: '❌', color: '#EF4444' },
    ],
    setupTasks: [
      { titleTr: 'Açıköğretim sınav takvimini kaydet ve alarm kur', titleEn: 'Save the distance education exam schedule and set reminders', priority: 'High' },
      { titleTr: 'Her ders için çıkmış soru bankasını indir', titleEn: 'Download past question banks for each course', priority: 'High' },
    ],
    sprintTasks: [
      { titleTr: 'Her ders için mini deneme çöz', titleEn: 'Solve a mini mock for each course', priority: 'High' },
      { titleTr: 'Ünite özetlerini hızlı tekrar et', titleEn: 'Quickly review all unit summaries', priority: 'Medium' },
    ],
  },
  pte: {
    emoji: '🎙️',
    temelHabits: [
      { name: 'Read Aloud', nameTr: 'Speaking: Read Aloud pratik', emoji: '🎙️', color: '#3B82F6' },
      { name: 'Reorder', nameTr: 'Reading: Reorder Paragraphs', emoji: '📖', color: '#10B981' },
    ],
    ortaHabits: [
      { name: 'Speaking', nameTr: 'Speaking: RA + Repeat Sentence', emoji: '🎙️', color: '#3B82F6' },
      { name: 'Reading', nameTr: 'Reading: FIB + MCQ', emoji: '📖', color: '#10B981' },
      { name: 'Writing', nameTr: 'Writing: Summarize Written Text', emoji: '✍️', color: '#F59E0B' },
      { name: 'Listening', nameTr: 'Listening: FIB pratik', emoji: '👂', color: '#8B5CF6' },
    ],
    ileriHabits: [
      { name: 'Speaking', nameTr: 'Speaking: Describe Image + Retell', emoji: '🎙️', color: '#3B82F6' },
      { name: 'Reading', nameTr: 'Reading: tüm soru tipleri', emoji: '📖', color: '#10B981' },
      { name: 'Writing', nameTr: 'Writing: Full AWE pratik', emoji: '✍️', color: '#F59E0B' },
      { name: 'Listening', nameTr: 'Listening: Highlight Correct Summary', emoji: '👂', color: '#8B5CF6' },
      { name: 'Mock Analiz', nameTr: 'Mock test analizi', emoji: '📊', color: '#EF4444' },
    ],
    setupTasks: [
      { titleTr: 'PTE Academic Official Guide temin et', titleEn: 'Get the PTE Academic Official Guide', priority: 'High' },
      { titleTr: 'Scored Practice Test ile mevcut seviyeni ölç', titleEn: 'Measure your current level with a Scored Practice Test', priority: 'High' },
    ],
    sprintTasks: [
      { titleTr: 'Tam PTE mock test çöz', titleEn: 'Complete a full PTE mock test', priority: 'High' },
      { titleTr: 'Speaking ve Listening odak pratiği yap', titleEn: 'Do focused Speaking and Listening practice', priority: 'High' },
    ],
  },
  bilsem: {
    emoji: '🧩',
    temelHabits: [
      { name: 'Sözel Mantık', nameTr: 'Sözel mantık bulmacaları (15 dk)', emoji: '🧩', color: '#8B5CF6' },
      { name: 'Sayısal Örüntü', nameTr: 'Sayısal örüntü soruları', emoji: '🔢', color: '#3B82F6' },
    ],
    ortaHabits: [
      { name: 'Sözel Mantık', nameTr: 'Sözel & şekil mantık soruları', emoji: '🧩', color: '#8B5CF6' },
      { name: 'Sayısal', nameTr: 'Sayısal örüntü ve dizi', emoji: '🔢', color: '#3B82F6' },
      { name: 'Yaratıcı', nameTr: 'Yaratıcı düşünme egzersizleri', emoji: '🎨', color: '#EC4899' },
    ],
    ileriHabits: [
      { name: 'Zeka Testi', nameTr: 'Tam zeka testi seti (sözel+şekil+sayısal)', emoji: '🧩', color: '#8B5CF6' },
      { name: 'Örüntü', nameTr: 'İleri düzey örüntü soruları', emoji: '🔢', color: '#3B82F6' },
      { name: 'Yaratıcı', nameTr: 'Yaratıcı problem çözme pratiği', emoji: '🎨', color: '#EC4899' },
      { name: 'Uzamsal', nameTr: 'Görsel-uzamsal akıl yürütme', emoji: '🧠', color: '#10B981' },
    ],
    setupTasks: [
      { titleTr: 'BİLSEM değerlendirme aşamalarını araştır (Grup Tarama → Bireysel)', titleEn: 'Research BİLSEM assessment stages (Group Screening → Individual)', priority: 'High' },
      { titleTr: 'Zeka testi pratik kitabı temin et', titleEn: 'Get an IQ test practice book', priority: 'High' },
    ],
    sprintTasks: [
      { titleTr: 'Tam BİLSEM simülasyon testi çöz', titleEn: 'Complete a full BİLSEM simulation test', priority: 'High' },
      { titleTr: 'Zayıf alan (şekil/sayısal/sözel) odak pratiği', titleEn: 'Focus practice on your weakest area (visual/numerical/verbal)', priority: 'High' },
    ],
  },
};

// Maps detected exam name to content key
function detectExamContentKey(upperName: string): string | null {
  if (['YKS', 'TYT', 'AYT'].some(k => upperName.includes(k))) return 'yks';
  if (upperName.includes('KPSS')) return 'kpss';
  if (upperName.includes('ALES')) return 'ales';
  if (upperName.includes('LGS')) return 'lgs';
  if (upperName.includes('DGS')) return 'dgs';
  if (['YDS', 'YÖKDİL', 'YOKDIL'].some(k => upperName.includes(k))) return 'yds';
  if (upperName.includes('IELTS')) return 'ielts';
  if (upperName.includes('TOEFL')) return 'toefl';
  if (['TUS', 'DUS'].some(k => upperName.includes(k))) return 'tus';
  if (upperName.includes('USMLE')) return 'usmle';
  if (upperName.includes('GRE') && !upperName.includes('GMAT')) return 'gre';
  if (upperName.includes('GMAT')) return 'gmat';
  if (['MSÜ', 'MSU', 'HARP', 'ASKERİ'].some(k => upperName.includes(k))) return 'msü';
  if (['PMYO', 'POLİS', 'EMNİYET'].some(k => upperName.includes(k))) return 'pmyo';
  if (['ÖABT', 'OABT'].some(k => upperName.includes(k))) return 'oabt';
  if (['AOF', 'AÖF', 'AUZEF', 'AÇIKÖG'].some(k => upperName.includes(k))) return 'aof';
  if (upperName.includes('PTE')) return 'pte';
  if (['BİLSEM', 'BILSEM'].some(k => upperName.includes(k))) return 'bilsem';
  return null;
}

function buildLevelTemplates(content: ExamContent, examName: string, days: number): StudyTemplate[] {
  const templates: StudyTemplate[] = [];

  // Foundation — Bloom faz 1: kavramsal zemin (270+ gün)
  if (days >= 270) {
    templates.push({
      ...TEMPLATE_FOUNDATION(examName),
      tasks: content.setupTasks,
    });
  }

  // Sprint önce — son 60 günde en üste çıkar
  if (days <= 60) {
    templates.push({
      ...TEMPLATE_SPRINT(examName),
      habits: [
        { name: 'Sabah Denemesi', nameTr: 'Sabah denemesi çöz', emoji: '📊', color: '#EF4444' },
        { name: 'Hata Analizi', nameTr: 'Hata analizi & zayıf alan', emoji: '🔍', color: '#F59E0B' },
        { name: 'Akşam Tekrarı', nameTr: 'Akşam hızlı tekrar', emoji: '🌙', color: '#6366F1' },
      ],
      tasks: content.sprintTasks,
    });
  }

  templates.push({
    id: 'level-temel',
    titleTr: 'Temel Hazırlık',
    titleEn: 'Foundation Prep',
    descTr: 'Konuları kavramak ve alışkanlık oluşturmak için yavaş ama sağlam başlangıç. Sınava yeni başlayanlar veya uzun aradan dönüyorsanız buradan başlayın.',
    descEn: 'A slow but solid start to understand concepts and build habits. Best for beginners or those returning after a long break.',
    targetTr: '✓ Sınava yeni başlıyor · Günde 30–60 dk çalışıyor · Temel kavramları oturtuyor',
    targetEn: '✓ Just starting out · 30–60 min/day · Building foundational understanding',
    emoji: '🌱',
    dailyGoalMinutes: 45,
    habits: content.temelHabits,
    tasks: content.setupTasks,
  });

  templates.push({
    id: 'level-orta',
    titleTr: 'Standart Hazırlık',
    titleEn: 'Standard Prep',
    descTr: 'Konu + soru dengesini kuran, düzenli çalışan orta seviye planı. Çoğu kişi için en uygun başlangıç noktası.',
    descEn: 'A balanced topic + practice plan for steady, consistent studiers. The right starting point for most people.',
    targetTr: '✓ Temel konuları biliyor · Günde 60–120 dk · Soru pratiğine geçmeye hazır',
    targetEn: '✓ Knows the basics · 60–120 min/day · Ready to move into practice questions',
    emoji: '📈',
    dailyGoalMinutes: 90,
    habits: content.ortaHabits,
    tasks: content.setupTasks,
  });

  templates.push({
    id: 'level-ileri',
    titleTr: 'Yoğun Hazırlık',
    titleEn: 'Intensive Prep',
    descTr: 'Konuları bilen, skor optimizasyonuna odaklanan ileri düzey planı. Günlük yüksek hacim ve sistematik hata analizi.',
    descEn: 'Advanced plan for those who know the material and are optimizing for score. High daily volume and systematic error analysis.',
    targetTr: '✓ Konulara hâkim · Günde 2+ saat · Puan sıkıştırıyor',
    targetEn: '✓ Comfortable with content · 2+ hrs/day · Squeezing out more points',
    emoji: '🔥',
    dailyGoalMinutes: 150,
    habits: content.ileriHabits,
    tasks: [...content.setupTasks, ...content.sprintTasks],
  });

  return templates.map(t => withWeeklyProgram(t, days, examName, 'exam'));
}

export function getCustomExamMode(examName: string, examDate: string, examTipTr?: string, examTipEn?: string): TurkishMode {
  const { days } = daysLeftInfo(examDate);
  const examSub = modeSubtitle(examDate,
    { future: '{days} gün kaldı · Seviyeni seç', today: 'Bugün · Son gün!', past: 'Tarih geçti · Güncelle' },
    { future: '{days} days left · Pick your level', today: 'Today · Last day!', past: 'Date passed · Update' },
  );
  const name = examName.trim() || 'Sınav';
  const n = name.toUpperCase();

  const contentKey = detectExamContentKey(n);
  const examEmoji = contentKey ? (EXAM_CONTENT[contentKey]?.emoji ?? '🎯') : '🎯';

  let templates: StudyTemplate[];
  if (contentKey && EXAM_CONTENT[contentKey]) {
    templates = buildLevelTemplates(EXAM_CONTENT[contentKey], name, days);
  } else {
    const isLastMonth = days <= 30;
    const isMemHeavy = ['KPSS', 'TUS', 'DUS', 'YDS', 'YOKDIL', 'YÖKDİL', 'IELTS', 'TOEFL', 'GRE', 'GMAT', 'USMLE'].some(e => n.includes(e));
    const isQHeavy = ['YKS', 'TYT', 'AYT', 'LGS', 'ALES', 'DGS', 'KPSS', 'MSÜ', 'MSU', 'PMYO'].some(e => n.includes(e));
    const isLanguage = ['YDS', 'YOKDIL', 'YÖKDİL', 'IELTS', 'TOEFL', 'GRE', 'GMAT'].some(e => n.includes(e));
    const isMedical = ['TUS', 'DUS', 'USMLE'].some(e => n.includes(e));
    const rawTemplates = isLastMonth
      ? [TEMPLATE_SPRINT(name), TEMPLATE_ACTIVE_RECALL(name), TEMPLATE_DEEP_WORK(name)]
      : days >= 270
      ? [TEMPLATE_FOUNDATION(name), TEMPLATE_ACTIVE_RECALL(name), TEMPLATE_SPACED_REPETITION(name), TEMPLATE_DEEP_WORK(name), TEMPLATE_SPRINT(name)]
      : [TEMPLATE_ACTIVE_RECALL(name), TEMPLATE_SPACED_REPETITION(name), TEMPLATE_DEEP_WORK(name), TEMPLATE_SPRINT(name)];
    templates = rawTemplates.map(t => withWeeklyProgram({
      ...t,
      targetTr: examTemplateTargetTr(t.id, name, isMemHeavy, isQHeavy, isLanguage, isMedical),
      targetEn: examTemplateTargetEn(t.id, name, isMemHeavy, isQHeavy, isLanguage, isMedical),
    }, days, name, 'exam'));
  }

  return {
    type: 'exam',
    labelTr: `${name} Hazırlığı`,
    labelEn: `${name} Prep`,
    subtitleTr: examSub.tr,
    subtitleEn: examSub.en,
    emoji: examEmoji,
    daysLeft: days,
    habits: [],
    tasks: [],
    templates,
    tipTr: examTipTr,
    tipEn: examTipEn,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

function nextDate(ranges: { start: string }[]): string {
  const today = new Date().toISOString().split('T')[0];
  const future = ranges.find(r => r.start >= today);
  return future?.start ?? ranges[ranges.length - 1].start;
}

export function getModePreview(type: ModeType, opts?: { examName?: string; examDate?: string; examTipTr?: string; examTipEn?: string; tezName?: string; tezDate?: string; mulakatName?: string; mulakatDate?: string; sporGoal?: string; sporDate?: string; sporInputs?: SporInputs }): TurkishMode {
  if (type === 'ramazan') {
    const next = nextDate(RAMAZAN);
    const nextDate_ = new Date(next);
    const daysUntil = Math.max(0, Math.ceil((nextDate_.getTime() - Date.now()) / 86400000));
    const dateLabel = nextDate_.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
    const subtitleTr = daysUntil > 0
      ? `${dateLabel}'de başlıyor · Planı şimdiden hazırla`
      : `${dateLabel}'den itibaren aktif`;
    const subtitleEn = daysUntil > 0
      ? `Starts ${dateLabel} · Plan ahead`
      : `Active from ${dateLabel}`;
    return { ...RAMAZAN_MODE(daysUntil), subtitleTr, subtitleEn };
  }
  if (type === 'exam') {
    return getCustomExamMode(opts?.examName ?? '', opts?.examDate ?? new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0], opts?.examTipTr, opts?.examTipEn);
  }
  if (type === 'tez') {
    return getTezMode(opts?.tezName ?? '', opts?.tezDate ?? new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0]);
  }
  if (type === 'mulakat') {
    return getMulakatMode(opts?.mulakatName ?? '', opts?.mulakatDate ?? new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]);
  }
  if (type === 'spor') {
    return getSporMode(opts?.sporGoal ?? '', opts?.sporDate ?? new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0], opts?.sporInputs);
  }
  if (type === 'yks') {
    const next = nextDate(YKS);
    const date = new Date(next).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
    return { ...YKS_MODE(0), subtitleTr: `${date} öncesi aktif olacak`, subtitleEn: `Activates before ${date}` };
  }
  const next = nextDate(KPSS);
  const date = new Date(next).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
  return { ...KPSS_MODE(0), subtitleTr: `${date} öncesi aktif olacak`, subtitleEn: `Activates before ${date}` };
}

export function detectTurkishMode(): TurkishMode | null {
  for (const r of RAMAZAN) {
    // Active during Ramazan itself
    const duringDays = isActive(r.start, r.end, 0);
    if (duringDays >= 0) return RAMAZAN_MODE(duringDays);

    // Active 7 days before Ramazan starts (pre-period)
    const preActive = isActive(r.start, r.end, 7);
    if (preActive >= 0) {
      const startMs = new Date(r.start).setHours(0, 0, 0, 0);
      const daysToStart = Math.ceil((startMs - Date.now()) / 86400000);
      return {
        ...RAMAZAN_MODE(daysToStart),
        subtitleTr: `${daysToStart} gün sonra başlıyor · Planı şimdiden hazırla`,
        subtitleEn: `Starts in ${daysToStart} days · Plan ahead`,
      };
    }
  }
  for (const y of YKS) {
    const days = isActive(y.start, y.end, 35);
    if (days >= 0) return YKS_MODE(days);
  }
  for (const k of KPSS) {
    const days = isActive(k.start, k.end, 45);
    if (days >= 0) return KPSS_MODE(days);
  }
  return null;
}

// All habit names that can be created by each seasonal mode — used for name-based fallback removal
export const RAMAZAN_HABIT_NAMES: string[] = [
  ...TEMPLATE_RAMAZAN_GECE.habits.map(h => h.name),
  ...TEMPLATE_RAMAZAN_SABAH.habits.map(h => h.name),
];
