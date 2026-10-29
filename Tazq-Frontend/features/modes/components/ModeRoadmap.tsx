import React from 'react';
import { View, Text, StyleSheet, Modal, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Compass, Target, Sprout, Unlock, Flag } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { GlassSurface } from '@/shared/components/GlassSurface';
import { AlertHost } from '@/shared/components/CustomAlert';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { S, R, F, W, B, ICON } from '@/shared/constants/tokens';
import { useStagedPlanStore } from '@/features/modes/store/useStagedPlanStore';
import { modePhase } from '@/features/modes/utils/modePhase';
import type { ModeSummary, ModeSummaryEntry } from '@/features/modes/hooks/useActiveModeSummary';
import { fmtDateKey } from '@/features/habits/store/useHabitStore';
import { useActiveHabitList } from '@/features/habits/hooks/useActiveHabitList';

/*
  BUGÜN = ALIŞKANLIK + GÖREV — mod kartının "Bugünün planı" sayımıyla aynı tanım.
  Özet kancasının todayTotal'ı yalnız görev sayıyor; rozet 0/1 derken kart 0/2 diyordu.
*/
function useToday() {
  const habits = useActiveHabitList();
  const key = fmtDateKey();
  return (e: ModeSummaryEntry) => {
    const ids = new Set(e.habitIds);
    const hDone = habits.filter(h => ids.has(h.id) && (h.completedDates ?? []).includes(key)).length;
    return { done: e.todayDone + hDone, total: e.todayTotal + e.habitCount };
  };
}

/*
  ── MOD DURUM ROZETİ + YOL HARİTASI (madde 7) ────────────────────────────────────
  Modlar ekranının sol üstü bir tur modalı açıyordu — Ayarlar'daki "turları yeniden
  göster" ile aynı iş, ekranın en değerli köşesinde. Yerine: aktif hedeflerin BUGÜNKÜ
  durumu (rozet) ve dokununca her hedefin fazı, kalan günü, bugünü ve sırada bekleyen
  öğeleri (kademeli açılım) tek sayfada.
*/
const COPY = {
  tr: {
    pillA11y: (d: number, t: number) => `Bugün ${t} plan işinden ${d} tamam. Yol haritasını aç`,
    title: 'Yol haritası', sub: 'Hedeflerin, fazları ve bugünün',
    today: 'Bugün', daysLeft: (n: number) => `${n} gün kaldı`, open: 'Süresiz', expired: 'Tarihi geçti',
    phase: (i: number, t: number, name: string) => `Faz ${i}/${t} · ${name}`,
    staged: (n: number) => `${n} öğe sırada — ilerledikçe günde bir açılır`, close: 'Kapat',
    howA11y: 'Modlar nasıl çalışır', howTitle: 'Modlar nasıl çalışır', howSub: 'Bir hedef aç; plan seninle birlikte büyür',
    how: [
      ['Hedefini seç', 'Sınav, tez, mülakat, spor ya da bir alışkanlığı bırakmak — adı ve tarihi yeter.'],
      ['Küçük başla', 'İlk gün 1 görev ve 1 alışkanlık. Bir anda yüklenmezsin.'],
      ['İlerledikçe açılır', 'Bir günü plan işiyle kapattıkça ertesi gün yeni bir adım eklenir.'],
      ['Fazlar tarihe göre', 'Hedef yaklaştıkça plan hazırlıktan son düzlüğe kendiliğinden geçer.'],
    ] as [string, string][],
  },
  en: {
    pillA11y: (d: number, t: number) => `${d} of ${t} plan tasks done today. Open roadmap`,
    title: 'Roadmap', sub: 'Your goals, their phases and today',
    today: 'Today', daysLeft: (n: number) => `${n} days left`, open: 'Ongoing', expired: 'Date passed',
    phase: (i: number, t: number, name: string) => `Phase ${i}/${t} · ${name}`,
    staged: (n: number) => `${n} items queued — one unlocks a day as you progress`, close: 'Close',
    howA11y: 'How modes work', howTitle: 'How modes work', howSub: 'Open a goal; the plan grows with you',
    how: [
      ['Pick your goal', 'An exam, thesis, interview, fitness or quitting a habit — a name and a date is enough.'],
      ['Start small', 'Day one is 1 task and 1 habit. Nothing piles up at once.'],
      ['Unlock as you go', 'Each day you close with plan work adds a new step the next day.'],
      ['Phases follow the date', 'As the goal nears, the plan moves from groundwork to the final stretch on its own.'],
    ] as [string, string][],
  },
};

