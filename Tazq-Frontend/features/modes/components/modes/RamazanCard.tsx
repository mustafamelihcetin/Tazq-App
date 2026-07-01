/**
 * RamazanCard — "Ramazan Modu" (modlar.tsx'ten çıkarıldı). Takvim-tetiklemeli:
 * yalnız Ramazan'a 7 günden az kala / aktifken / kullanıcı açıkken görünür.
 * Veri doğrudan store/util'lerden; önizleme merkezi → onOpenPreview.
 */
import React from 'react';
import { View, Text, Switch } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ChevronRight } from 'lucide-react-native';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { usePrefsStore } from '../../store/usePrefsStore';
import { useHabitStore, fmtDateKey } from '@/features/habits';
import { useTaskStore } from '@/features/tasks';
import { CustomAlert as Alert } from '@/shared/components/CustomAlert';
import { Touchable } from '@/shared/components/Touchable';
import { renderModeEmojiIcon } from '../../utils/modeIcons';
import { retirePlanTask } from '@/shared/utils/planTaskOps';
import { getCurrentRamadanStatus, formatRamadanDate } from '@/shared/utils/ramadanDates';
import { RAMAZAN_HABIT_NAMES } from '../../utils/turkishModes';
import { scheduleRamadanStartNotification, cancelRamadanStartNotification } from '@/shared/utils/notifications';
import { S, R, F, B } from '@/shared/constants/tokens';

