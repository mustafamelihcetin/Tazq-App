import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { inferSleepFromNames } from '@/features/habits/utils/sleepHabit';
import { daysBetween } from '@/features/habits/utils/habitLimit';
import { bump, isDueToday, isPlannedDay, targetOf, isQuantity, scheduleOf, type PlanFields, type HabitAutoSource } from '@/features/habits/utils/habitSchedule';

/** Plan alanları (sıklık, miktar, dilim, otomatik kaynak) — bkz. habitSchedule. Hepsi isteğe bağlı. */
export interface Habit extends PlanFields {
  id: string;
  name: string;
  emoji: string;
  color: string;
  completedDates: string[]; // 'YYYY-MM-DD'
  skippedDates?: string[];   // 'YYYY-MM-DD'
  createdAt: string;
  /**
   * Bu alışkanlık hangi dönemsel moda ait (exam/yks/kpss/tez/mulakat/spor/ramazan)?
   * Mod kapatılınca güvenilir temizlik için kullanılır. Manuel alışkanlıklarda undefined.
   */
  planMode?: string;
  nameTr?: string;
  nameEn?: string;
  /**
   * Faz 0 sağlık entegrasyonu temeli: bu alışkanlık bir sağlık metriğine karşılık geliyorsa
   * etiketlenir (ör. uyku habit'i → 'sleep'). Şu an sadece etiket; ileride Apple Health /
   * Health Connect ile "onaylı asistan" akışı bu etikete bakar. Manuel/diğerlerinde undefined.
   */
  healthMetric?: 'sleep';
  /**
   * DİNLENDİRİLDİ (duraklatıldı) — 'YYYY-MM-DD'. Sınıra sayılmaz, bugünün listesinde
   * çıkmaz (madde 6). Geri alınca NULL yazılır, alan silinmez: birleştirme yereli
   * tercih ediyor ama silinmiş alan buluttaki eski değeri geri getirirdi.
   */
  pausedAt?: string | null;
}

interface HabitState {
  habits: Habit[];
  weeklyGoal: string;
  addHabit: (name: string, emoji: string, color: string, id?: string, planMode?: string, nameTr?: string, nameEn?: string, plan?: PlanFields) => void;
  /** Sıklık/miktar/dilim/otomatik kaynağı değiştirir (geçmiş işaretlere dokunmaz). */
  updatePlan: (id: string, plan: PlanFields) => void;
  /** Elle eklenen alışkanlığın rengini değiştirir (palet açık tonu; bkz. habitColor). */
  setHabitColor: (id: string, color: string) => void;
  /** Ana dokunuş: miktarlıda +1 (hedefteyken sıfırlar), değilse yapıldı/geri al. */
  tapHabit: (id: string, date: string) => void;
  /** Odak/nefes bitince bağlı alışkanlıkları işaretler; işaretlenenlerin adlarını döner. */
  markAuto: (source: HabitAutoSource, date: string) => string[];
  removeHabit: (id: string) => void;
  toggleDate: (habitId: string, date: string) => void;
  toggleSkipDate: (habitId: string, date: string) => void;
  setWeeklyGoal: (goal: string) => void;
  getStreak: (habit: Habit) => number;
  setHabits: (habits: Habit[]) => void;
  /** Geri alınabilir duraklatma (bkz. habitLimit). */
  pauseHabit: (id: string, today?: string) => void;
  /** Dinlenme günleri MOLA sayılır — seri bozulmaz. */
  resumeHabit: (id: string, today?: string) => void;
}

export function fmtDateKey(d: Date = new Date()): string {
  const adjusted = new Date(d);
  adjusted.setHours(adjusted.getHours() - 3); // 3-hour buffer for night owls
  return `${adjusted.getFullYear()}-${String(adjusted.getMonth() + 1).padStart(2, '0')}-${String(adjusted.getDate()).padStart(2, '0')}`;
}

