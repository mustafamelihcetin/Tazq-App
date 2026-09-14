/*
  TANITIM MOCK'UNUN METİNLERİ — tek sözlükte, kendi dosyasında.

  ── NEDEN SÖZLÜK ─────────────────────────────────────────────────────────────
  Uygulamanın kuralı bu (bkz. __tests__/i18nRatchet.test.ts): iki dilli metin satır
  içinde dallanmaz. Tanıtım ekranı istisna değil; aksine METNİN tamamı iki dilde tek
  tek gözden geçirilecek tek yer olduğu için sözlük burada daha da gerekli: TR ve EN
  karşılıkları yan yana duruyor, biri güncellenip öteki unutulamıyor.

  Sekme adları BottomNavBar'daki TAB_SHORT ile birebir aynı — mağaza görselindeki
  etiketle uygulamadaki etiket ayrışamaz.

  ── NEDEN AYRI DOSYA ──────────────────────────────────────────────────────────
  Bu bir KOD dosyası değil, VERİ. Mock motorundan ayrıldı çünkü ikisi ayrı
  sebeplerle değişiyor: biri uygulamanın arayüzü değişince, öteki söylenecek söz
  değişince.
*/
export type MockCopy = {
  tabs: string[];
  dayInitial: string[];
  dayShort: string[];
  focusEyebrow: string; remaining: string; zen: string; zenHint: string;
  modesTitle: string; planEyebrow: string; planTasks: string; daysLeft: string;
  examName: string; examEyebrow: string;
  fitName: string; fitEyebrow: string;
  saveName: string; saveEyebrow: string;
  thesisName: string; thesisEyebrow: string;
  quitName: string; quitEyebrow: string;
  interviewName: string; interviewEyebrow: string;
  momentumLabel: string; momentumDelta: string;
  nextLabel: string; nextTask: string; nextAction: string;
  tasksTitle: string; filters: string[];
  taskRows: { title: string; time?: string; mode?: string; done?: boolean }[];
  nlpHint: string;
  insights: string; insightsSub: string; focusScore: string; focusEval: string;
  coachLabel: string; coachTip: string; momentum: string; goalLabel: string; weeklyFocus: string;
  weeklyTitle: string; weeklyRange: string; statFocus: string; statTasks: string;
  statHabits: string; peakWeek: string; habitsLabel: string; habits: string[];
  greeting: string; name: string; todayLabel: string; tasksDone: string;
  myDay: string; homeRows: string[];
};

