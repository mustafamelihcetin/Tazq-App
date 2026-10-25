import { matchesTr, matchesEn } from '@/features/tasks/nlp/morph';
import { normalize } from '@/features/tasks/nlp/understand';

/*
  ALIŞKANLIK ADINDAN SİMGE — deterministik, LLM yok (bkz. görev anlama motoru ilkeleri).
  Kelime = kök ya da kök + geçerli Türkçe ek (matchesTr): "su" kökü "sunum"a eşleşmez.
  Fiiller ek kurallarına girmediği için yaygın biçimleri ayrıca listelenir ("koşmak", "uyu").
  Simgeler Yeni Alışkanlık ızgarasındakilerle AYNI (HABIT_EMOJIS) — dışarıda bir şey önerilmez.
*/

/** weak: zaman sözcükleri ("sabah koşusu") alışkanlığın NE olduğunu değil NE ZAMAN olduğunu söyler — yalnız başka eşleşme yoksa. */
type Rule = { icon: string; tr: string[]; en: string[]; weak?: boolean };

const RULES: Rule[] = [
  { icon: '🚭', tr: ['sigara', 'tütün', 'nikotin'], en: ['smoke', 'smoking', 'cigarette', 'nicotine'] },
  { icon: '🏃', tr: ['koşu', 'koş', 'koşmak', 'yürüyüş', 'yürü', 'yürümek', 'adım', 'kardiyo'], en: ['run', 'running', 'jog', 'walk', 'walking', 'steps', 'cardio'] },
  { icon: '🚴', tr: ['bisiklet', 'pedal'], en: ['bike', 'cycling', 'bicycle'] },
  { icon: '🧘', tr: ['meditasyon', 'yoga', 'nefes', 'esneme', 'mindfulness'], en: ['meditate', 'meditation', 'yoga', 'breathe', 'breathing', 'stretch', 'stretching', 'mindfulness'] },
  { icon: '💪', tr: ['spor', 'salon', 'antrenman', 'egzersiz', 'şınav', 'mekik', 'ağırlık', 'fitness', 'gym'], en: ['gym', 'workout', 'exercise', 'pushup', 'pushups', 'situps', 'weights', 'fitness', 'training'] },
  { icon: '💧', tr: ['su', 'sıvı'], en: ['water', 'hydrate', 'hydration'] },
  { icon: '😴', tr: ['uyku', 'uyu', 'uyumak', 'yat', 'yatmak', 'şekerleme'], en: ['sleep', 'bed', 'bedtime', 'nap'] },
  { icon: '🥗', tr: ['sebze', 'meyve', 'salata', 'diyet', 'beslenme', 'kahvaltı', 'öğün', 'şeker'], en: ['vegetable', 'vegetables', 'fruit', 'salad', 'diet', 'breakfast', 'meal', 'sugar'] },
  { icon: '💊', tr: ['ilaç', 'vitamin', 'hap', 'takviye'], en: ['pill', 'pills', 'medicine', 'medication', 'vitamin', 'vitamins', 'supplement'] },
  { icon: '🗣️', tr: ['ingilizce', 'almanca', 'fransızca', 'ispanyolca', 'dil', 'kelime', 'konuşma', 'duolingo'], en: ['english', 'german', 'french', 'spanish', 'language', 'vocabulary', 'words', 'speaking', 'duolingo'] },
  { icon: '📚', tr: ['kitap', 'oku', 'okumak', 'okuma', 'sayfa', 'roman', 'ders'], en: ['read', 'reading', 'book', 'books', 'pages', 'study', 'studying'] },
  { icon: '✍️', tr: ['günlük', 'yaz', 'yazmak', 'yazı', 'not', 'şükran'], en: ['journal', 'journaling', 'write', 'writing', 'diary', 'gratitude'] },
  { icon: '💻', tr: ['kod', 'yazılım', 'program', 'proje', 'bilgisayar'], en: ['code', 'coding', 'programming', 'project', 'computer'] },
  { icon: '🎵', tr: ['müzik', 'gitar', 'piyano', 'şarkı', 'enstrüman', 'keman'], en: ['music', 'guitar', 'piano', 'song', 'instrument', 'violin', 'practice'] },
  { icon: '🎨', tr: ['resim', 'çizim', 'çiz', 'boya', 'sanat'], en: ['draw', 'drawing', 'paint', 'painting', 'art', 'sketch'] },
  { icon: '📷', tr: ['fotoğraf', 'foto'], en: ['photo', 'photography', 'picture'] },
  { icon: '🧹', tr: ['temizlik', 'temizle', 'topla', 'düzen', 'oda', 'ev', 'bulaşık', 'çamaşır'], en: ['clean', 'cleaning', 'tidy', 'room', 'house', 'dishes', 'laundry'] },
  { icon: '💰', tr: ['para', 'birikim', 'biriktir', 'tasarruf', 'bütçe', 'harcama'], en: ['money', 'save', 'saving', 'savings', 'budget', 'spending'] },
  { icon: '👥', tr: ['ara', 'arkadaş', 'aile', 'anne', 'baba', 'sosyal', 'mesaj'], en: ['call', 'friend', 'friends', 'family', 'mom', 'dad', 'social'] },
  { icon: '🙏', tr: ['namaz', 'dua', 'ibadet', 'kuran', 'oruç'], en: ['pray', 'prayer', 'worship'] },
  { icon: '🌿', tr: ['bitki', 'çiçek', 'doğa', 'sula'], en: ['plant', 'plants', 'garden', 'nature'] },
  { icon: '🌅', tr: ['erken', 'sabah', 'kalk', 'kalkmak'], en: ['early', 'morning', 'wake', 'sunrise'], weak: true },
  { icon: '☕', tr: ['kahve', 'çay', 'kafein'], en: ['coffee', 'tea', 'caffeine'] },
  { icon: '🧠', tr: ['zeka', 'bulmaca', 'satranç', 'odak', 'düşün'], en: ['puzzle', 'chess', 'brain', 'focus', 'think'] },
];

const tokenize = (text: string, lang: 'tr' | 'en') =>
  normalize(text, lang).split(/[^\p{L}']+/u).filter(Boolean);

/**
 * Addan en yakın simge — cümlede ÖNCE geçen eşleşme kazanır; eşleşme yoksa null
 * (çağıran mevcut seçimi korur).
 */
export function suggestHabitIcon(name: string, lang: 'tr' | 'en'): string | null {
  const tokens = tokenize(name ?? '', lang);
  if (tokens.length === 0) return null;
  const match = lang === 'tr' ? matchesTr : matchesEn;
  const hit = (token: string, rule: Rule) =>
    (lang === 'tr' ? rule.tr : rule.en).some((l) => match(token, l)) ||
    // Türkçe arayüzde İngilizce ödünç kelimeler de ("gym", "fitness") tanınsın.
    (lang === 'tr' && rule.en.some((l) => matchesEn(token, l)));
  for (const pass of [false, true]) {
    for (const token of tokens) {
      for (const rule of RULES) if (!!rule.weak === pass && hit(token, rule)) return rule.icon;
    }
  }
  return null;
}
