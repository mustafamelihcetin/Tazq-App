import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthService } from '../services/api';

interface SeasonalPrefs {
  ramazan: boolean;
  examMode: boolean;
  examName: string;
  examDate: string | null;
  exam2Name: string;
  exam2Date: string | null;
  exam3Name: string;
  exam3Date: string | null;
  tezMode: boolean;
  tezName: string;
  tezDate: string | null;
  mulakatMode: boolean;
  mulakatName: string;
  mulakatDate: string | null;
  mulakat2Name: string;
  mulakat2Date: string | null;
  mulakat3Name: string;
  mulakat3Date: string | null;
  sporMode: boolean;
  sporGoal: string;
  sporDate: string | null;
  spor2Goal: string;
  spor2Date: string | null;
  spor3Goal: string;
  spor3Date: string | null;
}

type PlanMode = 'exam' | 'exam2' | 'exam3' | 'ramazan' | 'tez' | 'mulakat' | 'mulakat2' | 'mulakat3' | 'spor' | 'spor2' | 'spor3';

// Günlük plan motorunun ihtiyaç duyduğu kompakt plan tarifi.
// Görevler artık önceden materyalize edilmiyor; bu spec'ten her gün üretiliyor.
export interface PlanSpec {
  templateId?: string;     // seçilen şablon (faz override / başlangıç fazı)
  dailyMinutes?: number;   // kullanıcının seçtiği günlük çalışma süresi → görev yoğunluğu
  startDate?: string;      // planın oluşturulduğu an (ISO) — "kaçıncı hafta" hesabının
                           // tek kaynağı. Spor (güç deload döngüsü / maraton rampası)
                           // bunu kullanır; ilk setPlanSpec'te damgalanır, sonra korunur.
}

interface PrefsState {
  seasonal: SeasonalPrefs;
  setSeasonalPref: (key: keyof SeasonalPrefs, value: boolean | string | null) => void;
  planSpecs: Partial<Record<PlanMode, PlanSpec>>;
  setPlanSpec: (mode: PlanMode, spec: PlanSpec) => void;
  clearPlanSpec: (mode: PlanMode) => void;
  weeklyNotification: boolean;
  setWeeklyNotification: (value: boolean) => void;
  morningBrief: boolean;
  setMorningBrief: (value: boolean) => void;
  eveningBrief: boolean;
  setEveningBrief: (value: boolean) => void;
  soundEffects: boolean;
  setSoundEffects: (value: boolean) => void;
  examPlanHabitIds: string[];
  examPlanTaskIds: number[];
  exam2PlanHabitIds: string[];
  exam2PlanTaskIds: number[];
  exam3PlanHabitIds: string[];
  exam3PlanTaskIds: number[];
  ramazanPlanHabitIds: string[];
  ramazanPlanTaskIds: number[];
  tezPlanHabitIds: string[];
  tezPlanTaskIds: number[];
  mulakatPlanHabitIds: string[];
  mulakatPlanTaskIds: number[];
  mulakat2PlanHabitIds: string[];
  mulakat2PlanTaskIds: number[];
  mulakat3PlanHabitIds: string[];
  mulakat3PlanTaskIds: number[];
  sporPlanHabitIds: string[];
  sporPlanTaskIds: number[];
  spor2PlanHabitIds: string[];
  spor2PlanTaskIds: number[];
  spor3PlanHabitIds: string[];
  spor3PlanTaskIds: number[];
  examReviewShown: boolean;
  setExamReviewShown: (v: boolean) => void;
  dismissedBannerKey: string;
  setDismissedBannerKey: (key: string) => void;
  motto: string;
  setMotto: (v: string) => void;
  productivityHour: 'morning' | 'afternoon' | 'evening' | 'night';
  setProductivityHour: (v: 'morning' | 'afternoon' | 'evening' | 'night') => void;
  avatarBorderColor: string;
  setAvatarBorderColor: (v: string) => void;
  setPlanIds: (mode: PlanMode, habitIds: string[], taskIds: number[]) => void;
  clearPlanIds: (mode: PlanMode) => void;
  // Cihazlar arası eşitleme: seçili tercihleri backend'e gönderir / login sonrası geri yükler.
  syncToCloud: () => Promise<void>;
  hydrateFromCloud: (prefsJson?: string | null) => void;
}

// Buluta eşitlenecek tercih alanları. (motto/avatarBorderColor kendi backend kolonlarıyla
// updateProfile üzerinden gider; soundEffects/dismissedBannerKey/examReviewShown cihaza özeldir.)
const CLOUD_PREF_KEYS = [
  'seasonal',
  'planSpecs',
  'productivityHour',
  'weeklyNotification',
  'morningBrief',
  'eveningBrief',
  'examPlanHabitIds', 'examPlanTaskIds',
  'exam2PlanHabitIds', 'exam2PlanTaskIds',
  'exam3PlanHabitIds', 'exam3PlanTaskIds',
  'ramazanPlanHabitIds', 'ramazanPlanTaskIds',
  'tezPlanHabitIds', 'tezPlanTaskIds',
  'mulakatPlanHabitIds', 'mulakatPlanTaskIds',
  'mulakat2PlanHabitIds', 'mulakat2PlanTaskIds',
  'mulakat3PlanHabitIds', 'mulakat3PlanTaskIds',
  'sporPlanHabitIds', 'sporPlanTaskIds',
  'spor2PlanHabitIds', 'spor2PlanTaskIds',
  'spor3PlanHabitIds', 'spor3PlanTaskIds',
] as const;

