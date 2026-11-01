import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Compass, TrendingUp, TrendingDown } from 'lucide-react-native';
import { MotiView } from 'moti';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { Touchable } from '@/shared/components/Touchable';
import { DisplayPanel, DisplayDivider, DisplayValue, useDisplayColors, DISPLAY_FONT } from '@/shared/components/DisplayPanel';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { useFirstInSession } from '@/shared/components/EntranceStage';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useReduceMotion } from '@/shared/hooks/useReduceMotion';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { useActiveModeSummary, type ModeSummaryEntry } from '@/features/modes/hooks/useActiveModeSummary';
import { TrendLine } from '@/features/modes/components/TrendLine';
import { ICON, S, R, F, W, B, HAIRLINE, topBarSpace } from '@/shared/constants/tokens';
import { useContentMaxWidth } from '@/shared/components/ResponsiveColumns';
import { track } from '@/shared/utils/analytics';
import { renderModeEmojiIcon } from '@/features/modes';
import { stripEmoji } from '@/shared/utils/emoji';
import { upperFor } from '@/shared/utils/localeCase';
import { langOf } from '@/shared/utils/lang';

/**
 * MODLARIN ÖZETİ — GERİYE BAKIŞ (2026-10-31, denetim).
 *
 * ── ÖLÇÜLEN SORUN ─────────────────────────────────────────────────────────────
 * Ekran üç şeyi tekrar ediyordu: aktif mod sayısı, en yakın hedefin günü ve bugünkü plan
 * (modlar sayfasının durum kartı), her modun kalan günü ve bugünü (yol haritası). Kendine
 * ait tek ölçüsü "bu hafta alışkanlık %"ydi; üstteki cümle de ölçmeden öğüt veriyordu.
 * Kullanıcı: "çok çirkin ve işe yaramaz, yol haritası ile de çakışmamalı"; ardından "daha
 * kompakt, minimalist, anlamlı ve animasyonlu — çok sıkıcı, tek düze".
 *
 * ── ROL AYRIMI ───────────────────────────────────────────────────────────────
 *  · Durum kartı: ŞU AN (geri sayım, bugünün planı).
 *  · Yol haritası: İLERİ (faz, kalan gün, sırada bekleyenler).
 *  · Bu ekran: GERİ — son 4 haftada her modda ne yapıldı, hangisi hızlanıyor, hangisi
 *    geride. Kıyas yalnız ölçülen veriyle ve AYNI GÜNE kadar (bkz. modeHistory).
 *
 * ── DÜZEN ────────────────────────────────────────────────────────────────────
 * Tek panel: bu haftanın sayısı solda, 4 haftalık eğilim çizgisi sağda (Skia; çizilerek
 * gelir, bkz. TrendLine). Altında tek cümlelik içgörü — yalnız ölçülen farktan doğar,
 * fark yoksa yazılmaz. Mod satırlarında aynı 4 hafta küçük sütunlarla, sırayla büyüyerek.
 * Hepsi oturumdaki İLK açılışta bir kez oynar ve durur; "hareketi azalt"ta son hâl.
 */

const COPY = {
  tr: {
    title: 'Modların özeti',
    thisWeek: 'Bu hafta tamamlanan',
    weeks: '4 hafta',
    delta: (d: number) => (d > 0 ? `geçen haftanın bu gününden ${d} fazla` : d < 0 ? `geçen haftanın bu gününden ${-d} az` : 'geçen haftayla aynı tempo'),
    none: 'bu hafta henüz tamamlanan yok',
    rising: (m: string, d: number) => `${m} hızlanıyor: geçen haftaya göre +${d}.`,
    slipping: (m: string, d: number) => `${m} geride kaldı (${d}). Bugün küçük bir adım yeter.`,
    modes: 'Modlar',
    rowDelta: (d: number) => (d > 0 ? `+${d} geçen haftaya göre` : d < 0 ? `${d} geçen haftaya göre` : 'geçen haftayla aynı'),
    rowNone: 'son 4 haftada kayıt yok',
    chartA11y: (label: string, w: number[]) => `${label}, son 4 hafta: ${w.join(', ')}`,
    footnote: 'Plan alışkanlığı işaretlenen günler + biten plan görevleri. Kalan gün ve fazlar yol haritasında.',
    emptyTitle: 'Henüz aktif mod yok',
    emptyBody: 'Bir hedef aç; haftalar ilerledikçe her modda ne kadar yol aldığını burada görürsün.',
    emptyCta: 'Mod seç',
  },
  en: {
    title: 'Modes overview',
    thisWeek: 'Done this week',
    weeks: '4 weeks',
    delta: (d: number) => (d > 0 ? `${d} more than this point last week` : d < 0 ? `${-d} fewer than this point last week` : 'same pace as last week'),
    none: 'nothing done yet this week',
    rising: (m: string, d: number) => `${m} is picking up: +${d} vs last week.`,
    slipping: (m: string, d: number) => `${m} has slipped (${d}). One small step today is enough.`,
    modes: 'Modes',
    rowDelta: (d: number) => (d > 0 ? `+${d} vs last week` : d < 0 ? `${d} vs last week` : 'same as last week'),
    rowNone: 'nothing logged in 4 weeks',
    chartA11y: (label: string, w: number[]) => `${label}, last 4 weeks: ${w.join(', ')}`,
    footnote: 'Days a plan habit was checked + plan tasks finished. Days left and phases live in the roadmap.',
    emptyTitle: 'No active modes yet',
    emptyBody: 'Turn on a goal; as the weeks go by you will see how far each mode has come.',
    emptyCta: 'Pick a mode',
  },
};

