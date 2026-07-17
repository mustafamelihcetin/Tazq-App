import React from 'react';
import * as Lucide from 'lucide-react-native';

export interface IconMapping {
  Icon: React.ComponentType<any>;
  color: string;
}

/**
 * Rozet renkleri — markayla uyumlu, KÜRATE edilmiş kimlik paleti.
 *
 * NEDEN değişti: eski set dağınık, eski iOS sistem renkleriydi (#FF9500, #FFCC00, #FF2D55…)
 * — uygulamanın geri kalanında terk ettiğimiz palet. Rozet renkleri "kimlik"tir (madalya
 * gibi, temayla dönmez) ama tek bir SİSTEM gibi durmalı. Üç kademeli aile + iki dönüm noktası:
 *
 *   • Seri  → ATEŞ rampası (amber→turuncu→kırmızı): seri uzadıkça "ısınır". Nadirlik = derin kırmızı.
 *   • Momentum → YÜKSELİŞ rampası (gök→mavi→indigo→mor): serinlik, yukarı ivme.
 *   • Odak  → DERİNLİK rampası (teal→zümrüt→koyu zümrüt): odak derinleştikçe yeşil koyulaşır.
 *   • Mükemmel Gün → altın (gün standardı) · İlk Görev → pembe (kutlama patlaması).
 *
 * Glif kontrastı luminance'a göre (glyphOn) — parlak amber/altında siyah, koyu tonda beyaz.
 */
export const ACHIEVEMENT_ICONS: Record<string, IconMapping> = {
  // Seri — ateş rampası
  streak_3: { Icon: Lucide.Flame, color: '#FBBF24' },       // Amber — kıvılcım
  streak_7: { Icon: Lucide.Zap, color: '#FB923C' },         // Turuncu
  streak_14: { Icon: Lucide.Trophy, color: '#F97316' },     // Koyu turuncu
  streak_30: { Icon: Lucide.Gem, color: '#EF4444' },        // Kırmızı
  streak_100: { Icon: Lucide.Crown, color: '#B91C1C' },     // Derin kırmızı — efsane

  // Momentum — yükseliş rampası
  momentum_50: { Icon: Lucide.Rocket, color: '#38BDF8' },   // Gök
  momentum_75: { Icon: Lucide.Star, color: '#3B82F6' },     // Mavi
  momentum_90: { Icon: Lucide.Compass, color: '#6366F1' },  // Indigo
  momentum_100: { Icon: Lucide.Sparkles, color: '#8B5CF6' }, // Mor — zirve

  // Odak — derinlik rampası
  focus_first: { Icon: Lucide.Target, color: '#2DD4BF' },   // Teal
  focus_5h: { Icon: Lucide.Brain, color: '#10B981' },       // Zümrüt
  focus_25h: { Icon: Lucide.Award, color: '#059669' },      // Koyu zümrüt — ustalık

  daily_perfect: { Icon: Lucide.CheckCircle2, color: '#EAB308' }, // Altın — mükemmel gün
  first_task: { Icon: Lucide.PartyPopper, color: '#EC4899' },     // Pembe — ilk kutlama
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
