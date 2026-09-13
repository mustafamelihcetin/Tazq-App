import type { ParsedHint } from '@/features/tasks/utils/taskParser';
import type { NlpChip } from '@/features/tasks/components/NlpHintRow';
import { visibleTextTags, translateTag } from '@/features/tasks/utils/taskTags';
import { weekdayName } from '@/shared/constants/weekdays';
import { langOf } from '@/shared/utils/lang';
import { useLanguageStore } from '@/shared/store/useLanguageStore';

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
    chips.push({ kind: 'date', text: new Date(hint.dueDate).toLocaleDateString() });
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
  for (const tag of visibleTextTags(hint.tags)) {
    chips.push({ kind: 'tag', text: translateTag(tag, lang) });
  }

  return chips;
}
