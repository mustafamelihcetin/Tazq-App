import type { ParsedHint } from '@/features/tasks/utils/taskParser';
import type { NlpChip } from '@/features/tasks/components/NlpHintRow';
import { visibleTextTags, translateTag } from '@/features/tasks/utils/taskTags';
import { weekdayName } from '@/shared/constants/weekdays';
import { langOf } from '@/shared/utils/lang';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { parseDateKey } from '@/shared/utils/dateKey';

/**
 * AYRIŞTIRICININ ANLADIKLARI → GÖSTERİLECEK PARÇALAR.
 *
 * NEDEN AYRI DOSYA: bu dönüşüm TaskFormModal'ın içinde gömülüydü. Hızlı ekleme
 * sayfası da aynı ipucunu göstermek zorunda (kullanıcı "yarın 15:00 toplantı"
 * yazdığında ne anladığımızı görmeli) ve kopyalansaydı iki ekran zamanla ayrışırdı:
 * biri tekrarı gösterir öbürü göstermez, gün adı birinde çevrilir öbüründe çevrilmez.
 *
 * Ham emoji YOK: her parça TÜRÜYLE geliyor, ikonunu sunum katmanı çiziyor
 * (bkz. NlpHintRow).
 */
export function buildNlpChips(hint: ParsedHint, language: string): NlpChip[] {
  // Metinler sözlükten — bu dosyada satır içi iki dilli dallanma YOK
  // (bkz. __tests__/i18nRatchet.test.ts).
  const t = useLanguageStore.getState().t;
  const lang = langOf(language);
  const chips: NlpChip[] = [];

  if (hint.dueDate) {
    // YEREL takvimden: `new Date('2026-09-20')` UTC gece yarısı okunur ve UTC'nin
    // gerisindeki saat dilimlerinde çip bir önceki günü gösterirdi.
    chips.push({ kind: 'date', text: parseDateKey(hint.dueDate).toLocaleDateString() });
  }
  if (hint.dueTime) {
    chips.push({ kind: 'time', text: new Date(hint.dueTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
  }
  if (hint.recurrence && hint.recurrence !== 'None') {
    const recurrenceLabel: Record<string, string> = {
      Daily: t.recurrenceDaily,
      Weekly: t.recurrenceWeekly,
      Monthly: t.recurrenceMonthly,
    };
    // Gün adı ARAYÜZ dilinde kurulur. Eskiden `Her ${...}` sabit Türkçe yazıyordu ve
    // gün adı ayrıştırıcıdan GİRDİNİN dilinde geliyordu → "Her Monday".
    chips.push({
      kind: 'repeat',
      text: hint.recurrenceDay != null
        ? `${t.recurrenceEvery} ${weekdayName(hint.recurrenceDay, lang)}`
        : recurrenceLabel[hint.recurrence],
    });
  }
  // Öncelik de görünür: eskiden forma SESSİZCE yazılıyordu, kullanıcı neden değiştiğini
  // bilmiyordu. Orta öncelik varsayılan olduğu için çip değildir.
  if (hint.priority === 'High' || hint.priority === 'Low') {
    chips.push({ kind: 'priority', text: hint.priority === 'High' ? t.priorityHigh : t.priorityLow });
  }
  for (const tag of visibleTextTags(hint.tags)) {
    chips.push({ kind: 'tag', text: translateTag(tag, lang) });
  }

  return chips;
}