/**
 * Yalnız BAŞLAMIŞ planlar: anahtarı açık ama kurulumu bitmemiş mod "0/0" gösteriyordu
 * (cihazda görüldü). Planı başlamış = en az bir alışkanlığı ya da görevi var.
 */
const HOW_ICONS = [Target, Sprout, Unlock, Flag];
const started = (entries: ModeSummaryEntry[]) => entries.filter(e => e.habitIds.length + e.taskIds.length > 0);

export function ModeStatusPill({ summary, onPress }: { summary: ModeSummary; onPress: () => void }) {
  const { theme } = useAppTheme();
  const lang = useLanguageStore(s => (s.language === 'en' ? 'en' : 'tr'));
  const today = useToday();
  const live = started(summary.entries);
  /*
    Aktif plan yokken sol üst BOŞ kalmıyor (kullanıcı geri bildirimi): pusula düğmesi
    aynı sayfayı "nasıl çalışır" hâliyle açar — tur değil, kısa ve kalıcı bir anlatım.
  */
  if (live.length === 0) {
    return (
      <Touchable onPress={onPress} accessibilityRole="button" accessibilityLabel={COPY[lang].howA11y} testID="mode-status-pill"
        style={[styles.pill, { backgroundColor: theme.surfaceCard, borderColor: theme.outline }]}>
        <Compass size={ICON.sm} color={theme.primary} />
      </Touchable>
    );
  }
  const accent = live[0].color ?? theme.primary;
  const done = live.reduce((n, e) => n + today(e).done, 0);
  const total = live.reduce((n, e) => n + today(e).total, 0);
  return (
    <Touchable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={COPY[lang].pillA11y(done, total)}
      testID="mode-status-pill"
      style={[styles.pill, { backgroundColor: accent + '1A', borderColor: accent + '40' }]}
    >
      <View style={[styles.dot, { backgroundColor: accent }]} />
      <Text style={[styles.pillText, { color: theme.onSurface }]} numberOfLines={1}>{`${done}/${total}`}</Text>
    </Touchable>
  );
}

function Row({ e, lang }: { e: ModeSummaryEntry; lang: 'tr' | 'en' }) {
  const { theme } = useAppTheme();
  const c = COPY[lang];
  const staged = useStagedPlanStore(s => s.queues[e.key]?.items.length ?? 0);
  const phase = modePhase(e.key, e.days);
  const t = useToday()(e);
  const pct = t.total > 0 ? t.done / t.total : 0;
  const when = e.days == null ? c.open : e.days < 0 ? c.expired : c.daysLeft(e.days);
  return (
    <View style={[styles.row, { backgroundColor: theme.surfaceCard, borderColor: theme.outline }]}>
      <View style={styles.rowHead}>
        <View style={[styles.dot, { backgroundColor: e.color }]} />
        <Text style={[styles.rowTitle, { color: theme.onSurface }]} numberOfLines={1}>{e.label}</Text>
        <Text style={[styles.meta, { color: e.textColor }]}>{when}</Text>
      </View>

      {phase && (
        <View style={{ gap: S.xs }}>
          <View style={styles.steps} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {phase.names.map((_, i) => (
              <View key={i} style={[styles.step, { backgroundColor: i <= phase.index ? e.color : theme.outlineVariant }]} />
            ))}
          </View>
          <Text style={[styles.meta, { color: theme.onSurfaceVariant }]}>{c.phase(phase.index + 1, phase.total, phase[lang])}</Text>
        </View>
      )}

      <View style={{ gap: S.xs }}>
        <View style={styles.rowHead}>
          <Text style={[styles.meta, { color: theme.onSurfaceVariant, flex: 1 }]}>{c.today}</Text>
          <Text style={[styles.meta, { color: theme.onSurface, fontVariant: ['tabular-nums'] }]}>{`${t.done}/${t.total}`}</Text>
        </View>
        <View style={[styles.track, { backgroundColor: theme.outlineVariant }]}>
          <View style={[styles.fill, { width: `${Math.round(pct * 100)}%`, backgroundColor: e.color }]} />
        </View>
      </View>

      {staged > 0 && <Text style={[styles.meta, { color: theme.onSurfaceMuted }]}>{c.staged(staged)}</Text>}
    </View>
  );
}