/*
  SERİ PLANA DUYARLI (2026-10-30): "Pzt-Çar-Cum" alışkanlığında Salı bir kaçırma değildir —
  planlanmayan günler mola gibi atlanır. "Haftada N"de günlük seri anlamsız: ardışık hedefi
  tutan HAFTA sayısı döner. Tek boşluk affı ("iki kez kaçırma") aynen korunur.
*/
function computeStreak(completedDates: string[] | undefined, skippedDates: string[] | undefined, plan?: PlanFields): number {
  const schedule = scheduleOf(plan ?? {});
  if (schedule.kind === 'weekly') return weeklyStreak(completedDates ?? [], schedule.times);
  if (schedule.kind === 'days') {
    // Planlanmayan günleri mola say: aşağıdaki günlük algoritma onları zinciri bozmadan geçer.
    const done = new Set(completedDates ?? []);
    const extra: string[] = [];
    const d0 = new Date();
    for (let i = 0; i < 400; i++) {
      const k = fmtDateKey(new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() - i, d0.getHours()));
      if (!done.has(k) && !isPlannedDay({ schedule }, k)) extra.push(k);
    }
    skippedDates = [...(skippedDates ?? []), ...extra];
  }
  if (!completedDates?.length) return 0;
  const completedSet = new Set(completedDates);
  const skippedSet = new Set(skippedDates ?? []);
  let streak = 0;
  let d = new Date();
  
  // If today is missed/skipped, check yesterday. If yesterday is also missed/skipped, streak is broken.
  const isTodayActive = completedSet.has(fmtDateKey(d)) || skippedSet.has(fmtDateKey(d));
  if (!isTodayActive) {
    d.setDate(d.getDate() - 1);
    const isYesterdayActive = completedSet.has(fmtDateKey(d)) || skippedSet.has(fmtDateKey(d));
    if (!isYesterdayActive) {
      return 0; // 2 consecutive days missed/skipped -> broken
    }
  }
  
  while (true) {
    if (streak > 3650) break; // safety
    const key = fmtDateKey(d);
    
    if (completedSet.has(key)) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else if (skippedSet.has(key)) {
      d.setDate(d.getDate() - 1);
    } else {
      // Missing day (gap). Check if the day before that was completed to forgive this gap.
      const prevD = new Date(d);
      prevD.setDate(prevD.getDate() - 1);
      const prevKey = fmtDateKey(prevD);
      
      if (completedSet.has(prevKey) || skippedSet.has(prevKey)) {
        // Gap forgiven (grace period)
        d.setDate(d.getDate() - 1);
      } else {
        // Two consecutive missed days
        break;
      }
    }
  }
  return streak;
}

function weeklyStreak(completedDates: string[], times: number): number {
  const done = new Set(completedDates);
  const monday = (d: Date) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const count = (start: Date) => { let n = 0; for (let i = 0; i < 7; i++) { const x = new Date(start); x.setDate(x.getDate() + i); if (done.has(key(x))) n++; } return n; };
  let w = monday(new Date());
  let streak = count(w) >= times ? 1 : 0; // bu hafta tuttuysa say; tutmadıysa hafta bitmedi, ceza yok
  w.setDate(w.getDate() - 7);
  for (let i = 0; i < 520 && count(w) >= times; i++) { streak++; w.setDate(w.getDate() - 7); }
  return streak;
}

