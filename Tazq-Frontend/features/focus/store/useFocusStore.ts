import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { swallow } from '@/shared/utils/swallow';
import { playSoundEffect } from '@/shared/utils/soundEffects';

// Timer her saniye set() çağırdığı için persist middleware her saniye AsyncStorage'a yazar.
// Bu, uzun seanslarda ısınma/jank yapar. Yazımları throttle'la: en fazla FLUSH_MS'de bir yaz.
// Seans başında yazılan expectedFinishAt zaten kalıcı olduğundan birkaç saniyelik gecikme veri kaybı yaratmaz.
const throttledAsyncStorage = (() => {
  const pending: Record<string, string> = {};
  let timer: ReturnType<typeof setTimeout> | null = null;
  const FLUSH_MS = 3000;
  const flush = () => {
    timer = null;
    for (const key of Object.keys(pending)) {
      const value = pending[key];
      delete pending[key];
      AsyncStorage.setItem(key, value).catch((e) => swallow('focusStore.throttledFlush', e, { capture: true }));
    }
  };
  return {
    getItem: (name: string) => AsyncStorage.getItem(name),
    setItem: (name: string, value: string) => {
      pending[name] = value;
      if (!timer) {
        timer = setTimeout(flush, FLUSH_MS);
        // Node (Jest) ortamında bekleyen zamanlayıcı süreci canlı tutar ve worker
        // kapanmaz. React Native'de setTimeout sayı döner, unref yoktur — opsiyonel çağrı.
        (timer as unknown as { unref?: () => void })?.unref?.();
      }
    },
    removeItem: (name: string) => {
      delete pending[name];
      return AsyncStorage.removeItem(name);
    },
  };
})();

interface FocusState {
  isActive: boolean;
  seconds: number;
  totalSeconds: number;
  pausedSeconds: number | null;
  currentTask: string;
  /**
   * Seansın bağlı olduğu görev — İSTEĞE BAĞLI.
   *
   * ── NEDEN ZORUNLU DEĞİL ───────────────────────────────────────────────────
   * Görevler homojen değil: "rapor yaz" için sayaç tam yerinde, "süt al" ya da
   * "15:00 toplantı" için saçma. Her görevi bir odak seansına bağlamaya çalışmak,
   * kullanıcıyı uymadığı bir kalıba sokar. Bu yüzden bağ ASLA otomatik kurulmuyor
   * ve hiçbir yerde dayatılmıyor; kullanıcı isterse kuruluyor, istemezse seans
   * bugünküyle birebir aynı çalışıyor.
   *
   * `currentTask` (metin) zaten vardı ve kalıyor: serbest yazılan seanslar (ör.
   * "kitap okuma") bir göreve bağlı olmak zorunda değil.
   */
  currentTaskId: number | null;
  /**
   * Görev başına biriken odak dakikası.
   *
   * YALNIZ YERELDE: sunucudaki seans kaydı görev ADINI taşıyor ve bu, türetilmiş
   * bir ölçü — kaybolursa kimse veri kaybetmiş olmaz. Bunun için sunucuya yeni bir
   * alan eklemek (ve bir dağıtım beklemek) gereksiz bir maliyet olurdu.
   */
  taskFocusMinutes: Record<number, number>;
  lastActiveAt: number | null;
  expectedFinishAt: number | null;
  /**
   * SEANS KİMLİĞİ + TÜRÜ + TEK KAYIT KİLİDİ.
   *
   * Bir seans birden çok yoldan "bitebiliyor" (ekranda sıfıra inme, arka plandan dönüş,
   * uygulama kapalıyken dolma, erken bitirme, çıkış). Eskiden bu yollardan ikisi aynı
   * seansı AYRI AYRI kaydediyordu. Artık her seansın bir kimliği var ve bir kimlik
   * yalnız BİR kez kaydedilebilir (bkz. claimCommit).
   *
   * `sessionKind`: mola da bir geri sayım, ama odak DEĞİL. Eskiden moladan sonra süre
   * dolunca mola dakikaları odak seansı olarak kaydediliyordu.
   */
  sessionId: string | null;
  sessionKind: 'focus' | 'break';
  committedSessionId: string | null;
  /** Süre sıfıra indiği an (planlanan bitiş). Geç açılışta molayı kendiliğinden başlatmamak için. */
  finishedAt: number | null;
  // Daily focus tracking
  dailyFocusMinutes: number;
  dailyFocusDate: string;
  dailyGoalMinutes: number;
  bestStreak: number;
  streakFreezeAvailable: boolean;
  streakFreezeUsedWeek: string;
  // Gamification & Shield updates
  focusPoints: number;
  streakShields: number;
  strictMode: boolean;
  localStreak: number;
  lastCheckedDate: string;
  // Pomodoro
  pomodoroMode: boolean;
  pomodoroRound: number;
  pomodoroPhase: 'work' | 'break';
  // Actions
  setIsActive: (active: boolean) => void;
  setSeconds: (seconds: number | ((s: number) => number)) => void;
  /** İkinci parametre verilmezse bağ KURULMAZ/kaldırılır — varsayılan davranış budur. */
  setCurrentTask: (task: string, taskId?: number | null) => void;
  setDuration: (minutes: number) => void;
  /** Mola geri sayımını başlatır — odak olarak KAYDEDİLMEZ. */
  startBreak: (minutes: number) => void;
  /**
   * Bu seansın kaydını ÜSTLENİR. İlk çağrıda true döner, aynı seans için sonrakilerde
   * false — seans kaç yoldan biterse bitsin bir kez kaydedilir.
   */
  claimCommit: () => boolean;
  tick: () => void;
  reset: () => void;
  rehydrateTimer: () => void;
  addFocusMinutes: (mins: number) => void;
  setDailyGoal: (mins: number) => void;
  updateBestStreak: (current: number) => void;
  togglePomodoroMode: () => void;
  nextPomodoroPhase: () => void;
  useStreakFreeze: () => void;
  checkStreakFreezeReset: () => void;
  setStrictMode: (strict: boolean) => void;
  addFocusPoints: (pts: number) => void;
  consumeStreakShield: () => boolean;
  incrementLocalStreak: () => void;
}

