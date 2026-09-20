import { useHabitStore, fmtDateKey } from '@/features/habits';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { isPausedOn, PAUSABLE_MODES } from './planPause';

/**
 * DURAKLATMANIN STORE'A DOKUNAN TARAFI.
 *
 * Kural katmanı saf (bkz. planPause): gün anahtarlarıyla çalışır, hiçbir şey bilmez.
 * Buradakiler ise tercihleri ve alışkanlıkları okur/yazar. İkisi ayrı çünkü kuralın
 * testi store kurmadan yazılabilmeli; ama işlemler de TEK yerde olmalı — motor ve
 * arayüz aynı duraklatmayı iki farklı şekilde uygularsa, kullanıcı hangi ekrandan
 * ara verdiğine göre farklı sonuç alırdı.
 */

/** Bu yuva bugün duraklı mı? */
export function isSlotPausedNow(mode: string, todayKey: string = fmtDateKey()): boolean {
  const specs = usePrefsStore.getState().planSpecs as Record<string, { pausedUntil?: string | null } | undefined>;
  return isPausedOn(specs[mode]?.pausedUntil, todayKey);
}

/**
 * Bir planın alışkanlıklarında BUGÜNÜ atlandı olarak işaretler.
 *
 * Atlanan gün seriyi korur (bkz. useHabitStore/computeStreak). Duraklatma yalnız
 * görev üretimini durdursaydı yarım bir söz olurdu: alışkanlıklar gelmeye devam
 * eder, kullanıcı ara verdiği için serisini kaybeder ve "ara vermek cezalandırılıyor"
 * hissi doğardı.
 *
 * Zaten tamamlanmış ya da zaten atlanmış güne dokunulmaz — duraklı günde çalışmayı
 * seçen kullanıcının emeği onundur. (Bir günü tamamlamak, o günün atlama kaydını
 * kendiliğinden siler; bkz. toggleDate.)
 */
export function skipPlanHabitsToday(mode: string, todayKey: string = fmtDateKey()): void {
  const prefs = usePrefsStore.getState() as unknown as Record<string, unknown>;
  const ids = (prefs[`${mode}PlanHabitIds`] as string[] | undefined) ?? [];
  for (const id of ids) {
    const h = useHabitStore.getState().habits.find(x => x.id === id);
    if (!h) continue;
    if ((h.completedDates ?? []).includes(todayKey)) continue;
    if ((h.skippedDates ?? []).includes(todayKey)) continue;
    useHabitStore.getState().toggleSkipDate(id, todayKey);
  }
}

/**
 * Duraklı olan TÜM yuvalar için bugünü işaretler (uygulama her açılışında).
 *
 * Aralığın tamamı önceden işaretlenmez, yalnız YAŞANAN gün: kullanıcı erken devam
 * ederse geriye temizlenecek bir iz kalmaz.
 */
export function markPausedHabitsSkipped(todayKey: string = fmtDateKey()): void {
  for (const mode of PAUSABLE_MODES) {
    if (!isSlotPausedNow(mode, todayKey)) continue;
    skipPlanHabitsToday(mode, todayKey);
  }
}
