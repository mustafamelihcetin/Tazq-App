/**
 * Sınır metinleri (madde 6) — kullanıcı kararı: "kullanıcıya açıklayalım, ikna edici olsun".
 * Yasak dili yok; neden 7 olduğu ve hiçbir şeyin kaybolmadığı söylenir.
 */
export const HABIT_LIMIT_COPY = {
  tr: {
    fullTitle: 'Odak yedi alışkanlıkta kalır',
    fullBody: 'Zihin aynı anda yaklaşık yedi şeyi rahatça izler; az sayıda alışkanlığa odaklananlar daha tutarlı kalır. Yenisini eklemek için birini dinlendir — serisi ve geçmişi korunur, istediğinde tek dokunuşla geri gelir.',
    restOne: 'Birini dinlendir', ok: 'Tamam', cancel: 'Vazgeç',
    // Kullanıcı: "neden 7 olduğunu bilimsel söylemeliyiz, tatmin etsin". Yalnız gerçek,
    // yayımlanmış bulgular; abartısız ifadeyle.
    whyBtn: 'Neden 7?', whyTitle: 'Neden yedi?',
    whyBody: '• Çalışan bellek aynı anda yaklaşık 7±2 şeyi tutabilir (Miller, 1956).\n'
      + '• Yeni bir alışkanlığın otomatikleşmesi ortalama 66 gün sürer; her biri bu kadar tekrar ister (Lally ve ark., 2010, UCL).\n'
      + '• Plan yapmanın faydası tek hedefte güçlüdür, hedef sayısı arttıkça azalır (Dalton ve Spiller, 2012).\n\n'
      + 'Yedi, hepsine gerçekten yer açabildiğin üst sınır. Az ama yerleşen alışkanlık, çok ama yarım kalandan iyidir.',
    pickTitle: 'Hangisi dinlensin?', pickBody: 'Son iki haftada en az yaptıkların önde.',
    rest: 'Dinlendir', resume: 'Geri getir', restedSection: (n: number) => `Dinlenenler (${n})`,
    restedToast: (name: string) => `"${name}" dinlenmeye alındı — serisi korunuyor`,
    resumedToast: (name: string) => `"${name}" geri geldi`,
    overTitle: 'Biraz sadeleştirelim mi?',
    overBody: (n: number, extra: number) => `${n} aktif alışkanlığın var. ${extra} tanesini dinlendirirsen kalanlara daha kolay odaklanırsın — hiçbiri silinmez, geçmişleri korunur.`,
    overApply: 'Önerilenleri dinlendir', overLater: 'Şimdilik kalsın',
  },
  en: {
    fullTitle: 'Focus stays at seven habits',
    fullBody: 'The mind tracks about seven things comfortably, and people who focus on a few habits stay more consistent. To add a new one, rest one — its streak and history stay, and it comes back with a single tap.',
    restOne: 'Rest one', ok: 'OK', cancel: 'Cancel',
    whyBtn: 'Why 7?', whyTitle: 'Why seven?',
    whyBody: '• Working memory holds about 7±2 items at once (Miller, 1956).\n'
      + '• A new habit takes 66 days on average to become automatic — each one needs that much repetition (Lally et al., 2010, UCL).\n'
      + '• The benefit of planning is strong for one goal and shrinks as goals multiply (Dalton & Spiller, 2012).\n\n'
      + 'Seven is the upper bound where each habit still gets real room. A few habits that stick beat many that fade.',
    pickTitle: 'Which one should rest?', pickBody: 'The ones you did least in the last two weeks come first.',
    rest: 'Rest', resume: 'Bring back', restedSection: (n: number) => `Resting (${n})`,
    restedToast: (name: string) => `"${name}" is resting — its streak is kept`,
    resumedToast: (name: string) => `"${name}" is back`,
    overTitle: 'Shall we simplify a little?',
    overBody: (n: number, extra: number) => `You have ${n} active habits. Resting ${extra} of them makes the rest easier to focus on — nothing is deleted, history is kept.`,
    overApply: 'Rest the suggested ones', overLater: 'Not now',
  },
};
