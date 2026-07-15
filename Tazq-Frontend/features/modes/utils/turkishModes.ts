import { CategoryColors } from '@/shared/constants/Colors';
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
  descTr?: string;
  descEn?: string;
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

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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
    { name: 'Günlük Soru Çözümü', nameTr: 'Günlük Soru Çözümü', emoji: '📝', color: CategoryColors.blue },
    { name: 'Hata Defteri', nameTr: 'Hata Defteri', emoji: '❌', color: CategoryColors.red },
    { name: 'Konu Mini Testi', nameTr: 'Konu Mini Testi', emoji: '🎯', color: CategoryColors.green },
  ],
  tasks: [
    { 
      titleTr: 'Soru bankası temin et', 
      titleEn: 'Get a question bank', 
      descTr: `${examName} hazırlık sürecinde kullanacağınız güncel soru bankasını bulun veya satın alın.`,
      descEn: `Find or purchase an up-to-date question bank for your ${examName} preparation.`,
      priority: 'High' 
    },
    { 
      titleTr: 'Hata defteri oluştur', 
      titleEn: 'Create error log', 
      descTr: 'Yanlış yaptığınız soruları ve çözümlerini kaydetmek için fiziksel veya dijital (Notion vb.) bir hata defteri oluşturun.',
      descEn: 'Create a physical or digital (Notion, etc.) error log to track and review questions you get wrong.',
      priority: 'High' 
    },
    { 
      titleTr: 'Tarama denemesi çöz', 
      titleEn: 'Solve diagnostic test', 
      descTr: 'Seviyenizi belirlemek için ilk tarama deneme sınavını çözün ve eksik olduğunuz konuları tespit edin.',
      descEn: 'Take a diagnostic practice test to identify your current level and weak subject areas.',
      priority: 'High' 
    },
    { 
      titleTr: 'Günlük soru hedefi belirle', 
      titleEn: 'Set daily question target', 
      descTr: 'Kendinize günlük çözebileceğiniz gerçekçi bir soru hedefi belirleyin (en az 30 soru önerilir).',
      descEn: 'Determine a realistic daily question goal (minimum 30 questions recommended).',
      priority: 'Medium' 
    },
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
    { name: 'Kart Tekrarı', nameTr: 'Kart Tekrarı', emoji: '🔄', color: CategoryColors.indigo },
    { name: 'Yeni Kart Ekleme', nameTr: 'Yeni Kart Ekleme', emoji: '➕', color: CategoryColors.violet },
    { name: 'Konu Özeti Yazma', nameTr: 'Konu Özeti Yazma', emoji: '✍️', color: CategoryColors.pink },
  ],
  tasks: [
    { 
      titleTr: 'Anki veya Quizlet kur', 
      titleEn: 'Set up Anki or Quizlet', 
      descTr: 'Aralıklı tekrar için dijital kart uygulaması olan Anki veya Quizlet\'i kurun ve ilk çalışma destenizi oluşturun.',
      descEn: 'Install Anki or Quizlet for spaced repetition and initialize your first study deck.',
      priority: 'High' 
    },
    { 
      titleTr: 'Müfredatı kartlara böl', 
      titleEn: 'Split syllabus into cards', 
      descTr: `${examName} konularını ve kavramlarını kısa bilgi kartlarına (flashcard) dönüştürmek için parçalara ayırın.`,
      descEn: `Deconstruct the ${examName} syllabus into bite-sized concepts suitable for flashcards.`,
      priority: 'High' 
    },
    { 
      titleTr: 'Tekrar takvimi oluştur', 
      titleEn: 'Create review schedule', 
      descTr: 'Öğrendiğiniz bilgilerin kalıcı olması için 7 günlük aralıklı tekrar planı hazırlayın.',
      descEn: 'Design a 7-day spaced repetition calendar to reinforce new concepts.',
      priority: 'Medium' 
    },
    { 
      titleTr: 'İlk 50 kartı oluştur', 
      titleEn: 'Create first 50 cards', 
      descTr: 'Öğrendiğiniz önemli tanımları ve formülleri içeren ilk 50 bilgi kartını bugün hazırlayın.',
      descEn: 'Prepare your first 50 flashcards containing definitions, formulas, or key facts today.',
      priority: 'Medium' 
    },
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
    { name: 'Sabah Odak Bloğu', nameTr: 'Sabah Odak Bloğu', emoji: '🌅', color: CategoryColors.amber },
    { name: 'Öğleden Sonra Bloğu', nameTr: 'Öğleden Sonra Bloğu', emoji: '☀️', color: CategoryColors.blue },
    { name: 'Günlük 3 Hedef', nameTr: 'Günlük 3 Hedef', emoji: '📋', color: CategoryColors.green },
  ],
  tasks: [
    { 
      titleTr: 'Çalışma alanını düzenle', 
      titleEn: 'Set up study space', 
      descTr: 'Çalışma masanızı dikkatinizi dağıtmayacak şekilde düzenleyin ve telefonunuzu mutlaka başka bir odaya bırakın.',
      descEn: 'Organize your desk to eliminate distractions and keep your phone in another room.',
      priority: 'High' 
    },
    { 
      titleTr: 'Haftalık konu planı yap', 
      titleEn: 'Create weekly topic plan', 
      descTr: `${examName} müfredatına göre bu hafta hangi konulara odaklanacağınızı net bir şekilde belirleyin.`,
      descEn: `Define exactly which subject areas and chapters you will focus on this week for ${examName}.`,
      priority: 'High' 
    },
    { 
      titleTr: 'Sabah bloğu için alarm kur', 
      titleEn: 'Set alarm for morning block', 
      descTr: 'Güne erken ve zinde başlamak için sabah en geç 08:00\'e alarm kurun ve çalışma bloğunu başlatın.',
      descEn: 'Set an alarm by 08:00 AM to kick off your first focused morning study session.',
      priority: 'Medium' 
    },
    { 
      titleTr: 'Site engelleyici kur', 
      titleEn: 'Install site blocker', 
      descTr: 'Sosyal medya ve dikkat dağıtıcı web sitelerine erişimi engellemek için Cold Turkey veya benzeri bir uygulama kurun.',
      descEn: 'Install Cold Turkey or a similar tool to block social media and distracting websites during study blocks.',
      priority: 'Low' 
    },
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
    { name: 'Sabah Denemesi', nameTr: 'Sabah Denemesi', emoji: '📊', color: CategoryColors.red },
    { name: 'Hata Analizi', nameTr: 'Hata Analizi', emoji: '🔍', color: CategoryColors.amber },
    { name: 'Akşam Tekrarı', nameTr: 'Akşam Tekrarı', emoji: '🌙', color: CategoryColors.indigo },
  ],
  tasks: [
    { 
      titleTr: 'Mock sınav takvimini oluştur', 
      titleEn: 'Build mock exam schedule', 
      descTr: 'Mock sınav takvimini oluşturun: Hangi günler deneme sınavı çözeceksiniz, hangi günler hata analizi yapacaksınız belirleyin.',
      descEn: 'Build mock exam schedule: Determine which days are for test practice and which are for error analysis.',
      priority: 'High' 
    },
    { 
      titleTr: 'En zayıf 5 konuyu listele', 
      titleEn: 'List 5 weakest topics', 
      descTr: 'En zayıf olduğunuz 5 konuyu listeleyin ve her birine bu haftadan başlayarak çalışacağınız özel birer gün atayın.',
      descEn: 'List your 5 weakest topics and assign each a study day starting this week.',
      priority: 'High' 
    },
    { 
      titleTr: 'Son deneme sonucunu analiz et', 
      titleEn: 'Analyze last mock result', 
      descTr: 'Bir önceki denemenizi çıkarın: Hangi soruları yanlış yaptınız, hangi konuları tekrar etmeniz gerekiyor analiz edin.',
      descEn: 'Review your last mock test: Check which questions failed and identify which topics need review.',
      priority: 'High' 
    },
    { 
      titleTr: 'Son haftayı tekrara ayır', 
      titleEn: 'Set final week for review', 
      descTr: 'Son haftayı sadece konu tekrarlarına ayırın; o haftadan itibaren kesinlikle yeni bir konu çalışmaya başlamayın.',
      descEn: 'Designate the final week as review-only — do not start any new study topics after that point.',
      priority: 'Medium' 
    },
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
    { name: 'Konu Okuma', nameTr: 'Günlük Konu Okuma', emoji: '📖', color: CategoryColors.blue },
    { name: 'Kavram Haritası', nameTr: 'Kavram Haritası Çıkarma', emoji: '🗺️', color: CategoryColors.violet },
    { name: 'Temel Soru Çözümü', nameTr: 'Temel Soru Çözümü', emoji: '✏️', color: CategoryColors.green },
  ],
  tasks: [
    { 
      titleTr: 'Müfredatı listele ve böl', 
      titleEn: 'List syllabus and split', 
      descTr: `${examName} müfredatını tam liste halinde çıkartın ve haftalık/aylık çalışabileceğiniz küçük konu başlıklarına bölün.`,
      descEn: `Create a full list of the ${examName} syllabus and split it into manageable weekly study topics.`,
      priority: 'High' 
    },
    { 
      titleTr: 'Kaynak kitapları belirle', 
      titleEn: 'Choose study books', 
      descTr: 'Konu anlatımı ve soru çözümü için kendinize en fazla 2 veya 3 kaliteli ana kaynak kitap belirleyin.',
      descEn: 'Select a maximum of 2 to 3 high-quality textbooks or resource guides for your study preparation.',
      priority: 'High' 
    },
    { 
      titleTr: 'Aylık konu takvimi yap', 
      titleEn: 'Create monthly topic calendar', 
      descTr: 'Önünüzdeki aylar için hangi konuyu ne zaman bitireceğinizi planlayan gerçekçi bir konu takvimi hazırlayın.',
      descEn: 'Draft a realistic calendar outlining when you will cover and complete each major syllabus topic.',
      priority: 'High' 
    },
    { 
      titleTr: 'Teşhis denemesi çöz', 
      titleEn: 'Take diagnostic test', 
      descTr: 'Bilgi seviyenizi ölçmek için başlangıç teşhis denemesi çözün ve eksik olduğunuz konuları not edin.',
      descEn: 'Complete an initial diagnostic practice test to pinpoint your current performance and flag weak areas.',
      priority: 'Medium' 
    },
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
    { name: 'Teravih Namazı', nameTr: 'Teravih Namazı', emoji: '🤲', color: CategoryColors.indigo },
    { name: 'Teravih Sonrası Çalışma', nameTr: 'Teravih Sonrası Çalışma', emoji: '📚', color: CategoryColors.violet },
    { name: 'Gece Kuran Okuma', nameTr: 'Gece Kuran Okuma', emoji: '📖', color: CategoryColors.green },
    { name: 'Şükür Günlüğü', nameTr: 'Şükür Günlüğü', emoji: '🙏', color: CategoryColors.pink },
  ],
  tasks: [
    { 
      titleTr: 'Gece çalışma alanını hazırla', 
      titleEn: 'Set up night study space', 
      descTr: 'Çalışma alanınızı geceye hazırlayın: Masayı düzenleyin, lambayı ayarlayın, suyunuzu alın ve telefonunuzu sessiz moda geçirin.',
      descEn: 'Set up your study space for the night: clean desk, turn on lamp, grab water, and put phone on silent.',
      priority: 'High' 
    },
    { 
      titleTr: 'Teravih sonrası çalışma bloğu ekle', 
      titleEn: 'Schedule study after Tarawih', 
      descTr: 'Bu akşamki teravih namazı saatini öğrenin ve bittikten sonraki 60 dakikalık çalışma bloğunu takviminize ekleyin.',
      descEn: 'Find tonight\'s Tarawih time and block a 60-minute study session after it in your calendar.',
      priority: 'High' 
    },
    { 
      titleTr: 'Hedeflerini çalışma alanına as', 
      titleEn: 'Post your goals in study area', 
      descTr: 'Kendinize 3 ibadet ve 3 dünya hedefi yazın ve çalışma alanınıza görünür bir şekilde asın.',
      descEn: 'Write down 3 spiritual and 3 worldly goals and post them visibly in your study area.',
      priority: 'Medium' 
    },
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
    { name: 'Sahur Uyanışı', nameTr: 'Sahur Uyanışı', emoji: '⏰', color: CategoryColors.amber },
    { name: 'Sahur Sonrası Çalışma', nameTr: 'Sahur Sonrası Çalışma', emoji: '📚', color: CategoryColors.blue },
    { name: 'Dua & Zikir', nameTr: 'Dua & Zikir', emoji: '☪️', color: CategoryColors.indigo },
    { name: 'İftar Hazırlığı', nameTr: 'İftar Hazırlığı', emoji: '🍽️', color: CategoryColors.green },
  ],
  tasks: [
    { 
      titleTr: 'Sahur alarmını kur', 
      titleEn: 'Set Suhoor alarm', 
      descTr: 'Sahur alarmını kurun. Sahur sonrası hemen çalışmaya başlamak için uyanma saatinizi 30 dakika erkene planlayın.',
      descEn: 'Set your Suhoor alarm 30 minutes earlier than usual to leave time for study after the meal.',
      priority: 'High' 
    },
    { 
      titleTr: 'Çalışma materyalini masada hazırla', 
      titleEn: 'Prepare study materials', 
      descTr: 'Sahur masasındaki veya çalışma masanızdaki kitap, defter ve notlarınızı şimdiden hazırlayın.',
      descEn: 'Prepare your study books, laptop, or notepad on the table ahead of time.',
      priority: 'Medium' 
    },
    { 
      titleTr: 'Günlük niyet kartı yaz', 
      titleEn: 'Write daily intention card', 
      descTr: 'Güne başlarken bir niyet kartı yazın: Kendinize 1 ibadet ve 1 dünya hedefi belirleyin.',
      descEn: 'Write a daily intention card: Set 1 spiritual and 1 worldly goal for the day.',
      priority: 'Medium' 
    },
  ],
};

