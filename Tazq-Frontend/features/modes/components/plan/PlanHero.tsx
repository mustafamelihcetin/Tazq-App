import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { F, W, S, R } from '@/shared/constants/tokens';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useCountUp } from '@/shared/hooks/useCountUp';
import { PlanRoadLine } from './PlanRoadLine';
import type { PlanCopy } from './planCopy';

/*
  PLANIN ÜSTÜ: NEREDEYİM, BUGÜN NE VAR (2026-11-05, kullanıcı: "UI/UX'i yukarı çek"). Eskiden boş bir halka ve her planda aynı kalıp cümle vardı.
  Şimdi yolun gerçek çizgisi: başladığın gün, bugün, hedef günü. Başlangıç bilinmiyorsa çizgi çizilmez, ilerleme uydurulmaz.
  Sınavda konu çubuğu yolun yerine geçer: orada asıl ölçü biten konudur. Hareket yalnız burada ve tek sefer: çizgi bugüne kadar uzanır.
*/
const SEG_DELAY = 500;
const LOCALE = { tr: 'tr-TR', en: 'en-US' };

export interface PlanHeroProps {
  title: string;
  accent: string;
  c: PlanCopy;
  lang: 'tr' | 'en';
  metric: { value: number; unit: string } | null;
  note?: { text: string; urgent?: boolean } | null;
  done: number;
  total: number;
  road: { progress: number; startIso: string; endKey: string } | null;
  topics?: { done: number; total: number } | null;
  line?: string | null;
}

const shortDate = (d: Date, lang: 'tr' | 'en') => d.toLocaleDateString(LOCALE[lang], { day: 'numeric', month: 'short' });

export function PlanHero({ title, accent, c, lang, metric, note, done, total, road, topics, line }: PlanHeroProps) {
  const { theme } = useAppTheme();
  const parts = Math.min(total, 10);
  const shown = useCountUp(metric?.value ?? 0);
  const filled = total ? Math.round((done / total) * parts) : 0;
  const topicPct = topics && topics.total ? Math.round((topics.done / topics.total) * 100) : 0;
  return (
    <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280 }} style={[st.card, { backgroundColor: theme.surfaceCard }]}>
      <View style={st.head}>
        <View style={{ flex: 1, gap: S.xxs }}>
          <Text numberOfLines={2} accessibilityRole="header" style={{ fontSize: F.title3, fontWeight: W.bold, color: theme.onSurface }}>{title}</Text>
          {note && <Text style={{ fontSize: F.footnote, color: note.urgent ? theme.error : theme.onSurfaceMuted }}>{note.text}</Text>}
          {line && <Text style={{ fontSize: F.footnote, color: theme.onSurfaceVariant }}>{line}</Text>}
        </View>
        {metric && (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: F.title, fontWeight: W.bold, color: accent, fontVariant: ['tabular-nums'] }}>{shown}</Text>
            <Text style={{ fontSize: F.caption2, fontWeight: W.semibold, color: accent }}>{metric.unit}</Text>
          </View>
        )}
      </View>

      {topics && topics.total > 0 ? (
        <View style={{ gap: S.xs }}>
          <View accessibilityRole="progressbar" accessibilityValue={{ now: topics.done, min: 0, max: topics.total }} style={[st.track, { backgroundColor: theme.surfaceContainerHigh }]}>
            <MotiView from={{ width: '0%' }} animate={{ width: `${topicPct}%` }} transition={{ type: 'timing', duration: 700 }} style={[st.fill, { backgroundColor: accent }]} />
          </View>
          <Text style={{ fontSize: F.caption2, color: theme.onSurfaceMuted }}>{c.topicProgress(topics.done, topics.total)}</Text>
        </View>
      ) : road ? (
        <View accessible accessibilityLabel={c.journey(Math.round(road.progress * 100))} style={{ gap: S.xs }}>
          <PlanRoadLine progress={road.progress} color={accent} track={theme.onSurfaceMuted + '55'} surface={theme.surfaceCard} />
          <View style={st.ends}>
            <Text style={{ fontSize: F.caption2, color: theme.onSurfaceMuted }}>{shortDate(new Date(road.startIso), lang)}</Text>
            <Text style={{ fontSize: F.caption2, color: theme.onSurfaceMuted }}>{shortDate(new Date(`${road.endKey}T12:00:00`), lang)}</Text>
          </View>
        </View>
      ) : null}

      <View style={{ gap: S.xs }}>
        <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: theme.onSurfaceVariant }}>{c.todayProgress(done, total)}</Text>
        {parts > 0 && (
          <View style={st.segments}>
            {Array.from({ length: parts }, (_, i) => (
              <MotiView key={`${i}-${i < filled}`} from={{ scaleY: i < filled ? 2.6 : 1, backgroundColor: i < filled ? accent : theme.surfaceContainerHigh }} animate={{ scaleY: 1, backgroundColor: i < filled ? accent : theme.surfaceContainerHigh }} transition={{ type: 'spring', damping: 12, stiffness: 220, delay: SEG_DELAY + i * 45 }} style={st.segment} />
            ))}
          </View>
        )}
      </View>
    </MotiView>
  );
}

const st = StyleSheet.create({
  card: { borderRadius: R.lg, padding: S.md, gap: S.md },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: S.md },
  track: { height: 6, borderRadius: R.full, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: R.full },
  ends: { flexDirection: 'row', justifyContent: 'space-between' },
  segments: { flexDirection: 'row', gap: S.xxs },
  segment: { flex: 1, height: 4, borderRadius: R.full },
});
