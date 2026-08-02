import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthService } from '@/shared/services/api';
import { swallow } from '@/shared/utils/swallow';

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
  /** Kurulum taslağı: yalnız günlük süreyi yazar, `startDate` damgalamaz. */
  setPlanDraftMinutes: (mode: PlanMode, minutes: number | null) => void;
  clearPlanSpec: (mode: PlanMode) => void;
  weeklyNotification: boolean;
  setWeeklyNotification: (value: boolean) => void;
  morningBrief: boolean;
  setMorningBrief: (value: boolean) => void;
  eveningBrief: boolean;
  setEveningBrief: (value: boolean) => void;
  soundEffects: boolean;
  setSoundEffects: (value: boolean) => void;
  /**
   * TİTREŞİM GERİ BİLDİRİMİ — kullanıcı kapatabilir.
   *
   * Ses kapatılabiliyordu ama titreşim kapatılamıyordu; oysa uygulamada ~293
   * titreşim çağrısı var (her 1.4 dokunmada bir). Titreşimden rahatsız olan veya
   * pil tasarrufu isteyen kullanıcının hiçbir çıkışı yoktu. Cihaza özel — buluta
   * eşitlenmez (telefon tercihi, hesap tercihi değil).
   */
  hapticFeedback: boolean;
  setHapticFeedback: (value: boolean) => void;
  /**
   * Bildirimde görev/alışkanlık ADI gizlensin mi.
   *
   * Bildirim kilit ekranında çıkıyor ve gövdesinde kullanıcının yazdığı ham başlık
   * duruyor — yani yanındaki herkes okuyabiliyor. Kullanıcı o metni kendisi için
   * yazmıştı. "Doktor: test sonucu", "Ayrılık konuşması", "Kredi başvurusu"…
   *
   * Bunu bir içerik SÜZGECİYLE çözmek yanlış olurdu: metin kullanıcının kendi
   * cihazında kendisine gösteriliyor, kimseyi rahatsız etmiyor. Doğru olan kararı
   * kullanıcıya vermek. Varsayılan KAPALI — çoğu kişi hatırlatmanın ne olduğunu
   * görmek ister; gizlemek bir tercih, dayatma değil.
   *
   * Cihaz tercihi: buluta eşitlenmez (aynı hesap farklı telefonda farklı mahremiyet).
   */
  hideNotificationContent: boolean;
  setHideNotificationContent: (value: boolean) => void;
  // Derin odak tercihleri — cihazda kalıcı (her seansda sıfırlanmasın diye). Cihaza özel.
  focusBreathMode: 'classic' | 'box' | 'calm' | 'off';
  setFocusBreathMode: (v: 'classic' | 'box' | 'calm' | 'off') => void;
  focusAmbientSound: string;
  setFocusAmbientSound: (v: string) => void;
  focusPreset: string;
  setFocusPreset: (v: string) => void;
  // Uyku sağlık entegrasyonu (Faz 1) — cihaza özel. optIn: kullanıcı Apple Sağlık bağladı mı?
  sleepHealthOptIn: 'unset' | 'yes' | 'no';
  setSleepHealthOptIn: (v: 'unset' | 'yes' | 'no') => void;
  sleepLastCheckDate: string; // 'YYYY-MM-DD' — günde bir kez sor
  setSleepLastCheckDate: (v: string) => void;
  sleepGoalHours: number;     // hedef uyku (saat) — kutlama mesajı için
  setSleepGoalHours: (v: number) => void;
  /**
   * Hareket sağlık entegrasyonu — UYKUDAN AYRI tutuluyor.
   *
   * Tek bir "sağlık" anahtarı olsaydı, uykusunu paylaşmaya razı olan kullanıcı
   * koşularını da paylaşmak zorunda kalırdı. İki veri farklı hassasiyette ve platformlar
   * da izinleri ayrı ayrı veriyor; tercih de aynı ayrımı korumalı.
   */
  activityHealthOptIn: 'unset' | 'yes' | 'no';
  setActivityHealthOptIn: (v: 'unset' | 'yes' | 'no') => void;
  /** 'YYYY-MM-DD' — hareket verisi günde bir kez sorulur (uykudakiyle aynı desen). */
  activityLastCheckDate: string;
  setActivityLastCheckDate: (v: string) => void;
  /**
   * GÖREVLER EKRANI GÖRÜNÜM TERCİHLERİ — kalıcı olmaları gerekiyor.
   *
   * Bunlar `useState` ile tutuluyordu, yani uygulama her kapandığında sıfırlanıyordu.
   * "Tamamlananları gizle" gibi bir tercihi her açılışta yeniden kurmak zorunda kalmak,
   * ayarı hiç sunmamaktan daha sinir bozucu: kullanıcı bir karar veriyor, uygulama onu
   * unutuyor.
   *
   * `tagFilter` bilinçli olarak DIŞARIDA: o bir arama hamlesi, kalıcı bir tercih değil.
   * Etiket filtresiyle kapatılan uygulamanın ertesi gün aynı daraltmayla açılması,
   * kullanıcıya "görevlerim kayboldu" dedirtirdi.
   */
  taskFilter: 'all' | 'today' | 'High' | 'Medium' | 'Low' | 'done';
  setTaskFilter: (v: 'all' | 'today' | 'High' | 'Medium' | 'Low' | 'done') => void;
  taskSortBy: 'priority' | 'date' | 'creation';
  setTaskSortBy: (v: 'priority' | 'date' | 'creation') => void;
  taskHideCompleted: boolean;
  setTaskHideCompleted: (v: boolean) => void;
  taskShowFutureManual: boolean;
  setTaskShowFutureManual: (v: boolean) => void;
  /**
   * UYKUDAN TÜREYEN TOPARLANMA — plan motorunun okuduğu tek sağlık sinyali.
   *
   * Neden burada saklanıyor: plan üretimi SENKRON çalışıyor (bkz. dailyPlanEngine),
   * sağlık verisi okumak ise asenkron ve izne bağlı. Motorun her görev üretiminde
   * platformdan veri beklemesi hem yavaşlatır hem izin yokken belirsiz bırakırdı.
   *
   * Bunun yerine uyku senkronu — zaten günlük dökümü okuyor — sonucu buraya yazıyor;
   * motor da hazır değeri okuyor. Veri hiç yoksa 'unknown' kalır ve motor bugünkü gibi
   * davranır: sağlık entegrasyonu kapalı olan kullanıcı için HİÇBİR ŞEY değişmez.
   */
  recoveryState: 'unknown' | 'low' | 'normal';
  setRecoveryState: (v: 'unknown' | 'low' | 'normal') => void;
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
  /** true = buluta yazıldı · false = yazılamadı (çağıran "bekliyor" işaretini korumalı). */
  syncToCloud: () => Promise<boolean>;
  hydrateFromCloud: (prefsJson?: string | null) => void;
  _hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;
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
      _hasHydrated: false,
      setHasHydrated: (v) => set({ _hasHydrated: v }),
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
      /**
       * KURULUM TASLAĞI — günlük süre seçimi, plan oluşturulmadan ÖNCE saklanır.
       *
       * Sınav kurulumu üç adım: ad + tarih + günlük süre. Ad ve tarih tercihlere
       * yazılıyordu, süre ise yalnız bileşen belleğindeydi. Kart yeniden kurulduğu anda
       * (ekran döndüğünde, moda geri dönüldüğünde) süre sıfırlanıyor, kurulum
       * "tamamlanmamış" sayılıyor ve kart kullanıcıya "Sınav ekle" diyordu — halbuki
       * sınav ve tarih kayıtlıydı ve üstteki özet onları gösteriyordu. Kullanıcı için
       * bu, yaptığı işin kaybolması demekti.
       *
       * NEDEN `setPlanSpec` DEĞİL: o, ilk yazışta `startDate` damgalıyor. Kurulum
       * sırasında çağrılsaydı planın "kaçıncı hafta" hesabı, plan henüz kurulmadan
       * başlamış sayılırdı — kullanıcı taslağı bırakıp bir hafta sonra dönerse plan
       * bir hafta ilerlemiş görünürdü. Bu yazıcı yalnız süreyi yazar; `startDate`
       * damgası plan gerçekten oluşturulduğunda vurulmaya devam eder.
       */
      setPlanDraftMinutes: (mode, minutes) =>
        set((s) => ({
          planSpecs: { ...s.planSpecs, [mode]: { ...s.planSpecs[mode], dailyMinutes: minutes } },
        })),

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
      hapticFeedback: true,
      setHapticFeedback: (value) => set({ hapticFeedback: value }),
      hideNotificationContent: false,
      setHideNotificationContent: (value) => set({ hideNotificationContent: value }),
      // Derin odak: nefes varsayılanı 'off' (opt-in — odak ≠ nefes çalışması). Kullanıcı seçince kalıcı.
      focusBreathMode: 'off',
      setFocusBreathMode: (v) => set({ focusBreathMode: v }),
      focusAmbientSound: 'off',
      setFocusAmbientSound: (v) => set({ focusAmbientSound: v }),
      focusPreset: 'classic',
      setFocusPreset: (v) => set({ focusPreset: v }),
      sleepHealthOptIn: 'unset',
      setSleepHealthOptIn: (v) => set({ sleepHealthOptIn: v }),
      sleepLastCheckDate: '',
      setSleepLastCheckDate: (v) => set({ sleepLastCheckDate: v }),
      sleepGoalHours: 7,
      setSleepGoalHours: (v) => set({ sleepGoalHours: v }),
      activityHealthOptIn: 'unset',
      setActivityHealthOptIn: (v) => set({ activityHealthOptIn: v }),
      activityLastCheckDate: '',
      setActivityLastCheckDate: (v) => set({ activityLastCheckDate: v }),
      taskFilter: 'all',
      setTaskFilter: (v) => set({ taskFilter: v }),
      taskSortBy: 'creation',
      setTaskSortBy: (v) => set({ taskSortBy: v }),
      taskHideCompleted: false,
      setTaskHideCompleted: (v) => set({ taskHideCompleted: v }),
      taskShowFutureManual: true,
      setTaskShowFutureManual: (v) => set({ taskShowFutureManual: v }),
      recoveryState: 'unknown',
      setRecoveryState: (v) => set({ recoveryState: v }),
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
          const ach = require('@/features/user/store/useAchievementStore').useAchievementStore.getState();
          snapshot.__achievements = { unlocked: ach.unlocked, baselined: ach.baselined };
        } catch (e) { swallow('prefsStore.collectAchievementsForSnapshot', e, { capture: true }); }
        /*
          KİLO GEÇMİŞİ BİLEREK BURAYA EKLENMEDİ.

          Teknik olarak sığardı (bu JSON serbest biçimli), ama gizlilik metninin 2.5.
          maddesi sağlık verisinin "sunucularımıza gönderilmez" taahhüdünü veriyor ve kilo
          KVKK'da özel nitelikli sağlık verisi. Buluta taşımak önce metnin ve App Store veri
          etiketinin değişmesini gerektirir — kod kararı değil, ürün kararı.

          Bunun bedeli bilinen ve kabul edilmiş: çıkışta kilo geçmişi cihazdan silinir ve
          geri gelmez (bkz. useSporStore.clearAll). Plan kaldırmak ise geçmişi SİLMEZ.
        */
        /*
          SONUÇ DÖNDÜRÜLÜYOR — "denendi" ile "başarıldı" ayrı şeyler.

          Bu fonksiyon hatayı içeride yutuyor ve hiçbir şey döndürmüyordu; çağıran taraf
          (usePrefsSync) ise "bekleyen değişiklik" bayrağını istek GÖNDERİLMEDEN ÖNCE
          temizliyordu. Sunucu 500/429 dönerse ya da istek düşerse değişiklik "gönderildi"
          sayılıyor ve buluttaki kopya bir sonraki tercih değişikliğine kadar bayat kalıyordu.

          Bunun faturası yeni cihazda kesiliyor: kullanıcı telefon değiştirdiğinde yerelde
          hiçbir şey olmadığı için bulut kazanıyor ve eski tercihleri geri geliyor.
        */
        try {
          await AuthService.updateProfile({ preferences: JSON.stringify(snapshot) });
          return true;
        } catch (err) {
          // Çevrimdışı/başarısız: tercihler lokalde zaten kalıcı; çağıran taraf bayrağı
          // AÇIK bırakıp bir sonraki fırsatta (online/login geçişi) yeniden dener.
          swallow('prefsStore.syncToCloud', err);
          return false;
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
              require('@/features/user/store/useAchievementStore').useAchievementStore.getState().applyCloud(parsed.__achievements);
            } catch (e) { swallow('prefsStore.applyCloudAchievements', e, { capture: true }); }
          }
          // Kilo geçmişi buluta hiç gönderilmediği için burada geri yüklenecek bir şey de
          // yok (gerekçe: syncToCloud içindeki not).
        } catch (err) {
          swallow('prefsStore.hydrateFromCloud', err, { capture: true });
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
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