// Persona temelli profiller — Gece/Sahur vakit odaklıyken bunlar yaşam durumuna göre.
const TEMPLATE_RAMAZAN_OGRENCI: StudyTemplate = {
  id: 'ramazan-ogrenci',
  titleTr: 'Öğrenci Dengesi',
  titleEn: 'Student Balance',
  descTr: 'Ramazan okul/sınav dönemine denk geldiğinde düşük enerjiyi yönetmek esastır. Kısa ama düzenli çalışma bloklarını ibadet ritmiyle harmanlayan, sürdürülebilir bir rutin.',
  descEn: 'When Ramadan overlaps with school/exams, managing low energy is key. A sustainable routine blending short, regular study blocks with a worship rhythm.',
  targetTr: '🎓 Okul/sınav dönemi · Oruçluyken derse odaklanmakta zorlanan öğrenciler',
  targetEn: '🎓 School/exam season · Students who struggle to focus on lessons while fasting',
  emoji: '🎓',
  dailyGoalMinutes: 50,
  habits: [
    { name: 'Sabah Tekrar', nameTr: 'Sabah Tekrar', emoji: '📖', color: CategoryColors.blue },
    { name: 'Öğleden Sonra Kısa Çalışma', nameTr: 'Öğleden Sonra Kısa Çalışma', emoji: '✏️', color: CategoryColors.violet },
    { name: 'Teravih / Akşam İbadeti', nameTr: 'Teravih / Akşam İbadeti', emoji: '🤲', color: CategoryColors.indigo },
    { name: 'Dua & Zikir', nameTr: 'Dua & Zikir', emoji: '☪️', color: CategoryColors.green },
  ],
  tasks: [
    { 
      titleTr: 'Ders programını oruca göre düzenle', 
      titleEn: 'Rearrange study plan for fasting', 
      descTr: 'Haftalık ders ve çalışma programınızı oruç saatlerine (özellikle iftar öncesi ve sahur sonrası verimli saatlere) göre yeniden düzenleyin.',
      descEn: 'Rearrange your weekly study schedule around fasting hours (such as high-energy periods after Suhoor).',
      priority: 'High' 
    },
    { 
      titleTr: 'En verimli saatine ağır dersleri koy', 
      titleEn: 'Schedule hard subjects for high energy', 
      descTr: 'Günün en verimli olduğunuz saatini belirleyin (örneğin sahur sonrası veya sabah saatleri) ve en ağır dersleri o saatlere yerleştirin.',
      descEn: 'Identify your peak energy hour of the day and schedule your most difficult subjects during that block.',
      priority: 'Medium' 
    },
    { 
      titleTr: 'Sınav ve ödev takvimi oluştur', 
      titleEn: 'Set exam and homework calendar', 
      descTr: 'Ramazan ayı içindeki tüm sınav ve ödev teslim tarihlerini takviminize işleyin ve TAZQ üzerinde geri sayım kurun.',
      descEn: 'Add all exam and homework due dates to your calendar and configure countdown indicators in TAZQ.',
      priority: 'Medium' 
    },
  ],
};

const TEMPLATE_RAMAZAN_CALISAN: StudyTemplate = {
  id: 'ramazan-calisan',
  titleTr: 'Çalışan Ritmi',
  titleEn: 'Working Rhythm',
  descTr: 'Tam gün iş + oruç enerji yönetimi ister. Zorlu işleri yüksek enerjili sabah saatlerine alıp ibadeti güne yedirerek hem verimi hem huzuru korur.',
  descEn: 'A full workday plus fasting demands energy management. Schedule hard work in high-energy morning hours and weave worship into the day to protect both output and peace.',
  targetTr: '💼 Tam zamanlı çalışan · Oruçluyken iş verimini korumak isteyenler',
  targetEn: '💼 Full-time worker · Those who want to keep work performance while fasting',
  emoji: '💼',
  dailyGoalMinutes: 40,
  habits: [
    { name: 'Sahur + Güne Niyet', nameTr: 'Sahur + Güne Niyet', emoji: '⏰', color: CategoryColors.amber },
    { name: 'Öğle Mini Dinlenme', nameTr: 'Öğle Mini Dinlenme', emoji: '☕', color: CategoryColors.blue },
    { name: 'İş Sonrası İbadet Bloğu', nameTr: 'İş Sonrası İbadet Bloğu', emoji: '🤲', color: CategoryColors.indigo },
    { name: 'Su & Beslenme Dengesi', nameTr: 'Su & Beslenme Dengesi', emoji: '💧', color: CategoryColors.green },
  ],
  tasks: [
    { 
      titleTr: 'Zor işleri sabahın ilk saatlerine al', 
      titleEn: 'Move hard tasks to morning', 
      descTr: 'Enerjinizin en yüksek olduğu sabah saatlerine günün en zorlu işlerini ve odaklanma gerektiren görevlerini yerleştirin.',
      descEn: 'Schedule your most complex and high-focus work for the early morning hours when energy is highest.',
      priority: 'High' 
    },
    { 
      titleTr: 'Toplantıları öğleden önceye planla', 
      titleEn: 'Schedule meetings before noon', 
      descTr: 'Mümkünse iş toplantılarınızı öğleden önceye çekin; böylece öğleden sonraki düşük enerjili saatlerde sunum ve raporlama gibi işlerle ilgilenebilirsiniz.',
      descEn: 'Try to schedule meetings before noon to preserve afternoon slots for low-energy tasks like reporting.',
      priority: 'Medium' 
    },
    { 
      titleTr: 'İftar sonrası dinlenme ve ibadet bloğu kur', 
      titleEn: 'Plan rest and worship block after Iftar', 
      descTr: 'İftardan hemen sonra kendinize 30 dakikalık bir dinlenme ve ibadet bloğu planlayın.',
      descEn: 'Designate a 30-minute block immediately after Iftar for quiet rest and spiritual reflection.',
      priority: 'Medium' 
    },
  ],
};

// Default habits/tasks for modes that don't use template selection
const RAMAZAN_DEFAULT_HABITS: ModeHabit[] = [
  { name: 'Teravih Namazı', nameTr: 'Teravih Namazı', emoji: '🤲', color: CategoryColors.indigo },
  { name: 'Kuran Okuma', nameTr: 'Kuran Okuma', emoji: '📖', color: CategoryColors.violet },
  { name: 'Sahur Uyanışı', nameTr: 'Sahur Uyanışı', emoji: '⏰', color: CategoryColors.amber },
  { name: 'Dua & Zikir', nameTr: 'Dua & Zikir', emoji: '☪️', color: CategoryColors.green },
];

