import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Touchable } from '@/shared/components/Touchable';
import { MoonPhase, QuitVine } from './PlanSignature';
import { MoneyBox } from './MoneyBox';
import { PlanScene, type PlanSceneData } from './PlanScenes';
import { CompletionBurst } from '@/shared/components/CompletionBurst';
import { haptic } from '@/shared/utils/haptics';
import { MotiView } from 'moti';
import { F, W, S, R, MIN_TOUCH } from '@/shared/constants/tokens';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useCountUp } from '@/shared/hooks/useCountUp';
import { PlanRoadLine } from './PlanRoadLine';
import type { PlanCopy } from './planCopy';

/*
  PLANIN ÜSTÜ: NEREDEYİM, BUGÜN NE VAR (2026-11-05, kullanıcı: "UI/UX'i yukarı çek"). Eskiden boş bir halka ve her planda aynı kalıp cümle vardı.
  Şimdi yolun gerçek çizgisi: başladığın gün, bugün, hedef günü. Başlangıç bilinmiyorsa çizgi çizilmez, ilerleme uydurulmaz.
  Hareket yalnız burada ve tek sefer: çizgi bugüne kadar uzanır.
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
  line?: string | null;
  /** Hedefin kendi ölçüsü (bkz. PlanSignature); yoksa tarih çizgisi. */
  signature?: PlanHeroSignature | null;
  /** İmzanın altındaki tek eylem: "Para ekle". */
  action?: { label: string; onPress: () => void } | null;
}

export type PlanHeroSignature =
  | { kind: 'moneybox'; pct: number; label: string; amount: string; goal: string; symbol: string }
  | { kind: 'quit'; days: number; milestones: readonly number[]; a11y: string }
  | { kind: 'scene'; scene: PlanSceneData }
  | { kind: 'moon'; day: number; duration: number; caption: string };

const shortDate = (d: Date, lang: 'tr' | 'en') => d.toLocaleDateString(LOCALE[lang], { day: 'numeric', month: 'short' });

export function PlanHero({ title, accent, c, lang, metric, note, done, total, road, line, signature, action }: PlanHeroProps) {
  const { theme } = useAppTheme();
  const parts = Math.min(total, 10);
  const shown = useCountUp(metric?.value ?? 0);
  const filled = total ? Math.round((done / total) * parts) : 0;
  // Günün son işi bitince tek seferlik kıvılcım ve dokunuş. Açılışta zaten bitmiş gün patlamaz.
  const [burst, setBurst] = useState(0);
  const wasDone = useRef(total > 0 && done >= total);
  useEffect(() => {
    const nowDone = total > 0 && done >= total;
    if (nowDone && !wasDone.current) { setBurst(b => b + 1); haptic.celebrate(); }
    wasDone.current = nowDone;
  }, [done, total]);
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

      {signature?.kind === 'moneybox' ? (
        <View accessible accessibilityRole="progressbar" accessibilityLabel={`${signature.amount}, ${signature.goal}`} accessibilityValue={{ now: Math.round(signature.pct * 100), min: 0, max: 100 }} style={st.boxRow}>
          <MoneyBox pct={signature.pct} height={124} color={accent} body={theme.surfaceContainerHigh} surface={theme.surfaceCard} glint={theme.surfaceCard} symbol={signature.symbol} />
          <View style={{ flex: 1, gap: S.xxs }}>
            <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: F.title, fontWeight: W.bold, fontVariant: ['tabular-nums'], color: accent }}>{signature.amount}</Text>
            <Text numberOfLines={1} style={{ fontSize: F.footnote, color: theme.onSurfaceVariant }}>{signature.goal} · {signature.label}</Text>
          </View>
        </View>
      ) : signature?.kind === 'scene' ? (
        <PlanScene scene={signature.scene} accent={accent} />
      ) : signature?.kind === 'quit' ? (
        <View accessible accessibilityLabel={signature.a11y}>
          <QuitVine days={signature.days} milestones={signature.milestones} color={accent} track={theme.surfaceContainerHigh} />
        </View>
      ) : signature?.kind === 'moon' ? (
        <View accessible accessibilityLabel={signature.caption} style={st.moonRow}>
          <MoonPhase day={signature.day} duration={signature.duration} color={accent} surface={theme.surfaceCard} track={theme.surfaceContainerHigh} />
          <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: theme.onSurfaceVariant }}>{signature.caption}</Text>
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

      {action && (
        <Touchable accessibilityRole="button" onPress={action.onPress} style={st.action}>
          <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: accent }}>{action.label} ›</Text>
        </Touchable>
      )}

      <View style={{ gap: S.xs }}>
        <View pointerEvents="none" style={st.burst}><CompletionBurst trigger={burst} color={accent} radius={8} spread={34} particles={10} duration={800} /></View>
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
  ends: { flexDirection: 'row', justifyContent: 'space-between' },
  burst: { position: 'absolute', left: '50%', top: 8 },
  boxRow: { flexDirection: 'row', alignItems: 'center', gap: S.md },
  moonRow: { flexDirection: 'row', alignItems: 'center', gap: S.md },
  action: { minHeight: MIN_TOUCH, justifyContent: 'center', marginVertical: -S.sm },
  segments: { flexDirection: 'row', gap: S.xxs },
  segment: { flex: 1, height: 4, borderRadius: R.full },
});
