/**
 * TezCard — "Tez / Proje" dönemsel modu (modlar.tsx'ten çıkarıldı).
 * Veri kaynağı doğrudan `seasonal` (kalıcı) → local-mirror desync'i yok.
 * Sadece UI state'i (expand, date picker) lokal. Önizleme/apply akışı modlar'da
 * merkezi olduğundan `onOpenPreview` prop'u ile tetiklenir.
 */
import React, { useState } from 'react';
import { View, Text, Switch, TextInput, Platform, useWindowDimensions } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { ChevronRight, CalendarDays, GraduationCap, Calendar } from 'lucide-react-native';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { usePrefsStore } from '../../store/usePrefsStore';
import { useHabitStore, fmtDateKey } from '@/features/habits';
import { useTaskStore } from '@/features/tasks';
import { CustomAlert as Alert } from '@/shared/components/CustomAlert';
import { Touchable } from '@/shared/components/Touchable';
import { renderModeEmojiIcon } from '../../utils/modeIcons';
import { retirePlanTask, formatPlanDate, isDatePast, daysLeftOf } from '@/shared/utils/planTaskOps';
import { ICON, S, R, F, B } from '@/shared/constants/tokens';
import { Separator } from '@/shared/components/Separator';
import { AppIcon } from '@/shared/components/AppIcon';

const TEZ = '#8B5CF6';
const BASE_CALENDAR_WIDTH = 340;