function getLocalDateString(d: Date = new Date()): string {
  const adjusted = new Date(d);
  adjusted.setHours(adjusted.getHours() - 3); // 3-hour buffer for night owls
  const y = adjusted.getFullYear();
  const m = String(adjusted.getMonth() + 1).padStart(2, '0');
  const day = String(adjusted.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const getISODate = () => getLocalDateString();
/** Odak gününün anahtarı (gece kuşları için 3 saat tamponlu). Ekranlar bugünü buradan sorar. */
export const focusDayKey = () => getLocalDateString();

const newSessionId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Kalan süre SAATTEN okunur: bitiş anı − şimdi. Saniyede bir "1 eksilt" yöntemi, JS
 * meşgulken atlanan tik kadar geride kalıyordu (yoğun animasyonda dakikalarca).
 */
export const remainingFromClock = (expectedFinishAt: number, now: number = Date.now()): number =>
  Math.max(0, Math.ceil((expectedFinishAt - now) / 1000));

const getISOWeek = () => {
  const d = new Date();
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo}`;
};

export const useFocusStore = create<FocusState>()(
  persist(
    (set, get) => ({
      isActive: false,
      seconds: 1500,
      totalSeconds: 1500,
      pausedSeconds: null,
      currentTask: '',
      currentTaskId: null,
      taskFocusMinutes: {},
      lastActiveAt: null,
      expectedFinishAt: null,
      sessionId: null,
      sessionKind: 'focus',
      committedSessionId: null,
      finishedAt: null,
      dailyFocusMinutes: 0,
      dailyFocusDate: '',
      dailyGoalMinutes: 60,
      bestStreak: 0,
      streakFreezeAvailable: true,
      streakFreezeUsedWeek: '',
      focusPoints: 0,
      streakShields: 1,
      strictMode: false,
      localStreak: 0,
      lastCheckedDate: '',
      pomodoroMode: false,
      pomodoroRound: 1,
      pomodoroPhase: 'work',

      setIsActive: (isActive) => {
        const st = get();
        const now = Date.now();
        if (isActive) {
          if (st.seconds <= 0) return; // bitmiş sayaç yeniden "başlatılamaz"; önce süre seçilir
          set({
            isActive: true,
            lastActiveAt: now,
            expectedFinishAt: now + st.seconds * 1000,
            pausedSeconds: null,
            finishedAt: null,
            // Duraklatıp devam etmek AYNI seans; yalnız yeni başlangıç yeni kimlik alır.
            sessionId: st.sessionId ?? newSessionId(),
          });
          return;
        }
        // Duraklat: kalan süre o anki SAATTEN dondurulur (son tik beklenmez).
        const seconds = st.isActive && st.expectedFinishAt ? remainingFromClock(st.expectedFinishAt, now) : st.seconds;
        set({
          isActive: false,
          seconds,
          lastActiveAt: null,
          expectedFinishAt: null,
          pausedSeconds: seconds,
        });
      },

      setSeconds: (seconds) =>
        set((state) => {
          const nextSeconds = typeof seconds === 'function' ? seconds(state.seconds) : seconds;
          return {
            seconds: nextSeconds,
            expectedFinishAt: state.isActive ? (Date.now() + nextSeconds * 1000) : state.expectedFinishAt
          };
        }),

      setCurrentTask: (currentTask, currentTaskId = null) => set({ currentTask, currentTaskId }),

      setDuration: (minutes) => {
        const secs = minutes * 60;
        set({
          totalSeconds: secs,
          seconds: secs,
          isActive: false,
          lastActiveAt: null,
          expectedFinishAt: null,
          pausedSeconds: null,
          // Yeni süre = yeni seans (henüz başlamadı): kimlik başlatınca verilir.
          sessionId: null,
          sessionKind: 'focus',
          finishedAt: null,
        });
      },

      startBreak: (minutes) => {
        const secs = Math.max(1, Math.round(minutes)) * 60;
        const now = Date.now();
        set({
          totalSeconds: secs,
          seconds: secs,
          isActive: true,
          lastActiveAt: now,
          expectedFinishAt: now + secs * 1000,
          pausedSeconds: null,
          sessionId: newSessionId(),
          sessionKind: 'break',
          finishedAt: null,
        });
      },

      claimCommit: () => {
        const { sessionId, committedSessionId } = get();
        const id = sessionId ?? newSessionId();
        if (committedSessionId === id) return false;
        set({ sessionId: id, committedSessionId: id });
        return true;
      },

      tick: () => {
        const { isActive, seconds, expectedFinishAt } = get();
        if (isActive) {
          const next = expectedFinishAt ? remainingFromClock(expectedFinishAt) : Math.max(0, seconds - 1);
          if (next <= 0) {
            set({ seconds: 0, isActive: false, lastActiveAt: null, expectedFinishAt: null, pausedSeconds: null, finishedAt: expectedFinishAt ?? Date.now() });
          } else if (next !== seconds) {
            set({ seconds: next });
          }
        } else if (seconds === 0) {
          set({ isActive: false, lastActiveAt: null, expectedFinishAt: null, pausedSeconds: null });
        }
      },

      reset: () => {
        const { totalSeconds } = get();
        set({ 
          isActive: false, 
          seconds: totalSeconds, 
          currentTask: '',
          // Bağ seansla birlikte biter: bir sonraki seans yanlış göreve yazılmasın.
          currentTaskId: null,
          lastActiveAt: null,
          expectedFinishAt: null,
          pausedSeconds: null,
          sessionId: null,
          sessionKind: 'focus',
          finishedAt: null,
          /*
            localStreak SIFIRLANMIYOR — bu alan odak ekranında kullanılmıyor
            (incrementLocalStreak hiç çağrılmıyor); sıfırlamak zararsız ama gereksiz.

            bestStreak SIFIRLANIYORDU — her "Yeni Seans" / "Sıfırla" butonunda
            kullanıcının TÜM EN İYİ SERİSİ siliniyordu. bestStreak seanslar arası
            kalıcı bir rekordur; seans sonunda sıfırlanmaz. updateBestStreak sadece
            artar ve hiçbir şey onu azaltmamalı.
          */
        });
      },

      rehydrateTimer: () => {
        const { isActive, expectedFinishAt, lastActiveAt, seconds, pausedSeconds } = get();
        let totalSeconds = Math.max(60, get().totalSeconds || 1500);

        if (__DEV__) {
          console.log('[FocusStore] rehydrateTimer Started:', {
            isActive,
            expectedFinishAt,
            lastActiveAt,
            seconds,
            pausedSeconds,
            totalSeconds
          });
        }
        
        // Reset if the day changed!
        const { dailyFocusDate } = get();
        const today = getISODate();
        if (dailyFocusDate && dailyFocusDate !== today) {
          /*
            Eskiden süre dolmuş ya da duraklatılmış seans da burada SİLİNİYORDU: gece
            23:50'de biten seans ertesi sabah hiç kaydedilmiyor, gece yarısını geçen
            duraklatılmış seansın dakikaları kayboluyordu. Artık yalnız HİÇ BAŞLANMAMIŞ
            sayaç yeni güne tazelenir; başlamış her seans kaldığı yerden sürer ve normal
            yoldan kaydedilir (bkz. features/focus/session.ts).
          */
          const untouched = !isActive && seconds === totalSeconds;
          if (untouched) {
            if (__DEV__) console.log('[FocusStore] rehydrateTimer: Day changed, refreshing idle timer.');
            set({
              isActive: false,
              seconds: 1500,
              totalSeconds: 1500,
              currentTask: '',
              currentTaskId: null,
              lastActiveAt: null,
              expectedFinishAt: null,
              pausedSeconds: null,
              sessionId: null,
              sessionKind: 'focus',
              finishedAt: null,
              dailyFocusMinutes: 0,
              dailyFocusDate: today
            });
            return;
          } else {
            if (__DEV__) console.log('[FocusStore] rehydrateTimer: Day changed but active session not expired yet. Resetting minutes count only.');
            set({
              dailyFocusMinutes: 0,
              dailyFocusDate: today
            });
          }
        }

        if (!isActive) {
          if (seconds === 0) {
            // Keep it at 0 so the completion handler can run
            return;
          }
          if (pausedSeconds !== null && pausedSeconds !== undefined) {
            const validPaused = Math.max(0, Math.min(totalSeconds, pausedSeconds));
            set({ seconds: validPaused, totalSeconds });
          } else {
            set({ seconds: totalSeconds, totalSeconds });
          }
          return;
        }
        
        let remaining = seconds;
        if (expectedFinishAt) {
          remaining = remainingFromClock(expectedFinishAt);
        } else if (lastActiveAt) {
          const elapsed = Math.floor((Date.now() - lastActiveAt) / 1000);
          remaining = Math.max(0, seconds - elapsed);
        } else {
          return;
        }

        // Clamp remaining seconds defensively
        remaining = Math.min(totalSeconds, remaining);

        if (remaining === 0) {
          if (__DEV__) console.log('[FocusStore] rehydrateTimer: Timer fully elapsed/completed in background.');
          set({ isActive: false, seconds: 0, lastActiveAt: null, expectedFinishAt: null, pausedSeconds: null, totalSeconds, finishedAt: expectedFinishAt ?? Date.now() });
        } else {
          if (__DEV__) console.log('[FocusStore] rehydrateTimer: Restored active timer with remaining seconds:', remaining);
          // Eski kayıtta bitiş anı yoksa şimdi kurulur: bundan sonra saat tek kaynak.
          set({ seconds: remaining, lastActiveAt: null, totalSeconds, expectedFinishAt: expectedFinishAt ?? Date.now() + remaining * 1000 });
        }
      },

      addFocusMinutes: (mins) => {
        const { dailyFocusDate, dailyFocusMinutes, currentTaskId, taskFocusMinutes } = get();
        const today = getISODate();
        if (dailyFocusDate !== today) {
          set({ dailyFocusMinutes: mins, dailyFocusDate: today });
        } else {
          set({ dailyFocusMinutes: dailyFocusMinutes + mins });
        }

        /*
          SEANS BİR GÖREVE BAĞLIYSA dakikalar oraya da yazılır.

          Buraya konmasının sebebi: seansın bittiği BEŞ ayrı yer var (normal bitiş,
          erken bitirme, pomodoro turu, arka plandan dönüş, zen çıkışı) ve hepsi zaten
          bu fonksiyonu çağırıyor. Bağı her birine ayrı ayrı eklemek, birini unutunca
          sessizce eksik sayan bir ölçü demekti.

          Bağ yoksa (serbest seans) hiçbir şey değişmez.
        */
        if (currentTaskId != null && mins > 0) {
          set({
            taskFocusMinutes: {
              ...taskFocusMinutes,
              [currentTaskId]: (taskFocusMinutes[currentTaskId] ?? 0) + mins,
            },
          });
        }

        try {
          const { useMomentumStore } = require('../../user/store/useMomentumStore');
          useMomentumStore.getState().addFocusMinutes(mins);
        } catch (e) {
          swallow('focusStore.registerMinutes', e);
        }
      },

      setDailyGoal: (mins) => set({ dailyGoalMinutes: mins }),

      updateBestStreak: (current) => {
        const { bestStreak } = get();
        if (current > bestStreak) {
          set({ bestStreak: current });
        }
      },

      togglePomodoroMode: () => {
        const { pomodoroMode } = get();
        set({ pomodoroMode: !pomodoroMode, pomodoroRound: 1, pomodoroPhase: 'work' });
      },

      nextPomodoroPhase: () => {
        const { pomodoroPhase, pomodoroRound } = get();
        if (pomodoroPhase === 'work') {
          if (pomodoroRound === 4) {
            // Long break after round 4
            set({ pomodoroPhase: 'break', pomodoroRound: 1 });
          } else {
            set({ pomodoroPhase: 'break' });
          }
        } else {
          // break -> work, advance round (unless we just reset from round 4)
          const nextRound = pomodoroRound < 4 ? pomodoroRound + 1 : 1;
          set({ pomodoroPhase: 'work', pomodoroRound: nextRound });
        }
      },

      useStreakFreeze: () => {
        const { streakShields } = get();
        const nextShields = Math.max(0, streakShields - 1);
        set({
          streakShields: nextShields,
          streakFreezeAvailable: nextShields > 0,
          streakFreezeUsedWeek: getISOWeek()
        });
      },

      checkStreakFreezeReset: () => {
        const { streakFreezeUsedWeek, streakShields } = get();
        const currentWeek = getISOWeek();
        if (streakFreezeUsedWeek && streakFreezeUsedWeek !== currentWeek) {
          const nextShields = Math.min(3, streakShields + 1); // grant one shield on new week if used
          set({
            streakShields: nextShields,
            streakFreezeAvailable: nextShields > 0,
            streakFreezeUsedWeek: ''
          });
        }
      },

      setStrictMode: (strictMode) => set({ strictMode }),

      addFocusPoints: (pts) => {
        const { focusPoints, streakShields } = get();
        const nextPoints = focusPoints + pts;
        if (nextPoints >= 100) {
          const addedShields = Math.floor(nextPoints / 100);
          const remainingPoints = nextPoints % 100;
          const nextShields = Math.min(3, streakShields + addedShields);
          
          if (nextShields > streakShields) {
            try {
              const { usePrefsStore } = require('@/features/modes/store/usePrefsStore');
              if (usePrefsStore.getState().soundEffects) {
                playSoundEffect(require('../../../assets/sounds/levelup.mp3'), {
                  context: 'focusStore.levelUpSound',
                  releaseAfterMs: 3000,
                });
              }
            } catch (e) {
              swallow('focusStore.readSoundPref', e);
            }
          }

          set({
            focusPoints: remainingPoints,
            streakShields: nextShields,
            streakFreezeAvailable: nextShields > 0
          });
        } else {
          set({ focusPoints: nextPoints });
        }
      },

      consumeStreakShield: () => {
        const { streakShields } = get();
        if (streakShields > 0) {
          const nextShields = streakShields - 1;
          set({
            streakShields: nextShields,
            streakFreezeAvailable: nextShields > 0
          });
          return true;
        }
        return false;
      },

      incrementLocalStreak: () => {
        const { localStreak, bestStreak } = get();
        const next = localStreak + 1;
        set({
          localStreak: next,
          bestStreak: Math.max(bestStreak, next)
        });
      },
    }),
    {
      name: 'tazq-focus-storage',
      storage: createJSONStorage(() => throttledAsyncStorage),
      onRehydrateStorage: (state) => {
        return (state, error) => {
          if (!error && state) {
            state.rehydrateTimer();
          }
        };
      },
      partialize: (state) => ({
        isActive: state.isActive,
        seconds: state.seconds,
        totalSeconds: state.totalSeconds,
        pausedSeconds: state.pausedSeconds,
        currentTask: state.currentTask,
        currentTaskId: state.currentTaskId,
        taskFocusMinutes: state.taskFocusMinutes,
        lastActiveAt: state.lastActiveAt,
        expectedFinishAt: state.expectedFinishAt,
        sessionId: state.sessionId,
        sessionKind: state.sessionKind,
        committedSessionId: state.committedSessionId,
        finishedAt: state.finishedAt,
        dailyFocusMinutes: state.dailyFocusMinutes,
        dailyFocusDate: state.dailyFocusDate,
        dailyGoalMinutes: state.dailyGoalMinutes,
        bestStreak: state.bestStreak,
        streakFreezeAvailable: state.streakFreezeAvailable,
        streakFreezeUsedWeek: state.streakFreezeUsedWeek,
        pomodoroMode: state.pomodoroMode,
        pomodoroRound: state.pomodoroRound,
        pomodoroPhase: state.pomodoroPhase,
        focusPoints: state.focusPoints,
        streakShields: state.streakShields,
        strictMode: state.strictMode,
        localStreak: state.localStreak,
        lastCheckedDate: state.lastCheckedDate,
      }),
    }
  )
);
