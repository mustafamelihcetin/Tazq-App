type Language = 'tr' | 'en';

interface Task {
  title: string;
  priority: string;
  isCompleted: boolean;
  dueDate?: string | null;
}

const SENSITIVE_KW = ['cenaze', 'vefat', 'taziye', 'hastane', 'ameliyat', 'başsağlığı', 'mevlit', 'ilaç', 'tedavi', 'klinik'];
const JOYFUL_KW = ['doğum günü', 'kutlama', 'parti', 'düğün', 'tatil', 'bayram', 'tebrik', 'yıl dönümü', 'nişan', 'eğlence'];
const STRESSFUL_KW = ['sınav', 'mülakat', 'sunum', 'teslim', 'deadline', 'acil', 'vize', 'final', 'proje', 'toplantı'];
const TOMORROW_KW = ['yarın', 'tomorrow', 'öbür gün', 'next day'];
const FUNERAL_KW = ['cenaze', 'vefat', 'taziye', 'başsağlığı', 'mevlit'];

const ACADEMIC_KW = ['ders', 'matematik', 'türkçe', 'fizik', 'kimya', 'biyoloji', 'tarih', 'coğrafya', 'edebiyat', 'geometri', 'çöz', 'deneme', 'soru', 'konu', 'tekrar', 'okuma', 'tez', 'makale', 'ödev', 'kütüphane', 'çalışma', 'vize', 'final', 'sınav'];
const HEALTH_KW = ['koşu', 'yürüyüş', 'spor', 'kardiyo', 'antreman', 'antrenman', 'fitness', 'gym', 'pilates', 'yoga', 'diyet', 'kilo', 'kalori', 'egzersiz', 'su', 'yürüyüş', 'meditasyon'];
const FINANCE_KW = ['para', 'bütçe', 'tasarruf', 'fatura', 'borç', 'hesap', 'kart', 'ödeme', 'birikim', 'kira', 'taksit'];
const CAREER_KW = ['kod', 'yazılım', 'mülakat', 'toplantı', 'proje', 'sunum', 'email', 'e-posta', 'rapor', 'iş', 'ofis', 'github', 'tasarım', 'cv', 'başvuru', 'linkedin'];
const LEISURE_KW = ['film', 'dizi', 'oyun', 'kitap', 'kahve', 'dinlenme', 'mola', 'uyku', 'tatil', 'gezi', 'arkadaş', 'müzik', 'hobi'];

type Sentiment = 'sensitive' | 'joyful' | 'stressful' | 'normal';
type Category = 'academic' | 'health' | 'finance' | 'career' | 'leisure' | 'generic';

function getSentiment(title: string): Sentiment {
  const t = title.toLowerCase();
  if (SENSITIVE_KW.some(kw => t.includes(kw))) return 'sensitive';
  if (JOYFUL_KW.some(kw => t.includes(kw))) return 'joyful';
  if (STRESSFUL_KW.some(kw => t.includes(kw))) return 'stressful';
  return 'normal';
}

function getCategory(title: string): Category {
  const t = title.toLowerCase();
  if (ACADEMIC_KW.some(kw => t.includes(kw))) return 'academic';
  if (HEALTH_KW.some(kw => t.includes(kw))) return 'health';
  if (FINANCE_KW.some(kw => t.includes(kw))) return 'finance';
  if (CAREER_KW.some(kw => t.includes(kw))) return 'career';
  if (LEISURE_KW.some(kw => t.includes(kw))) return 'leisure';
  return 'generic';
}

function isTomorrowTask(title: string): boolean {
  const t = title.toLowerCase();
  return TOMORROW_KW.some(kw => t.includes(kw));
}

function tr(trStr: string, enStr: string, lang: Language): string {
  return lang === 'tr' ? trStr : enStr;
}

