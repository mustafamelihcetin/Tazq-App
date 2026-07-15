import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, G, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { Zap } from 'lucide-react-native';
import { BentoCard } from '@/shared/components/BentoCard';
import { Touchable } from '@/shared/components/Touchable';
import { F, S, R, W, ICON, METRIC, LH, trackingFor } from '@/shared/constants/tokens';
import type { AppTheme } from '@/shared/constants/Colors';

/**
 * "Bugün" kartı — günün tek bakışlık özeti: kaç görev bitti, hedefin neresindesin,
 * ne kadar odaklandın.
 *
 * PSİKOLOJİK ROL: burası ilerlemenin görüldüğü yer. O yüzden hedefe ULAŞILDIĞINDA
 * kartın rengi maviden yeşile döner (theme.primary → theme.tertiary): renk burada süs
 * değil, "başardın" diyen tek sinyal. Yeşil hem gradyanda hem halkada hem sayıda
 * eşzamanlı döner — parça parça dönseydi mesaj bulanıklaşırdı.
 */

/** Halka geometrisi — hepsi tek ölçüden türer, böylece boyut değişince bozulmaz. */
const RING = 90;
const RING_STROKE = 9;
const RING_C = RING / 2;
const RING_R = RING_C - RING_STROKE / 2 - 3.5; // 37 — çizgi kalınlığı + optik pay
const RING_LEN = 2 * Math.PI * RING_R;

export interface TodayCardProps {
  /** Bugün tamamlanan görev sayısı. */
  completed: number;
  /** Günlük görev hedefi. */
  goal: number;
  /** Bugün odaklanılan dakika. */
  focusMinutes: number;
  /** Günlük odak hedefi (dakika). */
  focusGoalMinutes: number;
  /** Çift dokunma kolay yumurtası açık mı. */
  highlight: boolean;
  /** Kolay yumurta metni. */
  surprise: string;
  /** Kutlama animasyonunu yeniden tetikleyen sayaç. */
  burstKey: number;
  onTap: () => void;
  label: string;
  isSmallScreen: boolean;
  isDark: boolean;
  tr: boolean;
  theme: AppTheme;
  padding: number;
}

