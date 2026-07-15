import { CategoryColors } from '@/shared/constants/Colors';
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

// Zengin eşleşme: bilinen aktivite → hazır ad/emoji/renk.
const HABIT_PATTERNS: Array<{ keywords: string[]; nameTr: string; nameEn: string; emoji: string; color: string }> = [
  { keywords: ['koş', 'run', 'cardio', 'jog'], nameTr: 'Koşu', nameEn: 'Running', emoji: '🏃', color: CategoryColors.green },
  { keywords: ['yürü', 'walk', 'adım'], nameTr: 'Yürüyüş', nameEn: 'Walking', emoji: '🚶', color: CategoryColors.green },
  { keywords: ['yüz', 'swim', 'havuz'], nameTr: 'Yüzme', nameEn: 'Swimming', emoji: '🏊', color: '#06B6D4' },
  { keywords: ['spor', 'egzersiz', 'antrenman', 'gym', 'fitness', 'workout', 'training', 'ağırlık'], nameTr: 'Spor / Antrenman', nameEn: 'Workout', emoji: '💪', color: CategoryColors.orange },
  { keywords: ['esne', 'stretch', 'mobilite', 'mobility'], nameTr: 'Esneme', nameEn: 'Stretching', emoji: '🤸', color: '#14B8A6' },
  { keywords: ['kitap', 'oku', 'okuma', 'read', 'reading', 'book'], nameTr: 'Okuma', nameEn: 'Reading', emoji: '📚', color: CategoryColors.indigo },
  { keywords: ['çalış', 'ders', 'study', 'ödev', 'homework', 'revize', 'tekrar', 'konu'], nameTr: 'Ders Çalışma', nameEn: 'Study', emoji: '📖', color: CategoryColors.blue },
  { keywords: ['soru çöz', 'test çöz', 'deneme', 'soru bankası'], nameTr: 'Soru Çözümü', nameEn: 'Practice Questions', emoji: '✏️', color: CategoryColors.blue },
  { keywords: ['yaz', 'yazım', 'yazma', 'write', 'writing', 'günlük', 'journal'], nameTr: 'Yazı Yazmak', nameEn: 'Writing', emoji: '✍️', color: CategoryColors.violet },
  { keywords: ['su iç', 'water', 'hidrasyon', 'hydration'], nameTr: 'Su İçmek', nameEn: 'Hydration', emoji: '💧', color: '#06B6D4' },
  { keywords: ['protein', 'beslenme', 'kalori', 'diyet', 'diet', 'nutrition', 'sağlıklı ye', 'sebze'], nameTr: 'Beslenme Takibi', nameEn: 'Nutrition', emoji: '🥗', color: CategoryColors.green },
  { keywords: ['uyku', 'sleep', 'uyu', 'erken yat'], nameTr: 'Uyku Düzeni', nameEn: 'Sleep', emoji: '😴', color: CategoryColors.indigo },
  { keywords: ['meditasyon', 'meditation', 'nefes', 'breath', 'mindful', 'yoga'], nameTr: 'Meditasyon', nameEn: 'Meditation', emoji: '🧘', color: CategoryColors.violet },
  { keywords: ['dua', 'namaz', 'prayer', 'ibadet', 'kuran', 'quran', 'zikir'], nameTr: 'İbadet / Zikir', nameEn: 'Prayer', emoji: '🤲', color: CategoryColors.indigo },
  { keywords: ['kod', 'coding', 'programlama', 'geliştir', 'develop', 'software', 'yazılım'], nameTr: 'Kod Yazmak', nameEn: 'Coding', emoji: '💻', color: CategoryColors.green },
  { keywords: ['dil', 'kelime', 'vocabulary', 'language', 'ingilizce', 'english', 'almanca', 'kelime ezber'], nameTr: 'Dil Öğrenimi', nameEn: 'Language', emoji: '🗣️', color: CategoryColors.blue },
  { keywords: ['müzik', 'music', 'gitar', 'guitar', 'piyano', 'piano', 'enstrüman'], nameTr: 'Müzik Pratiği', nameEn: 'Music', emoji: '🎵', color: CategoryColors.pink },
  { keywords: ['resim', 'çizim', 'draw', 'paint', 'art', 'sketch'], nameTr: 'Çizim / Resim', nameEn: 'Drawing', emoji: '🎨', color: CategoryColors.pink },
  { keywords: ['vitamin', 'ilaç', 'medication', 'supplement', 'takviye'], nameTr: 'Vitamin / İlaç', nameEn: 'Supplements', emoji: '💊', color: CategoryColors.amber },
  { keywords: ['araştır', 'research', 'makale', 'paper', 'literatür', 'literature', 'kaynak'], nameTr: 'Araştırma', nameEn: 'Research', emoji: '🔍', color: CategoryColors.violet },
  { keywords: ['temizlik', 'düzen', 'clean', 'tidy', 'organize'], nameTr: 'Düzen / Temizlik', nameEn: 'Tidy Up', emoji: '🧹', color: '#14B8A6' },
  { keywords: ['tasarruf', 'bütçe', 'budget', 'save money', 'para biriktir'], nameTr: 'Bütçe Takibi', nameEn: 'Budgeting', emoji: '💰', color: CategoryColors.amber },
];