export function getSmartInsight(
  lang: Language,
  isActive: boolean,
  momentum: number,
  highPriorityToday: Task | undefined,
  topTaskToday: Task | undefined,
  futureTasksIncomplete: Task[],
  seasonal?: any,
  todayCompleted?: number,
  dailyGoal?: number,
  todayRating?: number | null,
): string {
  if (isActive) {
    return tr(
      'Odak modu aktif. Akışını bozma, harika gidiyorsun. 🔥',
      'Focus mode active. Stay in the zone, you\'re doing great. 🔥',
      lang,
    );
  }

  // 1) Today's Performance Rating Reaction
  if (todayRating) {
    if (todayRating === 5) {
      return tr(
        'Harika bir gün! 😎 Bugünün yüksek performansını ve pozitif enerjisini yarınki hedeflerine de taşımaya hazır mısın?',
        'What an excellent day! 😎 Ready to carry today\'s high performance and positive energy into tomorrow\'s goals?',
        lang,
      );
    }
    if (todayRating === 4) {
      return tr(
        'Çok iyi bir gün geçiriyorsun. 🙂 Hedeflerine emin adımlarla yaklaşıyorsun, bu çizgiyi koru!',
        'You\'re having a very good day. 🙂 You\'re moving closer to your goals, keep it up!',
        lang,
      );
    }
    if (todayRating === 3) {
      return tr(
        'Orta karar, dengeli bir gün. 😐 Tutarlı kalmak da önemli bir başarıdır. Yarın ivmeyi bir tık artırabiliriz.',
        'A steady, balanced day. 😐 Staying consistent is a great achievement in itself. We can push the pace slightly tomorrow.',
        lang,
      );
    }
    if (todayRating === 2) {
      return tr(
        'Bugün biraz yavaş geçmiş gibi görünüyor. 😕 Kendini fazla zorlama. Yarın taze bir başlangıç yapmak için bugün dinlenmeye odaklan.',
        'Looks like today was a bit slow. 😕 Don\'t push yourself too hard. Focus on resting today to make a fresh start tomorrow.',
        lang,
      );
    }
    if (todayRating === 1) {
      return tr(
        'Bugün zor bir gün olmuş. 😫 Unutma, her gün mükemmel olamaz. Kendine karşı nazik ol ve bugün sadece pillerini şarj et. 🛌',
        'Today was a tough day. 😫 Remember, not every day can be perfect. Be kind to yourself and just recharge your batteries today. 🛌',
        lang,
      );
    }
  }

  const hasProgress = typeof todayCompleted === 'number' && typeof dailyGoal === 'number' && dailyGoal > 0;

  // 1) Progress Nudges: Celebrations and Encouragements
  if (hasProgress && todayCompleted >= dailyGoal) {
    return tr(
      `Tebrikler! Bugünün hedefine ulaştın (${todayCompleted}/${dailyGoal}) 🎉 İvmeni korumak için istersen hafif bir odaklanma daha yapabilirsin.`,
      `Congratulations! You reached today's goal (${todayCompleted}/${dailyGoal}) 🎉 Feel free to do a light focus session to keep the momentum going.`,
      lang,
    );
  }

  // 2) Mode-Specific Insights
  const activeTask = highPriorityToday || topTaskToday;
  if (activeTask && seasonal) {
    const title = activeTask.title;
    
    // RAMAZAN
    if (seasonal.ramazan) {
      return tr(
        `Hayırlı Ramazanlar! İftarla sahur arasındaki zamanı verimli değerlendirmek için "${title}" konusuna odaklanabilirsin.`,
        `Wishing you a blessed Ramadan! Focus on "${title}" to make the most of the time between Iftar and Sahur.`,
        lang,
      );
    }
    
    // EXAMS (YKS, KPSS, or Custom Exam)
    if (seasonal.examMode && seasonal.examName) {
      const days = seasonal.examDate ? Math.max(0, Math.ceil((new Date(seasonal.examDate).getTime() - Date.now()) / 86400000)) : null;
      const daysStr = days !== null ? (lang === 'tr' ? `${days} gün kaldı` : `${days} days left`) : '';
      const timeContext = daysStr ? ` (${daysStr})` : '';
      return tr(
        `${seasonal.examName} hazırlığında bugün kritik bir gün${timeContext}. "${title}" hedefini tamamlayıp deneme analizlerine odaklanalım.`,
        `Today is a critical day for your ${seasonal.examName} prep${timeContext}. Let's complete "${title}" and analyze mock exams.`,
        lang,
      );
    }
    
    // TEZ
    if (seasonal.tezMode && seasonal.tezName) {
      const days = seasonal.tezDate ? Math.max(0, Math.ceil((new Date(seasonal.tezDate).getTime() - Date.now()) / 86400000)) : null;
      const daysStr = days !== null ? (lang === 'tr' ? `${days} gün kaldı` : `${days} days left`) : '';
      const timeContext = daysStr ? ` (${daysStr})` : '';
      return tr(
        `Tez teslimine${timeContext} yaklaşıyoruz. Hedefine ulaşmak için bugün "${title}" çalışmasına odaklanalım.`,
        `Nearing thesis deadline${timeContext}. Let's focus on "${title}" today to stay on track.`,
        lang,
      );
    }
    
    // MULAKAT
    if (seasonal.mulakatMode && seasonal.mulakatName) {
      return tr(
        `Mülakat hazırlığında pratik her şeydir. Bugün "${title}" mülakat sorusuna/konusuna çalışarak özgüvenini artır.`,
        `Practice is everything in interview prep. Work on "${title}" today to build your confidence.`,
        lang,
      );
    }

    // TASARRUF (Budget)
    if (seasonal.tasarrufMode && seasonal.tasarrufName) {
      return tr(
        `Tasarruf modun aktif. Bütçeni korumak ve birikim hedefine yaklaşmak için "${title}" adımını tamamla.`,
        `Saving mode is active. Complete "${title}" to keep your budget balanced and reach your savings target.`,
        lang,
      );
    }

    // BIRAKMA (Quit)
    if (seasonal.birakmaMode && seasonal.birakmaName) {
      return tr(
        `Zihnini taze tutuyorsun! "${title}" odağıyla dikkatinizi tetikleyicilerden uzak tutmak bugün seni 1 adım daha ileri taşıyacak.`,
        `Keeping a fresh mind! Focusing on "${title}" will keep your attention away from triggers and push you 1 step further today.`,
        lang,
      );
    }

    // SPOR
    if (seasonal.sporMode && seasonal.sporGoal) {
      return tr(
        `Bugün hareket etme günü! Spor planındaki "${title}" hedefini tamamlayıp zihnini tazelemeye hazır mısın?`,
        `Time to move today! Are you ready to complete "${title}" from your workout plan and refresh your mind?`,
        lang,
      );
    }
  }

  // 3) Progress-based Nudge (If not started yet)
  if (hasProgress && todayCompleted === 0 && momentum < 40 && activeTask) {
    return tr(
      `Bugün henüz başlamadın. "${activeTask.title}" görevi için sadece 5 dakikalık bir odaklanma başlatıp ilk adımı atalım! 🚀`,
      `You haven't started today. Let's start a quick 5-minute focus session for "${activeTask.title}" to take the first step! 🚀`,
      lang,
    );
  }

  // 4) Category-Specific Insights
  if (activeTask) {
    const title = activeTask.title;
    const category = getCategory(title);
    if (category === 'academic') {
      return tr(
        `Zihninin en açık olduğu saatleri "${title}" konusu için değerlendir. Sonrası büyük bir rahatlama! 📚`,
        `Spend your peak focus hours on "${title}". You will feel great once it's done! 📚`,
        lang,
      );
    }
    if (category === 'health') {
      return tr(
        `Bugün vücudunu ve zihnini canlandırma vakti. "${title}" egzersizine başlamak enerjini tavan yapacak. ⚡`,
        `Time to energize your body and mind today. Starting "${title}" will boost your energy. ⚡`,
        lang,
      );
    }
    if (category === 'finance') {
      return tr(
        `Finansal huzurun için kritik bir adım: "${title}". Bugün bunu netleştirip kafanı rahatlat. 💳`,
        `A key step for your financial peace: "${title}". Resolve this today to clear your mind. 💳`,
        lang,
      );
    }
    if (category === 'career') {
      return tr(
        `Kariyer hedeflerine giden yolda bugünün en önemli işi: "${title}". Odaklan ve bitir! 🚀`,
        `Today's key task on your career path: "${title}". Focus and finish strong! 🚀`,
        lang,
      );
    }
    if (category === 'leisure') {
      return tr(
        `Kendine zaman ayırmak üretkenliğini besler. "${title}" aktivitesinin keyfini çıkar. ☕`,
        `Taking time for yourself fuels productivity. Enjoy your "${title}" time. ☕`,
        lang,
      );
    }
  }

  if (momentum > 75) return tr('Zirvedesin! Bugün durdurulamaz bir tempoya ulaştın.', "You're at peak performance! Unstoppable pace today.", lang);
  return tr('Tüm görevler hazır. Yeni bir hedef belirleme vakti.', 'All tasks ready. Time to set a new target.', lang);
}

