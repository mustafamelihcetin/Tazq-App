import { Achievement } from '../store/useAchievementStore';

export const ACHIEVEMENTS: Record<string, Achievement> = {
  // ── Streak ──────────────────────────────────────────────
  streak_3: {
    id: 'streak_3', emoji: '🔥',
    titleTr: '3 Günlük Seri!', titleEn: '3-Day Streak!',
    subtitleTr: 'Alışkanlık oluşmaya başlıyor.', subtitleEn: 'A habit is starting to form.',
  },
  streak_7: {
    id: 'streak_7', emoji: '⚡',
    titleTr: '1 Hafta Aralıksız!', titleEn: 'One Full Week!',
    subtitleTr: 'Kararlılık birikim halinde.', subtitleEn: 'Consistency is building up.',
  },
  streak_14: {
    id: 'streak_14', emoji: '🏆',
    titleTr: '2 Haftalık Güç!', titleEn: '2-Week Power!',
    subtitleTr: 'Bu seviye herkesin ulaşamadığı bir yer.', subtitleEn: 'Not everyone gets here.',
  },
  streak_30: {
    id: 'streak_30', emoji: '💎',
    titleTr: '30 Gün Tam Güç!', titleEn: '30 Days Strong!',
    subtitleTr: 'Artık bu bir yaşam biçimi.', subtitleEn: 'This is a lifestyle now.',
  },
  streak_100: {
    id: 'streak_100', emoji: '👑',
    titleTr: '100 Gün Efsanesi!', titleEn: '100-Day Legend!',
    subtitleTr: 'Nadir. Ciddi. Gerçek.', subtitleEn: 'Rare. Serious. Real.',
  },

  // ── Momentum ─────────────────────────────────────────────
  momentum_50: {
    id: 'momentum_50', emoji: '🚀',
    titleTr: 'Momentum: 50!', titleEn: 'Momentum: 50!',
    subtitleTr: 'Yarı yoldasın, devam et.', subtitleEn: 'Halfway there, keep going.',
  },
  momentum_75: {
    id: 'momentum_75', emoji: '🌟',
    titleTr: 'Yüksek Momentum!', titleEn: 'High Momentum!',
    subtitleTr: 'Üretkenliğin zirveye yaklaşıyor.', subtitleEn: 'Your productivity is peaking.',
  },
  momentum_90: {
    id: 'momentum_90', emoji: '🔮',
    titleTr: 'Neredeyse Mükemmel!', titleEn: 'Almost Perfect!',
    subtitleTr: '90+ — bu seviye nadir görülür.', subtitleEn: '90+ is rarely seen.',
  },
  momentum_100: {
    id: 'momentum_100', emoji: '✨',
    titleTr: 'Tam Momentum!', titleEn: 'Full Momentum!',
    subtitleTr: 'Bugün her şeyi doğru yaptın.', subtitleEn: 'You did everything right today.',
  },

  // ── Focus ────────────────────────────────────────────────
  focus_first: {
    id: 'focus_first', emoji: '🎯',
    titleTr: 'İlk Odak Seansı!', titleEn: 'First Focus Session!',
    subtitleTr: 'Derin çalışma yolculuğu başladı.', subtitleEn: 'Deep work journey begins.',
  },
  focus_5h: {
    id: 'focus_5h', emoji: '🧠',
    titleTr: '5 Saat Odak!', titleEn: '5 Hours of Focus!',
    subtitleTr: 'Zihnin keskinleşiyor.', subtitleEn: 'Your mind is sharpening.',
  },
  focus_25h: {
    id: 'focus_25h', emoji: '🏅',
    titleTr: '25 Saat Derin Çalışma!', titleEn: '25 Hours Deep Work!',
    subtitleTr: 'Uzmanlık birikime dayanır.', subtitleEn: 'Mastery is built on accumulation.',
  },

  // ── Daily ────────────────────────────────────────────────
  daily_perfect: {
    id: 'daily_perfect', emoji: '✅',
    titleTr: 'Mükemmel Gün!', titleEn: 'Perfect Day!',
    subtitleTr: "Bugünkü tüm görevler tamamlandı.", subtitleEn: 'All tasks for today completed.',
  },
};

// ── Checker functions ─────────────────────────────────────────────────────────

export function checkStreakAchievement(streak: number): Achievement | null {
  if (streak >= 100) return ACHIEVEMENTS.streak_100;
  if (streak >= 30) return ACHIEVEMENTS.streak_30;
  if (streak >= 14) return ACHIEVEMENTS.streak_14;
  if (streak >= 7) return ACHIEVEMENTS.streak_7;
  if (streak >= 3) return ACHIEVEMENTS.streak_3;
  return null;
}

export function checkMomentumAchievement(momentum: number): Achievement | null {
  if (momentum >= 100) return ACHIEVEMENTS.momentum_100;
  if (momentum >= 90) return ACHIEVEMENTS.momentum_90;
  if (momentum >= 75) return ACHIEVEMENTS.momentum_75;
  if (momentum >= 50) return ACHIEVEMENTS.momentum_50;
  return null;
}

export function checkFocusAchievement(totalMinutes: number): Achievement | null {
  if (totalMinutes >= 25 * 60) return ACHIEVEMENTS.focus_25h;
  if (totalMinutes >= 5 * 60) return ACHIEVEMENTS.focus_5h;
  if (totalMinutes >= 1) return ACHIEVEMENTS.focus_first;
  return null;
}