const TREND_W = 128;
const TREND_H = 52;

/** Haftalık sütunlar — eskiler soluk, bu hafta dolu; sıfır hafta ince bir taban çizgisi. */
function WeekBars({ values, color, track, play, delay }: { values: number[]; color: string; track: string; play: boolean; delay: number }) {
  const max = Math.max(1, ...values);
  return (
    <View style={styles.bars}>
      {values.map((v, i) => (
        <MotiView
          key={i}
          from={play ? { scaleY: 0 } : undefined}
          animate={{ scaleY: 1 }}
          transition={{ type: 'timing', duration: 420, delay: delay + i * 70 }}
          style={{
            transformOrigin: 'bottom',
            width: 5,
            height: v > 0 ? Math.max(3, Math.round((v / max) * BAR_H)) : 2,
            borderRadius: R.xs,
            backgroundColor: v > 0 ? (i === values.length - 1 ? color : color + '59') : track,
          }}
        />
      ))}
    </View>
  );
}
const BAR_H = 22;

function ModeRow({ e, index, c, play }: { e: ModeSummaryEntry; index: number; c: typeof COPY.tr; play: boolean }) {
  const { theme, isDark } = useAppTheme();
  const h = e.history;
  const logged = h.weeks.some(v => v > 0);
  const label = stripEmoji(e.label) || e.label;
  const delta = h.thisWeek - h.lastWeekSameDay;
  return (
    <MotiView
      from={play ? { opacity: 0, translateY: 6 } : undefined}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 280, delay: 200 + index * 60 }}
      accessible
      accessibilityLabel={`${c.chartA11y(label, h.weeks)}. ${logged ? c.rowDelta(delta) : c.rowNone}`}
      style={[styles.row, { borderTopWidth: index === 0 ? 0 : HAIRLINE, borderTopColor: theme.separator }]}
    >
      <View style={[styles.tile, { backgroundColor: e.color + (isDark ? '26' : '18') }]}>
        {renderModeEmojiIcon(e.emoji, 16, e.color)}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.rowTitle, { color: theme.onSurface }]} numberOfLines={1}>{label}</Text>
        <Text style={[styles.rowMeta, { color: logged && delta > 0 ? theme.success : theme.onSurfaceMuted }]} numberOfLines={1}>
          {logged ? c.rowDelta(delta) : c.rowNone}
        </Text>
      </View>
      <WeekBars values={h.weeks} color={e.color} track={theme.separator} play={play} delay={240 + index * 60} />
      <Text style={[styles.num, { color: theme.onSurface }]}>{h.thisWeek}</Text>
    </MotiView>
  );
}

