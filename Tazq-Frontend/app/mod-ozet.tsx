import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, CalendarClock, Layers, Flame } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useAppTheme } from '../hooks/useAppTheme';
import { useLanguageStore } from '../store/useLanguageStore';
import { usePrefsStore } from '../store/usePrefsStore';
import { useHabitStore } from '../store/useHabitStore';
import { useTaskStore } from '../store/useTaskStore';
import { S, R, F, B } from '../constants/tokens';
import { track } from '../utils/analytics';

// Bu haftanın (Pzt–Paz) 'YYYY-MM-DD' anahtarları.
function thisWeekKeys(): Set<string> {
  const now = new Date();
  const day = (now.getDay() + 6) % 7; // 0 = Pazartesi
  const monday = new Date(now);
  monday.setDate(now.getDate() - day);
  const keys = new Set<string>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    keys.add(d.toISOString().split('T')[0]);
  }
  return keys;
}

function daysLeftOf(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const end = new Date(dateStr).setHours(23, 59, 59, 999);
  if (end < Date.now()) return -1; // geçmiş
  return Math.max(0, Math.ceil((end - Date.now()) / 86400000));
}

interface ModeEntry {
  key: string;
  label: string;
  color: string;
  emoji: string;
  days: number | null; // null = süresiz, -1 = geçmiş
  habitIds: string[];
  taskIds: number[];
}