export function RamazanCard({ onOpenPreview }: { onOpenPreview: () => void }) {
  const { theme, isDark } = useAppTheme();
  const { language } = useLanguageStore();
  const tr = language === 'tr';
  const accent = isDark ? '#A5B4FC' : '#6366F1';

  const seasonal = usePrefsStore(s => s.seasonal);
  const setSeasonalPref = usePrefsStore(s => s.setSeasonalPref);
  const clearPlanIds = usePrefsStore(s => s.clearPlanIds);
  const ramazanPlanHabitIds = usePrefsStore(s => s.ramazanPlanHabitIds);
  const ramazanPlanTaskIds = usePrefsStore(s => s.ramazanPlanTaskIds);
  const habits = useHabitStore(s => s.habits);
  const removeHabit = useHabitStore(s => s.removeHabit);
  const tasks = useTaskStore(s => s.tasks);

  const ramadanStatus = React.useMemo(() => getCurrentRamadanStatus(), []);

  // Görünürlük: takvim-tetiklemeli.
  if (!(seasonal.ramazan || ramadanStatus.daysUntilStart <= 7 || ramadanStatus.isActive)) return null;

  // Bugünkü ilerleme.
  const todayKey = fmtDateKey();
  const isToday = (d?: string | null) => !!d && !d.startsWith('0001') && fmtDateKey(new Date(d)) === todayKey;
  const planHabits = habits.filter(h => ramazanPlanHabitIds.includes(h.id));
  const wkTasks = tasks.filter(t => ramazanPlanTaskIds.includes(t.id) && (isToday(t.dueDate) || (t.isCompleted && isToday(t.completedAt))));
  const progTotal = planHabits.length + wkTasks.length;
  const progDone = planHabits.filter(h => (h.completedDates ?? []).includes(todayKey)).length + wkTasks.filter(t => t.isCompleted).length;
  const progPct = progTotal > 0 ? Math.round((progDone / progTotal) * 100) : 0;

  const closePlan = () => {
    ramazanPlanHabitIds.forEach(id => removeHabit(id));
    habits.filter(h => RAMAZAN_HABIT_NAMES.some(n => n.toLowerCase() === h.name.toLowerCase())).forEach(h => removeHabit(h.id));
    ramazanPlanTaskIds.forEach(id => retirePlanTask(id, 'ramazan'));
    clearPlanIds('ramazan');
    setSeasonalPref('ramazan', false);
    cancelRamadanStartNotification();
  };

  return (
    <View style={{ borderRadius: R.lg, borderWidth: B.thin, overflow: 'hidden', backgroundColor: isDark ? '#1C1C22' : theme.surfaceContainerLowest, borderColor: seasonal.ramazan ? (isDark ? 'rgba(99,102,241,0.30)' : 'rgba(99,102,241,0.20)') : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)') }}>
      <View style={{ paddingHorizontal: S.md, paddingTop: S.md, paddingBottom: seasonal.ramazan ? S.sm : S.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
          <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: seasonal.ramazan ? '#6366F122' : '#6366F115', alignItems: 'center', justifyContent: 'center' }}>
            {renderModeEmojiIcon('🌙', 18, seasonal.ramazan ? '#6366F1' : '#6366F1aa')}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.onSurface, fontWeight: '500', fontSize: F.body }}>{tr ? 'Ramazan Modu' : 'Ramadan Mode'}</Text>
            <Text style={{ fontSize: F.caption, fontWeight: '500', marginTop: 1, color: ramadanStatus.isActive ? accent : seasonal.ramazan && ramadanStatus.period ? accent : theme.onSurfaceVariant, opacity: ramadanStatus.isActive ? 0.9 : seasonal.ramazan && ramadanStatus.period ? 0.75 : 0.55 }}>
              {ramadanStatus.isActive && ramadanStatus.period
                ? (tr
                    ? `🌙 ${formatRamadanDate(ramadanStatus.period.start, 'tr')} – ${formatRamadanDate(ramadanStatus.period.end, 'tr')} · ${ramadanStatus.daysRemaining} gün kaldı`
                    : `🌙 ${formatRamadanDate(ramadanStatus.period.start, 'en')} – ${formatRamadanDate(ramadanStatus.period.end, 'en')} · ${ramadanStatus.daysRemaining} days left`)
                : seasonal.ramazan && ramadanStatus.period
                ? (tr
                    ? `${formatRamadanDate(ramadanStatus.period.start, 'tr', ramadanStatus.period.year !== new Date().getFullYear())} · ${ramadanStatus.daysUntilStart} gün`
                    : `${formatRamadanDate(ramadanStatus.period.start, 'en', ramadanStatus.period.year !== new Date().getFullYear())} · ${ramadanStatus.daysUntilStart} days`)
                : (tr ? 'Oruç dönemine özel alışkanlık ve görevler' : 'Habits & tasks tailored for the fasting month')}
            </Text>
          </View>
          <Switch
            value={seasonal.ramazan}
            onValueChange={(v) => {
              Haptics.selectionAsync();
              if (!v && seasonal.ramazan) {
                const hasItems = ramazanPlanHabitIds.length > 0 || ramazanPlanTaskIds.length > 0;
                if (!hasItems) { closePlan(); return; }
                Alert.alert(tr ? 'Ramazan Modu Kapatılıyor' : 'Turning off Ramadan Mode', tr ? 'Eklenen tüm alışkanlıklar ve görevler kaldırılacak. Emin misin?' : 'All added habits and tasks will be removed. Are you sure?', [{ text: tr ? 'İptal' : 'Cancel', style: 'cancel' }, { text: tr ? 'Kapat ve Temizle' : 'Turn Off & Remove', style: 'destructive', onPress: closePlan }]);
              } else {
                setSeasonalPref('ramazan', v);
                if (v) {
                  onOpenPreview();
                  if (ramadanStatus.period && !ramadanStatus.isActive) scheduleRamadanStartNotification(ramadanStatus.period.start, language);
                }
              }
            }}
            trackColor={{ false: isDark ? '#3A3A3C' : '#E5E5EA', true: '#6366F180' }}
            thumbColor={seasonal.ramazan ? '#6366F1' : (isDark ? '#636366' : '#fff')}
          />
        </View>
      </View>
      {seasonal.ramazan && (
        <View style={{ paddingHorizontal: S.md, paddingBottom: S.md }}>
          <View style={{ height: 1, backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.10)', marginBottom: S.md }} />
          {!ramadanStatus.isActive && ramadanStatus.period ? (
            <Touchable onPress={onOpenPreview} style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs }} activeOpacity={0.7}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: accent }} />
              <Text style={{ color: accent, fontSize: F.caption, fontWeight: '600', flex: 1 }}>{tr ? 'Planı şimdiden hazırla' : 'Set up your plan in advance'}</Text>
              <ChevronRight size={12} color={accent} />
            </Touchable>
          ) : progTotal > 0 ? (
            <View style={{ gap: S.sm }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '600' }}>{tr ? 'Bugün' : 'Today'}</Text>
                <Text style={{ color: accent, fontSize: F.caption, fontWeight: '600' }}>{progDone}/{progTotal} · {progPct}%</Text>
              </View>
              <View style={{ height: 5, borderRadius: 3, backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.10)', overflow: 'hidden' }}>
                <View style={{ height: 5, borderRadius: 3, backgroundColor: accent, width: `${progPct}%` as any }} />
              </View>
            </View>
          ) : (
            <Touchable onPress={onOpenPreview} style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs }} activeOpacity={0.7}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: accent }} />
              <Text style={{ color: accent, fontSize: F.caption, fontWeight: '500', flex: 1 }}>{tr ? 'Plan henüz oluşturulmadı — Oluştur' : 'No plan yet — Create one'}</Text>
              <ChevronRight size={12} color={accent} />
            </Touchable>
          )}
        </View>
      )}
    </View>
  );
}