export const PROMO_COPY: Record<'tr' | 'en', MockCopy> = {
  tr: {
    tabs: ['Ana Sayfa', 'Görevler', 'Odak', 'Haftalık', 'Modlar'],
    dayInitial: ['P', 'S', 'Ç', 'P', 'C', 'C', 'P'],
    dayShort: ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'],
    focusEyebrow: 'Derin Odak', remaining: 'KALAN', zen: 'Zen Modu',
    zenHint: 'Sakinleşmek için çembere dokun',
    modesTitle: 'Yaşam Modları', planEyebrow: 'BUGÜNKÜ PLANIN', planTasks: 'plan görevi', daysLeft: 'gün',
    examName: 'YKS 2027', examEyebrow: 'SINAV',
    fitName: 'Kilo Hedefi', fitEyebrow: 'SPOR',
    saveName: 'Acil Fon', saveEyebrow: 'TASARRUF',
    thesisName: 'Tez Takibi', thesisEyebrow: 'AKADEMİ',
    quitName: 'Sigarayı Bırak', quitEyebrow: 'BIRAKMA',
    interviewName: 'Mülakat Hazırlığı', interviewEyebrow: 'KARİYER',
    momentumLabel: 'İvme', momentumDelta: 'bu hafta +12%',
    nextLabel: 'SIRADAKİ', nextTask: 'Paragraf denemesi çöz', nextAction: 'Odaklan',
    tasksTitle: 'Aksiyon Merkezi',
    filters: ['Tümü', 'Bugün', 'Yüksek'],
    taskRows: [
      { title: 'Toplantı notlarını yaz', time: 'Bugün 09:30', done: true },
      { title: 'Paragraf denemesi çöz', time: '2 saat kaldı', mode: 'YKS 2027' },
      { title: 'Proje sunumunu hazırla', time: 'Bugün 15:00' },
      { title: 'Spor: 30 dk koşu', mode: 'Kilo Hedefi' },
      { title: 'Akşam okuma alışkanlığı' },
      { title: 'Sunum provası yap', time: 'Yarın 11:00' },
      { title: 'Tez kaynaklarını tara', mode: 'Tez Takibi' },
      { title: 'Faturaları öde', time: 'Yarın' },
      { title: 'Haftalık planı gözden geçir', time: 'Cuma' },
      { title: 'Su iç — 2 litre', done: true },
    ],
    nlpHint: '“yarın 15:00 toplantı” yaz — tarihi, saati ve önceliği TAZQ anlar',
    insights: 'TAZQ INSIGHTS',
    insightsSub: 'Haftalık odaklanma ve alışkanlık gelişimi analitiği',
    focusScore: 'HAFTALIK ODAK SKORU',
    focusEval: 'Harika gidiyorsun — hafta boyunca düzenli odaklandın.',
    coachLabel: 'AKILLI ODAK ÖNERİSİ',
    coachTip: 'Sabahları tek bir 25 dakikalık blok, akşam üç kısa denemeden daha çok iş bitiriyor.',
    momentum: 'Momentum', goalLabel: 'Hedef', weeklyFocus: 'HAFTALIK ODAK',
    weeklyTitle: 'Haftalık Merkez', weeklyRange: '12 – 18 EYL',
    statFocus: 'Odak', statTasks: 'Görev', statHabits: 'Alışkanlık',
    peakWeek: 'Zirve haftası', habitsLabel: 'ALIŞKANLIKLAR',
    habits: ['Su iç', 'Meditasyon', 'Kitap oku', 'Erken kalk', 'Günlük yaz', 'Esneme'],
    greeting: 'İyi akşamlar,', name: 'Deniz', todayLabel: 'BUGÜN',
    tasksDone: 'görev tamamlandı', myDay: 'GÜNÜM',
    homeRows: ['Soru çöz: 40 dakika', 'Hata defterini gözden geçir', 'Akşam yürüyüşü', 'Kelime tekrarı: 30 dk', 'Deneme analizi', 'Su iç — 2 litre'],
  },
  en: {
    tabs: ['Home', 'Tasks', 'Focus', 'Weekly', 'Modes'],
    dayInitial: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
    dayShort: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    focusEyebrow: 'Deep Focus', remaining: 'REMAINING', zen: 'Zen Mode',
    zenHint: 'Tap the ring to calm',
    modesTitle: 'Life Modes', planEyebrow: 'YOUR PLAN TODAY', planTasks: 'plan tasks', daysLeft: 'days',
    examName: 'Final Exams', examEyebrow: 'EXAM',
    fitName: 'Weight Goal', fitEyebrow: 'FITNESS',
    saveName: 'Emergency Fund', saveEyebrow: 'SAVINGS',
    thesisName: 'Thesis Tracker', thesisEyebrow: 'ACADEMIC',
    quitName: 'Quit Smoking', quitEyebrow: 'QUITTING',
    interviewName: 'Interview Prep', interviewEyebrow: 'CAREER',
    momentumLabel: 'Momentum', momentumDelta: '+12% this week',
    nextLabel: 'UP NEXT', nextTask: 'Reading practice set', nextAction: 'Focus',
    tasksTitle: 'Action Center',
    filters: ['All', 'Today', 'High'],
    taskRows: [
      { title: 'Write up meeting notes', time: 'Today 09:30', done: true },
      { title: 'Reading practice set', time: '2 hours left', mode: 'Final Exams' },
      { title: 'Prepare project deck', time: 'Today 15:00' },
      { title: 'Workout: 30 min run', mode: 'Weight Goal' },
      { title: 'Evening reading habit' },
      { title: 'Rehearse the presentation', time: 'Tomorrow 11:00' },
      { title: 'Scan thesis sources', mode: 'Thesis Tracker' },
      { title: 'Pay the bills', time: 'Tomorrow' },
      { title: 'Review the weekly plan', time: 'Friday' },
      { title: 'Drink water — 2 litres', done: true },
    ],
    nlpHint: '“meeting tomorrow 3pm” — TAZQ reads the date, time and priority',
    insights: 'TAZQ INSIGHTS',
    insightsSub: 'Weekly focus and habit growth analytics',
    focusScore: 'WEEKLY FOCUS SCORE',
    focusEval: 'You are on a roll — steady focus all week long.',
    coachLabel: 'SMART FOCUS ADVICE',
    coachTip: 'One 25-minute block in the morning finishes more than three short evening attempts.',
    momentum: 'Momentum', goalLabel: 'Goal', weeklyFocus: 'WEEKLY FOCUS',
    weeklyTitle: 'Weekly Hub', weeklyRange: 'SEP 12 – 18',
    statFocus: 'Focus', statTasks: 'Tasks', statHabits: 'Habits',
    peakWeek: 'Peak week', habitsLabel: 'HABITS',
    habits: ['Hydrate', 'Meditate', 'Read', 'Wake early', 'Journal', 'Stretch'],
    greeting: 'Good evening,', name: 'Alex', todayLabel: 'TODAY',
    tasksDone: 'tasks completed', myDay: 'MY DAY',
    homeRows: ['Practice set: 40 minutes', 'Review the error log', 'Evening walk', 'Vocabulary drill: 30 min', 'Mock exam analysis', 'Drink water — 2 litres'],
  },
};
