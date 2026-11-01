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
  tasks?: any[];
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

export function generateWeeklyTips(input: WeeklyInsightInput, max = 3): Insight[] {
  const m = computeWeeklyMetrics(input);
  const tips: Insight[] = [];
  const hour = HOUR_LABEL[input.productivityHour] ?? HOUR_LABEL.morning;

  // Velocity Guard check: detect if tasks were spammed in the last 7 days
  if (input.tasks && input.tasks.length > 0) {
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const weeklyCompleted = input.tasks.filter(t => {
      if (!t.isCompleted || !t.completedAt) return false;
      const completedDate = new Date(t.completedAt);
      return completedDate >= sevenDaysAgo;
    });

    const sortedCompleted = [...weeklyCompleted]
      .map(t => ({ id: t.id, time: new Date(t.completedAt!).getTime() }))
      .sort((a, b) => a.time - b.time);

    let spammedCount = 0;
    for (let i = 1; i < sortedCompleted.length; i++) {
      const diffSeconds = (sortedCompleted[i].time - sortedCompleted[i - 1].time) / 1000;
      if (diffSeconds < 10) {
        spammedCount++;
      }
    }

    if (spammedCount >= 3) {
      /*
        DİL DÜZELTİLDİ — eski metin kullanıcıyı DENETLİYORDU: "hızınız normalin üzerinde
        saptandı… odak kalitenizi izlememizi zorlaştırır". Kullanıcı uygulamasına hesap
        vermez; uygulama kullanıcıya yardım eder. Gözlem aynı, cümle artık bir öneri.
      */
      tips.push({
        tone: 'neutral',
        textTr: 'Birkaç işi arka arkaya işaretlemişsin — liste temizliği iyi geldi demek. Büyük bir iş varsa onu tek başına ele almak haftanın resmini daha net gösterir.',
        textEn: 'You checked off several tasks back to back — a good cleanup. If one of them was a big piece of work, giving it its own slot makes your week easier to read.'
      });
    }
  }

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