// ═══════════════════════════════════════════════════════════════════════════════
// HAFTALIK İÇGÖRÜ MOTORU (kural-tabanlı, deterministik, %100 ücretsiz)
// Mevcut veriden (odak/görev/seri/momentum/üretkenlik saati) haftalık metrik ve
// önceliklendirilmiş öneri üretir. Haftalık Rapor + (ileride) koç katmanı kullanır.
// ═══════════════════════════════════════════════════════════════════════════════

export type ProductivityHour = 'morning' | 'afternoon' | 'evening' | 'night';
export type InsightTone = 'positive' | 'warning' | 'neutral' | 'motivational';

export interface WeeklyInsightInput {
  weeklyFocusMinutes: number[];   // son 7 gün, dk
  completedTasksWeek: number;
  streak: number;
  momentumLast7: number[];        // -1 = veri yok
  productivityHour: ProductivityHour;
  habits?: any[];
}

export interface WeeklyMetrics {
  totalFocusMin: number;
  activeDays: number;
  bestDayIndex: number;           // 0..6, -1 yoksa
  bestDayMinutes: number;
  avgMomentum: number;            // -1 yoksa
  momentumTrend: 'up' | 'down' | 'flat' | 'na';
}

export interface Insight {
  tone: InsightTone;
  textTr: string;
  textEn: string;
}

