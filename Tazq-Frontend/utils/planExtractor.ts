export interface DraftHabit {
  name: string;
  nameTr: string;
  emoji: string;
  color: string;
}

export interface DraftTask {
  titleTr: string;
  titleEn: string;
  priority: 'High' | 'Medium' | 'Low';
}

const HABIT_PATTERNS: Array<{
  keywords: string[];
  nameTr: string;
  nameEn: string;
  emoji: string;
  color: string;
}> = [
  { keywords: ['koş', 'run', 'cardio', 'yürüyüş', 'yürü', 'walk'], nameTr: 'Koşu / Yürüyüş', nameEn: 'Run / Walk', emoji: '🏃', color: '#10B981' },
  { keywords: ['spor', 'egzersiz', 'antrenman', 'gym', 'fitness', 'workout', 'training'], nameTr: 'Spor / Antrenman', nameEn: 'Workout', emoji: '💪', color: '#F97316' },
  { keywords: ['kitap', 'oku', 'okuma', 'read', 'reading', 'book'], nameTr: 'Okuma', nameEn: 'Reading', emoji: '📚', color: '#6366F1' },
  { keywords: ['çalış', 'ders', 'study', 'ödev', 'homework', 'revize', 'tekrar'], nameTr: 'Ders Çalışma', nameEn: 'Study', emoji: '📖', color: '#3B82F6' },
  { keywords: ['yaz', 'yazım', 'yazma', 'write', 'writing', 'günlük', 'journal', 'dergim'], nameTr: 'Yazı Yazmak', nameEn: 'Writing', emoji: '✍️', color: '#8B5CF6' },
  { keywords: ['su iç', 'su ', 'water', 'hidrasyon', 'hydration'], nameTr: 'Su İçmek', nameEn: 'Hydration', emoji: '💧', color: '#3B82F6' },
  { keywords: ['protein', 'beslenme', 'kalori', 'diyet', 'diet', 'nutrition', 'sağlıklı ye'], nameTr: 'Beslenme Takibi', nameEn: 'Nutrition', emoji: '🥗', color: '#10B981' },
  { keywords: ['uyku', 'sleep', 'uyu', 'erken yat'], nameTr: 'Uyku Düzeni', nameEn: 'Sleep', emoji: '😴', color: '#6366F1' },
  { keywords: ['meditasyon', 'meditation', 'nefes', 'breath', 'mindful', 'yoga'], nameTr: 'Meditasyon', nameEn: 'Meditation', emoji: '🧘', color: '#8B5CF6' },
  { keywords: ['dua', 'namaz', 'prayer', 'ibadet', 'kuran', 'quran', 'zihin'], nameTr: 'İbadet / Zikir', nameEn: 'Prayer', emoji: '🤲', color: '#6366F1' },
  { keywords: ['kod', 'coding', 'programlama', 'geliştir', 'develop', 'software'], nameTr: 'Kod Yazmak', nameEn: 'Coding', emoji: '💻', color: '#10B981' },
  { keywords: ['proje', 'project', 'görev takip', 'to-do', 'toplantı', 'meeting'], nameTr: 'Proje Takibi', nameEn: 'Project', emoji: '📋', color: '#F59E0B' },
  { keywords: ['dil', 'kelime', 'vocabulary', 'language', 'ingilizce', 'english', 'almanca'], nameTr: 'Dil Öğrenimi', nameEn: 'Language', emoji: '🗣️', color: '#3B82F6' },
  { keywords: ['müzik', 'music', 'gitar', 'guitar', 'piyano', 'piano', 'enstrüman'], nameTr: 'Müzik Pratiği', nameEn: 'Music', emoji: '🎵', color: '#EC4899' },
  { keywords: ['vitamin', 'ilaç', 'medication', 'supplement', 'takviye'], nameTr: 'Vitamin / İlaç', nameEn: 'Supplements', emoji: '💊', color: '#F59E0B' },
  { keywords: ['araştır', 'research', 'makale', 'paper', 'literatür', 'literature', 'kaynak'], nameTr: 'Araştırma', nameEn: 'Research', emoji: '🔍', color: '#8B5CF6' },
];

const HIGH_PRIORITY_VERBS = ['bitir', 'tamamla', 'gönder', 'sun', 'teslim', 'finish', 'complete', 'submit', 'deliver', 'hazırla', 'prepare', 'ulaş', 'reach', 'kazan', 'achieve'];
const LOW_PRIORITY_VERBS  = ['düşün', 'think', 'araştır', 'research', 'incele', 'review', 'keşfet', 'explore', 'belki', 'maybe', 'fikir', 'idea'];

export function extractPlanFromText(text: string, _tr: boolean): { habits: DraftHabit[]; tasks: DraftTask[] } {
  const lower = text.toLowerCase();
  const habits: DraftHabit[] = [];
  const tasks: DraftTask[]   = [];
  const seen = new Set<string>();

  for (const p of HABIT_PATTERNS) {
    if (p.keywords.some(kw => lower.includes(kw)) && !seen.has(p.nameTr)) {
      seen.add(p.nameTr);
      habits.push({ name: p.nameEn, nameTr: p.nameTr, emoji: p.emoji, color: p.color });
      if (habits.length >= 4) break;
    }
  }

  const sentences = text.split(/[.!?\n]+/).map(s => s.trim()).filter(s => s.length >= 6 && s.length <= 120);
  for (const sentence of sentences) {
    const s = sentence.toLowerCase();
    let priority: 'High' | 'Medium' | 'Low' = 'Medium';
    if (HIGH_PRIORITY_VERBS.some(v => s.includes(v))) priority = 'High';
    else if (LOW_PRIORITY_VERBS.some(v => s.includes(v))) priority = 'Low';
    tasks.push({ titleTr: sentence.trim(), titleEn: sentence.trim(), priority });
    if (tasks.length >= 3) break;
  }

  return { habits, tasks };
}

export const QUICK_EMOJIS = ['🎯', '📚', '💪', '🏃', '✍️', '💧', '😴', '🧘', '💻', '📋', '🥗', '🔍', '🎵', '⚡', '🤲', '📖'];
export const QUICK_COLORS = ['#10B981', '#3B82F6', '#6366F1', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899', '#F97316'];
