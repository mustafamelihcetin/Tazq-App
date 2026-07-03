import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthService } from '@/shared/services/api';

export interface SeasonalPrefs {
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
  // Tasarruf/Bütçe (tek slot) — tutarlar useBudgetStore'da; burada toggle/ad/hedef tarih.
  tasarrufMode: boolean;
  tasarrufName: string;
  tasarrufDate: string | null;
  // Bırakma (tek slot) — tip/başlangıç useQuitStore'da; burada toggle/ad. Deadline yok (seri).
  birakmaMode: boolean;
  birakmaName: string;
}

export type PlanMode = 'exam' | 'exam2' | 'exam3' | 'ramazan' | 'tez' | 'mulakat' | 'mulakat2' | 'mulakat3' | 'spor' | 'spor2' | 'spor3' | 'tasarruf' | 'birakma';

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
  tasarrufPlanHabitIds: string[];
  tasarrufPlanTaskIds: number[];
  birakmaPlanHabitIds: string[];
  birakmaPlanTaskIds: number[];
  examReviewShown: boolean;
  setExamReviewShown: (v: boolean) => void;
  dismissedBannerKey: string;
  setDismissedBannerKey: (key: string) => void;
  motto: string;
  setMotto: (v: string) => void;
  gender: 'male' | 'female' | '';
  setGender: (v: 'male' | 'female' | '') => void;
  productivityHour: 'morning' | 'afternoon' | 'evening' | 'night';
  setProductivityHour: (v: 'morning' | 'afternoon' | 'evening' | 'night') => void;
  avatarBorderColor: string;
  setAvatarBorderColor: (v: string) => void;
  // ── Ürün katmanları (Faz 1) ───────────────────────────────────────────────
  // Lite: sade to-do görünümü (gamification gizli). Pro: tam deneyim.
  uiMode: 'lite' | 'pro';
  setUiMode: (v: 'lite' | 'pro') => void;
  // Kademeli özellik açımı (AI koç, sosyal vb.) — cloud-sync.
  featureFlags: Record<string, boolean>;
  setFeatureFlag: (key: string, value: boolean) => void;
  // İlk-değer akışı izleme
  onboardingCompleted: boolean;
  setOnboardingCompleted: (v: boolean) => void;
  helpTourShown: boolean;
  setHelpTourShown: (v: boolean) => void;
  completedTours: Record<string, boolean>;
  setTourCompleted: (page: string, completed: boolean) => void;
  firstWinAt: string | null;
  markFirstWin: () => void;
  setPlanIds: (mode: PlanMode, habitIds: string[], taskIds: number[]) => void;
  clearPlanIds: (mode: PlanMode) => void;
  // Çıkışta cihazdaki kullanıcı-özel tercihleri (dönemsel modlar + plan id'leri) sıfırlar
  // → başka hesapla giriş yapınca önceki kullanıcının modları sızmaz.
  resetUserData: () => void;
  // Offline senkron sonrası: bir plan görevinin tempId'sini gerçek id ile değiştir
  // (tüm slot dizilerinde). Böylece mod kapatma/temizlik doğru id'yi siler.
  remapPlanTaskId: (oldId: number, newId: number) => void;
  // Cihazlar arası eşitleme: seçili tercihleri backend'e gönderir / login sonrası geri yükler.
  syncToCloud: () => Promise<void>;
  hydrateFromCloud: (prefsJson?: string | null) => void;
}