export const usePrefsStore = create<PrefsState>()(
  persist(
    (set, get) => ({
      seasonal: {
        ramazan: false,
        examMode: false,
        examName: '',
        examDate: null,
        exam2Name: '',
        exam2Date: null,
        exam3Name: '',
        exam3Date: null,
        tezMode: false,
        tezName: '',
        tezDate: null,
        mulakatMode: false,
        mulakatName: '',
        mulakatDate: null,
        mulakat2Name: '',
        mulakat2Date: null,
        mulakat3Name: '',
        mulakat3Date: null,
        sporMode: false,
        sporGoal: '',
        sporDate: null,
        spor2Goal: '',
        spor2Date: null,
        spor3Goal: '',
        spor3Date: null,
      },
      setSeasonalPref: (key, value) =>
        set((s) => ({ seasonal: { ...s.seasonal, [key]: value } })),
      planSpecs: {},
      setPlanSpec: (mode, spec) =>
        set((s) => {
          const prev = s.planSpecs[mode];
          // startDate ilk oluşturmada damgalanır, sonraki güncellemelerde korunur
          // (spec açıkça yeni bir startDate vermedikçe).
          return {
            planSpecs: {
              ...s.planSpecs,
              [mode]: { startDate: prev?.startDate ?? new Date().toISOString(), ...prev, ...spec },
            },
          };
        }),
      clearPlanSpec: (mode) =>
        set((s) => {
          const next = { ...s.planSpecs };
          delete next[mode];
          return { planSpecs: next };
        }),
      weeklyNotification: true,
      setWeeklyNotification: (value) => set({ weeklyNotification: value }),
      morningBrief: true,
      setMorningBrief: (value) => set({ morningBrief: value }),
      eveningBrief: true,
      setEveningBrief: (value) => set({ eveningBrief: value }),
      soundEffects: true,
      setSoundEffects: (value) => set({ soundEffects: value }),
      examPlanHabitIds: [],
      examPlanTaskIds: [],
      exam2PlanHabitIds: [],
      exam2PlanTaskIds: [],
      exam3PlanHabitIds: [],
      exam3PlanTaskIds: [],
      ramazanPlanHabitIds: [],
      ramazanPlanTaskIds: [],
      tezPlanHabitIds: [],
      tezPlanTaskIds: [],
      mulakatPlanHabitIds: [],
      mulakatPlanTaskIds: [],
      mulakat2PlanHabitIds: [],
      mulakat2PlanTaskIds: [],
      mulakat3PlanHabitIds: [],
      mulakat3PlanTaskIds: [],
      sporPlanHabitIds: [],
      sporPlanTaskIds: [],
      spor2PlanHabitIds: [],
      spor2PlanTaskIds: [],
      spor3PlanHabitIds: [],
      spor3PlanTaskIds: [],
      examReviewShown: false,
      setExamReviewShown: (v) => set({ examReviewShown: v }),
      dismissedBannerKey: '',
      setDismissedBannerKey: (key) => set({ dismissedBannerKey: key }),
      motto: '',
      setMotto: (v) => set({ motto: v }),
      productivityHour: 'morning',
      setProductivityHour: (v) => set({ productivityHour: v }),
      avatarBorderColor: 'transparent',
      setAvatarBorderColor: (v) => set({ avatarBorderColor: v }),
      setPlanIds: (mode, habitIds, taskIds) => {
        if (mode === 'exam') return set({ examPlanHabitIds: habitIds, examPlanTaskIds: taskIds });
        if (mode === 'exam2') return set({ exam2PlanHabitIds: habitIds, exam2PlanTaskIds: taskIds });
        if (mode === 'exam3') return set({ exam3PlanHabitIds: habitIds, exam3PlanTaskIds: taskIds });
        if (mode === 'tez') return set({ tezPlanHabitIds: habitIds, tezPlanTaskIds: taskIds });
        if (mode === 'mulakat') return set({ mulakatPlanHabitIds: habitIds, mulakatPlanTaskIds: taskIds });
        if (mode === 'mulakat2') return set({ mulakat2PlanHabitIds: habitIds, mulakat2PlanTaskIds: taskIds });
        if (mode === 'mulakat3') return set({ mulakat3PlanHabitIds: habitIds, mulakat3PlanTaskIds: taskIds });
        if (mode === 'spor') return set({ sporPlanHabitIds: habitIds, sporPlanTaskIds: taskIds });
        if (mode === 'spor2') return set({ spor2PlanHabitIds: habitIds, spor2PlanTaskIds: taskIds });
        if (mode === 'spor3') return set({ spor3PlanHabitIds: habitIds, spor3PlanTaskIds: taskIds });
        return set({ ramazanPlanHabitIds: habitIds, ramazanPlanTaskIds: taskIds });
      },
      clearPlanIds: (mode) => {
        set((s) => {
          const planSpecs = { ...s.planSpecs };
          delete planSpecs[mode];
          if (mode === 'exam') return { examPlanHabitIds: [], examPlanTaskIds: [], planSpecs };
          if (mode === 'exam2') return { exam2PlanHabitIds: [], exam2PlanTaskIds: [], planSpecs };
          if (mode === 'exam3') return { exam3PlanHabitIds: [], exam3PlanTaskIds: [], planSpecs };
          if (mode === 'tez') return { tezPlanHabitIds: [], tezPlanTaskIds: [], planSpecs };
          if (mode === 'mulakat') return { mulakatPlanHabitIds: [], mulakatPlanTaskIds: [], planSpecs };
          if (mode === 'mulakat2') return { mulakat2PlanHabitIds: [], mulakat2PlanTaskIds: [], planSpecs };
          if (mode === 'mulakat3') return { mulakat3PlanHabitIds: [], mulakat3PlanTaskIds: [], planSpecs };
          if (mode === 'spor') return { sporPlanHabitIds: [], sporPlanTaskIds: [], planSpecs };
          if (mode === 'spor2') return { spor2PlanHabitIds: [], spor2PlanTaskIds: [], planSpecs };
          if (mode === 'spor3') return { spor3PlanHabitIds: [], spor3PlanTaskIds: [], planSpecs };
          return { ramazanPlanHabitIds: [], ramazanPlanTaskIds: [], planSpecs };
        });
      },

      syncToCloud: async () => {
        const state = get() as any;
        const snapshot: Record<string, any> = {};
        for (const key of CLOUD_PREF_KEYS) snapshot[key] = state[key];
        // Başarımları da aynı transport ile taşı (sahibi useAchievementStore).
        // Böylece "kutlandı" hafızası, kutladığı metrik (sunucudaki streak) kadar kalıcı olur.
        try {
          const ach = require('./useAchievementStore').useAchievementStore.getState();
          snapshot.__achievements = { unlocked: ach.unlocked, baselined: ach.baselined };
        } catch {}
        try {
          await AuthService.updateProfile({ preferences: JSON.stringify(snapshot) });
        } catch (err) {
          // Çevrimdışı/başarısız: sessizce geç, tercihler lokalde zaten kalıcı.
          console.log('[Prefs Sync] cloud push failed (will retry on next change)', err);
        }
      },

      hydrateFromCloud: (prefsJson) => {
        if (!prefsJson) return;
        try {
          const parsed = JSON.parse(prefsJson);
          if (!parsed || typeof parsed !== 'object') return;
          const patch: Record<string, any> = {};
          for (const key of CLOUD_PREF_KEYS) {
            if (parsed[key] !== undefined) patch[key] = parsed[key];
          }
          if (Object.keys(patch).length > 0) set(patch as any);
          // Buluttaki başarım durumunu achievement store'a birleştir (union).
          // Yeni kurulum/cihazda streak ile birlikte "kutlandı" bilgisi de geri gelir →
          // tekrar kutlama olmaz.
          if (parsed.__achievements && typeof parsed.__achievements === 'object') {
            try {
              require('./useAchievementStore').useAchievementStore.getState().applyCloud(parsed.__achievements);
            } catch {}
          }
        } catch (err) {
          console.log('[Prefs Sync] hydrate parse failed', err);
        }
      },
    }),
    {
      name: 'tazq-prefs-storage',
      storage: createJSONStorage(() => AsyncStorage),
      merge: (persisted: any, current) => ({
        ...current,
        ...persisted,
        seasonal: {
          ramazan: false,
          examMode: false,
          examName: '',
          examDate: null,
          exam2Name: '',
          exam2Date: null,
          exam3Name: '',
          exam3Date: null,
          tezMode: false,
          tezName: '',
          tezDate: null,
          mulakatMode: false,
          mulakatName: '',
          mulakatDate: null,
          mulakat2Name: '',
          mulakat2Date: null,
          mulakat3Name: '',
          mulakat3Date: null,
          sporMode: false,
          sporGoal: '',
          sporDate: null,
          spor2Goal: '',
          spor2Date: null,
          spor3Goal: '',
          spor3Date: null,
          ...(persisted?.seasonal ?? {}),
        },
        motto: (persisted as any)?.motto ?? '',
        productivityHour: (persisted as any)?.productivityHour ?? 'morning',
        avatarBorderColor: (persisted as any)?.avatarBorderColor ?? 'transparent',
        planSpecs: (persisted as any)?.planSpecs ?? {},
      }),
    }
  )
);
