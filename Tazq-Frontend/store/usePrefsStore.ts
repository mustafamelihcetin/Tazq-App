import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
}

export const usePrefsStore = create<PrefsState>()(
  persist(
    (set) => ({
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
        set((s) => ({ planSpecs: { ...s.planSpecs, [mode]: { ...s.planSpecs[mode], ...spec } } })),
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