const HOUR_LABEL: Record<ProductivityHour, { tr: string; en: string }> = {
  morning: { tr: 'sabah', en: 'morning' },
  afternoon: { tr: 'öğleden sonra', en: 'afternoon' },
  evening: { tr: 'akşam', en: 'evening' },
  night: { tr: 'gece', en: 'night' },
};

export function computeWeeklyMetrics(input: WeeklyInsightInput): WeeklyMetrics {
  const focus = input.weeklyFocusMinutes ?? [];
  const totalFocusMin = focus.reduce((a, b) => a + Math.max(0, b), 0);
  const activeDays = focus.filter(m => m > 0).length;

  let bestDayIndex = -1;
  let bestDayMinutes = 0;
  focus.forEach((m, i) => { if (m > bestDayMinutes) { bestDayMinutes = m; bestDayIndex = i; } });

  const validMom = (input.momentumLast7 ?? []).filter(v => v >= 0);
  const avgMomentum = validMom.length ? Math.round(validMom.reduce((a, b) => a + b, 0) / validMom.length) : -1;

  let momentumTrend: WeeklyMetrics['momentumTrend'] = 'na';
  if (validMom.length >= 4) {
    const half = Math.floor(validMom.length / 2);
    const firstAvg = validMom.slice(0, half).reduce((a, b) => a + b, 0) / half;
    const secondAvg = validMom.slice(half).reduce((a, b) => a + b, 0) / (validMom.length - half);
    const diff = secondAvg - firstAvg;
    momentumTrend = diff > 5 ? 'up' : diff < -5 ? 'down' : 'flat';
  }

  return { totalFocusMin, activeDays, bestDayIndex, bestDayMinutes, avgMomentum, momentumTrend };
}

