export type ModeType = 'ramazan' | 'yks' | 'kpss' | 'exam' | 'tez' | 'mulakat';

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

const RAMAZAN: { start: string; end: string }[] = [
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
  targetTr: '30 günden az kaldı · Maksimum verim modu',
  targetEn: 'Less than 30 days left · Max performance mode',
  emoji: '⚡',
  dailyGoalMinutes: 180,
  habits: [
    { name: 'Sabah Denemesi', nameTr: 'Sabah Denemesi', emoji: '📊', color: '#EF4444' },
    { name: 'Hata Analizi', nameTr: 'Hata Analizi', emoji: '🔍', color: '#F59E0B' },
    { name: 'Akşam Tekrarı', nameTr: 'Akşam Tekrarı', emoji: '🌙', color: '#6366F1' },
  ],
  tasks: [
    { titleTr: `${examName}'a kaç gün kaldığını hesapla ve not al`, titleEn: `Count and note days until ${examName}`, priority: 'High' },
    { titleTr: 'Mock sınav takvimini oluştur (gün aşırı deneme)', titleEn: 'Create mock exam schedule (every other day)', priority: 'High' },
    { titleTr: 'En zayıf 5 konuyu listele ve önceliklendir', titleEn: 'List your 5 weakest topics and prioritize them', priority: 'High' },
    { titleTr: 'Son haftaya "sadece tekrar" bloğu ayır', titleEn: 'Reserve final week for review-only blocks', priority: 'Medium' },
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
    { titleTr: 'Gece çalışma alanını hazırla ve aydınlat', titleEn: 'Set up and light your night study space', priority: 'High' },
    { titleTr: 'Teravih saatine göre günlük programı düzenle', titleEn: 'Adjust daily schedule around Tarawih time', priority: 'High' },
    { titleTr: 'Ramazan hedeflerini yaz (ibadet + dünya)', titleEn: 'Write Ramadan goals (spiritual + worldly)', priority: 'Medium' },
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
  { titleTr: 'İftar planlaması yap', titleEn: 'Plan iftar meals', priority: 'Medium' },
  { titleTr: 'Ramazan hedeflerini belirle', titleEn: 'Set Ramadan goals', priority: 'Medium' },
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
    { titleTr: 'Haftalık kelime/sayfa hedefi belirle', titleEn: 'Set weekly word/page target', priority: 'Medium' },
    { titleTr: 'Danışmanla düzenli toplantı planla', titleEn: 'Schedule regular advisor meetings', priority: 'Medium' },
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
    { titleTr: 'İlk milestone\'u bu hafta tamamla', titleEn: 'Complete first milestone this week', priority: 'High' },
    { titleTr: 'Düzenli beyin fırtınası seansı planla', titleEn: 'Plan regular brainstorming sessions', priority: 'Low' },
  ],
});

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
    { titleTr: `${company} için şirket araştırması yap`, titleEn: `Research ${company} thoroughly`, priority: 'High' },
    { titleTr: 'CV\'yi pozisyona göre güncelle', titleEn: 'Update CV for the position', priority: 'High' },
    { titleTr: 'En zayıf teknik konularını listele ve önceliklendir', titleEn: 'List weakest technical topics and prioritize', priority: 'High' },
    { titleTr: 'Pratikte çöz: 50 medium LeetCode sorusu', titleEn: 'Practice: solve 50 medium LeetCode problems', priority: 'Medium' },
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

export function getTezMode(projectName: string, deadline: string): TurkishMode {
  const days = Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000));
  const name = projectName.trim() || 'Proje';
  return {
    type: 'tez',
    labelTr: `${name} Hazırlığı`,
    labelEn: `${name} Prep`,
    subtitleTr: days > 0 ? `${days} gün kaldı · Çalışma planını seç` : `Bugün · Teslim günü!`,
    subtitleEn: days > 0 ? `${days} days left · Pick your plan` : `Today · Deadline!`,
    emoji: '📝',
    daysLeft: days,
    habits: [],
    tasks: [],
    templates: [TEMPLATE_TEZ_WRITING(name), TEMPLATE_TEZ_MILESTONE(name)],
  };
}