export default function ModOzetScreen() {
  const { theme, isDark } = useAppTheme();
  const dc = useDisplayColors();
  const { language } = useLanguageStore();
  const lang = langOf(language);
  const c = COPY[lang];
  const router = useRouter();
  const insets = useSafeAreaInsets();
  /* Tablette içerik 600pt'lik şeride sıkışmasın — üç kademeli genişlik. */
  const contentW = useContentMaxWidth();
  const reduce = useReduceMotion();
  const first = useFirstInSession('mod-ozet');
  const play = first && !reduce;

  /*
    HESAP ORTAK BİR HOOK'TA (bkz. useActiveModeSummary → modeHistory).
    Ekran hiçbir görev/alışkanlık okuması yapmaz; yalnız çizer.
  */
  const { entries, activeCount } = useActiveModeSummary();

  React.useEffect(() => { track('mode_summary_opened'); }, []);

  const weeks = entries.reduce((acc, e) => acc.map((v, i) => v + (e.history.weeks[i] ?? 0)), [0, 0, 0, 0]);
  const thisWeek = weeks[3];
  const lastWeek = entries.reduce((a, e) => a + e.history.lastWeekSameDay, 0);

  /*
    TEK İÇGÖRÜ — yalnız ölçülen farktan. Önce geride kalan (eyleme çağırır), yoksa en çok
    hızlanan; tek mod varsa ya da fark küçükse cümle de yok (öğüt uydurulmaz).
  */
  const insight = (() => {
    if (entries.length < 2) return null;
    const ds = entries.map(e => ({ name: stripEmoji(e.label) || e.label, d: e.history.thisWeek - e.history.lastWeekSameDay }));
    const low = ds.reduce((a, b) => (b.d < a.d ? b : a));
    if (low.d <= -2) return { text: c.slipping(low.name, low.d), up: false };
    const high = ds.reduce((a, b) => (b.d > a.d ? b : a));
    if (high.d >= 2) return { text: c.rising(high.name, high.d), up: true };
    return null;
  })();

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScreenHeader onBack={() => router.back()} title={c.title} />

      {activeCount === 0 ? (
        <View style={[styles.center, { paddingTop: topBarSpace(insets.top) }]}>
          <View style={{ marginBottom: S.md }}><Compass size={ICON.xl} color={theme.primary} strokeWidth={1.6} /></View>
          <Text style={{ color: theme.onSurface, fontSize: F.subhead, fontWeight: W.bold, textAlign: 'center', marginBottom: S.sm }}>{c.emptyTitle}</Text>
          <Text style={{ color: theme.onSurfaceVariant, fontSize: F.body, textAlign: 'center', lineHeight: 20, marginBottom: S.lg }}>{c.emptyBody}</Text>
          <Touchable onPress={() => router.back()} style={{ paddingHorizontal: S.lg, paddingVertical: S.sm, borderRadius: R.full, backgroundColor: theme.primary }} accessibilityRole="button">
            <Text style={{ color: theme.onPrimary, fontWeight: W.bold }}>{c.emptyCta}</Text>
          </Touchable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: S.lg, paddingTop: topBarSpace(insets.top) + S.md, paddingBottom: insets.bottom + S.xxl, gap: S.lg, width: '100%', maxWidth: contentW, alignSelf: 'center' }}
          showsVerticalScrollIndicator={false}
        >
          <DisplayPanel padding={S.md}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.label, { color: dc.label }]} numberOfLines={1}>{upperFor(c.thisWeek, language)}</Text>
                <DisplayValue value={`${thisWeek}`} style={styles.hero} seenKey="modes.week" />
                <Text style={[styles.delta, { color: thisWeek > lastWeek ? theme.success : dc.muted }]} numberOfLines={2}>
                  {thisWeek === 0 && lastWeek === 0 ? c.none : c.delta(thisWeek - lastWeek)}
                </Text>
              </View>
              <View accessible accessibilityLabel={c.chartA11y(c.weeks, weeks)} style={{ alignItems: 'flex-end' }}>
                <TrendLine values={weeks} width={TREND_W} height={TREND_H} color={theme.primary} play={play} />
                <Text style={[styles.label, { color: dc.label, marginTop: S.xxs }]}>{upperFor(c.weeks, language)}</Text>
              </View>
            </View>
            {insight && (
              <>
                <DisplayDivider spacing={S.smd} />
                <MotiView
                  from={play ? { opacity: 0, translateX: -4 } : undefined}
                  animate={{ opacity: 1, translateX: 0 }}
                  transition={{ type: 'timing', duration: 320, delay: 820 }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}
                >
                  {insight.up
                    ? <TrendingUp size={ICON.sm} color={theme.success} />
                    : <TrendingDown size={ICON.sm} color={dc.muted} />}
                  <Text style={{ flex: 1, color: dc.ink, fontSize: F.footnote, lineHeight: 18 }}>{insight.text}</Text>
                </MotiView>
              </>
            )}
          </DisplayPanel>

          <View style={{ gap: S.sm }}>
            <SectionHeader title={c.modes} theme={theme} tr={lang === 'tr'} />
            <View style={[styles.list, { backgroundColor: theme.surfaceCard, borderColor: theme.outline, borderWidth: isDark ? B.thin : 0 }]}>
              {entries.map((e, i) => <ModeRow key={e.key} e={e} index={i} c={c} play={play} />)}
            </View>
            <Text style={[styles.footnote, { color: theme.onSurfaceMuted }]}>{c.footnote}</Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: S.xl },
  label: { fontSize: F.caption2, fontWeight: W.semibold, letterSpacing: 1.1 },
  hero: { fontSize: F.title, marginTop: S.xxs },
  delta: { fontSize: F.caption, fontWeight: W.semibold, marginTop: S.xxs },
  list: { borderRadius: R.lg, overflow: 'hidden', paddingHorizontal: S.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: S.smd, paddingVertical: S.sm },
  tile: { width: 30, height: 30, borderRadius: R.sm, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: F.body, fontWeight: W.semibold },
  rowMeta: { fontSize: F.caption, fontWeight: W.semibold, marginTop: S.xxs },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: S.xxs, height: BAR_H },
  num: { fontFamily: DISPLAY_FONT.digits, fontSize: F.body, fontVariant: ['tabular-nums'], minWidth: 24, textAlign: 'right' },
  footnote: { fontSize: F.caption, lineHeight: 16, paddingHorizontal: S.xs },
});
export { RouteErrorBoundary as ErrorBoundary } from '@/shared/components/CrashFallback'; // çökerse yalnız bu ekran düşer