/** Önceliklendirilmiş öneriler (en kritik üstte). En fazla `max` döner. */
export function generateWeeklyTips(input: WeeklyInsightInput, max = 3): Insight[] {
  const m = computeWeeklyMetrics(input);
  const tips: Insight[] = [];
  const hour = HOUR_LABEL[input.productivityHour] ?? HOUR_LABEL.morning;

  // Habit-based local AI coach tips
  if (input.habits && input.habits.length > 0) {
    const today = new Date();
    const last7Keys: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const y = d.getFullYear();
      const monthStr = String(d.getMonth() + 1).padStart(2, '0');
      const dayStr = String(d.getDate()).padStart(2, '0');
      last7Keys.push(`${y}-${monthStr}-${dayStr}`);
    }

    let mostSkippedHabit: any = null;
    let maxSkips = 0;
    input.habits.forEach(habit => {
      const safeSkipped = Array.isArray(habit.skippedDates) ? habit.skippedDates : [];
      const skipsThisWeek = safeSkipped.filter((dateStr: string) => last7Keys.includes(dateStr)).length;
      if (skipsThisWeek > maxSkips) {
        maxSkips = skipsThisWeek;
        mostSkippedHabit = habit;
      }
    });

    if (mostSkippedHabit && maxSkips > 0) {
      tips.push({
        tone: 'warning',
        textTr: `"${mostSkippedHabit.name}" alışkanlığını bu hafta ${maxSkips} kez pas geçmişsin. Kendine mola hakkı tanıman güzel ancak rutini kaybetmemeye çalışalım.`,
        textEn: `You skipped "${mostSkippedHabit.name}" ${maxSkips} times this week. Breaks are healthy, but let's try to maintain the routine.`
      });
    }

    let mostCompletedHabit: any = null;
    let maxCompletions = 0;
    input.habits.forEach(habit => {
      const safeCompletions = Array.isArray(habit.completedDates) ? habit.completedDates : [];
      const completionsThisWeek = safeCompletions.filter((dateStr: string) => last7Keys.includes(dateStr)).length;
      if (completionsThisWeek > maxCompletions) {
        maxCompletions = completionsThisWeek;
        mostCompletedHabit = habit;
      }
    });

    if (mostCompletedHabit && maxCompletions >= 4) {
      tips.push({
        tone: 'positive',
        textTr: `Tebrikler, "${mostCompletedHabit.name}" alışkanlığını bu hafta ${maxCompletions} kez tamamlayarak mükemmel bir kararlılık gösterdin.`,
        textEn: `Congratulations, you completed "${mostCompletedHabit.name}" ${maxCompletions} times this week, showing excellent determination.`
      });
    }
  }

  if (input.streak <= 0) {
    tips.push({ tone: 'motivational',
      textTr: 'Seri yok. Bugün küçük bir görevi tamamlayıp seriyi yeniden başlat.',
      textEn: 'No streak. Complete one small task today to restart it.' });
  } else if (input.streak >= 7) {
    tips.push({ tone: 'positive',
      textTr: `${input.streak} günlük seri — istikrar harika, bozma!`,
      textEn: `${input.streak}-day streak — great consistency, keep it!` });
  }

  if (m.totalFocusMin < 60) {
    tips.push({ tone: 'warning',
      textTr: `Bu hafta odak düşük (${m.totalFocusMin} dk). Yarın ${hour.tr} 1 Pomodoro (25 dk) dene.`,
      textEn: `Low focus this week (${m.totalFocusMin} min). Try 1 Pomodoro (25 min) tomorrow in the ${hour.en}.` });
  } else if (m.momentumTrend === 'down') {
    tips.push({ tone: 'warning',
      textTr: `Momentum düşüyor. En verimli olduğun ${hour.tr} saatinde 25 dk derin çalışma ayır.`,
      textEn: `Momentum is dropping. Block 25 min of deep work in your peak ${hour.en} hours.` });
  } else if (m.momentumTrend === 'up') {
    tips.push({ tone: 'positive',
      textTr: 'Momentum yükselişte — ivmeyi koru, bir adım daha at.',
      textEn: 'Momentum is rising — keep the pace, push one step further.' });
  }

  if (input.completedTasksWeek === 0) {
    tips.push({ tone: 'neutral',
      textTr: 'Bu hafta hiç görev tamamlanmadı. Küçük başla: 2 dakikalık bir görev seç.',
      textEn: 'No tasks completed this week. Start small: pick a 2-minute task.' });
  } else if (input.completedTasksWeek >= 15) {
    tips.push({ tone: 'positive',
      textTr: `${input.completedTasksWeek} görev tamamladın — üretken bir hafta!`,
      textEn: `You completed ${input.completedTasksWeek} tasks — a productive week!` });
  }

  if (tips.length === 0) {
    tips.push({ tone: 'neutral',
      textTr: 'Dengeli bir hafta. Yarın için en önemli tek görevini bugünden belirle.',
      textEn: 'A balanced week. Pick tomorrow’s single most important task today.' });
  }

  return tips.slice(0, max);
}