// Buluta eşitlenecek tercih alanları. (motto/avatarBorderColor kendi backend kolonlarıyla
// updateProfile üzerinden gider; soundEffects/dismissedBannerKey/examReviewShown cihaza özeldir.)
const CLOUD_PREF_KEYS = [
  'seasonal',
  'planSpecs',
  'gender',
  'productivityHour',
  'weeklyNotification',
  'morningBrief',
  'eveningBrief',
  'uiMode',
  'featureFlags',
  'onboardingCompleted',
  'helpTourShown',
  'completedTours',
  'firstWinAt',
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
  'tasarrufPlanHabitIds', 'tasarrufPlanTaskIds',
  'birakmaPlanHabitIds', 'birakmaPlanTaskIds',
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
        tasarrufMode: false,
        tasarrufName: '',
        tasarrufDate: null,
        birakmaMode: false,
        birakmaName: '',
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
      tasarrufPlanHabitIds: [],
      tasarrufPlanTaskIds: [],
      birakmaPlanHabitIds: [],
      birakmaPlanTaskIds: [],
      examReviewShown: false,
      setExamReviewShown: (v) => set({ examReviewShown: v }),
      dismissedBannerKey: '',
      setDismissedBannerKey: (key) => set({ dismissedBannerKey: key }),
      motto: '',
      setMotto: (v) => set({ motto: v }),
      gender: '',
      setGender: (v) => set({ gender: v }),
      productivityHour: 'morning',
      setProductivityHour: (v) => set({ productivityHour: v }),
      avatarBorderColor: 'transparent',
      setAvatarBorderColor: (v) => set({ avatarBorderColor: v }),
      // Ürün katmanları — varsayılan 'pro' (mevcut kullanıcıların deneyimi değişmesin;
      // yeni kullanıcı onboarding'de seçer).
      uiMode: 'pro',
      setUiMode: (v) => set({ uiMode: v }),
      featureFlags: {},
      setFeatureFlag: (key, value) => set((s) => ({ featureFlags: { ...s.featureFlags, [key]: value } })),
      onboardingCompleted: false,
      setOnboardingCompleted: (v) => set({ onboardingCompleted: v }),
      helpTourShown: false,
      setHelpTourShown: (v) => set({ helpTourShown: v }),
      completedTours: {},
      setTourCompleted: (page, completed) => set((s) => ({ completedTours: { ...s.completedTours, [page]: completed } })),
      firstWinAt: null,
      markFirstWin: () => { if (!get().firstWinAt) set({ firstWinAt: new Date().toISOString() }); },
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
        if (mode === 'tasarruf') return set({ tasarrufPlanHabitIds: habitIds, tasarrufPlanTaskIds: taskIds });
        if (mode === 'birakma') return set({ birakmaPlanHabitIds: habitIds, birakmaPlanTaskIds: taskIds });
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
          if (mode === 'tasarruf') return { tasarrufPlanHabitIds: [], tasarrufPlanTaskIds: [], planSpecs };
          if (mode === 'birakma') return { birakmaPlanHabitIds: [], birakmaPlanTaskIds: [], planSpecs };
          return { ramazanPlanHabitIds: [], ramazanPlanTaskIds: [], planSpecs };
        });
      },

      resetUserData: () => set({
        seasonal: {
          ramazan: false,
          examMode: false, examName: '', examDate: null,
          exam2Name: '', exam2Date: null, exam3Name: '', exam3Date: null,
          tezMode: false, tezName: '', tezDate: null,
          mulakatMode: false, mulakatName: '', mulakatDate: null,
          mulakat2Name: '', mulakat2Date: null, mulakat3Name: '', mulakat3Date: null,
          sporMode: false, sporGoal: '', sporDate: null,
          spor2Goal: '', spor2Date: null, spor3Goal: '', spor3Date: null,
          tasarrufMode: false, tasarrufName: '', tasarrufDate: null,
          birakmaMode: false, birakmaName: '',
        },
        planSpecs: {},
        examReviewShown: false,
        helpTourShown: false,
        completedTours: {},
        uiMode: 'pro',
        onboardingCompleted: false,
        motto: '',
        gender: '',
        productivityHour: 'morning',
        avatarBorderColor: 'transparent',
        firstWinAt: null,
        examPlanHabitIds: [], examPlanTaskIds: [],
        exam2PlanHabitIds: [], exam2PlanTaskIds: [],
        exam3PlanHabitIds: [], exam3PlanTaskIds: [],
        ramazanPlanHabitIds: [], ramazanPlanTaskIds: [],
        tezPlanHabitIds: [], tezPlanTaskIds: [],
        mulakatPlanHabitIds: [], mulakatPlanTaskIds: [],
        mulakat2PlanHabitIds: [], mulakat2PlanTaskIds: [],
        mulakat3PlanHabitIds: [], mulakat3PlanTaskIds: [],
        sporPlanHabitIds: [], sporPlanTaskIds: [],
        spor2PlanHabitIds: [], spor2PlanTaskIds: [],
        spor3PlanHabitIds: [], spor3PlanTaskIds: [],
        tasarrufPlanHabitIds: [], tasarrufPlanTaskIds: [],
        birakmaPlanHabitIds: [], birakmaPlanTaskIds: [],
      }),

      remapPlanTaskId: (oldId, newId) => set((s) => {
        const fix = (arr: number[]) => (arr.includes(oldId) ? arr.map(id => (id === oldId ? newId : id)) : arr);
        return {
          examPlanTaskIds: fix(s.examPlanTaskIds),
          exam2PlanTaskIds: fix(s.exam2PlanTaskIds),
          exam3PlanTaskIds: fix(s.exam3PlanTaskIds),
          tezPlanTaskIds: fix(s.tezPlanTaskIds),
          mulakatPlanTaskIds: fix(s.mulakatPlanTaskIds),
          mulakat2PlanTaskIds: fix(s.mulakat2PlanTaskIds),
          mulakat3PlanTaskIds: fix(s.mulakat3PlanTaskIds),
          sporPlanTaskIds: fix(s.sporPlanTaskIds),
          spor2PlanTaskIds: fix(s.spor2PlanTaskIds),
          spor3PlanTaskIds: fix(s.spor3PlanTaskIds),
          ramazanPlanTaskIds: fix(s.ramazanPlanTaskIds),
        };
      }),

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

          // ── LOCAL-OTORİTER PLAN KORUMASI ──────────────────────────────────
          // Bu fonksiyon her açılışta (getCurrentUser → setUser) çağrılıyor.
          // Eskiden bulut `seasonal`/plan id'lerini local'in üzerine KOŞULSUZ yazıyordu.
          // Bulut kopyası bayatsa (ör. senkron 429 yiyip güncellenmediyse), kullanıcının
          // YENİ açtığı aktif modları her açılışta SİLİYORDU. Offline-first'te local
          // otoriterdir: local'de aktif plan/mod varsa bulut plan anahtarlarını EZMEZ
          // (bulut yalnızca local boşken — yeni cihaz/ilk kurulum — doldurur).
          const local = get() as any;
          const s = local.seasonal || {};
          const localHasPlans =
            !!(s.examMode || s.tezMode || s.mulakatMode || s.sporMode || s.ramazan || s.tasarrufMode || s.birakmaMode ||
               s.examName || s.tezName || s.mulakatName || s.sporGoal || s.tasarrufName || s.birakmaName) ||
            CLOUD_PREF_KEYS.some(k =>
              (k.endsWith('PlanHabitIds') || k.endsWith('PlanTaskIds')) &&
              Array.isArray(local[k]) && local[k].length > 0);
          const isPlanKey = (k: string) =>
            k === 'seasonal' || k === 'planSpecs' || k.endsWith('PlanHabitIds') || k.endsWith('PlanTaskIds');

          const patch: Record<string, any> = {};
          for (const key of CLOUD_PREF_KEYS) {
            if (parsed[key] === undefined) continue;
            if (localHasPlans && isPlanKey(key)) continue; // local kazanır → bayat bulut aktif planları ezmesin
            patch[key] = parsed[key];
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
          tasarrufMode: false,
          tasarrufName: '',
          tasarrufDate: null,
          birakmaMode: false,
          birakmaName: '',
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