// Tekrar/süreklilik sinyalleri → ALIŞKANLIK (her gün yapılan).
const RECURRENCE_CUES = ['her gün', 'hergün', 'her sabah', 'her akşam', 'her gece', 'her hafta', 'günlük', 'düzenli', 'rutin', 'alışkanlık', 'daily', 'every day', 'every morning', 'every night', 'each day', 'routine', 'habit', 'weekly', 'sürekli'];
// Tek-seferlik/teslim sinyalleri → GÖREV.
const DEADLINE_CUES = ['bugün', 'yarın', 'öbür gün', 'hafta sonu', 'bu hafta', 'pazartesi', 'salı', 'çarşamba', 'perşembe', 'cuma', 'cumartesi', 'pazar', 'son tarih', 'deadline', 'today', 'tomorrow', 'bitir', 'teslim', 'gönder', 'tamamla'];

const HIGH_PRIORITY_VERBS = ['bitir', 'tamamla', 'gönder', 'sun', 'teslim', 'finish', 'complete', 'submit', 'deliver', 'hazırla', 'prepare', 'ulaş', 'kazan', 'achieve', 'hallet'];
const LOW_PRIORITY_VERBS  = ['düşün', 'think', 'incele', 'review', 'keşfet', 'explore', 'belki', 'maybe', 'fikir', 'idea', 'bak'];
// Görev olduğunu güçlendiren genel eylem fiilleri.
const ACTION_VERBS = [...HIGH_PRIORITY_VERBS, ...LOW_PRIORITY_VERBS, 'yap', 'al ', 'satın', 'ara', 'planla', 'ayarla', 'oluştur', 'belirle', 'seç', 'çöz', 'indir', 'kaydol', 'başvur', 'temin', 'organize'];

// Bilinmeyen alışkanlık ifadesi için emoji çıkarımı (keyword eşleşmeyince).
function inferEmoji(s: string): string {
  if (/(yemek|aşçı|cook|pişir)/.test(s)) return '🍳';
  if (/(bisiklet|cycle|bike)/.test(s)) return '🚴';
  if (/(film|dizi|movie|series)/.test(s)) return '🎬';
  if (/(şükür|gratitude|minnet)/.test(s)) return '🙏';
  if (/(plan|hedef|goal)/.test(s)) return '🎯';
  if (/(telefon|ekran|screen|sosyal medya)/.test(s)) return '📵';
  return '✨';
}

// "her sabah esneme yap" → "Esneme" : tekrar/fiil sözcüklerini temizle, kısalt, baş harfi büyüt.
function cleanHabitName(frag: string): string {
  let n = frag;
  for (const c of [...RECURRENCE_CUES, 'yapmak', 'yap', 'etmek', 'istiyorum', 'isterim', 'lazım']) {
    n = n.replace(new RegExp(c, 'gi'), ' ');
  }
  n = n.replace(/\s+/g, ' ').trim();
  if (!n) return frag.trim();
  if (n.length > 28) n = n.slice(0, 28).trim();
  return n.charAt(0).toLocaleUpperCase('tr') + n.slice(1);
}

