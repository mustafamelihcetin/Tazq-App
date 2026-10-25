import type { FirstRunPage } from '@/features/onboarding/utils/firstRun';

/*
  ── TUR ADIMLARI — gerçek ekrandaki öğeyi işaret eder ─────────────────────────────
  Kaynaklar (scratchpad'e indirildi, bkz. features/onboarding/components/SpotlightTour):
    · driver.js / react-native-copilot / shepherd — her adım GERÇEK bir öğeyi vurgular
      (`target`). Eski tur, ekranla çelişen sahte önizleme çiziyordu (gece "Günaydın,
      Deniz · 84").
    · Apple HIG Onboarding / TipKit — kısa: başlık + TEK cümle. Eski adımlar 25–40
      kelimeydi.
    · react-joyride `showProgress` — "2 / 4".

  Her `target`, sayfadaki bir `<TourTarget id>` ile eşleşir (bkz. __tests__/tourSteps.test.ts).
  Hedef o an ekranda yoksa (Sade mod, boş liste…) adım kendiliğinden atlanır — tur
  görünmeyen bir şeyi anlatmaz.
*/

export interface TourStepDef {
  target: string;
  /**
   * Hedef BAŞLIK ÇUBUĞUNDA: sayfa önce en üste kaydırılır. Aşağı kaymış sayfada başlık
   * logodan selamlamaya geçiyor; logo adımı "İyi Geceler"i vurguluyordu (cihazda görüldü).
   */
  scrollTop?: boolean;
  title: { tr: string; en: string };
  body: { tr: string; en: string };
}

export const TOUR_STEPS: Record<FirstRunPage, TourStepDef[]> = {
  dashboard: [
    {
      // Yalnız aktif modu olana: kart yoksa hedef ölçülemez, adım atlanır.
      target: 'activePlan',
      title: { tr: 'Aktif planın', en: 'Your active plan' },
      body: { tr: 'Hedeflerinin geri sayımı burada; birden fazlaysa yana kaydırarak geç.', en: 'Your goals count down here; swipe sideways if you have more than one.' },
    },
    {
      target: 'today',
      title: { tr: 'Günün özeti', en: 'Your day' },
      body: { tr: 'Halkalar görev, odak ve alışkanlık hedefine ne kadar yaklaştığını gösterir.', en: 'The rings show how close you are to your task, focus and habit goals.' },
    },
    {
      target: 'habits',
      title: { tr: 'Alışkanlıklar', en: 'Habits' },
      body: { tr: 'Yaptığına dokun; dinlenme günü için basılı tut, serin bozulmaz.', en: 'Tap the ones you did; press and hold for a rest day — your streak stays.' },
    },
    {
      target: 'tasks',
      title: { tr: 'Bugünün görevleri', en: "Today's tasks" },
      body: { tr: 'Halkaya dokununca görev biter; "Odaklan" ile sıradakine hemen başlarsın.', en: 'Tap the ring to finish a task; "Focus" starts the next one right away.' },
    },
    {
      target: 'core',
      scrollTop: true,
      title: { tr: 'TAZQ Core', en: 'TAZQ Core' },
      body: { tr: 'Logoya dokun: ara, tek cümleyle görev ekle ya da kalabalık günü toparla.', en: 'Tap the logo to search, add a task in one sentence or tidy up a busy day.' },
    },
  ],
  tasks: [
    {
      target: 'list',
      title: { tr: 'Görev listen', en: 'Your task list' },
      body: { tr: 'Halkaya dokununca biter, satıra dokununca açılır; silmek için sola kaydır.', en: 'Tap the ring to finish, tap the row to open it; swipe left to delete.' },
    },
    {
      target: 'quickAdd',
      title: { tr: 'Hızlı ekle', en: 'Quick add' },
      body: { tr: '"Yarın 9\'da sunum" yaz yeter; tarih ve saati TAZQ ayarlar.', en: 'Just type "presentation tomorrow at 9" — TAZQ sets the date and time.' },
    },
  ],
  focus: [
    {
      target: 'duration',
      title: { tr: 'Süre', en: 'Length' },
      body: { tr: '15 ile 90 dakika arasında bir süre seç ya da kendin belirle.', en: 'Pick 15 to 90 minutes, or set your own.' },
    },
    {
      target: 'startButton',
      title: { tr: 'Başlat', en: 'Start' },
      body: { tr: 'Seansı başlat; odakladığın her dakika gününe işlenir.', en: 'Start the session — every focused minute counts toward your day.' },
    },
    {
      target: 'modeSelect',
      title: { tr: 'Odak modları', en: 'Focus modes' },
      body: { tr: 'Nefes, Pomodoro ve Katı Mod buradan açılır.', en: 'Turn on Breathing, Pomodoro and Strict Mode here.' },
    },
  ],
  modlar: [
    {
      target: 'presets',
      title: { tr: 'Hedeflerin', en: 'Your goals' },
      body: { tr: 'Aktif hedeflerin burada; birden fazlaysa yana kaydırarak geç.', en: 'Your active goals live here; swipe sideways if you have more than one.' },
    },
    {
      target: 'contents',
      title: { tr: 'Yeni hedef', en: 'New goal' },
      body: { tr: 'Sınav, tez, spor ya da tasarruf seç; TAZQ o döneme özel planı kurar.', en: 'Pick exam, thesis, fitness or savings — TAZQ builds a plan for that season.' },
    },
    {
      target: 'overview',
      title: { tr: 'Özet', en: 'Overview' },
      body: { tr: 'Tüm hedeflerinin gidişatı tek ekranda.', en: 'How every goal is going, on one screen.' },
    },
  ],
  cockpit: [
    {
      target: 'weekStrip',
      title: { tr: 'Haftanın günleri', en: 'Your week' },
      body: { tr: 'Bir güne dokun; o günün işleri aşağıda açılır.', en: 'Tap a day to see its tasks below.' },
    },
    {
      target: 'dailySection',
      title: { tr: 'Günün detayı', en: 'Day detail' },
      body: { tr: 'Seçtiğin günün görevleri; halkaya dokununca görev tamamlanır.', en: 'Tasks for the day you picked; tap a ring to complete one.' },
    },
    {
      target: 'weeklyReview',
      title: { tr: 'Bu hafta', en: 'This week' },
      body: { tr: 'Tamamlanan iş, odak süresi ve alışkanlık oranın; gelecek haftanın planını buradan aç.', en: 'Tasks done, focus time and habit rate; open next week’s plan from here.' },
    },
  ],
};

/** Ana sayfa turu kendiliğinden açılır; diğerleri isteğe bağlı (kullanıcı kararı, 2026-10-25). */
export const AUTO_START_PAGES: readonly FirstRunPage[] = ['dashboard'];
