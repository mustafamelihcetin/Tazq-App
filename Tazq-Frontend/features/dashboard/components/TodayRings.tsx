import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { useReducedMotion } from 'react-native-reanimated';
import { useTween } from '@/shared/hooks/useTween';
import { Check } from 'lucide-react-native';
import { BentoCard } from '@/shared/components/BentoCard';
import { TourTarget } from '@/shared/components/TourContext';
import { Touchable } from '@/shared/components/Touchable';
import { F, S, R, W, ICON, HAIRLINE } from '@/shared/constants/tokens';
import type { AppTheme } from '@/shared/constants/Colors';

/*
  ── BUGÜN — ÜÇ HALKA (Apple Activity · can-it-be-done/season3/AppleActivity) ──
  Ana sayfa vitrindir; ilk bakışta "günüm nasıl gidiyor" tek nesnede okunmalı.
  Eskiden üç ayrı yüzey vardı: Momentum kartı, BUGÜN kartı (görev halkası + odak
  çizgisi) ve alışkanlık sayısı hiçbir yerde. Artık tek kart, üç ölçü:

    dış  → GÖREV       (bugün biten / bugünün işi)
    orta → ODAK        (dakika / günlük odak hedefi)
    iç   → ALIŞKANLIK  (yapılan / bugünkü alışkanlık)

  Referanstan alınan kurallar:
   · İZ, halkanın KENDİ renginin soluk hâli (Constants.ts → `bg`) — gri çember değil;
     halka tek nesne okunur, boşluk "bu ölçünün dolmamış kısmı" der.
   · Açılışta halkalar SIRAYLA dolar (AppleActivity → timing). Sakin modda dolu çizilir.
   · Renk ÖLÇÜYE sabittir; hedefe ulaşmayı renk değişimi değil göstergedeki tik anlatır
     (renk her zaman aynı şeyi söylesin). Mor YOK (bkz. uxConsistency "çapraz-hue").

  Momentum aynı kartın ALTINDA, saç teliyle ayrılmış (MomentumPulse `embedded`).
*/

const SIZE = 112;
const STROKE = 11;
const GAP = 3;
const C = SIZE / 2;
const radiusAt = (i: number) => C - STROKE / 2 - 1 - i * (STROKE + GAP);

interface Metric {
  label: string;
  value: string;
  progress: number; // 0..1 (taşma kırpılır)
  reached: boolean;
  color: string;
}