const RAMAZAN_DEFAULT_TASKS: ModeTask[] = [
  { titleTr: 'Zekat hesapla ve öde', titleEn: 'Calculate and pay Zakat', priority: 'High' },
  { 
    titleTr: 'İftar ve sahur menüsü hazırla', 
    titleEn: 'Plan iftar and suhoor menu', 
    descTr: 'Bu hafta için iftar menüsü hazırlayın: 3 ana yemek belirleyin ve sahur alışveriş listesi yapın.',
    descEn: 'Plan this week\'s iftar menu: choose 3 main dishes and write a suhoor shopping list.',
    priority: 'Medium' 
  },
  { 
    titleTr: 'İbadet ve dünya hedeflerini yaz', 
    titleEn: 'Write spiritual and worldly goals', 
    descTr: 'Kendinize 3 ibadet ve 3 dünya hedefi yazıp görünür bir yere asın (telefon kilit ekranı veya duvar gibi).',
    descEn: 'Write down 3 spiritual and 3 worldly goals and place them somewhere visible (like your phone lock screen or wall).',
    priority: 'Medium' 
  },
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
  templates: [TEMPLATE_RAMAZAN_GECE, TEMPLATE_RAMAZAN_SABAH, TEMPLATE_RAMAZAN_OGRENCI, TEMPLATE_RAMAZAN_CALISAN],
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
    { name: 'Günlük Yazım Oturumu', nameTr: 'Günlük Yazım Oturumu', emoji: '✍️', color: CategoryColors.violet },
    { name: 'Kaynak & Literatür Okuma', nameTr: 'Kaynak & Literatür Okuma', emoji: '📚', color: CategoryColors.indigo },
    { name: 'Danışman İletişimi', nameTr: 'Danışman İletişimi', emoji: '🤝', color: CategoryColors.green },
  ],
  tasks: [
    { 
      titleTr: 'Taslak anahat oluştur', 
      titleEn: 'Create rough outline', 
      descTr: `${projectName} çalışmanızın bölümlerini ve ana başlıklarını içeren bir taslak anahat (outline) hazırlayın.`,
      descEn: `Develop a structured chapter and section outline for your ${projectName}.`,
      priority: 'High' 
    },
    { 
      titleTr: 'Kaynak yöneticisi kur', 
      titleEn: 'Set up reference manager', 
      descTr: 'Akademik atıflarınızı ve kaynakçanızı kolayca yönetmek için Zotero, Mendeley veya benzeri bir yazılım kurun.',
      descEn: 'Install Zotero, Mendeley, or a similar tool to easily manage academic references and citations.',
      priority: 'High' 
    },
    { 
      titleTr: 'İlk 500 kelimeyi yaz', 
      titleEn: 'Write first 500 words', 
      descTr: 'Günlük yazacağınız kelime hedefini belirleyin ve bugün başlangıç olarak ilk 500 kelimenizi yazın.',
      descEn: 'Determine your daily word count target and write your first 500 words today.',
      priority: 'Medium' 
    },
    { 
      titleTr: 'Danışmana ilerleme raporu at', 
      titleEn: 'Email progress to advisor', 
      descTr: 'Danışman hocanıza bu hafta yaptığınız ilerlemelerin özetini içeren bir e-posta atın ve bir sonraki toplantı tarihini talep edin.',
      descEn: 'Send a progress update email to your advisor and request a date for your next sync.',
      priority: 'Medium' 
    },
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
    { name: 'Araştırma / Veri Toplama', nameTr: 'Araştırma / Veri Toplama', emoji: '🔬', color: CategoryColors.blue },
    { name: 'Yaratıcı Düşünme Bloğu', nameTr: 'Yaratıcı Düşünme Bloğu', emoji: '💡', color: CategoryColors.amber },
    { name: 'Günlük İlerleme Notu', nameTr: 'Günlük İlerleme Notu', emoji: '📔', color: CategoryColors.pink },
  ],
  tasks: [
    { 
      titleTr: '3 aylık milestone planı yap', 
      titleEn: 'Create 3-month milestone plan', 
      descTr: `${projectName} sürecinde 3 ay boyunca ulaşmak istediğiniz temel aşamaları (milestones) ve hedefleri belirleyin.`,
      descEn: `Outline major milestones and delivery goals to achieve over the next 3 months for ${projectName}.`,
      priority: 'High' 
    },
    { 
      titleTr: 'Proje takip panosu kur', 
      titleEn: 'Set up tracking board', 
      descTr: 'Görevlerinizi görselleştirmek ve takvim planını izlemek için Notion veya Trello üzerinde bir proje tahtası hazırlayın.',
      descEn: 'Initialize a Kanban tracking board on Notion or Trello to visualize tasks and deadlines.',
      priority: 'High' 
    },
    { 
      titleTr: "İlk milestone'u tanımla", 
      titleEn: 'Define first milestone', 
      descTr: 'Bu hafta içinde tamamlayacağınız ilk önemli teslimatı netleştirin ve hedef bitiş tarihini takviminize işleyin.',
      descEn: 'Specify the first concrete deliverable to complete this week and pin the deadline to your calendar.',
      priority: 'High' 
    },
    { 
      titleTr: '30 dk beyin fırtınası yap', 
      titleEn: 'Do 30-min brainstorm', 
      descTr: 'Bugün 30 dakika odaklanıp araştırma sorunuzu, tezinizin ana argümanını ve 3 adet olası bölüm başlığını kağıda dökün.',
      descEn: 'Allocate 30 minutes to brainstorm your core research question, central thesis, and 3 candidate chapter titles.',
      priority: 'Low' 
    },
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
    { name: 'Günlük Kod', nameTr: 'Günlük kod yazımı / commit', emoji: '💻', color: CategoryColors.blue },
    { name: 'Sprint Review', nameTr: 'Haftalık sprint review & planlama', emoji: '🔄', color: CategoryColors.violet },
    { name: 'Test', nameTr: 'Test yaz / çalıştır', emoji: '🧪', color: CategoryColors.green },
  ],
  tasks: [
    { 
      titleTr: 'Kullanıcı hikayelerini listele', 
      titleEn: 'List user stories', 
      descTr: `${projectName} kapsamında geliştireceğiniz özelliklerin kullanıcı hikayelerini (User Stories) liste halinde hazırlayın.`,
      descEn: `Write down detailed user stories for the features you plan to build for ${projectName}.`,
      priority: 'High' 
    },
    { 
      titleTr: 'Git reposu kur', 
      titleEn: 'Set up Git repository', 
      descTr: 'Projeniz için GitHub veya GitLab\'de kod deposu açın ve Git branching (dal) stratejinizi netleştirin.',
      descEn: 'Create a GitHub or GitLab repository for the codebase and decide on your Git branching model.',
      priority: 'High' 
    },
    { 
      titleTr: 'MVP kapsamını tanımla', 
      titleEn: 'Define MVP scope', 
      descTr: 'Bu hafta içinde projenizin en sade ve çalışır halini (MVP) tanımlayın. Listede en fazla 3 özellik olmasına dikkat edin.',
      descEn: 'Define the Minimum Viable Product (MVP) scope for this week, focusing on a maximum of 3 core features.',
      priority: 'High' 
    },
    { 
      titleTr: 'CI/CD hattı kur', 
      titleEn: 'Set up CI/CD pipeline', 
      descTr: 'Kodunuzun otomatik test edilmesi ve yayına alınması için GitHub Actions veya Vercel entegrasyonu gibi bir CI/CD hattı kurun.',
      descEn: 'Configure a basic CI/CD pipeline using GitHub Actions, Vercel, or similar for automatic tests and deployments.',
      priority: 'Medium' 
    },
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
    { name: 'Günlük İlerleme', nameTr: 'Günlük ilerleme notu ve çıktı kaydı', emoji: '📋', color: CategoryColors.amber },
    { name: 'Paydaş İletişimi', nameTr: 'Paydaş güncelleme / e-posta / toplantı', emoji: '🤝', color: CategoryColors.green },
    { name: 'Risk Takibi', nameTr: 'Risk ve engel takibi', emoji: '⚠️', color: CategoryColors.red },
  ],
  tasks: [
    { 
      titleTr: 'Proje şartnamesini yaz', 
      titleEn: 'Write project scope', 
      descTr: `${projectName} çalışmasının sınırlarını çizen proje şartnamesini (scope) ve başarı kriterlerini dokümante edin.`,
      descEn: `Document a clear project scope statement and define key success metrics for ${projectName}.`,
      priority: 'High' 
    },
    { 
      titleTr: 'Paydaş ve iletişim planı yap', 
      titleEn: 'Make communication plan', 
      descTr: 'Projeden etkilenecek paydaşları belirleyin ve onlara yapılacak raporlama/toplantı sıklığını planlayın.',
      descEn: 'Identify project stakeholders and map out a structured communication/update schedule.',
      priority: 'High' 
    },
    { 
      titleTr: 'Proje takip aracı kur', 
      titleEn: 'Set up tracking tool', 
      descTr: 'Çalışmalarınızı ve görevlerinizi takip etmek için Jira, Notion veya Trello gibi bir yönetim paneli hazırlayın.',
      descEn: 'Set up a workspace in Jira, Notion, or Trello to track milestones, tasks, and issues.',
      priority: 'Medium' 
    },
    { 
      titleTr: 'Durum raporu şablonu yap', 
      titleEn: 'Prepare status template', 
      descTr: 'Haftalık ilerlemeyi paydaşlara hızlıca sunabilmek için sade bir durum raporu (status report) şablonu hazırlayın.',
      descEn: 'Draft a simple status update template to use for weekly stakeholder reporting.',
      priority: 'Medium' 
    },
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
    { name: 'Yazım Tamamlama', nameTr: 'Günlük yazım/revizyon bloğu (3+ saat)', emoji: '✍️', color: CategoryColors.red },
    { name: 'Bölüm Revizyonu', nameTr: 'Bölüm revizyonu & danışman bildirimi', emoji: '🔍', color: CategoryColors.amber },
    { name: 'Format Kontrolü', nameTr: 'Kaynakça & format standartları kontrolü', emoji: '📋', color: CategoryColors.indigo },
  ],
  tasks: [
    { 
      titleTr: 'Kalan bölümleri listele', 
      titleEn: 'List remaining sections', 
      descTr: `${projectName} çalışmanızın genel tamamlanma yüzdesini çıkartıp eksik olan kısımları liste halinde not edin.`,
      descEn: `Evaluate the current completion percentage of ${projectName} and checklist all remaining parts.`,
      priority: 'High' 
    },
    { 
      titleTr: 'Son taslağı danışmana ilet', 
      titleEn: 'Send final draft to advisor', 
      descTr: 'Projenin veya tezin son taslağını danışmanınıza gönderip geri bildirim alacağınız tarihi netleştirin.',
      descEn: 'Send the completed final draft to your advisor and establish a clear timeline for feedback.',
      priority: 'High' 
    },
    { 
      titleTr: 'Atıf formatını kontrol et', 
      titleEn: 'Check citation formatting', 
      descTr: 'Dokümandaki kaynakçanın ve atıfların belirlenen akademik format standartlarına (APA, MLA, IEEE vb.) uygunluğunu test edin.',
      descEn: 'Cross-check all references and citations against the specified academic formatting standard (APA, MLA, etc.).',
      priority: 'High' 
    },
    { 
      titleTr: 'Teslim şartlarını gözden geçir', 
      titleEn: 'Read submission requirements', 
      descTr: 'Kurumun belirlediği sayfa sınırı, kağıt cinsi, ciltleme ve format gibi teslim şartnamelerini detaylıca okuyun.',
      descEn: 'Review official guidelines regarding formatting, page limits, margins, and physical binding.',
      priority: 'Medium' 
    },
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
    { name: 'Günlük LeetCode / Algoritma', nameTr: 'Günlük LeetCode / Algoritma', emoji: '💻', color: CategoryColors.green },
    { name: 'Sistem Tasarımı Çalışması', nameTr: 'Sistem Tasarımı Çalışması', emoji: '🏗️', color: CategoryColors.blue },
    { name: 'Mock Mülakat', nameTr: 'Mock Mülakat', emoji: '🎙️', color: CategoryColors.violet },
  ],
  tasks: [
    { 
      titleTr: 'Şirket araştırması yap', 
      titleEn: 'Perform company research', 
      descTr: `${company} ile ilgili son haberleri okuyun, iş ilanındaki aranan şartları detaylıca inceleyin ve şirketin temel değerlerini not edin.`,
      descEn: `Read recent news about ${company}, analyze the job description requirements, and take note of their corporate values.`,
      priority: 'High' 
    },
    { 
      titleTr: 'CV\'yi ilana göre güncelle', 
      titleEn: 'Update CV for role', 
      descTr: 'Özgeçmişinizi pozisyona göre güncelleyin; iş ilanında geçen önemli kavram ve anahtar kelimeleri CV\'nize dahil edin.',
      descEn: 'Tailor your resume by highlighting experience and keywords that directly map to the job description.',
      priority: 'High' 
    },
    { 
      titleTr: 'Zayıf teknik konuları listele', 
      titleEn: 'List weak technical topics', 
      descTr: 'Mülakatta çıkabilecek en çok zorlandığınız teknik konuları (veri yapıları, algoritmalar, sistem tasarımı vb.) listeleyin ve önceliklendirin.',
      descEn: 'Identify and list your weakest technical areas (e.g. data structures, systems) to prioritize study.',
      priority: 'High' 
    },
    { 
      titleTr: '10 medium LeetCode çöz', 
      titleEn: 'Solve 10 medium LeetCode', 
      descTr: 'Bu hafta içinde en az 10 adet orta zorlukta LeetCode sorusu çözerek algoritma pratiği yapın. Array ve String konularından başlayabilirsiniz.',
      descEn: 'Solve 10 medium coding challenges on LeetCode this week, starting with array and string manipulation.',
      priority: 'Medium' 
    },
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
    { name: 'STAR Hikaye Pratiği', nameTr: 'STAR Hikaye Pratiği', emoji: '⭐', color: CategoryColors.amber },
    { name: 'Özgüven / Ses Tonu Pratiği', nameTr: 'Özgüven / Ses Tonu Pratiği', emoji: '🎙️', color: CategoryColors.green },
    { name: 'Günlük Öz-Yansıma', nameTr: 'Günlük Öz-Yansıma', emoji: '🪞', color: CategoryColors.pink },
  ],
  tasks: [
    { 
      titleTr: 'Değerleri ve kültürü oku', 
      titleEn: 'Read values and culture', 
      descTr: `${company} firmasının kurum kültürünü, vizyonunu ve çalışan değerlerini detaylıca inceleyin.`,
      descEn: `Explore and understand the core cultural pillars, mission, and employee values of ${company}.`,
      priority: 'High' 
    },
    { 
      titleTr: '5 adet STAR hikayesi yaz', 
      titleEn: 'Write 5 STAR stories', 
      descTr: 'Geçmiş projelerinizden başarı ve kriz durumlarını anlatan, STAR metoduna uygun 5 adet mülakat hikayesi hazırlayın.',
      descEn: 'Draft 5 behavior stories using the STAR method highlighting leadership, conflict resolution, or success.',
      priority: 'High' 
    },
    { 
      titleTr: 'Davranışsal soruları listele', 
      titleEn: 'List behavioral questions', 
      descTr: 'Sıkça karşılaşılan davranışsal ve IK mülakat sorularını listeleyin ve bunlara vereceğiniz cevapların ana hatlarını oluşturun.',
      descEn: 'Compile a list of common behavioral interview questions and outline your talking points.',
      priority: 'Medium' 
    },
    { 
      titleTr: '3 kez mock mülakat yap', 
      titleEn: 'Do 3 mock interviews', 
      descTr: 'Beden dilinizi ve konuşma hızınızı kontrol etmek için ayna karşısında veya kameraya kaydederek 3 kez mock mülakat provası yapın.',
      descEn: 'Practice your delivery, speed, and body language by conducting 3 mock interviews in front of a mirror or camera.',
      priority: 'Medium' 
    },
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
    { name: 'Case Pratik', nameTr: 'Günlük case çözümü (1 case/gün)', emoji: '🧩', color: CategoryColors.indigo },
    { name: 'Framework', nameTr: 'Framework ezber ve uygulama (MECE, Profitability)', emoji: '📐', color: CategoryColors.blue },
    { name: 'Math Drill', nameTr: 'Mental math hız pratiği (10 dk)', emoji: '🔢', color: CategoryColors.amber },
  ],
  tasks: [
    { 
      titleTr: 'Şirket ve pazar araştırması yap', 
      titleEn: 'Perform market research', 
      descTr: `${company} şirketinin pazar payını, rakip analizini, son dönemdeki projelerini ve vizyonunu araştırın.`,
      descEn: `Analyze the market position, competitors, recent projects, and corporate goals of ${company}.`,
      priority: 'High' 
    },
    { 
      titleTr: 'Vaka (case) kitabı edin', 
      titleEn: 'Get a case study book', 
      descTr: 'Danışmanlık vakalarına hazırlanmak için Case in Point veya Victor Cheng LOMS gibi temel başucu kaynaklarından birini edinin.',
      descEn: 'Acquire essential prep resources like "Case in Point" or Victor Cheng\'s LOMS to study consulting structures.',
      priority: 'High' 
    },
    { 
      titleTr: '5 temel framework\'ü öğren', 
      titleEn: 'Learn 5 core frameworks', 
      descTr: 'Vaka analizlerinde kullanılan 5 ana framework\'ü (Profitability, Market Entry, M&A, Operations, Pricing) öğrenip pratik edin.',
      descEn: 'Master the 5 key problem-solving frameworks: Profitability, Market Entry, M&A, Operations, and Pricing.',
      priority: 'High' 
    },
    { 
      titleTr: 'Eşli 3 mock case çöz', 
      titleEn: 'Solve 3 mock cases with peer', 
      descTr: 'Bir çalışma arkadaşı (peer) ile karşılıklı 3 vaka çalışması yapın; kendi sesinizi kaydederek çözüm sunumunuzu dinleyip geliştirin.',
      descEn: 'Conduct 3 mock case interviews with a study partner, recording your audio to review your logic and delivery.',
      priority: 'Medium' 
    },
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
    { name: 'Araştırma Özeti', nameTr: 'Araştırma özetini sesli anlat (3 dk)', emoji: '🔬', color: CategoryColors.violet },
    { name: 'Pedagoji', nameTr: 'Ders planı / öğretim felsefesi hazırlığı', emoji: '📚', color: CategoryColors.blue },
    { name: 'Soru Pratiği', nameTr: 'Muhtemel soruları yüksek sesle yanıtla', emoji: '🎙️', color: CategoryColors.green },
  ],
  tasks: [
    { 
      titleTr: 'Yayınları ve öncelikleri incele', 
      titleEn: 'Review research priorities', 
      descTr: `${company} kurumundaki akademisyenlerin/araştırmacıların son yayınlarını ve kurumun araştırma önceliklerini okuyun.`,
      descEn: `Analyze the recent publications and strategic research directions of the faculty or team at ${company}.`,
      priority: 'High' 
    },
    { 
      titleTr: '2 sayfalık araştırma özeti yaz', 
      titleEn: 'Write research statement', 
      descTr: 'Çalışmalarınızı ve gelecekteki araştırma hedeflerinizi özetleyen en fazla 2 sayfalık bir araştırma beyannamesi (research statement) hazırlayın.',
      descEn: 'Draft a concise 2-page statement outlining your past achievements and future research agenda.',
      priority: 'High' 
    },
    { 
      titleTr: 'Sunum (job talk) hazırla', 
      titleEn: 'Prepare job talk', 
      descTr: 'Mülakat kuruluna yapacağınız 45 dakikalık sunumu ve ardından gelecek 15 dakikalık soru-cevap bölümünün slaytlarını hazırlayın.',
      descEn: 'Design slides for a 45-minute technical presentation followed by a 15-minute Q&A block.',
      priority: 'High' 
    },
    { 
      titleTr: 'Öğretim felsefeni özetle', 
      titleEn: 'Summarize teaching philosophy', 
      descTr: 'Eğitime bakış açınızı ve öğretim metodolojinizi anlatan 1 sayfalık bir öğretim felsefesi (teaching philosophy) metni yazın.',
      descEn: 'Draft a 1-page document summarizing your educational values and pedagogical methodology.',
      priority: 'Medium' 
    },
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
    { name: 'Mock Mülakat', nameTr: 'Günlük mock mülakat (sesli/video)', emoji: '🎙️', color: CategoryColors.red },
    { name: 'STAR Tekrar', nameTr: 'STAR hikayelerini sesli tekrar et', emoji: '⭐', color: CategoryColors.amber },
    { name: 'Şirket Tarama', nameTr: 'Son dakika şirket/sektör haberleri', emoji: '🔍', color: CategoryColors.green },
  ],
  tasks: [
    { 
      titleTr: 'Son dakika haberlerini tara', 
      titleEn: 'Scan latest developments', 
      descTr: `${company} firması ve bağlı olduğu sektör ile ilgili yayınlanan en son haberleri ve duyuruları kontrol edin.`,
      descEn: `Check for any recent news, corporate reports, or industry alerts regarding ${company}.`,
      priority: 'High' 
    },
    { 
      titleTr: '3 STAR hikayesini sesli prova et', 
      titleEn: 'Rehearse 3 STAR stories', 
      descTr: 'En güvendiğiniz 3 adet STAR hikayesini sesli olarak anlatın ve mülakat süresine uygunluğunu (maksimum 2-3 dakika) süre tutarak test edin.',
      descEn: 'Practice telling your top 3 STAR stories out loud while timing them to ensure they stay under 3 minutes.',
      priority: 'High' 
    },
    { 
      titleTr: 'Zor soruların cevabını hazırla', 
      titleEn: 'Prepare answers for hard questions', 
      descTr: 'Karşılaşmaktan en çok çekindiğiniz zor soruyu (örneğin kariyer boşlukları, zayıf yönler) belirleyin ve cevabınızı netleştirin.',
      descEn: 'Pinpoint the interview question you dread most and refine a clear, confident response.',
      priority: 'High' 
    },
    { 
      titleTr: 'Lojistik planı bugün tamamla', 
      titleEn: 'Finalize logistics plan', 
      descTr: 'Giyeceğiniz kıyafeti hazırlayın, mülakat adresine giden rotayı kontrol edin ve lojistik planı bugün bitirerek mülakat sabahını rahat geçirin.',
      descEn: 'Choose your outfit, confirm travel route, and set up alarms today to avoid any rush on interview morning.',
      priority: 'Medium' 
    },
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

export function localizeSporGoal(goal: string | null | undefined, tr: boolean): string {
  if (!goal) return '';
  const g = goal.trim();
  const hasEmoji = g.startsWith('🏃') || g.startsWith('💪') || g.startsWith('⚖️') || g.startsWith('✨') || g.startsWith('🏆');
  if (g.includes('Kilo') || g.includes('Weight')) {
    return hasEmoji ? (tr ? '⚖️ Kilo Yönetimi' : '⚖️ Weight Management') : (tr ? 'Kilo Yönetimi' : 'Weight Management');
  }
  if (g.includes('Maraton') || g.includes('Marathon') || g.includes('Koşu') || g.includes('Running')) {
    return hasEmoji ? (tr ? '🏃 Maraton / Koşu' : '🏃 Marathon / Running') : (tr ? 'Maraton / Koşu' : 'Marathon / Running');
  }
  if (g.includes('Güç') || g.includes('Strength') || g.includes('Kas') || g.includes('Muscle')) {
    return hasEmoji ? (tr ? '💪 Güç & Kas' : '💪 Strength & Muscle') : (tr ? 'Güç & Kas' : 'Strength & Muscle');
  }
  if (g.includes('Genel Form') || g.includes('General Fitness')) {
    return hasEmoji ? (tr ? '✨ Genel Form' : '✨ General Fitness') : (tr ? 'Genel Form' : 'General Fitness');
  }
  if (g.includes('Spor Yarışması') || g.includes('Sport Competition') || g.includes('Yarışma') || g.includes('Competition')) {
    return hasEmoji ? (tr ? '🏆 Spor Yarışması' : '🏆 Sport Competition') : (tr ? 'Spor Yarışması' : 'Sport Competition');
  }
  return goal;
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
  const planWeeks = realWeeks;

  const lossSetupTasks: ModeTask[] = [
    {
      titleTr: `İlk antrenman: 30 dk tempolu yürüyüş`,
      titleEn: `First workout: 30 min brisk walk`,
      descTr: `Bugün 30 dk tempolu yürüyüş yapın. Nefesiniz hafif hızlanmalı fakat konuşurken zorlanmamalısınız.`,
      descEn: `Do a 30-minute brisk walk today. Your breathing should speed up slightly, but you should not struggle to talk.`,
      priority: 'High',
      daysFromNow: 0,
    },
    {
      titleTr: `Mutfak düzenlemesi yap`,
      titleEn: `Perform kitchen reset`,
      descTr: `Mutfaktaki şekerli içecekleri, beyaz ekmekleri ve paketli/işlenmiş atıştırmalıkları kaldırın.`,
      descEn: `Remove sugary drinks, white bread, and packaged or processed snacks from your kitchen.`,
      priority: 'High',
      daysFromNow: 0,
    },
    {
      titleTr: `Günlük protein hedefini belirle`,
      titleEn: `Determine daily protein target`,
      descTr: `Günlük protein hedefinizi belirleyin: ${cw > 0 ? Math.round(cw * (isFemale ? 1.4 : 1.6)) : (isFemale ? 90 : 100)}–${cw > 0 ? Math.round(cw * (isFemale ? 1.8 : 2.0)) : (isFemale ? 115 : 130)} g/gün arası tüketmeye çalışın.`,
      descEn: `Set daily protein target: aim for ${cw > 0 ? Math.round(cw * (isFemale ? 1.4 : 1.6)) : (isFemale ? 90 : 100)}–${cw > 0 ? Math.round(cw * (isFemale ? 1.8 : 2.0)) : (isFemale ? 115 : 130)} g/day.`,
      priority: 'Medium',
      daysFromNow: 1,
    },
    {
      titleTr: `Kilo yönetimi hedefini kaydet`,
      titleEn: `Save weight management goal`,
      descTr: `Kilo yönetimi hedefinizi sisteme kaydedin: Hedef ${cwStr} → ${twStr} (${planWeeks} haftada haftalık ${rateStr} değişim).`,
      descEn: `Save your weight management goal today: target ${cwStr} → ${twStr} (${rateStr}/week for ${planWeeks} weeks).`,
      priority: 'Medium',
      daysFromNow: 2,
    },
  ];

  const gainSetupTasks: ModeTask[] = [
    {
      titleTr: `Günlük kalori hedefini hesapla`,
      titleEn: `Calculate daily calorie target`,
      descTr: `Günlük kalori ihtiyacınızı (TDEE) hesaplayıp üzerine 300–500 kcal fazlasını ekleyin. Takip için MyFitnessPal benzeri bir uygulama kullanabilirsiniz.`,
      descEn: `Calculate daily calorie target: TDEE + 300–500 kcal surplus. Use MyFitnessPal or a similar app.`,
      priority: 'High',
      daysFromNow: 0,
    },
    {
      titleTr: `Direnç antrenmanı programı seç`,
      titleEn: `Choose resistance training program`,
      descTr: `Kendinize uygun bir direnç/ağırlık antrenmanı programı seçip ilk seansı tamamlayın (haftada 3–4 gün). Kas gelişimi için ağırlık antrenmanları zorunludur.`,
      descEn: `Choose a resistance training program and do your first session (3–4 days/week). Training is mandatory for muscle.`,
      priority: 'High',
      daysFromNow: 0,
    },
    {
      titleTr: `Günlük protein hedefini belirle`,
      titleEn: `Determine daily protein target`,
      descTr: `Günlük protein hedefinizi belirleyin: ${cw > 0 ? Math.round(cw * (isFemale ? 1.6 : 1.8)) : (isFemale ? 105 : 120)}–${cw > 0 ? Math.round(cw * (isFemale ? 2.0 : 2.2)) : (isFemale ? 130 : 150)} g/gün (yumurta, tavuk, yoğurt, baklagil vb.).`,
      descEn: `Daily protein target: aim for ${cw > 0 ? Math.round(cw * (isFemale ? 1.6 : 1.8)) : (isFemale ? 105 : 120)}–${cw > 0 ? Math.round(cw * (isFemale ? 2.0 : 2.2)) : (isFemale ? 130 : 150)} g/day (eggs, chicken, yogurt, legumes).`,
      priority: 'High',
      daysFromNow: 1,
    },
    {
      titleTr: `Kilo yönetimi hedefini kaydet`,
      titleEn: `Save weight management goal`,
      descTr: `Kilo yönetimi hedefinizi sisteme kaydedin: Hedef ${cwStr} → ${twStr} (${planWeeks} haftada haftalık ${rateStr} değişim).`,
      descEn: `Save your weight management goal today: target ${cwStr} → ${twStr} (${rateStr}/week for ${planWeeks} weeks).`,
      priority: 'Medium',
      daysFromNow: 2,
    },
  ];

  const tasks: ModeTask[] = losing ? lossSetupTasks : gainSetupTasks;

  const lossHabits = [
    { name: 'Hareket', nameTr: 'Günlük hareket (yürüyüş / egzersiz)', emoji: '🚶', color: CategoryColors.green },
    { name: 'Öğün', nameTr: 'Öğünleri atlamama & porsiyon kontrolü', emoji: '🥗', color: CategoryColors.amber },
    { name: 'Su', nameTr: 'Su tüketimi (günde 2–3 lt)', emoji: '💧', color: CategoryColors.blue },
    { name: 'Uyku', nameTr: 'Düzenli uyku (7–9 saat)', emoji: '😴', color: CategoryColors.violet },
  ];

  const gainHabits = [
    { name: 'Antrenman', nameTr: 'Direnç antrenmanı (programdaki günler)', emoji: '🏋️', color: CategoryColors.orange },
    { name: 'Protein', nameTr: 'Günlük protein hedefine ulaş', emoji: '🥩', color: CategoryColors.red },
    { name: 'Kalori', nameTr: 'Kalori fazlası ile beslen (TDEE + 300-500)', emoji: '🍽️', color: CategoryColors.amber },
    { name: 'Uyku', nameTr: 'Düzenli uyku (7–9 saat) — kas onarımı için kritik', emoji: '😴', color: CategoryColors.violet },
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
    tasks: tasks,
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
      { name: 'Koşu', nameTr: 'Planlı koşu seansı', emoji: '🏃', color: CategoryColors.red },
      { name: 'Mobilite', nameTr: 'Isınma + koşu sonrası esneme (10 dk)', emoji: '🧘', color: CategoryColors.green },
      { name: 'Hidrasyon', nameTr: 'Antrenman öncesi / sonrası sıvı alımı', emoji: '💧', color: CategoryColors.blue },
      { name: 'Uyku', nameTr: 'Kaliteli uyku — kaslar geceleri onarılır', emoji: '😴', color: CategoryColors.violet },
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
    { name: 'Antrenman', nameTr: `${dayListTr} — spor pratiği`, emoji: '🏆', color: CategoryColors.red },
    { name: 'Dinlenme', nameTr: 'Toparlanma: uyku + aktif dinlenme', emoji: '😴', color: CategoryColors.violet },
    { name: 'Beslenme', nameTr: 'Performans beslenmesi: yeterli karbonhidrat + protein', emoji: '🥗', color: CategoryColors.amber },
    { name: 'Mental', nameTr: 'Mental hazırlık: görselleştirme / nefes egzersizi', emoji: '🧠', color: CategoryColors.green },
  ];

  const gucHabits = [
    { name: 'Antrenman', nameTr: `${dayListTr} — planlı seans`, emoji: '🏋️', color: CategoryColors.red },
    { name: 'Protein', nameTr: 'Günlük protein alımı (her öğünde yeterli kaynak)', emoji: '🥩', color: CategoryColors.amber },
    { name: 'Uyku', nameTr: 'Uyku kalitesi — kaslar uyurken büyür', emoji: '😴', color: CategoryColors.violet },
    { name: 'Kayıt', nameTr: 'Antrenman günlüğü: set · tekrar · ağırlık', emoji: '📊', color: CategoryColors.green },
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
    labelTr: localizeSporGoal(cleanName, true),
    labelEn: localizeSporGoal(cleanName, false),
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
      { name: 'Konu Kavrama', nameTr: 'Konu kavrama okuma (TYT)', emoji: '📖', color: CategoryColors.blue },
      { name: 'Mini Soru', nameTr: 'Günlük mini soru (10–20)', emoji: '📝', color: CategoryColors.green },
    ],
    ortaHabits: [
      { name: 'Matematik Soru', nameTr: 'Matematik günlük soru', emoji: '📐', color: CategoryColors.blue },
      { name: 'Türkçe Paragraf', nameTr: 'Türkçe paragraf tekrarı', emoji: '📖', color: CategoryColors.green },
      { name: 'AYT Konu Özeti', nameTr: 'Fen/AYT konu özeti', emoji: '🔬', color: CategoryColors.violet },
      { name: 'Hata Defteri', nameTr: 'Hata defteri güncelle', emoji: '❌', color: CategoryColors.red },
    ],
    ileriHabits: [
      { name: 'Deneme Analizi', nameTr: 'Günlük deneme analizi', emoji: '📊', color: CategoryColors.red },
      { name: 'AYT Mat Yoğun', nameTr: 'AYT matematik yoğun', emoji: '📐', color: CategoryColors.blue },
      { name: 'TYT Hız', nameTr: 'TYT hız & doğruluk pratiği', emoji: '⚡', color: CategoryColors.amber },
      { name: 'Zayıf Konu', nameTr: 'Zayıf konu sprint', emoji: '🎯', color: CategoryColors.violet },
      { name: 'Hata Defteri', nameTr: 'Hata defteri & tekrar', emoji: '❌', color: CategoryColors.red },
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
      { name: 'GY-GK Konu', nameTr: 'GY-GK konu okuma', emoji: '📚', color: CategoryColors.blue },
      { name: 'Mini Soru', nameTr: 'Mini soru çözümü (20)', emoji: '📝', color: CategoryColors.green },
    ],
    ortaHabits: [
      { name: 'Tarih-Coğrafya', nameTr: 'Tarih/Coğrafya/Vatandaşlık', emoji: '📚', color: CategoryColors.blue },
      { name: 'Anayasa', nameTr: 'Anayasa & Hukuk özeti', emoji: '⚖️', color: CategoryColors.amber },
      { name: 'Eğitim Bil.', nameTr: 'Eğitim Bilimleri flashcard', emoji: '🧠', color: CategoryColors.violet },
      { name: 'GY-GK Soru', nameTr: 'GY-GK soru bankası', emoji: '📝', color: CategoryColors.green },
    ],
    ileriHabits: [
      { name: 'Soru Bankası', nameTr: 'Günlük soru bankası (60+)', emoji: '📝', color: CategoryColors.red },
      { name: 'Eğitim Bil.', nameTr: 'Eğitim Bilimleri yoğun', emoji: '🧠', color: CategoryColors.violet },
      { name: 'Çıkmış Sorular', nameTr: 'Çıkmış KPSS soru analizi', emoji: '📊', color: CategoryColors.blue },
      { name: 'Hata Analizi', nameTr: 'Hata analizi & tekrar', emoji: '❌', color: CategoryColors.red },
      { name: 'Konu Haritası', nameTr: 'Konu haritası çıkarma', emoji: '🗂️', color: CategoryColors.green },
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
      { name: 'Sayısal Giriş', nameTr: 'Sayısal muhakeme giriş soruları', emoji: '🔢', color: CategoryColors.blue },
      { name: 'Sözel Giriş', nameTr: 'Sözel analoji çalışması', emoji: '📝', color: CategoryColors.green },
    ],
    ortaHabits: [
      { name: 'Sayısal Muhakeme', nameTr: 'Sayısal muhakeme soruları', emoji: '🔢', color: CategoryColors.blue },
      { name: 'Sözel Paragraf', nameTr: 'Sözel paragraf & analoji', emoji: '📝', color: CategoryColors.green },
      { name: 'Süreli Çözüm', nameTr: 'Süreli çözüm pratiği', emoji: '⏱️', color: CategoryColors.amber },
    ],
    ileriHabits: [
      { name: 'ALES Sayısal', nameTr: 'ALES sayısal yoğun (45 dk)', emoji: '🔢', color: CategoryColors.blue },
      { name: 'Sözel Tam Set', nameTr: 'Sözel tam set çözümü', emoji: '📝', color: CategoryColors.green },
      { name: 'Zaman Yönetimi', nameTr: 'Zaman yönetimi simülasyonu', emoji: '⏱️', color: CategoryColors.amber },
      { name: 'Hata Analizi', nameTr: 'Hata analizi & tekrar', emoji: '❌', color: CategoryColors.red },
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
      { name: 'Matematik Temel', nameTr: 'Matematik temel konu', emoji: '📐', color: CategoryColors.blue },
      { name: 'Türkçe Paragraf', nameTr: 'Türkçe paragraf okuma', emoji: '📖', color: CategoryColors.green },
    ],
    ortaHabits: [
      { name: 'Matematik', nameTr: 'Matematik konu + soru', emoji: '📐', color: CategoryColors.blue },
      { name: 'Türkçe', nameTr: 'Türkçe dil bilgisi & paragraf', emoji: '📖', color: CategoryColors.green },
      { name: 'Fen Bilimleri', nameTr: 'Fen Bilimleri konu özeti', emoji: '🔬', color: CategoryColors.violet },
      { name: 'Sosyal', nameTr: 'Sosyal Bilgiler harita çalışması', emoji: '🌍', color: CategoryColors.amber },
    ],
    ileriHabits: [
      { name: 'Matematik', nameTr: 'Matematik deneme soruları', emoji: '📐', color: CategoryColors.blue },
      { name: 'Türkçe Hız', nameTr: 'Türkçe hız çözüm', emoji: '📖', color: CategoryColors.green },
      { name: 'Fen Tarama', nameTr: 'Fen tam konu taraması', emoji: '🔬', color: CategoryColors.violet },
      { name: 'Sosyal+İnkılap', nameTr: 'Sosyal + İnkılap tarih özeti', emoji: '🌍', color: CategoryColors.amber },
      { name: 'İngilizce', nameTr: 'İngilizce kelime & okuma', emoji: '🇬🇧', color: CategoryColors.pink },
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
      { name: 'Sayısal Temel', nameTr: 'Sayısal yetenek temel soruları', emoji: '🔢', color: CategoryColors.blue },
      { name: 'Sözel Giriş', nameTr: 'Sözel yetenek giriş', emoji: '📝', color: CategoryColors.green },
    ],
    ortaHabits: [
      { name: 'Sayısal', nameTr: 'Sayısal yetenek soruları', emoji: '🔢', color: CategoryColors.blue },
      { name: 'Sözel Paragraf', nameTr: 'Sözel yetenek paragraf', emoji: '📝', color: CategoryColors.green },
    ],
    ileriHabits: [
      { name: 'DGS Sayısal', nameTr: 'DGS sayısal yoğun', emoji: '🔢', color: CategoryColors.blue },
      { name: 'Sözel Tam Set', nameTr: 'Sözel tam set çözümü', emoji: '📝', color: CategoryColors.green },
      { name: 'Süreli Deneme', nameTr: 'Süreli deneme çözümü', emoji: '⏱️', color: CategoryColors.amber },
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
      { name: 'Metin Okuma', nameTr: 'Günlük akademik İngilizce metin', emoji: '📖', color: CategoryColors.blue },
      { name: 'Kelime', nameTr: 'Kelime listesi (5–10/gün)', emoji: '🗃️', color: CategoryColors.violet },
    ],
    ortaHabits: [
      { name: 'Akademik Okuma', nameTr: 'Akademik metin okuma & anlama', emoji: '📖', color: CategoryColors.blue },
      { name: 'Kelime', nameTr: 'Akademik kelime listesi (15/gün)', emoji: '🗃️', color: CategoryColors.violet },
      { name: 'Gramer', nameTr: 'Gramer yapıları tekrarı', emoji: '✏️', color: CategoryColors.pink },
      { name: 'YDS Soru', nameTr: 'YDS format soruları çözümü', emoji: '📝', color: CategoryColors.green },
    ],
    ileriHabits: [
      { name: 'Hız Okuma', nameTr: 'Hız okuma pratiği', emoji: '📖', color: CategoryColors.blue },
      { name: 'AWL Kelime', nameTr: 'COCA/AWL kelime seti (20/gün)', emoji: '🗃️', color: CategoryColors.violet },
      { name: 'İleri Gramer', nameTr: 'İleri gramer (inversion/cleft)', emoji: '✏️', color: CategoryColors.pink },
      { name: 'Çıkmış YDS', nameTr: 'Çıkmış YDS tam set çözümü', emoji: '📝', color: CategoryColors.green },
      { name: 'Hata Analizi', nameTr: 'Yanlış soru analizi', emoji: '❌', color: CategoryColors.red },
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
      { name: 'Listening', nameTr: 'Listening pratik (podcast)', emoji: '👂', color: CategoryColors.blue },
      { name: 'Reading', nameTr: 'Reading passage (1 metin/gün)', emoji: '📖', color: CategoryColors.green },
    ],
    ortaHabits: [
      { name: 'Listening', nameTr: 'Listening: not alma pratiği', emoji: '👂', color: CategoryColors.blue },
      { name: 'Reading', nameTr: 'Reading: skimming & scanning', emoji: '📖', color: CategoryColors.green },
      { name: 'Writing', nameTr: 'Writing Task 1 taslak', emoji: '✍️', color: CategoryColors.amber },
      { name: 'Speaking', nameTr: 'Speaking monologue kaydı', emoji: '🗣️', color: CategoryColors.violet },
    ],
    ileriHabits: [
      { name: 'Listening', nameTr: 'Listening: Section 3–4 (academic)', emoji: '👂', color: CategoryColors.blue },
      { name: 'Reading', nameTr: 'Reading: T/F/NG stratejisi', emoji: '📖', color: CategoryColors.green },
      { name: 'Writing', nameTr: 'Writing Task 1 & 2 tam pratik', emoji: '✍️', color: CategoryColors.amber },
      { name: 'Speaking', nameTr: 'Speaking: Part 2 cue card', emoji: '🗣️', color: CategoryColors.violet },
      { name: 'Mock Analiz', nameTr: 'Mock test hata analizi', emoji: '📊', color: CategoryColors.red },
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
      { name: 'Listening', nameTr: 'Integrated Listening (kısa lecture)', emoji: '👂', color: CategoryColors.blue },
      { name: 'Reading', nameTr: 'Reading passage çözümü', emoji: '📖', color: CategoryColors.green },
    ],
    ortaHabits: [
      { name: 'Listening', nameTr: 'Integrated Listening + notları', emoji: '👂', color: CategoryColors.blue },
      { name: 'Reading', nameTr: 'Academic reading passage', emoji: '📖', color: CategoryColors.green },
      { name: 'Writing', nameTr: 'Independent Writing taslak', emoji: '✍️', color: CategoryColors.amber },
      { name: 'Speaking', nameTr: 'Speaking template pratiği', emoji: '🎙️', color: CategoryColors.violet },
    ],
    ileriHabits: [
      { name: 'Listening', nameTr: 'Listening: pragmatic purpose soruları', emoji: '👂', color: CategoryColors.blue },
      { name: 'Reading', nameTr: 'Reading: prose summary soruları', emoji: '📖', color: CategoryColors.green },
      { name: 'Writing', nameTr: 'Integrated & Independent Writing', emoji: '✍️', color: CategoryColors.amber },
      { name: 'Speaking', nameTr: 'Speaking: template + içerik', emoji: '🎙️', color: CategoryColors.violet },
      { name: 'TPO Mock', nameTr: 'TPO mock test pratiği', emoji: '📊', color: CategoryColors.red },
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
      { name: 'Temel Bilim', nameTr: 'Temel bilim konu okuma', emoji: '🧬', color: CategoryColors.blue },
      { name: 'Mini Soru', nameTr: 'Günlük mini soru (20–30)', emoji: '📝', color: CategoryColors.green },
    ],
    ortaHabits: [
      { name: 'Temel Bilim', nameTr: 'Temel bilim konu + soru (50/gün)', emoji: '🧬', color: CategoryColors.blue },
      { name: 'Klinik Özet', nameTr: 'Klinik özet (Dahiliye/Cerrahi)', emoji: '🏥', color: CategoryColors.green },
      { name: 'Yanlış Tekrar', nameTr: 'Yanlış soru tekrarı', emoji: '🔄', color: CategoryColors.violet },
      { name: 'Kontrol Listesi', nameTr: 'Konu kontrol listesi', emoji: '📋', color: CategoryColors.amber },
    ],
    ileriHabits: [
      { name: 'Temel Bilim', nameTr: 'Temel bilim yoğun (Biyokimya/Patoloji)', emoji: '🧬', color: CategoryColors.blue },
      { name: 'Klinik Vaka', nameTr: 'Klinik vaka çalışması', emoji: '🏥', color: CategoryColors.green },
      { name: 'Soru Bankası', nameTr: 'Soru bankası (80+ soru/gün)', emoji: '📝', color: CategoryColors.red },
      { name: 'Sistematik Tekrar', nameTr: 'Yanlış soru sistematik tekrar', emoji: '🔄', color: CategoryColors.violet },
      { name: 'Alan Takibi', nameTr: 'Alan bazlı performans takibi', emoji: '📊', color: CategoryColors.amber },
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
      { name: 'Soru Bankası', nameTr: 'UWorld/Amboss günlük soru (20–30)', emoji: '📱', color: CategoryColors.blue },
      { name: 'First Aid', nameTr: 'First Aid konu okuma', emoji: '📚', color: CategoryColors.green },
    ],
    ortaHabits: [
      { name: 'Soru Bankası', nameTr: 'Soru bankası (40 soru/gün)', emoji: '📱', color: CategoryColors.blue },
      { name: 'Kaynak', nameTr: 'First Aid + Pathoma/Sketchy', emoji: '📚', color: CategoryColors.green },
      { name: 'Anki', nameTr: 'Anki deck tekrarı', emoji: '🔄', color: CategoryColors.violet },
      { name: 'Zayıf Alan', nameTr: 'Zayıf alan performans takibi', emoji: '📊', color: CategoryColors.amber },
    ],
    ileriHabits: [
      { name: 'Soru Bankası', nameTr: 'Soru bankası (60+ soru/gün)', emoji: '📱', color: CategoryColors.red },
      { name: 'Anki', nameTr: 'Anki 200+ kart/gün', emoji: '🔄', color: CategoryColors.violet },
      { name: 'First Aid', nameTr: 'Kaynak sistematik tarama', emoji: '📚', color: CategoryColors.green },
      { name: 'Klinik Vaka', nameTr: 'Clinical vignette analizi', emoji: '🏥', color: CategoryColors.blue },
      { name: 'NBME', nameTr: 'NBME/UWSim performans takibi', emoji: '📊', color: CategoryColors.amber },
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
      { name: 'Vocabulary', nameTr: 'Vocabulary: 10 kelime/gün', emoji: '📝', color: CategoryColors.blue },
      { name: 'Quant Temel', nameTr: 'Quant temel konular', emoji: '🔢', color: CategoryColors.green },
    ],
    ortaHabits: [
      { name: 'Verbal', nameTr: 'Verbal: vocabulary + RC passage', emoji: '📝', color: CategoryColors.blue },
      { name: 'Quant', nameTr: 'Quant: DS & Problem Solving', emoji: '🔢', color: CategoryColors.green },
      { name: 'AWA', nameTr: 'AWA essay taslak pratiği', emoji: '✍️', color: CategoryColors.amber },
    ],
    ileriHabits: [
      { name: 'Verbal', nameTr: 'Verbal: Full RC + Text Completion', emoji: '📝', color: CategoryColors.blue },
      { name: 'Quant', nameTr: 'Quant: yoğun problem çözme', emoji: '🔢', color: CategoryColors.green },
      { name: 'AWA', nameTr: 'AWA: Issue + Argument essay', emoji: '✍️', color: CategoryColors.amber },
      { name: 'PowerPrep', nameTr: 'ETS PowerPrep simülasyonu', emoji: '📊', color: CategoryColors.violet },
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
      { name: 'Quant Giriş', nameTr: 'Quant: Problem Solving giriş', emoji: '🔢', color: CategoryColors.blue },
      { name: 'Verbal Temel', nameTr: 'Verbal: SC temelleri', emoji: '📝', color: CategoryColors.green },
    ],
    ortaHabits: [
      { name: 'Quant', nameTr: 'Quant: DS + PS karma çalışma', emoji: '🔢', color: CategoryColors.blue },
      { name: 'Verbal', nameTr: 'Verbal: CR + SC günlük pratik', emoji: '📝', color: CategoryColors.green },
      { name: 'AWA & IR', nameTr: 'AWA & IR çalışması', emoji: '✍️', color: CategoryColors.amber },
    ],
    ileriHabits: [
      { name: 'Quant 700+', nameTr: 'Quant yoğun (700+ sorular)', emoji: '🔢', color: CategoryColors.blue },
      { name: 'Verbal', nameTr: 'Verbal: RC + CR + SC tam set', emoji: '📝', color: CategoryColors.green },
      { name: 'CAT Deneme', nameTr: 'CAT adaptif test simülasyonu', emoji: '📊', color: CategoryColors.violet },
      { name: 'AWA', nameTr: 'AWA essay pratiği', emoji: '✍️', color: CategoryColors.amber },
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
      { name: 'Kondisyon', nameTr: 'Temel kondisyon (koşu 20 dk)', emoji: '💪', color: CategoryColors.red },
      { name: 'Akademik', nameTr: 'TYT düzeyinde konu tekrarı', emoji: '📚', color: CategoryColors.blue },
    ],
    ortaHabits: [
      { name: 'Koşu', nameTr: 'Koşu antrenmanı (30 dk)', emoji: '🏃', color: CategoryColors.red },
      { name: 'Kalistenik', nameTr: 'Kalistenik egzersiz (şınav/mekik)', emoji: '💪', color: CategoryColors.amber },
      { name: 'Akademik', nameTr: 'Akademik soru çalışması', emoji: '📚', color: CategoryColors.blue },
      { name: 'Süreli Test', nameTr: 'Süreli test simülasyonu', emoji: '⏱️', color: CategoryColors.green },
    ],
    ileriHabits: [
      { name: 'Uzun Koşu', nameTr: 'Uzun koşu (45+ dk)', emoji: '🏃', color: CategoryColors.red },
      { name: 'Maksimum Kal.', nameTr: 'Maksimum kalistenik', emoji: '💪', color: CategoryColors.amber },
      { name: 'Akademik', nameTr: 'Akademik tam deneme', emoji: '📚', color: CategoryColors.blue },
      { name: 'Parkur', nameTr: 'Parkur simülasyonu', emoji: '⏱️', color: CategoryColors.green },
      { name: 'Mental', nameTr: 'Fiziksel + mental hazırlık', emoji: '🧠', color: CategoryColors.violet },
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
      { name: 'Koşu', nameTr: 'Koşu (2–3 km, günlük)', emoji: '🏃', color: CategoryColors.red },
      { name: 'Genel Kültür', nameTr: 'Genel kültür konu okuma', emoji: '📚', color: CategoryColors.blue },
    ],
    ortaHabits: [
      { name: 'Koşu', nameTr: 'Koşu antrenmanı (3–5 km)', emoji: '🏃', color: CategoryColors.red },
      { name: 'Kalistenik', nameTr: 'Kalistenik egzersiz', emoji: '💪', color: CategoryColors.amber },
      { name: 'Genel Kültür', nameTr: 'Genel kültür & güncel olaylar', emoji: '📚', color: CategoryColors.blue },
      { name: 'PMYO Soru', nameTr: 'PMYO soru çalışması', emoji: '📝', color: CategoryColors.green },
    ],
    ileriHabits: [
      { name: 'Interval Koşu', nameTr: 'Uzun mesafe + interval koşu', emoji: '🏃', color: CategoryColors.red },
      { name: 'Kalistenik', nameTr: 'Kalistenik maksimum set', emoji: '💪', color: CategoryColors.amber },
      { name: 'Genel Kültür', nameTr: 'Genel kültür yoğun', emoji: '📚', color: CategoryColors.blue },
      { name: 'PMYO Deneme', nameTr: 'PMYO full deneme çözümü', emoji: '📝', color: CategoryColors.green },
      { name: 'Mental', nameTr: 'Psikolojik dayanıklılık', emoji: '🧠', color: CategoryColors.violet },
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
      { name: 'Alan Bilgisi', nameTr: 'Alan bilgisi konu okuma', emoji: '📚', color: CategoryColors.blue },
      { name: 'Mini Soru', nameTr: 'Mini soru çözümü', emoji: '📝', color: CategoryColors.green },
    ],
    ortaHabits: [
      { name: 'Alan Bilgisi', nameTr: 'Alan bilgisi sistematik tarama', emoji: '📚', color: CategoryColors.blue },
      { name: 'ÖABT Soru', nameTr: 'ÖABT format soru çözümü', emoji: '📝', color: CategoryColors.green },
      { name: 'Eğitim Bil.', nameTr: 'Eğitim Bilimleri tekrarı', emoji: '🧠', color: CategoryColors.violet },
    ],
    ileriHabits: [
      { name: 'Alan Yoğun', nameTr: 'Alan bilgisi yoğun (zayıf konular)', emoji: '📚', color: CategoryColors.blue },
      { name: 'Çıkmış Soru', nameTr: 'Çıkmış ÖABT soruları', emoji: '📝', color: CategoryColors.green },
      { name: 'Eğitim Bil.', nameTr: 'Eğitim Bilimleri + pedagoji', emoji: '🧠', color: CategoryColors.violet },
      { name: 'Hata Analizi', nameTr: 'Hata analizi & tekrar', emoji: '❌', color: CategoryColors.red },
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
      { name: 'Ünite Okuma', nameTr: 'Ders kitabı ünite okuma (1/gün)', emoji: '📖', color: CategoryColors.blue },
      { name: 'Özet', nameTr: 'Ünite özeti çıkarma', emoji: '📝', color: CategoryColors.green },
    ],
    ortaHabits: [
      { name: 'Ders Okuma', nameTr: 'Ders okuma + not alma', emoji: '📖', color: CategoryColors.blue },
      { name: 'Ünite Sonu', nameTr: 'Ünite sonu soruları çözme', emoji: '📝', color: CategoryColors.green },
      { name: 'Haftalık Tekrar', nameTr: 'Haftalık tekrar oturumu', emoji: '🔄', color: CategoryColors.violet },
    ],
    ileriHabits: [
      { name: 'Hızlı Okuma', nameTr: 'Hızlı okuma + aktif not', emoji: '📖', color: CategoryColors.blue },
      { name: 'Çıkmış Soru', nameTr: 'Çıkmış soru analizi', emoji: '📝', color: CategoryColors.green },
      { name: 'Sistematik Tekrar', nameTr: 'Sistematik tekrar programı', emoji: '🔄', color: CategoryColors.violet },
      { name: 'Hata Takibi', nameTr: 'Hata takibi & güçlendirme', emoji: '❌', color: CategoryColors.red },
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
      { name: 'Read Aloud', nameTr: 'Speaking: Read Aloud pratik', emoji: '🎙️', color: CategoryColors.blue },
      { name: 'Reorder', nameTr: 'Reading: Reorder Paragraphs', emoji: '📖', color: CategoryColors.green },
    ],
    ortaHabits: [
      { name: 'Speaking', nameTr: 'Speaking: RA + Repeat Sentence', emoji: '🎙️', color: CategoryColors.blue },
      { name: 'Reading', nameTr: 'Reading: FIB + MCQ', emoji: '📖', color: CategoryColors.green },
      { name: 'Writing', nameTr: 'Writing: Summarize Written Text', emoji: '✍️', color: CategoryColors.amber },
      { name: 'Listening', nameTr: 'Listening: FIB pratik', emoji: '👂', color: CategoryColors.violet },
    ],
    ileriHabits: [
      { name: 'Speaking', nameTr: 'Speaking: Describe Image + Retell', emoji: '🎙️', color: CategoryColors.blue },
      { name: 'Reading', nameTr: 'Reading: tüm soru tipleri', emoji: '📖', color: CategoryColors.green },
      { name: 'Writing', nameTr: 'Writing: Full AWE pratik', emoji: '✍️', color: CategoryColors.amber },
      { name: 'Listening', nameTr: 'Listening: Highlight Correct Summary', emoji: '👂', color: CategoryColors.violet },
      { name: 'Mock Analiz', nameTr: 'Mock test analizi', emoji: '📊', color: CategoryColors.red },
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
      { name: 'Sözel Mantık', nameTr: 'Sözel mantık bulmacaları (15 dk)', emoji: '🧩', color: CategoryColors.violet },
      { name: 'Sayısal Örüntü', nameTr: 'Sayısal örüntü soruları', emoji: '🔢', color: CategoryColors.blue },
    ],
    ortaHabits: [
      { name: 'Sözel Mantık', nameTr: 'Sözel & şekil mantık soruları', emoji: '🧩', color: CategoryColors.violet },
      { name: 'Sayısal', nameTr: 'Sayısal örüntü ve dizi', emoji: '🔢', color: CategoryColors.blue },
      { name: 'Yaratıcı', nameTr: 'Yaratıcı düşünme egzersizleri', emoji: '🎨', color: CategoryColors.pink },
    ],
    ileriHabits: [
      { name: 'Zeka Testi', nameTr: 'Tam zeka testi seti (sözel+şekil+sayısal)', emoji: '🧩', color: CategoryColors.violet },
      { name: 'Örüntü', nameTr: 'İleri düzey örüntü soruları', emoji: '🔢', color: CategoryColors.blue },
      { name: 'Yaratıcı', nameTr: 'Yaratıcı problem çözme pratiği', emoji: '🎨', color: CategoryColors.pink },
      { name: 'Uzamsal', nameTr: 'Görsel-uzamsal akıl yürütme', emoji: '🧠', color: CategoryColors.green },
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
        { name: 'Sabah Denemesi', nameTr: 'Sabah denemesi çöz', emoji: '📊', color: CategoryColors.red },
        { name: 'Hata Analizi', nameTr: 'Hata analizi & zayıf alan', emoji: '🔍', color: CategoryColors.amber },
        { name: 'Akşam Tekrarı', nameTr: 'Akşam hızlı tekrar', emoji: '🌙', color: CategoryColors.indigo },
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
  ...TEMPLATE_RAMAZAN_OGRENCI.habits.map(h => h.name),
  ...TEMPLATE_RAMAZAN_CALISAN.habits.map(h => h.name),
];

export function getAllKnownModePairs(): Array<{ tr: string; en: string }> {
  const pairs: Array<{ tr: string; en: string }> = [];
  const addTpl = (tpl: StudyTemplate) => {
    tpl.tasks.forEach(t => pairs.push({ tr: t.titleTr, en: t.titleEn }));
    tpl.habits.forEach(h => pairs.push({ tr: h.nameTr, en: h.name }));
  };
  const dummy = "";
  const dummyInputs: SporInputs = { currentWeight: 70, targetWeight: 65, weeklyKm: 20, targetEvent: '10K', trainingDays: 3 };
  [
    TEMPLATE_RAMAZAN_GECE, TEMPLATE_RAMAZAN_SABAH, TEMPLATE_RAMAZAN_OGRENCI, TEMPLATE_RAMAZAN_CALISAN,
    TEMPLATE_ACTIVE_RECALL(dummy), TEMPLATE_SPACED_REPETITION(dummy), TEMPLATE_DEEP_WORK(dummy), TEMPLATE_SPRINT(dummy),
    TEMPLATE_FOUNDATION(dummy),
    TEMPLATE_TEZ_WRITING(dummy), TEMPLATE_TEZ_MILESTONE(dummy), TEMPLATE_TEZ_SOFTWARE(dummy), TEMPLATE_TEZ_IS(dummy), TEMPLATE_TEZ_SPRINT(dummy),
    TEMPLATE_MULAKAT_TEKNIK(dummy), TEMPLATE_MULAKAT_BEHAVIORAL(dummy), TEMPLATE_MULAKAT_CASE(dummy), TEMPLATE_MULAKAT_AKADEMIK(dummy), TEMPLATE_MULAKAT_SPRINT(dummy),
    buildKiloTemplate(dummyInputs, 30),
    buildMaratonTemplate(dummyInputs, 30),
    buildGucTemplateWithProgram(dummyInputs, 30, 'guc'),
    buildGucTemplateWithProgram(dummyInputs, 30, 'genel'),
    buildGucTemplateWithProgram(dummyInputs, 30, 'yaris'),
  ].forEach(addTpl);

  Object.values(EXAM_CONTENT).forEach(c => {
    c.temelHabits.forEach(h => pairs.push({ tr: h.nameTr, en: h.name }));
    c.ortaHabits.forEach(h => pairs.push({ tr: h.nameTr, en: h.name }));
    c.ileriHabits.forEach(h => pairs.push({ tr: h.nameTr, en: h.name }));
    c.setupTasks.forEach(t => pairs.push({ tr: t.titleTr, en: t.titleEn }));
    c.sprintTasks.forEach(t => pairs.push({ tr: t.titleTr, en: t.titleEn }));
  });
  return pairs;
}