// ── KURAL-TABANLI KOÇ: "şimdi ne yapmalıyım?" tek aksiyon ──────────────────────
// Anlık bağlamdan EN ÖNCELİKLİ tek eylemi seçer (CTA + rota ile). Ücretsiz/deterministik.

export interface CoachContext {
  streak: number;
  todayFocusMin: number;
  todayTasksDone: number;
  momentum: number; // bugünkü momentum, -1 = bilinmiyor
}

export interface CoachAction {
  tone: InsightTone;
  textTr: string;
  textEn: string;
  ctaTr?: string;
  ctaEn?: string;
  route?: '/tasks' | '/focus' | '/modlar';
}

export function getCoachAction(ctx: CoachContext): CoachAction {
  // 1) Seri yok — en kritik: bugün bir şey tamamla
  if (ctx.streak <= 0) {
    return {
      tone: 'motivational',
      textTr: 'Serin durmuş. Bugün küçük bir görevi tamamlayıp yeniden başlat.',
      textEn: 'Your streak is paused. Complete one small task today to restart.',
      ctaTr: 'Görevlere git', ctaEn: 'Go to tasks', route: '/tasks',
    };
  }
  // 2) Bugün hiç odak yok — 1 Pomodoro
  if (ctx.todayFocusMin <= 0) {
    return {
      tone: 'warning',
      textTr: 'Bugün hiç odaklanmadın. 25 dakikalık tek bir Pomodoro ile başla.',
      textEn: "You haven't focused today. Start with a single 25-minute Pomodoro.",
      ctaTr: 'Odağa başla', ctaEn: 'Start focus', route: '/focus',
    };
  }
  // 3) Bugün hiç görev tamamlanmamış
  if (ctx.todayTasksDone <= 0) {
    return {
      tone: 'neutral',
      textTr: 'İyi bir odakla başladın. Şimdi bugünün ilk görevini tamamla.',
      textEn: 'Good focus to start. Now complete your first task of the day.',
      ctaTr: 'Görevler', ctaEn: 'Tasks', route: '/tasks',
    };
  }
  // 4) Momentum düşük
  if (ctx.momentum >= 0 && ctx.momentum < 40) {
    return {
      tone: 'motivational',
      textTr: 'Momentum düşük ama gün bitmedi. Küçük bir adım daha at.',
      textEn: 'Momentum is low but the day isn’t over. Take one more small step.',
      ctaTr: 'Görevler', ctaEn: 'Tasks', route: '/tasks',
    };
  }
  // 5) İyi gidiyor
  return {
    tone: 'positive',
    textTr: 'Harika gidiyorsun — ivmeyi koru ve günü güçlü bitir.',
    textEn: 'You’re doing great — keep the momentum and finish strong.',
  };
}
