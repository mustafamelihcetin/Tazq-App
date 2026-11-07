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

    · 2026-11-07, kullanıcı: "user tam anlamalı, gereksiz karmaşa olmasın". Kalıp: ne yapılır + ne olur; ekranda olmayan şey anlatılmaz (eski metin artık olmayan "halkalar"dan söz ediyordu).

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
  /** İlk açılıştaki kısa turda yok; Yardım'dan baştan oynatınca gelir (fikir: Super Productivity'nin kısa turu + "daha fazla"). */
  extra?: boolean;
  title: { tr: string; en: string };
  body: { tr: string; en: string };
}

export const TOUR_STEPS: Record<FirstRunPage, TourStepDef[]> = {
  dashboard: [
    {
      // Yalnız aktif modu olana: kart yoksa hedef ölçülemez, adım atlanır.
      target: 'activePlan',
      extra: true,
      title: { tr: 'Aktif hedefin', en: 'Your active goal' },
      body: { tr: 'Sıradaki işin burada; birden fazla hedefin varsa yana kaydır.', en: 'Your next step is here; swipe sideways if you have more goals.' },
    },
    {
      target: 'today',
      title: { tr: 'Günün özeti', en: 'Your day' },
      body: { tr: 'Her iş bir yaprak, yaptıkça çiçek dolar; Momentum son 7 gününü gösterir.', en: 'Each task is a petal that fills as you go; Momentum shows your last 7 days.' },
    },
    {
      target: 'habits',
      extra: true,
      title: { tr: 'Alışkanlıklar', en: 'Habits' },
      body: { tr: 'Yaptığına dokun; bugün yapmayacaksan basılı tut, serin bozulmaz.', en: 'Tap what you did; press and hold to rest today, your streak stays.' },
    },
    {
      target: 'tasks',
      title: { tr: 'Bugünün görevleri', en: "Today's tasks" },
      body: { tr: 'Halkaya dokun, iş biter; "Odaklan" sıradaki iş için süreyi başlatır.', en: 'Tap the ring to finish; "Focus" starts the timer for the next task.' },
    },
    {
      target: 'core',
      scrollTop: true,
      title: { tr: 'TAZQ Core', en: 'TAZQ Core' },
      body: { tr: 'Logoya dokun: bir şey ara ya da tek cümleyle görev ekle.', en: 'Tap the logo to search or add a task in one sentence.' },
    },
  ],
  tasks: [
    {
      target: 'list',
      title: { tr: 'Görev listen', en: 'Your task list' },
      body: { tr: 'Halkaya dokun, biter; satıra dokun, açılır; sola kaydır, silinir.', en: 'Tap the ring to finish, the row to open, swipe left to delete.' },
    },
    {
      target: 'quickAdd',
      title: { tr: 'Hızlı ekle', en: 'Quick add' },
      body: { tr: '"Yarın 9\'da sunum" yaz; tarihi ve saati TAZQ ayarlar.', en: 'Type "presentation tomorrow at 9"; TAZQ sets the date and time.' },
    },
  ],
  focus: [
    {
      target: 'duration',
      title: { tr: 'Süre', en: 'Length' },
      body: { tr: 'Süreyi seçmek için halkayı parmağınla çevir.', en: 'Turn the ring with your finger to pick a length.' },
    },
    {
      target: 'startButton',
      title: { tr: 'Seansı başlat', en: 'Start a session' },
      body: { tr: 'Başlat; odaklandığın süre gününe eklenir.', en: 'Start; the time you focus is added to your day.' },
    },
    {
      target: 'modeSelect',
      title: { tr: 'Odak modları', en: 'Focus modes' },
      body: { tr: 'Pomodoro, Katı Mod ve odak sahnesini buradan seç.', en: 'Choose Pomodoro, Strict Mode and the focus scene here.' },
    },
  ],
  modlar: [
    {
      target: 'presets',
      title: { tr: 'Hedeflerin', en: 'Your goals' },
      body: { tr: 'Hedeflerin burada; birden fazla kart varsa yana kaydırarak geç.', en: 'Your goals live here; swipe sideways if there is more than one card.' },
    },
    {
      target: 'contents',
      title: { tr: 'Yeni hedef', en: 'New goal' },
      body: { tr: 'Bir hedef seç, tarihini gir; TAZQ her güne yapılacak işleri koyar.', en: 'Pick a goal and its date; TAZQ puts each day’s work in front of you.' },
    },
    {
      target: 'overview',
      title: { tr: 'Gidişat', en: 'Progress' },
      body: { tr: 'Bu düğme bütün hedeflerinin gidişatını tek ekranda açar.', en: 'This button shows how all your goals are going on one screen.' },
    },
  ],
  cockpit: [
    {
      target: 'weekStrip',
      title: { tr: 'Haftanın günleri', en: 'Your week' },
      body: { tr: 'Her sütun bir gün ve doluluğu o günün ilerlemesi; dokununca işleri açılır.', en: 'Each column is a day, filled by its progress; tap one to see its work.' },
    },
    {
      target: 'dailySection',
      title: { tr: 'Günün işleri', en: 'The day’s work' },
      body: { tr: 'Seçtiğin günün işleri burada; dokununca işaretlenir.', en: 'The selected day’s work is here; tap to tick it off.' },
    },
    {
      target: 'weeklyReview',
      title: { tr: 'Haftanın özeti', en: 'Week summary' },
      body: { tr: 'Odak, alışkanlık ve geçen haftayla farkı görmek için bunu aç.', en: 'Open this to see focus, habits and the change from last week.' },
    },
  ],
};

/** Kendiliğinden açılan tur kısadır; kullanıcı isteyince hepsi. */
export const tourStepsFor = (page: FirstRunPage, brief: boolean): TourStepDef[] => {
  const all = TOUR_STEPS[page] ?? [];
  return brief ? all.filter(s => !s.extra) : all;
};

/** Ana sayfa turu kendiliğinden açılır; diğerleri isteğe bağlı (kullanıcı kararı, 2026-10-25). */
export const AUTO_START_PAGES: readonly FirstRunPage[] = ['dashboard'];
