import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { F, S, W } from '@/shared/constants/tokens';
import type { AppTheme } from '@/shared/constants/Colors';
import { useMinuteClock } from '@/shared/hooks/useMinuteClock';
import { isBeforeRollover, logicalNow } from '@/shared/utils/appDay';

const COPY = {
  tr: { locale: 'tr-TR', line: (day: string) => `Hâlâ ${day} · yeni gün 03:00’te` },
  en: { locale: 'en-US', line: (day: string) => `Still ${day} · new day at 03:00` },
};

/*
  GECE NOTU (2026-11-06). Gece 01:00'de takvim yeni günde, alışkanlık ve odak hâlâ dünde: not olmadan uygulama gün değiştirememiş gibi durur.
  Kado'nun TodayDayCaption fikri: afiş değil, kapatılamaz, teşvik etmez; yalnız gerçeği söyler ve geçerli olmayınca kaybolur.
*/
export function RolloverCaption({ now: fixedNow, language, theme }: { now?: Date; language: 'tr' | 'en'; theme: AppTheme }) {
  // Saat burada: panel dakikada bir baştan çizilmesin, not 03:00'te kendiliğinden gitsin.
  const clock = useMinuteClock();
  const now = fixedNow ?? clock;
  if (!isBeforeRollover(now)) return null;
  const c = COPY[language];
  const raw = logicalNow(now).toLocaleDateString(c.locale, { weekday: 'long' });
  const day = raw.charAt(0).toLocaleUpperCase(c.locale) + raw.slice(1);
  return <Text numberOfLines={1} style={[styles.line, { color: theme.onSurfaceMuted }]}>{c.line(day)}</Text>;
}

const styles = StyleSheet.create({
  line: { fontSize: F.caption, fontWeight: W.medium, marginTop: -S.sm, marginBottom: S.sm },
});