export const useHabitStore = create<HabitState>()(
  persist(
    (set, get) => ({
      habits: [],
      weeklyGoal: '',
      setHabits: (habits) => set({ habits }),
      pauseHabit: (id, today = fmtDateKey()) =>
        set({ habits: get().habits.map(h => (h.id === id ? { ...h, pausedAt: today } : h)) }),
      resumeHabit: (id, today = fmtDateKey()) =>
        set({
          habits: get().habits.map(h => {
            if (h.id !== id || !h.pausedAt) return h;
            const done = new Set(h.completedDates ?? []);
            const rest = daysBetween(h.pausedAt, today).filter(d => !done.has(d));
            const skipped = Array.from(new Set([...(h.skippedDates ?? []), ...rest])).sort();
            return { ...h, pausedAt: null, skippedDates: skipped };
          }),
        }),
      addHabit: (name, emoji, color, id, planMode, nameTr, nameEn, plan) =>
        set((s) => {
          // Çift-isim koruması (büyük/küçük harf duyarsız) — aynı alışkanlık iki kez eklenmez.
          const key = name.trim().toLocaleLowerCase('tr');
          if (s.habits.some(h => h.name.trim().toLocaleLowerCase('tr') === key)) {
            return s;
          }
          // Faz 0: uyku alışkanlığını tek noktada türet. KURAL PAYLAŞIMLI (sleepHabit.ts):
          // kayıt ve okuma farklı kurallar kullanırsa bir alışkanlık kaydedilirken uyku
          // sayılıp okunurken sayılmayabilir. Eski satır burada `|| emoji === '😴'` diyordu
          // ve spor planının "Toparlanma: uyku + aktif dinlenme" alışkanlığına damgayı
          // KALICI olarak basıyordu — bkz. sleepHabit.ts'teki ölçülen sorun.
          const isSleep = inferSleepFromNames({ name, nameTr, nameEn, emoji });
          return {
            habits: [
              ...s.habits,
              {
                id: id ?? `habit_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
                name,
                emoji,
                color,
                completedDates: [],
                skippedDates: [],
                createdAt: new Date().toISOString(),
                ...(planMode ? { planMode } : {}),
                ...(nameTr ? { nameTr } : {}),
                ...(nameEn ? { nameEn } : {}),
                ...(isSleep ? { healthMetric: 'sleep' as const } : {}),
                ...(plan ?? {}),
              },
            ],
          };
        }),
      updatePlan: (id, plan) =>
        set((s) => ({ habits: s.habits.map((h) => (h.id === id ? { ...h, ...plan } : h)) })),
      setHabitColor: (id, color) =>
        set((s) => ({ habits: s.habits.map((h) => (h.id === id ? { ...h, color } : h)) })),
      tapHabit: (id, date) => {
        const h = get().habits.find(x => x.id === id);
        if (!h) return;
        if (!isQuantity(h)) { get().toggleDate(id, date); return; }
        const r = bump(h, date);
        set((s) => ({
          habits: s.habits.map((x) => {
            if (x.id !== id) return x;
            const dates = (x.completedDates ?? []).filter(d => d !== date);
            return { ...x, counts: r.counts, completedDates: r.done ? [...dates, date] : dates, skippedDates: (x.skippedDates ?? []).filter(d => d !== date) };
          }),
        }));
      },
      markAuto: (source, date) => {
        const hits = get().habits.filter(h => h.autoFrom === source && isDueToday(h, date) && !(h.completedDates ?? []).includes(date));
        if (hits.length === 0) return [];
        const ids = new Set(hits.map(h => h.id));
        set((s) => ({
          habits: s.habits.map((h) => (!ids.has(h.id) ? h : {
            ...h,
            completedDates: [...(h.completedDates ?? []), date],
            skippedDates: (h.skippedDates ?? []).filter(d => d !== date),
            ...(isQuantity(h) ? { counts: { ...(h.counts ?? {}), [date]: targetOf(h) } } : {}),
          })),
        }));
        return hits.map(h => h.name);
      },
      removeHabit: (id) =>
        set((s) => ({ habits: s.habits.filter((h) => h.id !== id) })),
      toggleDate: (habitId, date) =>
        set((s) => ({
          habits: s.habits.map((h) => {
            if (h.id !== habitId) return h;
            const dates = h.completedDates ?? [];
            const skipped = h.skippedDates ?? [];
            const has = dates.includes(date);
            return {
              ...h,
              completedDates: has
                ? dates.filter((d) => d !== date)
                : [...dates, date],
              skippedDates: skipped.filter((d) => d !== date),
            };
          }),
        })),
      toggleSkipDate: (habitId, date) =>
        set((s) => ({
          habits: s.habits.map((h) => {
            if (h.id !== habitId) return h;
            const dates = h.completedDates ?? [];
            const skipped = h.skippedDates ?? [];
            const has = skipped.includes(date);
            return {
              ...h,
              skippedDates: has
                ? skipped.filter((d) => d !== date)
                : [...skipped, date],
              completedDates: dates.filter((d) => d !== date),
            };
          }),
        })),
      setWeeklyGoal: (weeklyGoal) => set({ weeklyGoal }),
      getStreak: (habit) => computeStreak(habit.completedDates, habit.skippedDates, habit),
    }),
    {
      name: 'tazq-habits',
      storage: createJSONStorage(() => AsyncStorage),
      // Ensure persisted habits always have completedDates (guards against old data)
      merge: (persisted: any, current) => {
        const raw: any[] = ((persisted as any)?.habits ?? [])
          .filter((h: any) => !!h && !!h.id)
          .map((h: any) => ({
            ...h,
            completedDates: Array.isArray(h.completedDates) ? h.completedDates : [],
            skippedDates: Array.isArray(h.skippedDates) ? h.skippedDates : [],
            color: h.color ?? '#6366F1',
            emoji: h.emoji ?? '📌',
            name: h.name ?? '',
            /*
              YANLIŞ UYKU DAMGASINI DÜZELT — eski kural depoya yazdı, yalnız okumayı
              düzeltmek yetmez.

              `healthMetric: 'sleep'` kayıt anında basılıyordu ve o günkü kural
              `|| emoji === '😴'` içeriyordu. Spor planının "Toparlanma: uyku + aktif
              dinlenme" alışkanlığı bu yüzden uyku damgası taşıyor ve her sabah
              otomatik işaretleniyordu. Damga kalıcı olduğundan, kuralı düzeltmek
              MEVCUT kullanıcıları kurtarmıyor — damga da düzeltilmeli.

              GEÇMİŞ TAMAMLAMALARA DOKUNULMAZ. Hangi işaretin otomatik, hangisinin
              elle konduğu kayıtlı değil; silmek kullanıcının gerçekten yaptığı işi de
              silme riski taşır. Sessizce veri silmek, düzelttiğimiz hatanın aynısıdır.
              Bugünden itibaren doğru davranır.
            */
            healthMetric: inferSleepFromNames(h) ? ('sleep' as const) : undefined,
          }));
        const seen = new Set<string>();
        const habits = raw.filter((h) => {
          if (seen.has(h.id)) return false;
          seen.add(h.id);
          return true;
        });
        return { ...current, ...(persisted as any), habits };
      },
    }
  )
);
