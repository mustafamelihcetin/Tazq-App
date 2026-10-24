import React from 'react';
import { View, Text } from 'react-native';
import { MotiView } from 'moti';
import { S, R, F, RSPRING } from '@/shared/constants/tokens';
import type { FocusDay } from '@/features/focus/focusStreak';

/*
  ── SON 7 GÜN + SERİ (Tremor SparkChart/Tracker deseni) ──────────────────────
  "Bugün 0 / 60 dk" tek başına bugünü anlatıyordu; dün ne yaptığını, kaç gündür
  sürdürdüğünü göstermiyordu. Bağlılığı en çok taşıyan şey SÜREKLİLİĞİN görünür
  olması: yedi ince çubuk, bugünün çubuğu hedefe göre dolar, seri metinde yazar.
  Aynı alanı kaplar (eski çizgi + metin), ekrana yeni bir blok eklemez.

  Renk: bugün mavi (hedef tamamsa yeşil), geçmiş günler beyazın tonu — aurora'nın
  üstünde sakin kalsın. Odak yapılmamış gün yalnız iz (silik nokta).
*/
interface Props {
  days: FocusDay[];
  goal: number;
  caption: string;
  a11yLabel: string;
  todayColor: string;
  doneColor: string;
  reduceMotion?: boolean;
}

const H = 22;
const W = 6;

export const FocusWeekStrip = React.memo(({ days, goal, caption, a11yLabel, todayColor, doneColor, reduceMotion }: Props) => {
  const scaleMax = Math.max(goal, ...days.map(d => d.minutes), 1);
  return (
    <View accessible accessibilityLabel={a11yLabel} style={{ alignItems: 'center', gap: S.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: S.xs, height: H }}>
        {days.map(d => {
          const h = d.minutes > 0 ? Math.max(4, Math.round((Math.min(d.minutes, scaleMax) / scaleMax) * H)) : 2;
          const met = goal > 0 && d.minutes >= goal;
          const bg = d.isToday ? (met ? doneColor : todayColor) : d.minutes > 0 ? 'rgba(255,255,255,0.42)' : 'rgba(255,255,255,0.14)';
          return d.isToday && !reduceMotion ? (
            <MotiView
              key={d.key}
              from={{ height: 2 }}
              animate={{ height: h }}
              transition={{ type: 'spring', ...RSPRING.default }}
              style={{ width: W, borderRadius: R.full, backgroundColor: bg }}
            />
          ) : (
            <View key={d.key} style={{ width: W, height: h, borderRadius: R.full, backgroundColor: bg }} />
          );
        })}
      </View>
      <Text style={{ fontSize: F.caption, fontWeight: '600', color: 'rgba(255,255,255,0.5)', letterSpacing: 0.3, fontVariant: ['tabular-nums'] }}>
        {caption}
      </Text>
    </View>
  );
});
