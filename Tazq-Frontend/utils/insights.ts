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

type Sentiment = 'sensitive' | 'joyful' | 'stressful' | 'normal';

function getSentiment(title: string): Sentiment {
  const t = title.toLowerCase();
  if (SENSITIVE_KW.some(kw => t.includes(kw))) return 'sensitive';
  if (JOYFUL_KW.some(kw => t.includes(kw))) return 'joyful';
  if (STRESSFUL_KW.some(kw => t.includes(kw))) return 'stressful';
  return 'normal';
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
): string {
  if (isActive) {
    return tr(
      'Odak modu aktif. Akışını bozma, harika gidiyorsun.',
      'Focus mode active. Stay in the zone, you\'re doing great.',
      lang,
    );
  }

  if (highPriorityToday && !isTomorrowTask(highPriorityToday.title)) {
    const sentiment = getSentiment(highPriorityToday.title);
    const titleL = highPriorityToday.title.toLowerCase();
    if (sentiment === 'sensitive') {
      if (FUNERAL_KW.some(kw => titleL.includes(kw))) {
        return tr(`Başınız sağ olsun. "${highPriorityToday.title}" için metanet diliyorum. 🙏`, `My condolences. Stay strong for "${highPriorityToday.title}". 🙏`, lang);
      }
      return tr(`Geçmiş olsun. "${highPriorityToday.title}" sürecinde kendine dikkat et. 🙏`, `Get well soon. Take care during "${highPriorityToday.title}". 🙏`, lang);
    }
    if (sentiment === 'joyful') return tr(`Harika! "${highPriorityToday.title}" günü geldi. Tadını çıkar! 🎉`, `Awesome! "${highPriorityToday.title}" is today. Enjoy! 🎉`, lang);
    return tr(
      `Bugünün en kritik işi: "${highPriorityToday.title}". Hemen bitirip rahatlamaya ne dersin?`,
      `Today's priority: "${highPriorityToday.title}". How about finishing it now to relax?`,
      lang,
    );
  }

  if (topTaskToday && !isTomorrowTask(topTaskToday.title)) {
    const sentiment = getSentiment(topTaskToday.title);
    const titleL = topTaskToday.title.toLowerCase();
    if (sentiment === 'sensitive') {
      if (FUNERAL_KW.some(kw => titleL.includes(kw))) {
        return tr(`Zor bir görev: "${topTaskToday.title}". Sabır dilerim. 🙏`, `A difficult task: "${topTaskToday.title}". Wishing you patience. 🙏`, lang);
      }
      return tr(`"${topTaskToday.title}" konusuna odaklanalım. Sağlık her şeyden önemli. 🙏`, `Let's focus on "${topTaskToday.title}". Health comes first. 🙏`, lang);
    }
    if (sentiment === 'joyful') return tr(`Hadi "${topTaskToday.title}" hazırlıklarına başlayalım! ✨`, `Let's start prep for "${topTaskToday.title}"! ✨`, lang);
    return tr(
      `Sıradaki bugünün görevi: "${topTaskToday.title}". Küçük bir adımla başlamak ivmeni artırır.`,
      `Next for today: "${topTaskToday.title}". A small step now will boost your momentum.`,
      lang,
    );
  }

  if (futureTasksIncomplete.length > 0 || (topTaskToday && isTomorrowTask(topTaskToday.title))) {
    const nextTask = (topTaskToday && isTomorrowTask(topTaskToday.title)) ? topTaskToday : futureTasksIncomplete[0];
    const titleL = nextTask.title.toLowerCase();
    const sentiment = getSentiment(nextTask.title);
    const isTomorrow = isTomorrowTask(titleL);

    if (isTomorrow) {
      if (sentiment === 'sensitive') {
        if (FUNERAL_KW.some(kw => titleL.includes(kw))) {
          return tr('Yarın zor bir gün olacak. Metanetini koru, bugün sadece dinlen. 🙏', 'Tomorrow will be difficult. Stay strong, just rest today. 🙏', lang);
        }
        return tr(`Yarınki "${nextTask.title}" için şimdiden hazırlıklı ol. Geçmiş olsun. 🙏`, `Be prepared for tomorrow's "${nextTask.title}". Get well soon. 🙏`, lang);
      }
      if (sentiment === 'joyful') return tr(`Yarın harika bir gün olacak! "${nextTask.title}" seni bekliyor. 🎈`, `Tomorrow will be great! "${nextTask.title}" awaits you. 🎈`, lang);
      return tr(
        `Bugünlük işler tamam gibi. Yarınki "${nextTask.title}" görevin için şimdiden plan yapabilirsin.`,
        `Today seems clear. You can start planning for tomorrow's "${nextTask.title}" task.`,
        lang,
      );
    }
    return tr(
      `Sıradaki hedefin: "${nextTask.title}". Zamanı geldiğinde seni uyaracağım.`,
      `Next target: "${nextTask.title}". I'll alert you when the time comes.`,
      lang,
    );
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