export function getMulakatMode(company: string, date: string): TurkishMode {
  const days = Math.max(0, Math.ceil((new Date(date).getTime() - Date.now()) / 86400000));
  const name = company.trim() || 'Mülakat';
  return {
    type: 'mulakat',
    labelTr: `${name} Mülakatı`,
    labelEn: `${name} Interview`,
    subtitleTr: days > 0 ? `${days} gün kaldı · Hazırlık planını seç` : `Bugün · Mülakat günü!`,
    subtitleEn: days > 0 ? `${days} days left · Pick your prep plan` : `Today · Interview day!`,
    emoji: '💼',
    daysLeft: days,
    habits: [],
    tasks: [],
    templates: [TEMPLATE_MULAKAT_TEKNIK(name), TEMPLATE_MULAKAT_BEHAVIORAL(name)],
  };
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
      return `${name}'a 30 gün kala başla · Yeni konu yok, sadece pekiştirme`;
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
      return `Start 30 days before ${name} · No new topics — reinforcement only`;
    default:
      return 'Multiple choice exams · Factual knowledge';
  }
}

export function getCustomExamMode(examName: string, examDate: string, examTipTr?: string, examTipEn?: string): TurkishMode {
  const days = Math.max(0, Math.ceil((new Date(examDate).getTime() - Date.now()) / 86400000));
  const name = examName.trim() || 'Sınav';
  const isLastMonth = days <= 30;
  const n = name.toUpperCase();
  const isMemHeavy = ['KPSS', 'TUS', 'DUS', 'YDS', 'YOKDIL', 'YÖKDİL', 'IELTS', 'TOEFL', 'GRE', 'GMAT', 'USMLE'].some(e => n.includes(e));
  const isQHeavy = ['YKS', 'TYT', 'AYT', 'LGS', 'ALES', 'DGS', 'KPSS', 'MSÜ', 'MSU', 'PMYO'].some(e => n.includes(e));
  const isLanguage = ['YDS', 'YOKDIL', 'YÖKDİL', 'IELTS', 'TOEFL', 'GRE', 'GMAT'].some(e => n.includes(e));
  const isMedical = ['TUS', 'DUS', 'USMLE'].some(e => n.includes(e));
  const rawTemplates = isLastMonth
    ? [TEMPLATE_SPRINT(name), TEMPLATE_ACTIVE_RECALL(name), TEMPLATE_DEEP_WORK(name)]
    : [TEMPLATE_ACTIVE_RECALL(name), TEMPLATE_SPACED_REPETITION(name), TEMPLATE_DEEP_WORK(name), TEMPLATE_SPRINT(name)];
  const templates = rawTemplates.map(t => ({
    ...t,
    targetTr: examTemplateTargetTr(t.id, name, isMemHeavy, isQHeavy, isLanguage, isMedical),
    targetEn: examTemplateTargetEn(t.id, name, isMemHeavy, isQHeavy, isLanguage, isMedical),
  }));
  return {
    type: 'exam',
    labelTr: `${name} Hazırlığı`,
    labelEn: `${name} Prep`,
    subtitleTr: days > 0 ? `${days} gün kaldı · Planını seç` : `Bugün · Son gün!`,
    subtitleEn: days > 0 ? `${days} days left · Pick your plan` : `Today · Last day!`,
    emoji: '🎯',
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

export function getModePreview(type: ModeType, opts?: { examName?: string; examDate?: string; examTipTr?: string; examTipEn?: string; tezName?: string; tezDate?: string; mulakatName?: string; mulakatDate?: string }): TurkishMode {
  if (type === 'ramazan') {
    const next = nextDate(RAMAZAN);
    const date = new Date(next).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
    return { ...RAMAZAN_MODE(0), subtitleTr: `${date}'den itibaren aktif`, subtitleEn: `Activates from ${date}` };
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
    const days = isActive(r.start, r.end, 0);
    if (days >= 0) return RAMAZAN_MODE(days);
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
