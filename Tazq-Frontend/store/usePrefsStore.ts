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
  sporMode: boolean;
  sporGoal: string;
  sporDate: string | null;
}

type PlanMode = 'exam' | 'exam2' | 'exam3' | 'ramazan' | 'tez' | 'mulakat' | 'spor';

interface PrefsState {
  seasonal: SeasonalPrefs;
  setSeasonalPref: (key: keyof SeasonalPrefs, value: boolean | string | null) => void;
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
  sporPlanHabitIds: string[];
  sporPlanTaskIds: number[];
  examReviewShown: boolean;
  setExamReviewShown: (v: boolean) => void;
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
        sporMode: false,
        sporGoal: '',
        sporDate: null,
      },
      setSeasonalPref: (key, value) =>
        set((s) => ({ seasonal: { ...s.seasonal, [key]: value } })),
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
      sporPlanHabitIds: [],
      sporPlanTaskIds: [],
      examReviewShown: false,
      setExamReviewShown: (v) => set({ examReviewShown: v }),
      setPlanIds: (mode, habitIds, taskIds) => {
        if (mode === 'exam') return set({ examPlanHabitIds: habitIds, examPlanTaskIds: taskIds });
        if (mode === 'exam2') return set({ exam2PlanHabitIds: habitIds, exam2PlanTaskIds: taskIds });
        if (mode === 'exam3') return set({ exam3PlanHabitIds: habitIds, exam3PlanTaskIds: taskIds });
        if (mode === 'tez') return set({ tezPlanHabitIds: habitIds, tezPlanTaskIds: taskIds });
        if (mode === 'mulakat') return set({ mulakatPlanHabitIds: habitIds, mulakatPlanTaskIds: taskIds });
        if (mode === 'spor') return set({ sporPlanHabitIds: habitIds, sporPlanTaskIds: taskIds });
        return set({ ramazanPlanHabitIds: habitIds, ramazanPlanTaskIds: taskIds });
      },
      clearPlanIds: (mode) => {
        if (mode === 'exam') return set({ examPlanHabitIds: [], examPlanTaskIds: [] });
        if (mode === 'exam2') return set({ exam2PlanHabitIds: [], exam2PlanTaskIds: [] });
        if (mode === 'exam3') return set({ exam3PlanHabitIds: [], exam3PlanTaskIds: [] });
        if (mode === 'tez') return set({ tezPlanHabitIds: [], tezPlanTaskIds: [] });
        if (mode === 'mulakat') return set({ mulakatPlanHabitIds: [], mulakatPlanTaskIds: [] });
        if (mode === 'spor') return set({ sporPlanHabitIds: [], sporPlanTaskIds: [] });
        return set({ ramazanPlanHabitIds: [], ramazanPlanTaskIds: [] });
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
          sporMode: false,
          sporGoal: '',
          sporDate: null,
          ...(persisted?.seasonal ?? {}),
        },
      }),
    }
  )
);