function cap(s: string): string {
  const t = s.trim();
  return t.charAt(0).toLocaleUpperCase('tr') + t.slice(1);
}

/**
 * Serbest metinden anlamlı plan çıkarır (kural-tabanlı, %100 ücretsiz).
 * Her parçayı tekrar/deadline/fiil sinyalleriyle ALIŞKANLIK ↔ GÖREV olarak sınıflar.
 * Hiçbir şey çıkmazsa metni tek bir göreve düşürür → ASLA boş dönmez.
 */
export function extractPlanFromText(text: string, _tr: boolean): { habits: DraftHabit[]; tasks: DraftTask[] } {
  const habits: DraftHabit[] = [];
  const tasks: DraftTask[] = [];
  const habitSeen = new Set<string>();
  const taskSeen = new Set<string>();

  const fragments = text
    .split(/[.!?\n,;·•]+|\bve\b|\band\b/i)
    .map(s => s.trim())
    .filter(s => s.length >= 2 && s.length <= 120);

  for (const frag of fragments) {
    const s = frag.toLowerCase();
    const matched = HABIT_PATTERNS.find(p => p.keywords.some(kw => s.includes(kw)));
    const recurrence = RECURRENCE_CUES.some(c => s.includes(c));
    const deadline = DEADLINE_CUES.some(c => s.includes(c));
    const isHigh = HIGH_PRIORITY_VERBS.some(v => s.includes(v));
    const isLow = LOW_PRIORITY_VERBS.some(v => s.includes(v));
    const hasAction = ACTION_VERBS.some(v => s.includes(v));

    // ── SINIFLAMA ──
    // Alışkanlık: tekrar sinyali (deadline yoksa) VEYA bilinen aktivite (kısa, deadline/eylem yok).
    const isHabit =
      (recurrence && !deadline) ||
      (!!matched && !deadline && !hasAction && frag.length <= 30) ||
      // Tek kelimelik aktivite ("yüzme", "esneme") → alışkanlık
      (!!matched && frag.split(/\s+/).length <= 2 && !deadline);

    if (isHabit && habits.length < 5) {
      const name = matched ? matched.nameTr : cleanHabitName(frag);
      const key = name.toLocaleLowerCase('tr');
      if (!habitSeen.has(key) && name.length >= 2) {
        habitSeen.add(key);
        habits.push({
          name: matched ? matched.nameEn : name,
          nameTr: name,
          emoji: matched ? matched.emoji : inferEmoji(s),
          color: matched ? matched.color : QUICK_COLORS[habits.length % QUICK_COLORS.length],
        });
      }
      continue;
    }

    // ── GÖREV ──
    if (tasks.length < 6) {
      const key = s.replace(/\s+/g, ' ');
      if (taskSeen.has(key)) continue;
      taskSeen.add(key);
      const priority: 'High' | 'Medium' | 'Low' = (isHigh || deadline) ? 'High' : isLow ? 'Low' : 'Medium';
      tasks.push({ titleTr: cap(frag), titleEn: cap(frag), priority });
    }
  }

  // ── GARANTİ: hiçbir şey çıkmadıysa metni tek göreve düşür (asla boş dönme). ──
  if (habits.length === 0 && tasks.length === 0) {
    const t = text.trim().slice(0, 120);
    if (t.length >= 2) tasks.push({ titleTr: cap(t), titleEn: cap(t), priority: 'Medium' });
  }

  return { habits, tasks };
}

export const QUICK_EMOJIS = ['🎯', '📚', '💪', '🏃', '✍️', '💧', '😴', '🧘', '💻', '📋', '🥗', '🔍', '🎵', '⚡', '🤲', '📖'];
// Kullanıcının alışkanlık için seçebileceği renkler — kategori paletinin tamamı.
// Tip `string[]`: seçilen renk kalıcı veriye yazılır ve oradan `string` olarak geri
// gelir, dar birleşim tipi tutmaz.
export const QUICK_COLORS: string[] = [
  CategoryColors.green,
  CategoryColors.blue,
  CategoryColors.indigo,
  CategoryColors.violet,
  CategoryColors.amber,
  CategoryColors.red,
  CategoryColors.pink,
  CategoryColors.orange,
];