export function TezCard({ onOpenPreview }: { onOpenPreview: () => void }) {
  const { theme, isDark } = useAppTheme();
  const { language } = useLanguageStore();
  const tr = language === 'tr';
  const { width } = useWindowDimensions();
  const calendarScale = (width - S.lg * 2 - S.md * 2) < BASE_CALENDAR_WIDTH ? (width - S.lg * 2 - S.md * 2) / BASE_CALENDAR_WIDTH : 1;

  const seasonal = usePrefsStore(s => s.seasonal);
  const setSeasonalPref = usePrefsStore(s => s.setSeasonalPref);
  const clearPlanIds = usePrefsStore(s => s.clearPlanIds);
  const tezPlanHabitIds = usePrefsStore(s => s.tezPlanHabitIds);
  const tezPlanTaskIds = usePrefsStore(s => s.tezPlanTaskIds);
  const habits = useHabitStore(s => s.habits);
  const removeHabit = useHabitStore(s => s.removeHabit);
  const tasks = useTaskStore(s => s.tasks);

  const [expanded, setExpanded] = useState(() => {
    const s = usePrefsStore.getState().seasonal;
    const comp = (s.tezName || '').trim() !== '' && (s.tezDate || '') !== '';
    if (!comp) return true;
    return !(usePrefsStore.getState().tezPlanHabitIds.length > 0 || usePrefsStore.getState().tezPlanTaskIds.length > 0);
  });
  const [showDatePicker, setShowDatePicker] = useState(false);

  const name = seasonal.tezName || '';
  const date = seasonal.tezDate || '';
  const isComplete = name.trim() !== '' && date !== '';
  const past = isDatePast(date);
  const daysLeft = daysLeftOf(date);
  const dateObj = date ? new Date(date) : new Date(Date.now() + 90 * 86400000);
  const accent = TEZ;

  // Bugünkü ilerleme (alışkanlık + bugün vadeli/tamamlanan plan görevi).
  const todayKey = fmtDateKey();
  const isToday = (d?: string | null) => !!d && !d.startsWith('0001') && fmtDateKey(new Date(d)) === todayKey;
  const planHabits = habits.filter(h => tezPlanHabitIds.includes(h.id));
  const wkTasks = tasks.filter(t => tezPlanTaskIds.includes(t.id) && (isToday(t.dueDate) || (t.isCompleted && isToday(t.completedAt))));
  const progTotal = planHabits.length + wkTasks.length;
  const progDone = planHabits.filter(h => (h.completedDates ?? []).includes(todayKey)).length + wkTasks.filter(t => t.isCompleted).length;
  const progPct = progTotal > 0 ? Math.round((progDone / progTotal) * 100) : 0;

  const hasPlan = tezPlanHabitIds.length > 0 || tezPlanTaskIds.length > 0;

  const closePlan = () => {
    tezPlanHabitIds.forEach(id => removeHabit(id));
    tezPlanTaskIds.forEach(id => retirePlanTask(id, 'tez'));
    clearPlanIds('tez');
    setSeasonalPref('tezMode', false);
    setSeasonalPref('tezName', '');
    setSeasonalPref('tezDate', null);
    setExpanded(false);
  };

  return (
    <View style={[styles_modeCard, { backgroundColor: isDark ? '#1C1C22' : theme.surfaceContainerLowest, borderColor: seasonal.tezMode && isComplete ? (past ? theme.error + '40' : accent + '35') : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)') }]}>
      <View style={{ paddingHorizontal: S.md, paddingTop: S.md, paddingBottom: seasonal.tezMode ? S.sm : S.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
          <AppIcon Icon={GraduationCap} color={seasonal.tezMode && isComplete ? (past ? theme.error : accent) : TEZ} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.onSurface, fontWeight: '500', fontSize: F.body }}>{tr ? 'Tez / Proje' : 'Thesis / Project'}</Text>
            {seasonal.tezMode && isComplete ? (
              <Text style={{ color: past ? theme.error : accent, fontSize: F.caption, fontWeight: '500', marginTop: S.xxs }}>{past ? (tr ? 'Teslim tarihi geçti' : 'Deadline passed') : (tr ? `${daysLeft} gün kaldı` : `${daysLeft} days left`)}</Text>
            ) : (
              <Text style={{ color: theme.onSurfaceMuted, fontSize: F.caption, marginTop: S.xxs }}>{tr ? 'Deadline odaklı akademik / proje planı' : 'Deadline-driven thesis or project plan'}</Text>
            )}
          </View>
          <Switch
            value={seasonal.tezMode}
            onValueChange={(v) => {
              Haptics.selectionAsync();
              if (!v && seasonal.tezMode) {
                if (!hasPlan) { closePlan(); return; }
                Alert.alert(tr ? 'Tez Modu Kapatılıyor' : 'Turning off Thesis Mode', tr ? 'Eklenen alışkanlıklar ve görevler kaldırılacak. Emin misin?' : 'Added habits and tasks will be removed. Are you sure?', [{ text: tr ? 'İptal' : 'Cancel', style: 'cancel' }, { text: tr ? 'Kapat ve Temizle' : 'Turn Off & Remove', style: 'destructive', onPress: closePlan }]);
              } else if (v) { setSeasonalPref('tezMode', true); setExpanded(true); }
            }}
            trackColor={{ false: isDark ? '#3A3A3C' : '#E5E5EA', true: (isComplete ? accent : TEZ) + '80' }}
            thumbColor={seasonal.tezMode ? (isComplete ? accent : TEZ) : (isDark ? '#636366' : '#fff')}
          />
        </View>
      </View>

      {seasonal.tezMode && (
        <View style={{ paddingHorizontal: S.md, paddingBottom: S.md, gap: S.sm }}>
          <Separator theme={theme} />
          {!isComplete && !expanded && (
            <Touchable onPress={() => { Haptics.selectionAsync(); setExpanded(true); }} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, borderWidth: B.thin, borderStyle: 'dashed', borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)', borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.md }} activeOpacity={0.7}>
              <AppIcon Icon={GraduationCap} color={theme.onSurfaceVariant} size={24} radius={R.sm} iconSize={ICON.sm} />
              <Text style={{ color: theme.onSurfaceVariant, fontWeight: '500', fontSize: F.body, flex: 1 }}>{tr ? 'Proje ekle' : 'Add project'}</Text>
              <ChevronRight size={ICON.sm} color={theme.onSurfaceVariant} opacity={0.4} />
            </Touchable>
          )}

          {isComplete && !expanded && (
            <View style={{ borderRadius: R.md, overflow: 'hidden', borderWidth: B.thin, borderColor: (past ? theme.error : accent) + '30', backgroundColor: (past ? theme.error : accent) + '08' }}>
              <View style={{ height: 3, backgroundColor: past ? theme.error : accent }} />
              <View style={{ padding: S.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, marginBottom: S.sm }}>
                  <AppIcon Icon={GraduationCap} color={accent} size={24} radius={R.sm} iconSize={ICON.sm} />
                  <Text style={{ color: theme.onSurface, fontWeight: '600', fontSize: F.body, flex: 1 }} numberOfLines={1}>{name}</Text>
                  <Touchable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onOpenPreview(); }} activeOpacity={0.7} style={{ backgroundColor: accent + (isDark ? '22' : '15'), paddingHorizontal: S.smd, paddingVertical: S.xs, borderRadius: R.full }}>
                    <Text style={{ color: accent, fontSize: F.caption, fontWeight: '700' }}>{hasPlan ? (tr ? 'İçgörü & Önizle ›' : 'Insight & Preview ›') : (tr ? 'Plan Oluştur ›' : 'Create Plan ›')}</Text>
                  </Touchable>
                  <View style={{ width: 1, height: 12, backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)', marginHorizontal: S.xs }} />
                  <Touchable onPress={() => { Haptics.selectionAsync(); setExpanded(true); }} activeOpacity={0.7}>
                    <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '600' }}>{tr ? 'Düzenle' : 'Edit'}</Text>
                  </Touchable>
                </View>
                {past ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
                    {<Calendar size={ICON.sm} color={theme.error} />}
                    <Text style={{ color: theme.error, fontWeight: '500' }}>{tr ? 'Teslim tarihi geçti' : 'Deadline passed'} · {formatPlanDate(date, tr)}</Text>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: S.lg }}>
                    <View style={{ alignItems: 'center', minWidth: 52 }}>
                      <Text style={{ color: accent, fontWeight: '600', fontSize: 40, lineHeight: 42, letterSpacing: -1 }}>{daysLeft}</Text>
                      <Text style={{ color: accent, fontSize: 10, fontWeight: '600', opacity: 0.7, letterSpacing: 1 }}>{tr ? 'GÜN' : 'DAYS'}</Text>
                    </View>
                    <View style={{ flex: 1, paddingTop: S.xxs }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs }}>
                        {<Calendar size={ICON.sm} color={theme.onSurfaceVariant} />}
                        <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption }}>{formatPlanDate(date, tr)}</Text>
                      </View>
                      {progTotal > 0 && (
                        <View style={{ marginTop: S.sm, gap: S.xs }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '600' }}>{tr ? 'Bugün' : 'Today'}</Text>
                            <Text style={{ color: accent, fontSize: F.caption, fontWeight: '600' }}>{progDone}/{progTotal} · {progPct}%</Text>
                          </View>
                          <View style={{ height: 5, borderRadius: R.xs, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                            <View style={{ height: 5, borderRadius: R.xs, backgroundColor: accent, width: `${progPct}%` as any }} />
                          </View>
                        </View>
                      )}
                    </View>
                  </View>
                )}
              </View>
            </View>
          )}

          {expanded && (
            <View style={{ gap: S.sm }}>
              <View style={[{ borderRadius: R.md, paddingHorizontal: S.md, height: 44, justifyContent: 'center', borderWidth: B.thin }, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]}>
                <TextInput value={name} onChangeText={(v) => setSeasonalPref('tezName', v)} placeholder={tr ? 'Proje adı (Yüksek Lisans Tezi...)' : "Project name (Master's Thesis...)"} placeholderTextColor={theme.onSurfaceVariant + '70'} style={{ color: theme.onSurface, fontSize: F.body, fontWeight: '600' }} returnKeyType="done" underlineColorAndroid="transparent" />
              </View>
              <Touchable onPress={() => { Haptics.selectionAsync(); setShowDatePicker(true); }} style={[{ borderRadius: R.md, paddingHorizontal: S.md, height: 44, justifyContent: 'center', borderWidth: B.thin, flexDirection: 'row', alignItems: 'center' }, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]} activeOpacity={0.7}>
                <Text style={{ color: date ? theme.onSurface : theme.onSurfaceVariant + '70', fontSize: F.body, fontWeight: '600', flex: 1 }}>{date ? formatPlanDate(date, tr) : (tr ? 'Teslim tarihi seç' : 'Select deadline')}</Text>
                <CalendarDays size={ICON.sm} color={theme.onSurfaceVariant} opacity={0.5} />
              </Touchable>
              {showDatePicker && (
                <View style={Platform.OS === 'ios' ? { width: BASE_CALENDAR_WIDTH * calendarScale, height: 320 * calendarScale, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginVertical: S.xs } : { alignSelf: 'center', marginVertical: S.xs }}>
                  <View style={Platform.OS === 'ios' ? { width: BASE_CALENDAR_WIDTH, height: 320, transform: [{ scale: calendarScale }], justifyContent: 'center', alignItems: 'center' } : undefined}>
                    <DateTimePicker
                      style={Platform.OS === 'ios' ? { width: 320, height: 320 } : undefined}
                      value={dateObj} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'}
                      themeVariant={isDark ? 'dark' : 'light'} locale={tr ? 'tr-TR' : 'en-GB'}
                      minimumDate={new Date()} maximumDate={(() => { const d = new Date(); d.setFullYear(d.getFullYear() + 3); return d; })()}
                      onChange={(event: DateTimePickerEvent, d?: Date) => {
                        if (Platform.OS === 'android') setShowDatePicker(false);
                        if (event.type === 'dismissed') { setShowDatePicker(false); return; }
                        if (d) { const iso = d.toISOString().split('T')[0]; setSeasonalPref('tezDate', iso); if (Platform.OS === 'ios') setShowDatePicker(false); }
                      }}
                    />
                  </View>
                </View>
              )}
              <Touchable onPress={() => { Haptics.selectionAsync(); setExpanded(false); }} style={{ alignSelf: 'flex-end', paddingHorizontal: S.md, paddingVertical: S.xs }} activeOpacity={0.7}>
                <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '600' }}>{tr ? 'Bitti' : 'Done'}</Text>
              </Touchable>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles_modeCard = { borderRadius: R.lg, borderWidth: B.thin, overflow: 'hidden' as const };
