import React from 'react';
import * as Lucide from 'lucide-react-native';

export interface IconMapping {
  Icon: React.ComponentType<any>;
  color: string;
}

export const ACHIEVEMENT_ICONS: Record<string, IconMapping> = {
  streak_3: { Icon: Lucide.Flame, color: '#FF9500' },       // Orange
  streak_7: { Icon: Lucide.Zap, color: '#FFCC00' },         // Gold/Yellow
  streak_14: { Icon: Lucide.Trophy, color: '#FFD700' },     // Yellow/Gold
  streak_30: { Icon: Lucide.Gem, color: '#00C7BE' },        // Teal
  streak_100: { Icon: Lucide.Crown, color: '#AF52DE' },     // Purple

  momentum_50: { Icon: Lucide.Rocket, color: '#30B0C7' },   // Cyan
  momentum_75: { Icon: Lucide.Star, color: '#FFCC00' },     // Gold
  momentum_90: { Icon: Lucide.Compass, color: '#5856D6' },  // Indigo
  momentum_100: { Icon: Lucide.Sparkles, color: '#FF2D55' }, // Pink

  focus_first: { Icon: Lucide.Target, color: '#FF3B30' },   // Red
  focus_5h: { Icon: Lucide.Brain, color: '#AF52DE' },       // Purple
  focus_25h: { Icon: Lucide.Award, color: '#FF9500' },      // Orange/Gold Award

  daily_perfect: { Icon: Lucide.CheckCircle2, color: '#34C759' }, // Emerald Green

  first_task: { Icon: Lucide.PartyPopper, color: '#6366F1' }, // İlk zafer — Indigo
};

/**
 * Dolu renkli rozet kutusunda glif rengi — LUMINANCE'a göre.
 *
 * Apple tarzı rozet: dolu renkli kutu + kontrast glif. Rozet renkleri parlak sarı/altın
 * da içeriyor (#FFD700, #FFCC00); beyaz glif orada kaybolur. O yüzden zeminin parlaklığına
 * göre seçilir: açık zemin → siyah glif, koyu zemin → beyaz. Böylece her rozette okunur.
 */
function glyphOn(bg: string): string {
  const c = bg.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.substr(i, 2), 16) / 255);
  const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.5 ? '#000000' : '#FFFFFF';
}

export function renderAchievementIcon(id: string, size = 24, locked = false) {
  const mapping = ACHIEVEMENT_ICONS[id];
  if (!mapping) return null;
  const { Icon, color } = mapping;
  if (!Icon) return null;
  // Glif: kilitli → nötr gri; açık → zemine göre siyah/beyaz (kutu solid renk çiziyor,
  // bkz. CelebrationOverlay / profil ızgarası). Renkli glif DEĞİL — Apple boxed stili.
  return <Icon size={size} color={locked ? '#8E8E93' : glyphOn(color)} />;
}