export const TodayCard = React.memo<TodayCardProps>(
  ({
    completed, goal, focusMinutes, focusGoalMinutes, highlight, surprise, burstKey,
    onTap, label, isSmallScreen, isDark, tr, theme, padding,
  }) => {
    /**
     * "Görev yok" AYRI bir durum — "hepsi bitti" değil.
     *
     * Çağıran taraf `todayTasks.length || 1` yazıyordu: hiç görev yokken hedefi 1
     * yapıp "0/1 görev tamamlandı" gösteriyordu. Yalan kaldırıldı ve gerçek 0 geliyor.
     * Ama 0 gelince `0 >= 0` doğru olur ve kart YEŞİL "Tümü tamamlandı" derdi —
     * yapacak bir şey yokken kutlamak, kutlamayı değersizleştirir.
     *
     * Üç durum var, ikisi değil: yok · devam ediyor · bitti.
     */
    const hasGoal = goal > 0;
    const reached = hasGoal && completed >= goal;

    // Tek karar, üç yerde birden kullanılıyor (gradyan, halka, sayı) — ayrı ayrı
    // hesaplansaydı biri unutulur ve kart kendi içinde çelişirdi.
    // Görev yokken NÖTR: ne mavi (yapacak iş yok) ne yeşil (başarılacak şey yoktu).
    const accent = !hasGoal ? theme.onSurfaceVariant : reached ? theme.tertiary : theme.primary;
    const pct = hasGoal ? Math.round((completed / goal) * 100) : 0;
    const ringFill = hasGoal ? Math.min(completed / goal, 1) : 0;
    const metricSize = isSmallScreen ? METRIC.sm : METRIC.md;

    return (
      <View style={styles.wrap}>
        <Touchable onPress={onTap} activeOpacity={1}>
          <BentoCard index={0} style={{ overflow: 'hidden', padding }}>
            <LinearGradient
              colors={[accent + (isDark ? (highlight ? '45' : '28') : (highlight ? '30' : '18')), 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />

            <View style={styles.row}>
              {/* Sol: sayısal özet */}
              <View style={styles.stats}>
                <Text style={[styles.label, { color: theme.onSurfaceMuted }]}>{label}</Text>

                <View style={styles.metricRow}>
                  <Text
                    testID="today-completed"
                    style={[
                      styles.metric,
                      { fontSize: metricSize, letterSpacing: trackingFor(metricSize), color: theme.onSurface },
                    ]}
                  >
                    {completed}
                  </Text>
                  {/* Hedef İKİNCİL: aynı puntoda olsaydı "3" ile "5" eşit ağırlıkta
                      okunur ve hangisinin başarı olduğu belirsizleşirdi.
                      Görev yokken hiç gösterilmez — "/0" bir hedef değil, bir hata gibi okunur. */}
                  {hasGoal && <Text style={[styles.goal, { color: theme.onSurfaceMuted }]}>/{goal}</Text>}
                </View>

                <MotiView
                  key={`today-sub-${burstKey}`}
                  from={{ scale: burstKey > 0 ? 1.22 : 1, opacity: burstKey > 0 ? 0 : 1 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', damping: 11, stiffness: 220 }}
                >
                  {/*
                    Renk DURUMU anlatıyor: kolay yumurta/hedef anında vurgu rengi, normalde
                    sessiz gri. Eskiden `opacity: highlight ? 1 : 0.55` ile soluklaştırılıyordu
                    — palet rengini kullanım yerinde kısmak ölçülen kontrastı çöpe atar
                    (bkz. colorContrast.test.ts). Artık iki AYRI seviye.
                  */}
                  <Text testID="today-sub" style={[styles.sub, { color: highlight ? accent : theme.onSurfaceMuted }]}>
                    {highlight
                      ? surprise
                      : !hasGoal
                        // Yapacak bir şey yokken "Tümü tamamlandı 🎉" demek kutlamayı
                        // değersizleştirir: hiçbir şey yapmadan alkış almak, gerçekten
                        // bir şey bitirdiğinde gelen alkışın anlamını da düşürür.
                        ? (tr ? 'Bugün için planın boş' : 'Nothing planned today')
                        : reached
                          ? (tr ? 'Tümü tamamlandı 🎉' : 'All done 🎉')
                          : (tr ? 'görev tamamlandı' : 'tasks completed')}
                  </Text>
                </MotiView>

                {/* Odak dakikası — ikincil metrik, ince çubuk. */}
                <View style={styles.focusRow}>
                  <Zap size={ICON.xs} color={theme.primary} fill={theme.primary} />
                  <View style={[styles.track, { backgroundColor: theme.outline }]}>
                    <MotiView
                      animate={{ width: `${Math.min((focusMinutes / Math.max(focusGoalMinutes, 1)) * 100, 100)}%` }}
                      transition={{ type: 'timing', duration: 900 }}
                      style={[styles.fill, { backgroundColor: theme.primary }]}
                    />
                  </View>
                  <Text style={[styles.focusText, { color: theme.onSurfaceMuted }]}>
                    {focusMinutes}{tr ? 'dk' : 'm'}
                  </Text>
                </View>
              </View>

              {/* Sağ: ilerleme halkası */}
              <View style={styles.ringBox}>
                <Svg width={RING} height={RING}>
                  <Defs>
                    <SvgLinearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                      <Stop offset="0%" stopColor={accent} stopOpacity="1" />
                      <Stop offset="100%" stopColor={reached ? theme.tertiary : theme.secondary} stopOpacity="1" />
                    </SvgLinearGradient>
                  </Defs>
                  {/* -90°: dolum saat 12'den başlasın — saat 3'ten başlayan halka
                      "ilerleme" değil "rastgele yay" gibi okunur. */}
                  <G rotation="-90" origin={`${RING_C},${RING_C}`}>
                    <Circle
                      cx={RING_C} cy={RING_C} r={RING_R} fill="none"
                      stroke={theme.outline} strokeWidth={RING_STROKE}
                    />
                    <Circle
                      cx={RING_C} cy={RING_C} r={RING_R} fill="none"
                      stroke="url(#ringGrad)"
                      strokeWidth={RING_STROKE}
                      strokeLinecap="round"
                      strokeDasharray={`${RING_LEN}`}
                      strokeDashoffset={`${RING_LEN * (1 - ringFill)}`}
                    />
                  </G>
                </Svg>
                <View style={styles.ringCenter}>
                  <Text testID="today-pct" style={[styles.pct, { color: reached ? theme.tertiary : theme.onSurface }]}>{pct}</Text>
                  <Text style={[styles.pctSign, { color: theme.onSurfaceMuted }]}>%</Text>
                </View>
              </View>
            </View>
          </BentoCard>
        </Touchable>
      </View>
    );
  },
);

TodayCard.displayName = 'TodayCard';

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: S.lg, marginBottom: S.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: S.lg },
  stats: { flex: 1, gap: S.sm },
  label: {
    fontSize: F.caption,
    fontWeight: W.medium,
    letterSpacing: 1.2, // büyük harf etiket — optik açıklık
    marginBottom: S.xs,
  },
  metricRow: { flexDirection: 'row', alignItems: 'baseline', gap: S.xs },
  metric: { fontWeight: W.semibold, includeFontPadding: false },
  goal: { fontSize: F.subhead, fontWeight: W.semibold, letterSpacing: trackingFor(F.subhead) },
  sub: { fontSize: F.caption, fontWeight: W.semibold, letterSpacing: 0.3 },
  focusRow: { flexDirection: 'row', alignItems: 'center', gap: S.xs, marginTop: S.xxs },
  track: { flex: 1, height: 3, borderRadius: R.xs, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: R.xs },
  focusText: { fontSize: F.caption, fontWeight: W.semibold },
  ringBox: { width: RING, height: RING },
  ringCenter: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pct: {
    fontSize: F.title,
    fontWeight: W.semibold,
    letterSpacing: trackingFor(F.title),
    lineHeight: F.title * LH.tight,
  },
  pctSign: { fontSize: F.caption, fontWeight: W.semibold },
});
