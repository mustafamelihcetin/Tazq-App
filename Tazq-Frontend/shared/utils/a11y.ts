/**
 * EKRAN OKUYUCU METİNLERİ — tek sözlük.
 *
 * ── NEDEN TEK YER ─────────────────────────────────────────────────────────────
 * "tamamlandı / completed", "bugün atlandı / skipped today", "yüksek öncelikli /
 * high priority" gibi durum kelimeleri ÜÇ ayrı dosyada elle yazılıyordu (görev
 * satırı, alışkanlık satırı, alışkanlık baloncuğu). Aynı durumu üç farklı cümleyle
 * anlatmak, ekran okuyucu kullanan biri için uygulamanın tutarsız konuşması demek.
 *
 * ── NEDEN GEREKLİ ─────────────────────────────────────────────────────────────
 * Bu satırların hepsinde durum bilgisi YALNIZ RENKLE söyleniyordu: sol şerit
 * önceliği, üstü çizili başlık tamamlanmayı, rozet seriyi. Renk ekran okuyucuya
 * hiçbir şey söylemez — kör bir kullanıcı için tüm satırlar birbirinin aynıydı.
 *
 * Bkz. __tests__/a11yInteractive.test.ts
 */

export type A11yLang = 'tr' | 'en';

/** Boş parçaları atıp virgülle birleştirir — VoiceOver virgülde kısa duraklar. */
function join(parts: (string | null | undefined | false)[]): string {
  return parts.filter(Boolean).join(', ');
}

const PRIORITY: Record<string, { tr: string; en: string }> = {
  High: { tr: 'yüksek öncelikli', en: 'high priority' },
  Medium: { tr: 'orta öncelikli', en: 'medium priority' },
  Low: { tr: 'düşük öncelikli', en: 'low priority' },
};

const DONE = { tr: 'tamamlandı', en: 'completed' };
const NOT_DONE = { tr: 'tamamlanmadı', en: 'not completed' };
const DONE_TODAY = { tr: 'bugün tamamlandı', en: 'completed today' };
const NOT_DONE_TODAY = { tr: 'bugün tamamlanmadı', en: 'not completed today' };
const SKIPPED_TODAY = { tr: 'bugün atlandı', en: 'skipped today' };

const ROW_HINT = {
  tr: 'Dokun: ayrıntıları aç · Basılı tut: seçenekler',
  en: 'Tap for details · Long press for options',
};
const BULK_HINT = {
  tr: 'Seçime ekle veya çıkar',
  en: 'Add to or remove from selection',
};
const STREAK = {
  tr: (n: number) => `${n} günlük seri`,
  en: (n: number) => `${n} day streak`,
};

/** "Dokun: … · Basılı tut: …" — satırların ortak ipucu cümlesi. */
export function rowHint(lang: A11yLang): string {
  return ROW_HINT[lang];
}

/** Toplu seçim kipindeki görev satırının ipucu. */
export function bulkSelectHint(lang: A11yLang): string {
  return BULK_HINT[lang];
}

/** Görev satırı: "Başlık, yüksek öncelikli, tamamlanmadı". */
export function describeTask(
  task: { priority?: string | null; isCompleted?: boolean | null },
  title: string,
  lang: A11yLang,
): string {
  const p = PRIORITY[task.priority ?? 'Medium'] ?? PRIORITY.Medium;
  return join([title, p[lang], (task.isCompleted ? DONE : NOT_DONE)[lang]]);
}

/**
 * Alışkanlık satırı: "Su iç, bugün tamamlandı, 5 günlük seri".
 *
 * `streak` 0 ise hiç söylenmez — "0 günlük seri" bilgi değil gürültüdür.
 */
export function describeHabit(
  state: { doneToday?: boolean | null; skipped?: boolean | null; streak?: number | null },
  name: string,
  lang: A11yLang,
): string {
  const status = state.skipped
    ? SKIPPED_TODAY
    : state.doneToday
      ? DONE_TODAY
      : NOT_DONE_TODAY;
  const streak = (state.streak ?? 0) > 0 ? STREAK[lang](state.streak as number) : null;
  return join([name, status[lang], streak]);
}