export function ModeRoadmapSheet({ visible, summary, onClose }: { visible: boolean; summary: ModeSummary; onClose: () => void }) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const lang = useLanguageStore(s => (s.language === 'en' ? 'en' : 'tr'));
  const c = COPY[lang];
  const live = started(summary.entries);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Touchable accessibilityRole="button" accessibilityLabel={c.close} style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + S.lg }]}>
          <GlassSurface corners="top" />
          <View style={styles.grabber}><View style={[styles.grabberBar, { backgroundColor: theme.onSurface + '1F' }]} /></View>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: theme.onSurface }]} accessibilityRole="header">{live.length > 0 ? c.title : c.howTitle}</Text>
              <Text style={[styles.meta, { color: theme.onSurfaceVariant }]}>{live.length > 0 ? c.sub : c.howSub}</Text>
            </View>
            <Touchable onPress={onClose} accessibilityRole="button" accessibilityLabel={c.close} style={styles.close}>
              <X size={ICON.md} color={theme.onSurfaceVariant} />
            </Touchable>
          </View>
          <ScrollView contentContainerStyle={{ gap: S.smd }} showsVerticalScrollIndicator={false}>
            {live.length > 0
              ? live.map(e => <Row key={e.key} e={e} lang={lang} />)
              : c.how.map(([title, body], i) => {
                  const Icon = HOW_ICONS[i];
                  return (
                    <View key={title} style={[styles.row, styles.howRow, { backgroundColor: theme.surfaceCard, borderColor: theme.outline }]}>
                      <View style={[styles.howIcon, { backgroundColor: theme.primaryContainer }]}><Icon size={ICON.sm} color={theme.primary} /></View>
                      <View style={{ flex: 1, gap: S.xxs }}>
                        <Text style={[styles.rowTitle, { color: theme.onSurface }]}>{title}</Text>
                        <Text style={[styles.meta, { color: theme.onSurfaceVariant }]}>{body}</Text>
                      </View>
                    </View>
                  );
                })}
          </ScrollView>
        </View>
        <AlertHost />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  howRow: { flexDirection: 'row', alignItems: 'flex-start', gap: S.smd },
  howIcon: { width: 32, height: 32, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: S.xs, alignSelf: 'flex-start', minHeight: 36, paddingHorizontal: S.smd, borderRadius: R.full, borderWidth: B.thin },
  dot: { width: 8, height: 8, borderRadius: R.full },
  pillText: { fontSize: F.footnote, fontWeight: W.semibold, fontVariant: ['tabular-nums'] },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { maxHeight: '80%', borderTopLeftRadius: R.sheet, borderTopRightRadius: R.sheet, paddingHorizontal: S.lg, paddingTop: S.sm, overflow: 'hidden', gap: S.md },
  grabber: { alignItems: 'center' },
  grabberBar: { width: 36, height: 4, borderRadius: R.xs },
  header: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  title: { fontSize: F.title3, fontWeight: W.bold },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  row: { padding: S.md, borderRadius: R.lg, borderWidth: B.thin, gap: S.smd },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  rowTitle: { flex: 1, fontSize: F.body, fontWeight: W.semibold },
  meta: { fontSize: F.caption, fontWeight: W.medium },
  steps: { flexDirection: 'row', gap: S.xs },
  step: { flex: 1, height: 4, borderRadius: R.full },
  track: { height: 6, borderRadius: R.full, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: R.full },
});
