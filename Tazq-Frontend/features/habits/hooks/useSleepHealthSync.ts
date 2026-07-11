import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useHabitStore, fmtDateKey, type Habit } from '../store/useHabitStore';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { useToastStore } from '@/shared/store/useToastStore';
import { SleepHealth, formatSleepDuration } from '@/shared/services/sleepHealth';

/**
 * Uyku sağlık senkronu — hedef-bazlı, "onaylı asistan" (iOS HealthKit / Android Health Connect).
 *
 * Mantık (bağlıyken, opt-in 'yes'):
 *  - Hedef TUTULDU (uyku ≥ seçilen saat) → habit OTOMATİK işaretlenir + "🎉" toast (Geri al'lı).
 *  - Hedef TUTULMADI (gerçek bir gece uykusu var ama az) → İŞARETLEMEZ; nazik BİLGİ toast'ı
 *    ("Dün gece Xs · hedef Ys") + "İşaretle" aksiyonu (kullanıcı isterse tek dokunuşla). Başarısız damgası YOK.
 *  - Anlamlı gece uykusu yok (veri yok / < eşik) → tamamen sessiz, günü tüketmeden 15 dk'da bir tekrar dene.
 *  - Bağlı değil (opt-in 'yes' değil) → tamamen elle (eski usül), hiçbir şey gösterme.
 *
 * Dayanıklılık: uyku habit'i isim/emoji ile de tanınır (etiketsiz eskiler); toggleDate öncesi taze kontrol
 *  (yanlış silme yok); veri gelince gün bir kez kapatılır (mark ya da info); native yoksa sessiz no-op.
 */

const MIN_REAL_SLEEP_MIN = 120; // <2 saat: gerçek gece uykusu sayma (şekerleme/yarım senkron) → sessiz, tekrar dene
const RETRY_THROTTLE_MS = 15 * 60 * 1000; // veri yoksa en fazla 15 dk'da bir tekrar dene

type SleepOutcome = 'marked' | 'info' | 'nodata';

function isSleepHabit(h: Habit): boolean {
  if (h.healthMetric === 'sleep') return true;
  if (h.emoji === '😴') return true;
  return /uyku|sleep/i.test(`${h.name ?? ''} ${h.nameTr ?? ''} ${h.nameEn ?? ''}`);
}

export function useSleepHealthSync() {
  const habits = useHabitStore(s => s.habits);
  const runningRef = useRef(false);
  const lastAttemptRef = useRef(0); // veri-yok tekrar denemesi için throttle

  const markDone = (habitId: string, todayKey: string) => {
    // Taze kontrol: zaten işaretliyse dokunma (toggle silmesin).
    const cur = useHabitStore.getState().habits.find(h => h.id === habitId);
    if (cur && !(cur.completedDates ?? []).includes(todayKey)) {
      useHabitStore.getState().toggleDate(habitId, todayKey);
    }
  };

  const processSleep = useCallback(async (habitId: string, todayKey: string): Promise<SleepOutcome> => {
    const mins = await SleepHealth.getRecentSleepMinutes();
    if (mins == null || mins < MIN_REAL_SLEEP_MIN) return 'nodata'; // anlamlı uyku yok → sessiz

    const lang = (useLanguageStore.getState().language === 'en' ? 'en' : 'tr') as 'tr' | 'en';
    const goalHours = usePrefsStore.getState().sleepGoalHours || 7;
    const dur = formatSleepDuration(mins, lang);
    const goalMet = mins >= goalHours * 60;

    const fresh = useHabitStore.getState().habits.find(h => h.id === habitId);
    const alreadyDone = !!fresh && (fresh.completedDates ?? []).includes(todayKey);

    if (goalMet) {
      if (!alreadyDone) {
        markDone(habitId, todayKey);
        useToastStore.getState().show(
          lang === 'tr' ? `😴 Uyku işaretlendi · ${dur} 🎉` : `😴 Sleep marked · ${dur} 🎉`,
          'success',
          {
            label: lang === 'tr' ? 'Geri al' : 'Undo',
            onAction: () => {
              const cur = useHabitStore.getState().habits.find(h => h.id === habitId);
              if (cur && (cur.completedDates ?? []).includes(todayKey)) useHabitStore.getState().toggleDate(habitId, todayKey);
            },
          }
        );
      }
      return 'marked';
    }

    // Hedef tutulmadı → başarısız işaretleme YOK; nazik bilgi + istersen işaretle.
    if (!alreadyDone) {
      useToastStore.getState().show(
        lang === 'tr' ? `😴 Son uyku ${dur} · hedef ${goalHours} saat` : `😴 Last sleep ${dur} · goal ${goalHours}h`,
        'info',
        {
          label: lang === 'tr' ? 'İşaretle' : 'Mark',
          onAction: () => markDone(habitId, todayKey),
        }
      );
    }
    return 'info';
  }, []);

  const run = useCallback(async () => {
    if (runningRef.current) return;
    if (!SleepHealth.isSupported()) return;

    const sleepHabits = habits.filter(isSleepHabit);
    if (sleepHabits.length === 0) return;

    const todayKey = fmtDateKey();
    const unmarked = sleepHabits.filter(h => !(h.completedDates ?? []).includes(todayKey));
    if (unmarked.length === 0) return; // hepsi bugün işaretli → iş yok

    runningRef.current = true;
    try {
      const prefs = usePrefsStore.getState();

      // Bağlanma YALNIZ kullanıcı tarafından, AÇIKÇA (Profil → UYKU anahtarı). Burada asla modal gösterme.
      if (prefs.sleepHealthOptIn !== 'yes') return; // bağlı değil → tamamen elle

      // Bugün zaten işlendi (işaretlendi ya da bilgi verildi) → çık
      if (prefs.sleepLastCheckDate === todayKey) return;

      // Veri-yok durumunda hammer'lamamak için throttle
      const nowMs = Date.now();
      if (nowMs - lastAttemptRef.current < RETRY_THROTTLE_MS) return;
      lastAttemptRef.current = nowMs;

      let dataSeen = false;
      for (const h of unmarked) {
        const outcome = await processSleep(h.id, todayKey);
        if (outcome !== 'nodata') dataSeen = true; // mark ya da info = gece verisi vardı
      }
      // Veri geldiyse günü kapat → mark/info günde BİR kez. Veri yoksa kapatma (geç senkron için tekrar dene).
      if (dataSeen) prefs.setSleepLastCheckDate(todayKey);
    } finally {
      runningRef.current = false;
    }
  }, [habits, processSleep]);

  useEffect(() => {
    run();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') run(); });
    return () => sub.remove();
  }, [run]);
}