export default function ModOzetScreen() {
  const { theme, isDark } = useAppTheme();
  const { language } = useLanguageStore();
  const tr = language === 'tr';
  const router = useRouter();

  const prefs = usePrefsStore();
  const seasonal = prefs.seasonal;
  const habits = useHabitStore(s => s.habits);
  const tasks = useTaskStore(s => s.tasks);

  React.useEffect(() => { track('mode_summary_opened'); }, []);

  const weekKeys = useMemo(() => thisWeekKeys(), []);
  const now = new Date();
  const isToday = (d?: string | null) => {
    if (!d) return false;
    const x = new Date(d);
    return x.getFullYear() === now.getFullYear() && x.getMonth() === now.getMonth() && x.getDate() === now.getDate();
  };

  // Aktif mod girişlerini topla (slotlar dahil).
  const entries: ModeEntry[] = [];
  const examLbl = tr ? 'Sınav' : 'Exam';
  const mulLbl = tr ? 'Mülakat' : 'Interview';
  const sporLbl = tr ? 'Spor' : 'Fitness';
  if (seasonal.examMode) {
    entries.push({ key: 'exam', label: seasonal.examName || examLbl, color: '#3B82F6', emoji: '🎯', days: daysLeftOf(seasonal.examDate), habitIds: prefs.examPlanHabitIds, taskIds: prefs.examPlanTaskIds });
    if (seasonal.exam2Name) entries.push({ key: 'exam2', label: seasonal.exam2Name, color: '#3B82F6', emoji: '🎯', days: daysLeftOf(seasonal.exam2Date), habitIds: prefs.exam2PlanHabitIds, taskIds: prefs.exam2PlanTaskIds });
    if (seasonal.exam3Name) entries.push({ key: 'exam3', label: seasonal.exam3Name, color: '#3B82F6', emoji: '🎯', days: daysLeftOf(seasonal.exam3Date), habitIds: prefs.exam3PlanHabitIds, taskIds: prefs.exam3PlanTaskIds });
  }
  if (seasonal.tezMode) entries.push({ key: 'tez', label: seasonal.tezName || (tr ? 'Tez' : 'Thesis'), color: '#8B5CF6', emoji: '📚', days: daysLeftOf(seasonal.tezDate), habitIds: prefs.tezPlanHabitIds, taskIds: prefs.tezPlanTaskIds });
  if (seasonal.mulakatMode) {
    entries.push({ key: 'mulakat', label: seasonal.mulakatName || mulLbl, color: '#10B981', emoji: '💼', days: daysLeftOf(seasonal.mulakatDate), habitIds: prefs.mulakatPlanHabitIds, taskIds: prefs.mulakatPlanTaskIds });
    if (seasonal.mulakat2Name) entries.push({ key: 'mulakat2', label: seasonal.mulakat2Name, color: '#10B981', emoji: '💼', days: daysLeftOf(seasonal.mulakat2Date), habitIds: prefs.mulakat2PlanHabitIds, taskIds: prefs.mulakat2PlanTaskIds });
    if (seasonal.mulakat3Name) entries.push({ key: 'mulakat3', label: seasonal.mulakat3Name, color: '#10B981', emoji: '💼', days: daysLeftOf(seasonal.mulakat3Date), habitIds: prefs.mulakat3PlanHabitIds, taskIds: prefs.mulakat3PlanTaskIds });
  }
  if (seasonal.sporMode) {
    entries.push({ key: 'spor', label: seasonal.sporGoal || sporLbl, color: '#F97316', emoji: '💪', days: daysLeftOf(seasonal.sporDate), habitIds: prefs.sporPlanHabitIds, taskIds: prefs.sporPlanTaskIds });
    if (seasonal.spor2Goal) entries.push({ key: 'spor2', label: seasonal.spor2Goal, color: '#F97316', emoji: '💪', days: daysLeftOf(seasonal.spor2Date), habitIds: prefs.spor2PlanHabitIds, taskIds: prefs.spor2PlanTaskIds });
    if (seasonal.spor3Goal) entries.push({ key: 'spor3', label: seasonal.spor3Goal, color: '#F97316', emoji: '💪', days: daysLeftOf(seasonal.spor3Date), habitIds: prefs.spor3PlanHabitIds, taskIds: prefs.spor3PlanTaskIds });
  }
  if (seasonal.ramazan) entries.push({ key: 'ramazan', label: tr ? 'Ramazan' : 'Ramadan', color: '#6366F1', emoji: '🌙', days: null, habitIds: prefs.ramazanPlanHabitIds, taskIds: prefs.ramazanPlanTaskIds });

  // Her giriş için ölçütleri hesapla.
  const computed = entries.map(e => {
    const eHabits = habits.filter(h => e.habitIds.includes(h.id));
    const weekActive = eHabits.filter(h => (Array.isArray(h.completedDates) ? h.completedDates : []).some(d => weekKeys.has(d))).length;
    const pct = eHabits.length > 0 ? Math.round((weekActive / eHabits.length) * 100) : 0;
    const todays = tasks.filter(t => e.taskIds.includes(t.id) && t.tags?.includes('daily') && isToday(t.dueDate));
    const todayDone = todays.filter(t => t.isCompleted).length;
    return { ...e, habitCount: eHabits.length, weekActive, pct, todayDone, todayTotal: todays.length, taskTotal: e.taskIds.length };
  });

  // Genel özet.
  const activeCount = computed.length;
  const dated = computed.filter(c => c.days !== null && c.days >= 0).sort((a, b) => (a.days! - b.days!));
  const nearest = dated[0] ?? null;
  const totalHabits = computed.reduce((a, c) => a + c.habitCount, 0);
  const totalWeekActive = computed.reduce((a, c) => a + c.weekActive, 0);
  const overallPct = totalHabits > 0 ? Math.round((totalWeekActive / totalHabits) * 100) : 0;
  const todayDoneAll = computed.reduce((a, c) => a + c.todayDone, 0);
  const todayTotalAll = computed.reduce((a, c) => a + c.todayTotal, 0);

  // Kural-tabanlı tek satırlık içgörü (ücretsiz).
  const coachLine = (() => {
    if (activeCount === 0) return '';
    if (nearest && nearest.days! <= 3) return tr ? `“${nearest.label}” çok yakın — bu hafta tam odaklan.` : `“${nearest.label}” is very close — full focus this week.`;
    if (overallPct >= 80) return tr ? 'Tüm modlarda harika bir istikrar yakaladın, böyle devam!' : 'Great consistency across all modes — keep it up!';
    if (overallPct < 40 && totalHabits > 0) return tr ? 'Bu hafta alışkanlıklar biraz geride — küçük bir adım bile ivmeyi geri getirir.' : 'Habits are lagging this week — even one small step rebuilds momentum.';
    if (nearest) return tr ? `En yakın hedefin “${nearest.label}” (${nearest.days} gün). Günlük plana sadık kal.` : `Nearest goal: “${nearest.label}” (${nearest.days} days). Stick to the daily plan.`;
    return tr ? 'Kendi tempondasın — düzenli küçük adımlar fark yaratır.' : 'At your own pace — steady small steps win.';
  })();

  const Stat = ({ icon, value, label, color }: { icon: React.ReactNode; value: string; label: string; color: string }) => (
    <View style={[styles.statCard, { backgroundColor: isDark ? theme.surfaceContainer : theme.surfaceContainerLow, borderColor: theme.outlineVariant }]}>
      <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: color + '18', alignItems: 'center', justifyContent: 'center', marginBottom: S.xs }}>{icon}</View>
      <Text style={{ color: theme.onSurface, fontSize: F.title, fontWeight: '900', letterSpacing: -0.5 }}>{value}</Text>
      <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '600', opacity: 0.7 }}>{label}</Text>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel={tr ? 'Geri' : 'Back'}>
          <ArrowLeft size={24} color={theme.onSurface} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.onSurface }]}>{tr ? 'Modların Özeti' : 'Modes Overview'}</Text>
        <View style={{ width: 40 }} />
      </View>

      {activeCount === 0 ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 40, marginBottom: S.md }}>🧭</Text>
          <Text style={{ color: theme.onSurface, fontSize: F.subhead, fontWeight: '700', textAlign: 'center', marginBottom: 6 }}>{tr ? 'Henüz aktif mod yok' : 'No active modes yet'}</Text>
          <Text style={{ color: theme.onSurfaceVariant, fontSize: F.body, textAlign: 'center', lineHeight: 20, marginBottom: S.lg }}>{tr ? 'Bir hedef aç — buradan tüm modlarının gidişatını tek bakışta görürsün.' : 'Turn on a goal — track all your modes at a glance here.'}</Text>
          <TouchableOpacity onPress={() => router.back()} style={{ paddingHorizontal: S.lg, paddingVertical: S.sm, borderRadius: R.full, backgroundColor: theme.primary }} accessibilityRole="button">
            <Text style={{ color: '#fff', fontWeight: '800' }}>{tr ? 'Mod Seç' : 'Pick a Mode'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: S.lg, paddingBottom: 120, gap: S.lg }} showsVerticalScrollIndicator={false}>
          {/* İçgörü satırı */}
          {coachLine ? (
            <View style={[styles.coach, { backgroundColor: (nearest?.color ?? theme.primary) + '14', borderColor: (nearest?.color ?? theme.primary) + '33' }]}>
              <Text style={{ color: nearest?.color ?? theme.primary, fontSize: F.caption, fontWeight: '900', letterSpacing: 0.5, marginBottom: 4 }}>{tr ? '🧭 GENEL DURUM' : '🧭 OVERVIEW'}</Text>
              <Text style={{ color: theme.onSurface, fontSize: F.subhead, fontWeight: '700', lineHeight: 22 }}>{coachLine}</Text>
            </View>
          ) : null}

          {/* Özet ölçütleri */}
          <View style={{ flexDirection: 'row', gap: S.sm }}>
            <Stat icon={<Layers size={17} color="#6366F1" />} value={`${activeCount}`} label={tr ? 'Aktif mod' : 'Active modes'} color="#6366F1" />
            <Stat icon={<CalendarClock size={17} color="#FF9500" />} value={nearest ? `${nearest.days}${tr ? 'g' : 'd'}` : '∞'} label={tr ? 'En yakın hedef' : 'Nearest goal'} color="#FF9500" />
            <Stat icon={<Flame size={17} color="#34C759" />} value={totalHabits > 0 ? `%${overallPct}` : '—'} label={tr ? 'Hafta istikrar' : 'Week consistency'} color="#34C759" />
          </View>

          {/* Bugünkü plan genel */}
          {todayTotalAll > 0 && (
            <View style={[styles.section, { backgroundColor: isDark ? theme.surfaceContainer : theme.surfaceContainerLow, borderColor: theme.outlineVariant }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: S.sm }}>
                <Text style={{ color: theme.onSurface, fontWeight: '800', fontSize: F.body }}>{tr ? 'Bugünkü plan' : "Today's plan"}</Text>
                <Text style={{ color: theme.onSurfaceVariant, fontWeight: '700', fontSize: F.caption }}>{todayDoneAll}/{todayTotalAll}</Text>
              </View>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: theme.onSurfaceVariant + '20', overflow: 'hidden' }}>
                <View style={{ height: 8, borderRadius: 4, width: `${Math.round((todayDoneAll / todayTotalAll) * 100)}%`, backgroundColor: '#34C759' }} />
              </View>
            </View>
          )}

          {/* Mod kartları */}
          <View style={{ gap: S.sm }}>
            <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' }}>{tr ? 'Modlar' : 'Modes'}</Text>
            {computed.map((c, i) => (
              <MotiView
                key={c.key}
                from={{ opacity: 0, translateY: 8 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 300, delay: i * 60 }}
                style={[styles.modeRow, { backgroundColor: isDark ? theme.surfaceContainer : theme.surfaceContainerLow, borderColor: c.color + (isDark ? '33' : '22') }]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
                  <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: c.color + (isDark ? '26' : '18'), alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 20 }}>{c.emoji}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.body }} numberOfLines={1}>{c.label}</Text>
                    <Text style={{ color: c.days === -1 ? theme.error : c.color, fontSize: F.caption, fontWeight: '600', marginTop: 1 }}>
                      {c.days === null ? (tr ? 'Süresiz' : 'Open-ended') : c.days === -1 ? (tr ? 'Tarih geçti' : 'Date passed') : c.days === 0 ? (tr ? 'Bugün!' : 'Today!') : (tr ? `${c.days} gün kaldı` : `${c.days} days left`)}
                    </Text>
                  </View>
                  {c.todayTotal > 0 && (
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.caption }}>{c.todayDone}/{c.todayTotal}</Text>
                      <Text style={{ color: theme.onSurfaceVariant, fontSize: 10, fontWeight: '600' }}>{tr ? 'bugün' : 'today'}</Text>
                    </View>
                  )}
                </View>
                {/* haftalık alışkanlık istikrarı */}
                {c.habitCount > 0 && (
                  <View style={{ marginTop: S.sm }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ color: theme.onSurfaceVariant, fontSize: 11, fontWeight: '600' }}>{tr ? 'Bu hafta alışkanlık' : 'Habits this week'}</Text>
                      <Text style={{ color: c.color, fontSize: 11, fontWeight: '700' }}>{c.weekActive}/{c.habitCount} · %{c.pct}</Text>
                    </View>
                    <View style={{ height: 5, borderRadius: 3, backgroundColor: theme.onSurfaceVariant + '20', overflow: 'hidden' }}>
                      <View style={{ height: 5, borderRadius: 3, width: `${c.pct}%`, backgroundColor: c.color }} />
                    </View>
                  </View>
                )}
              </MotiView>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: S.md, paddingVertical: S.sm },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: S.xl },
  statCard: { flex: 1, borderRadius: R.lg, borderWidth: B.thin, padding: S.md, gap: 2 },
  section: { borderRadius: R.lg, borderWidth: B.thin, padding: S.md },
  coach: { borderRadius: R.lg, borderWidth: B.thin, padding: S.lg },
  modeRow: { borderRadius: R.lg, borderWidth: B.thin, padding: S.md },
});
