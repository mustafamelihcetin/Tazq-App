import React, { useEffect } from 'react';
import { View, Text, Modal, Animated, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { renderModeEmojiIcon } from '@/features/modes';
import { BrainCircuit, Zap, Target, Play, TrendingUp, TrendingDown, Check, Coffee, Gauge, X, ChevronRight, Activity } from 'lucide-react-native';
import { useSwipeToDismiss } from '@/shared/hooks/useSwipeToDismiss';
import { Touchable } from '@/shared/components/Touchable';
import { GlassSurface } from '@/shared/components/GlassSurface';
import { ICON, S, R, F, B, MAX_W, MIN_TOUCH } from '@/shared/constants/tokens';
import type { AppTheme } from '@/shared/constants/Colors';
import { fmtDateKey } from '@/features/habits';
import { weekdayIndex } from '@/features/dashboard/utils/streakDay';
import { focusDelta, formatMinutes, bestDayIndex } from '@/features/dashboard/utils/weeklyHub';
import { AppIcon } from '@/shared/components/AppIcon';
import { Separator } from '@/shared/components/Separator';
import { localeOf } from '@/shared/utils/lang';

/*
  ── İÇGÖRÜ MODALI — YENİDEN KURULDU (2026-10-25) ───────────────────────────────────

  Değerlendirmede bu yüzey 4/10 aldı; nedenleri ve karşılıkları:

  1. DÜRÜSTLÜK. Gösterilen her sayı artık ölçülen veriden (bkz. utils/weeklyHub):
     · "Alışkanlık & odak sinerjisi: %45 daha yüksek" SABİT bir cümleydi, hiçbir hesaba
       dayanmıyordu → kaldırıldı.
     · "10 sn altında tamamlananlar sayılmaz" dipnotları, o kural (Velocity Guard)
       kaldırıldıktan sonra YANLIŞTI → kaldırıldı.
     · "Odak skoru" uydurma ağırlıklarla (210 dk = 45 puan…) üretilip en az %10'a
       kenetleniyordu ve ana sayfadaki Momentum'la yarışan İKİNCİ bir skordu → kaldırıldı.
       Yerine ölçülen büyüklük: bu haftanın odak süresi ve geçen haftaya göre değişim.
     · Geçen hafta 0 iken "+%100" → "Geçen hafta kayıt yok".
     · Alışkanlık "10 tamamlama = tam puan" → yapılan / mümkün olan gün oranı.
  2. TEKRAR. Momentum ve bugünkü hedef kutuları ana sayfanın birebir kopyasıydı → kaldırıldı.
  3. EYLEM. Modal öneri verip "şimdi ne yapayım?" sorusunu cevapsız bırakıyordu (hızlı odak
     fonksiyonu props'ta vardı ama hiç kullanılmıyordu) → önerinin altında tek birincil eylem.
  4. HİYERARŞİ. Sekiz BÜYÜK HARF başlık ve hepsinin altında aynı küçük punto açıklama
     vardı → Tremor KPI kartı deseni: bir etiket, bir büyük sayı, bir değişim rozeti, bir
     grafik. Apple Fitness haftalık özeti gibi tek bakışta okunur.
  5. DİL. "TAZQ INSIGHTS", "Momentum", "45m" Türkçe arayüzde İngilizce kalıyordu.
*/

const COPY = {
  tr: {
    title: 'Bu hafta',
    close: 'Kapat',
    focusEyebrow: 'ODAK · BU HAFTA',
    noFocus: 'Bu hafta henüz odak kaydı yok',
    deltaNew: 'Geçen hafta kayıt yok',
    deltaVs: 'geçen haftanın aynı günlerine göre',
    bestDay: (day: string, mins: string) => `En verimli gün: ${day} · ${mins}`,
    nowEyebrow: 'ŞİMDİ',
    startFocus: '25 dk odaklan',
    resumeFocus: 'Odak seansına dön',
    habits: 'ALIŞKANLIKLAR',
    habitRate: (pct: number, done: number, possible: number) => `%${pct} · ${done}/${possible}`,
    moreHabits: (n: number) => `+${n} alışkanlık daha · Haftalık Merkez`,
    legendDone: 'Yapıldı',
    legendBreak: 'Mola',
    tips: 'ÖNERİLER',
    review: 'Haftalık geri bakışın tamamı',
    weekdays: ['Pa', 'Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct'],
    dayA11y: (day: string, mins: string) => `${day}: ${mins}`,
  },
  en: {
    title: 'This week',
    close: 'Close',
    focusEyebrow: 'FOCUS · THIS WEEK',
    noFocus: 'No focus sessions yet this week',
    deltaNew: 'No sessions last week',
    deltaVs: 'vs the same days last week',
    bestDay: (day: string, mins: string) => `Best day: ${day} · ${mins}`,
    nowEyebrow: 'NOW',
    startFocus: 'Focus for 25 min',
    resumeFocus: 'Back to your session',
    habits: 'HABITS',
    habitRate: (pct: number, done: number, possible: number) => `${pct}% · ${done}/${possible}`,
    moreHabits: (n: number) => `+${n} more habits · Weekly Hub`,
    legendDone: 'Done',
    legendBreak: 'Break',
    tips: 'SUGGESTIONS',
    review: 'Full weekly review',
    weekdays: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
    dayA11y: (day: string, mins: string) => `${day}: ${mins}`,
  },
};

/** Izgarada en çok bu kadar alışkanlık; fazlası Haftalık Merkez'de (eskiden 3'ü sessizce kesiliyordu). */
const MAX_HABITS = 5;
const CHART_H = 72;

interface StatusHubModalProps {
  visible: boolean;
  onClose: () => void;
  theme: AppTheme;
  isDark: boolean;
  language: string;
  insight: string;
  isActive: boolean; // odak seansı sürüyor mu
  startQuickFocus: () => void;
  weeklyTips?: { tone?: string; textTr: string; textEn: string }[];
  weeklyFocusData?: { day: string; minutes?: number }[];
  lastWeekMinutes?: number;
  habits?: any[];
  /**
   * Alışkanlık oranı ORTAK hafta motorundan (summarizeWeek) — Haftalık Merkez ile aynı sayı.
   * Modal kendi hesabını yapıyordu ve bugün kurulan alışkanlıkları 7 gün bekliyordu
   * ("%7 · 1/14", Haftalık Merkez aynı veri için %50; cihazda görüldü).
   */
  habitStats?: { done: number; possible: number; pct: number };
}

export const StatusHubModal: React.FC<StatusHubModalProps> = ({
  visible,
  onClose,
  theme,
  isDark,
  language,
  insight,
  isActive,
  startQuickFocus,
  weeklyTips,
  weeklyFocusData,
  lastWeekMinutes = 0,
  habits = [],
  habitStats,
}) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const c = language === 'tr' ? COPY.tr : COPY.en;
  const { panResponder, animatedStyle, prepare, slideIn } = useSwipeToDismiss({
    onDismiss: onClose,
  });

  useEffect(() => {
    if (visible) prepare();
  }, [visible, prepare]);

  const todayIndex = weekdayIndex();
  /*
    TAKVİM HAFTASI (Pzt → Paz) — odak verisi de böyle geliyor (bkz. index → weekRange).
    Eskiden ızgara "son 7 gün", grafik "bu hafta"ydı: aynı sayfada iki ayrı hafta.
  */
  const weekDays = React.useMemo(() => {
    const now = new Date();
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - todayIndex + i);
      const key = fmtDateKey(d);
      dates.push({ key, date: d, label: c.weekdays[d.getDay()], isToday: i === todayIndex, isFuture: i > todayIndex });
    }
    return dates;
  }, [c, todayIndex]);

  const days = weeklyFocusData ?? [];
  const totalFocusMins = days.reduce((sum, d) => sum + (d.minutes || 0), 0);
  const delta = focusDelta(totalFocusMins, lastWeekMinutes);
  const best = bestDayIndex(days);
  const maxMins = Math.max(...days.map(v => v.minutes || 0), 30);
  // Oran yalnız GEÇMİŞ + bugün üzerinden: henüz gelmemiş gün "yapılmadı" sayılmaz.
  const habitRate = habitStats && habitStats.possible > 0 ? habitStats : null;
  const shownHabits = habits.slice(0, MAX_HABITS);
  const hiddenHabits = habits.length - shownHabits.length;
  const fmtDay = (d: Date) => d.toLocaleDateString(localeOf(language), { day: 'numeric', month: 'short' });
  const range = `${fmtDay(weekDays[0].date)} – ${fmtDay(weekDays[6].date)}`;

  /*
    Haftanın günü metnini yerelleştirir. `weeklyFocusData[].day` kaynağa göre İngilizce
    ("Mon") ya da `t.dayLabels`'tan Türkçe ("Pzt") gelebiliyor; ikisinde de aranıp gün
    İNDEKSİNDEN doğru dile çevriliyor.
  */
  const getLocalizedDayName = (dayStr: string, isFull = false) => {
    const cleanDay = dayStr.trim().replace('.', '').toLowerCase();
    const enShort = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const trShort = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']; // i18n.ts dayLabels ile aynı
    const trFull = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
    const enFull = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    let idx = enShort.findIndex(k => cleanDay === k.toLowerCase() || cleanDay.startsWith(k.toLowerCase()));
    if (idx < 0) idx = trShort.findIndex(k => cleanDay === k.toLocaleLowerCase('tr'));
    if (idx < 0) return dayStr.trim().replace('.', '');
    const names = language === 'tr' ? (isFull ? trFull : trShort) : (isFull ? enFull : enShort);
    return names[idx];
  };

  const eyebrow = (text: string) => (
    <Text style={[styles.eyebrow, { color: theme.onSurfaceMuted }]}>{text}</Text>
  );
  const cardStyle = [styles.card, { backgroundColor: isDark ? theme.surfaceContainer : theme.surfaceContainerLow, borderColor: theme.outlineVariant }];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      onShow={slideIn}
    >
      <View style={styles.overlay}>
        <Touchable
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={c.close}
        />
        <Animated.View
          style={[
            animatedStyle,
            styles.sheet,
            { borderColor: theme.outlineVariant, maxHeight: winH - insets.top - S.md, paddingBottom: insets.bottom + S.md },
          ]}
        >
          <GlassSurface corners="top" />
          <View {...panResponder.panHandlers}>
            <View style={styles.dragHandleContainer}>
              <View style={[styles.dragHandle, { backgroundColor: theme.outline }]} />
            </View>

            {/* BAŞLIK — açan düğmenin ikonu (Gauge) burada da: kullanıcı nereye geldiğini tanır. */}
            <View style={styles.header}>
              <AppIcon Icon={Gauge} color={theme.primary} size={36} radius={R.md} iconSize={ICON.md} />
              <View style={styles.headerText}>
                <Text accessibilityRole="header" style={[styles.title, { color: theme.onSurface }]}>{c.title}</Text>
                <Text style={[styles.subtitle, { color: theme.onSurfaceMuted }]}>{range}</Text>
              </View>
              <Touchable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel={c.close}
                style={[styles.closeBtn, { backgroundColor: theme.surfaceField }]}
              >
                <X size={ICON.sm} color={theme.onSurfaceVariant} strokeWidth={2.2} />
              </Touchable>
            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.scroll}
            // Tablette içerik okunur bir sütunda kalır; sayfa tam genişlik yükselen bir yüzey.
            contentContainerStyle={styles.scrollContent}
          >
            {/* 1 · ODAK — Tremor KPI: etiket, büyük sayı, değişim rozeti, grafik. */}
            <View style={cardStyle}>
              {eyebrow(c.focusEyebrow)}
              <Text style={[styles.kpi, { color: theme.onSurface }]}>{formatMinutes(totalFocusMins, language)}</Text>
              {delta.kind === 'change' ? (
                <View style={styles.deltaRow}>
                  <View style={[styles.deltaBadge, { backgroundColor: (delta.pct >= 0 ? theme.success : theme.warning) + '1F' }]}>
                    {delta.pct >= 0
                      ? <TrendingUp size={ICON.xs} color={theme.success} />
                      : <TrendingDown size={ICON.xs} color={theme.warning} />}
                    <Text style={[styles.deltaText, { color: delta.pct >= 0 ? theme.success : theme.warning }]}>
                      {delta.pct >= 0 ? '+' : ''}{delta.pct}%
                    </Text>
                  </View>
                  <Text style={[styles.caption, { color: theme.onSurfaceMuted }]}>{c.deltaVs}</Text>
                </View>
              ) : delta.kind === 'new' ? (
                <Text style={[styles.caption, styles.deltaRow, { color: theme.onSurfaceMuted }]}>{c.deltaNew}</Text>
              ) : null}

              {/* Grafik: bugün dolu tint, öteki günler açık ton; yalnız en iyi günün değeri yazılır (gürültü yok).
                  Veri yoksa ÇİZİLMEZ — sıfır çubuklu grafik ~75 dp boş alan kaplıyordu (cihazda görüldü). */}
              {totalFocusMins > 0 && (
              <View style={styles.chart} accessible accessibilityRole="image" accessibilityLabel={days.map(d => c.dayA11y(getLocalizedDayName(d.day, true), formatMinutes(d.minutes || 0, language))).join(', ')}>
                {days.map((d, i) => {
                  const mins = d.minutes || 0;
                  const isToday = i === todayIndex;
                  const barH = mins > 0 ? Math.max(4, Math.round((mins / maxMins) * (CHART_H - 18))) : 3;
                  return (
                    <View key={i} style={styles.barCol}>
                      <Text style={[styles.barValue, { color: theme.onSurfaceVariant, opacity: i === best ? 1 : 0 }]}>{mins}</Text>
                      <View style={[styles.bar, { height: barH, backgroundColor: isToday ? theme.primary : mins > 0 ? theme.primary + '55' : theme.outline }]} />
                      <Text style={[styles.barLabel, { color: isToday ? theme.primary : theme.onSurfaceMuted, fontWeight: isToday ? '700' : '500' }]}>
                        {getLocalizedDayName(d.day)}
                      </Text>
                    </View>
                  );
                })}
              </View>
              )}

              <Separator theme={theme} />
              <Text style={[styles.body, { color: theme.onSurfaceVariant }]}>
                {best !== null
                  ? c.bestDay(getLocalizedDayName(days[best].day, true), formatMinutes(days[best].minutes || 0, language))
                  : c.noFocus}
              </Text>
            </View>

            {/* 2 · ŞİMDİ — öneri + tek birincil eylem */}
            <View style={cardStyle}>
              {eyebrow(c.nowEyebrow)}
              <Text style={[styles.insight, { color: theme.onSurface }]}>{insight}</Text>
              <Touchable
                onPress={() => {
                  if (isActive) { onClose(); router.push('/focus'); }
                  else startQuickFocus(); // modalı kapatır ve odak ekranına geçer
                }}
                accessibilityRole="button"
                accessibilityLabel={isActive ? c.resumeFocus : c.startFocus}
                style={[styles.primaryBtn, { backgroundColor: theme.primary }]}
              >
                {isActive ? <Activity size={ICON.sm} color={theme.onPrimary} /> : <Play size={ICON.sm} color={theme.onPrimary} fill={theme.onPrimary} />}
                <Text style={[styles.primaryText, { color: theme.onPrimary }]}>{isActive ? c.resumeFocus : c.startFocus}</Text>
              </Touchable>
            </View>

            {/* 3 · ALIŞKANLIKLAR — oran: yapılan / mümkün (mola paydadan düşer) */}
            {shownHabits.length > 0 && (
              <View style={cardStyle}>
                <View style={styles.rowBetween}>
                  {eyebrow(c.habits)}
                  {habitRate && (
                    <Text style={[styles.rate, { color: theme.onSurface }]}>{c.habitRate(habitRate.pct, habitRate.done, habitRate.possible)}</Text>
                  )}
                </View>
                <View style={styles.habitGrid}>
                  <View style={styles.habitRow}>
                    <View style={styles.habitName} />
                    {weekDays.map(day => (
                      <Text key={day.key} style={[styles.gridDay, { color: day.isToday ? theme.primary : theme.onSurfaceMuted, fontWeight: day.isToday ? '700' : '500' }]}>{day.label}</Text>
                    ))}
                  </View>
                  {shownHabits.map((habit, hIdx) => {
                    const completedSet = new Set(habit.completedDates || []);
                    const skippedSet = new Set(habit.skippedDates || []);
                    const color = habit.color || theme.primary;
                    // Alışkanlık o gün HENÜZ YOKTU: "yapılmadı" grisi değil, gelecek gün gibi boş çerçeve
                    // (bugün kurulan alışkanlık 6 kaçırılmış gün gibi görünüyordu; cihazda görüldü).
                    const bornKey = habit.createdAt ? fmtDateKey(new Date(habit.createdAt)) : '';
                    return (
                      <View key={habit.id ?? hIdx} style={styles.habitRow}>
                        <View style={styles.habitName}>
                          {renderModeEmojiIcon(habit.emoji ?? '📌', 14, color)}
                          <Text numberOfLines={1} style={[styles.habitText, { color: theme.onSurface }]}>{habit.name}</Text>
                        </View>
                        {weekDays.map(day => {
                          const done = completedSet.has(day.key);
                          const skipped = !done && skippedSet.has(day.key);
                          const inactive = day.isFuture || (!!bornKey && day.key < bornKey);
                          return (
                            <View key={day.key} style={styles.cellSlot}>
                              <View style={[
                                styles.cell,
                                {
                                  // Gelecek gün boş bir çerçeve: "yapılmadı" değil, "henüz değil".
                                  backgroundColor: done ? color : skipped ? theme.warning + '26' : inactive ? 'transparent' : theme.outline,
                                  borderStyle: inactive ? 'dashed' : 'solid',
                                  borderWidth: day.isToday ? B.medium : inactive ? B.thin : 0,
                                  borderColor: day.isToday ? theme.primary : theme.outline,
                                },
                              ]}>
                                {done ? <Check size={ICON.xs - 2} color="#FFFFFF" strokeWidth={3.5} /> : skipped ? <Coffee size={ICON.xs - 2} color={theme.warning} /> : null}
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    );
                  })}
                </View>
                {/* Lejant hücrelerin GERÇEK görünümünü taşır (eskiden mavi kare, hücreler alışkanlık rengindeydi). */}
                <View style={styles.legend}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendCell, { backgroundColor: theme.onSurfaceMuted }]}><Check size={ICON.xs - 4} color="#FFFFFF" strokeWidth={4} /></View>
                    <Text style={[styles.caption, { color: theme.onSurfaceMuted }]}>{c.legendDone}</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendCell, { backgroundColor: theme.warning + '26' }]}><Coffee size={ICON.xs - 4} color={theme.warning} /></View>
                    <Text style={[styles.caption, { color: theme.onSurfaceMuted }]}>{c.legendBreak}</Text>
                  </View>
                </View>
                {hiddenHabits > 0 && (
                  <Touchable
                    onPress={() => { onClose(); router.push('/cockpit'); }}
                    accessibilityRole="button"
                    accessibilityLabel={c.moreHabits(hiddenHabits)}
                    style={styles.linkRow}
                  >
                    <Text style={[styles.link, { color: theme.primary }]}>{c.moreHabits(hiddenHabits)}</Text>
                  </Touchable>
                )}
              </View>
            )}

            {/* 4 · ÖNERİLER — kural tabanlı koç kartları (bkz. insights.generateWeeklyTips) */}
            {weeklyTips && weeklyTips.length > 0 && (
              <View style={styles.tips}>
                {eyebrow(c.tips)}
                {weeklyTips.map((tip, idx) => {
                  // Üç ton tema jetonundan (olumlu/uyarı/motive edici) — ham rgba üçlüleri yok.
                  let accent = theme.onSurfaceVariant;
                  let IconComponent = BrainCircuit;
                  if (tip.tone === 'positive') { accent = theme.success; IconComponent = Target; }
                  else if (tip.tone === 'warning') { accent = theme.warning; IconComponent = Zap; }
                  else if (tip.tone === 'motivational') { accent = theme.secondary; IconComponent = BrainCircuit; }
                  const text = language === 'tr' ? tip.textTr : tip.textEn;
                  return (
                    <View key={idx} style={[styles.tip, { backgroundColor: accent + (isDark ? '14' : '0D'), borderColor: accent + (isDark ? '26' : '1A') }]}>
                      <AppIcon Icon={IconComponent} color={accent} size={28} radius={R.full} iconSize={ICON.sm} />
                      <Text style={[styles.tipText, { color: theme.onSurface }]}>{text}</Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* 5 · Derin analiz ayrı ekranda — bu sayfa bir ÖZET, rapor değil. */}
            <Touchable
              onPress={() => { onClose(); router.push('/report'); }}
              accessibilityRole="button"
              accessibilityLabel={c.review}
              style={[styles.reviewRow, { backgroundColor: theme.surfaceField }]}
            >
              <Text style={[styles.reviewText, { color: theme.onSurface }]}>{c.review}</Text>
              <ChevronRight size={ICON.sm} color={theme.onSurfaceVariant} />
            </Touchable>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: R.sheet,
    borderTopRightRadius: R.sheet,
    borderWidth: B.thin,
    borderBottomWidth: 0,
    overflow: 'hidden',
  },
  dragHandleContainer: { paddingTop: S.sm, paddingBottom: S.xs, alignItems: 'center' },
  dragHandle: { width: 36, height: 5, borderRadius: R.full },
  header: { flexDirection: 'row', alignItems: 'center', gap: S.smd, paddingHorizontal: S.lg, paddingBottom: S.md },
  headerText: { flex: 1 },
  title: { fontSize: F.title3, fontWeight: '700', letterSpacing: -0.3 },
  subtitle: { fontSize: F.footnote, fontWeight: '500', marginTop: S.xxs },
  closeBtn: { width: 36, height: 36, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  scroll: { flexGrow: 0 },
  scrollContent: { gap: S.md, paddingHorizontal: S.lg, paddingBottom: S.sm, width: '100%', maxWidth: MAX_W, alignSelf: 'center' },
  card: { borderRadius: R.lg, borderWidth: B.thin, padding: S.md, gap: S.sm },
  eyebrow: { fontSize: F.caption, fontWeight: '600', letterSpacing: 0.8 },
  kpi: { fontSize: F.display, fontWeight: '700', letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
  deltaRow: { flexDirection: 'row', alignItems: 'center', gap: S.xs },
  deltaBadge: { flexDirection: 'row', alignItems: 'center', gap: S.xxs, paddingHorizontal: S.sm, paddingVertical: S.xxs, borderRadius: R.full },
  deltaText: { fontSize: F.caption2, fontWeight: '700', fontVariant: ['tabular-nums'] },
  caption: { fontSize: F.caption2, fontWeight: '500' },
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: CHART_H + 20, marginTop: S.xs },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: S.xxs },
  barValue: { fontSize: F.caption, fontWeight: '700', fontVariant: ['tabular-nums'] },
  bar: { width: '46%', maxWidth: 22, borderRadius: R.xs },
  barLabel: { fontSize: F.caption },
  body: { fontSize: F.footnote, fontWeight: '500' },
  insight: { fontSize: F.callout, fontWeight: '500', letterSpacing: -0.2 },
  primaryBtn: { minHeight: MIN_TOUCH + S.xs, borderRadius: R.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, marginTop: S.xs },
  primaryText: { fontSize: F.body, fontWeight: '600' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rate: { fontSize: F.footnote, fontWeight: '600', fontVariant: ['tabular-nums'] },
  habitGrid: { gap: S.sm },
  habitRow: { flexDirection: 'row', alignItems: 'center' },
  habitName: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: S.xs, paddingRight: S.sm },
  habitText: { flexShrink: 1, fontSize: F.caption2, fontWeight: '600' },
  gridDay: { width: 26, textAlign: 'center', fontSize: F.caption },
  cellSlot: { width: 26, alignItems: 'center' },
  cell: { width: 18, height: 18, borderRadius: R.xs, alignItems: 'center', justifyContent: 'center' },
  legend: { flexDirection: 'row', justifyContent: 'flex-end', gap: S.md, marginTop: S.xxs },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: S.xs },
  legendCell: { width: 12, height: 12, borderRadius: R.xs, alignItems: 'center', justifyContent: 'center' },
  linkRow: { minHeight: MIN_TOUCH, justifyContent: 'center' },
  link: { fontSize: F.footnote, fontWeight: '600' },
  tips: { gap: S.sm },
  tip: { flexDirection: 'row', alignItems: 'center', gap: S.smd, borderWidth: B.thin, borderRadius: R.lg, padding: S.smd },
  tipText: { flex: 1, fontSize: F.footnote, fontWeight: '500' },
  reviewRow: { minHeight: MIN_TOUCH + S.xs, borderRadius: R.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: S.md },
  reviewText: { fontSize: F.body, fontWeight: '600' },
});
