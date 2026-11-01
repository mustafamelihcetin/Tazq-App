import { CategoryColors } from '@/shared/constants/Colors';
import { suggestHabitIcon } from '@/features/habits/utils/habitIcon';
import { capture } from '@/features/tasks/nlp/capture';
import type { Lang } from '@/features/tasks/nlp/understand';

/**
 * "KENDİ PLANINI OLUŞTUR" TASLAKLARI — mod bandındaki "Öner" düğmesi (2026-10-31, C1-b).
 *
 * Eskiden `shared/utils/planExtractor.ts` vardı ve kelime İÇİNDE arıyordu ("okula git" →
 * okuma alışkanlığı, "dilekçe yaz" → yazı alışkanlığı). Artık uygulamada TEK ayrıştırıcı var:
 * `features/tasks/nlp/capture.ts` (Anlama Motoru üstünde, altın setle korunur). Bu dosya
 * yalnız onun çıktısını bu ekranın taslak biçimine çevirir.
 *
 * Tek fark bu ekranın bağlamı: bir MODUN planı yazılıyor, maddeler çoğunlukla düzenli işler.
 * Bu yüzden tarihsiz/saatsiz ve alışkanlık sözlüğünde karşılığı olan madde ("kitap okumak")
 * alışkanlık sayılır. Sözlük kelime sınırına bakar (habitIcon → matchesTr).
 */

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

export function draftsFromText(text: string, lang: Lang): { habits: DraftHabit[]; tasks: DraftTask[] } {
  const habits: DraftHabit[] = [];
  const tasks: DraftTask[] = [];
  // Mod zaten seçili: "5 kilo vermek" bir durum değil, planın bir maddesi.
  for (const item of capture(text, lang, new Date(), { statements: false }).items) {
    const icon = item.kind === 'habit' ? item.emoji : suggestHabitIcon(item.title, lang);
    const routine = item.kind === 'habit' || (!item.dueDate && !item.time && !item.recurrence && icon != null);
    if (routine) {
      habits.push({
        name: item.title,
        nameTr: item.title,
        emoji: icon ?? QUICK_EMOJIS[habits.length % QUICK_EMOJIS.length],
        color: QUICK_COLORS[habits.length % QUICK_COLORS.length],
      });
    } else {
      tasks.push({ titleTr: item.title, titleEn: item.title, priority: item.kind === 'task' ? item.priority ?? 'Medium' : 'Medium' });
    }
  }
  return { habits, tasks };
}