const Ring = React.memo(({ index, metric, reduceMotion }: { index: number; metric: Metric; reduceMotion: boolean }) => {
  const r = radiusAt(index);
  const len = 2 * Math.PI * r;
  /*
    Dolum JS'te ilerler, düz prop olarak çizilir (bkz. useTween). Reanimated
    `animatedProps` ile çizilen yay, tur sırasında ana sayfa yeniden çizildikçe BOŞ
    kalıyordu (cihazda görüldü). Açılışta halkalar SIRAYLA dolar (AppleActivity → timing).
  */
  const p = useTween(Math.min(1, Math.max(0, metric.progress)), { duration: 1100, delay: index * 140, reduceMotion, initial: 0 });
  return (
    <>
      <Circle cx={C} cy={C} r={r} fill="none" stroke={metric.color + '29'} strokeWidth={STROKE} />
      <Circle
        cx={C} cy={C} r={r} fill="none"
        stroke={metric.color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeDasharray={`${len}`}
        strokeDashoffset={len * (1 - p)}
        // Sıfırda yuvarlak uç bir nokta bırakır — boş halkada yay hiç çizilmez.
        opacity={p > 0.001 ? 1 : 0}
      />
    </>
  );
});

export interface TodayRingsProps {
  label: string;
  /** Kartın tek cümlelik durumu ("gün yeni başlıyor", kolay yumurta sürprizi…). */
  caption: string;
  captionHighlight?: boolean;
  metrics: [Metric, Metric, Metric];
  footer?: React.ReactNode;
  /** Plan boşken görünen davet ("+ Görev ekle") — eski Sıradaki kartının boş hâlinin işi. */
  onAdd?: () => void;
  addLabel?: string;
  showAdd?: boolean;
  onTap?: () => void;
  /** Tur hedefi — dış boşluklu sarmalayıcıyı değil KARTI sarar (delik kart kenarına oturur). */
  tourId?: string;
  theme: AppTheme;
  padding: number;
}

export const TodayRings = React.memo<TodayRingsProps>(({ label, caption, captionHighlight, metrics, footer, onAdd, addLabel, showAdd, onTap, tourId, theme, padding }) => {
  const reduceMotion = useReducedMotion();
  return (
    <View style={styles.wrap}>
      <TourTarget id={tourId ?? 'today'} spotRadius={R.md}>
      <BentoCard index={0} style={{ padding, overflow: 'hidden' }}>
        {/* Dokunma bir ÖZELLİK değil, kolay yumurta — ekran okuyucu ağacına girmez (bkz. TodayCard). */}
        <Touchable accessible={false} onPress={onTap} activeOpacity={1}>
          <Text style={[styles.label, { color: theme.onSurfaceMuted }]}>{label}</Text>
          <View style={styles.row}>
            <View
              style={{ width: SIZE, height: SIZE }}
              accessible
              accessibilityRole="image"
              accessibilityLabel={metrics.map(m => `${m.label} ${m.value}`).join(', ')}
            >
              <Svg width={SIZE} height={SIZE}>
                {/* -90°: dolum saat 12'den başlar. */}
                <G rotation="-90" origin={`${C},${C}`}>
                  {metrics.map((m, i) => <Ring key={m.label} index={i} metric={m} reduceMotion={reduceMotion} />)}
                </G>
              </Svg>
            </View>

            <View style={styles.legend}>
              {metrics.map((m) => (
                <View key={m.label} style={styles.legendRow}>
                  <View style={[styles.dot, { backgroundColor: m.color }]} />
                  <Text style={[styles.legendLabel, { color: theme.onSurfaceVariant }]} numberOfLines={1}>{m.label}</Text>
                  <Text style={[styles.legendValue, { color: theme.onSurface }]} numberOfLines={1}>{m.value}</Text>
                  {/* Hedefe ulaşıldı: renk DEĞİŞMEZ, tik belirir. Yer hep ayrılı — sütun kaymasın. */}
                  <View style={styles.tick}>
                    {m.reached && <Check size={ICON.xs} color={m.color} strokeWidth={3} />}
                  </View>
                </View>
              ))}
            </View>
          </View>
          {!!caption && <Text style={[styles.caption, { color: captionHighlight ? theme.primary : theme.onSurfaceMuted }]}>{caption}</Text>}
        </Touchable>
        {showAdd && onAdd && addLabel ? (
          <Touchable
            onPress={onAdd}
            accessibilityRole="button"
            accessibilityLabel={addLabel}
            style={[styles.addPill, { backgroundColor: theme.primary + '1F' }]}
          >
            <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: theme.primary }}>{`+ ${addLabel}`}</Text>
          </Touchable>
        ) : null}

        {footer ? (
          <View style={{ marginTop: S.md, paddingTop: S.md, borderTopWidth: HAIRLINE, borderTopColor: theme.separator }}>
            {footer}
          </View>
        ) : null}
      </BentoCard>
      </TourTarget>
    </View>
  );
});

TodayRings.displayName = 'TodayRings';

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: S.lg, marginBottom: S.lg },
  label: { fontSize: F.caption, fontWeight: W.medium, letterSpacing: 1.2, marginBottom: S.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: S.lg },
  legend: { flex: 1, gap: S.smd },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  dot: { width: 8, height: 8, borderRadius: R.full },
  legendLabel: { flex: 1, fontSize: F.body, fontWeight: W.medium },
  legendValue: { fontSize: F.callout, fontWeight: W.semibold, fontVariant: ['tabular-nums'] },
  tick: { width: ICON.xs, alignItems: 'center' },
  caption: { fontSize: F.caption, fontWeight: W.semibold, marginTop: S.md, letterSpacing: 0.3 },
  addPill: { alignSelf: 'flex-start', marginTop: S.sm, paddingHorizontal: S.smd, paddingVertical: S.xs, borderRadius: R.full },
});
