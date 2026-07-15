/**
 * MulakatCard — "İş Mülakatı" dönemsel modu (3 slot). modlar.tsx'ten çıkarıldı.
 * Veri doğrudan `seasonal` store'dan (desync yok). Önizleme/apply merkezi → onOpenPreview.
 */
import React, { useState } from 'react';
import { View, Text, Switch, TextInput, Platform, useWindowDimensions } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { ChevronRight, CalendarDays, BookOpen, X } from 'lucide-react-native';
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

const ACCENT = '#10B981';
const BASE_CALENDAR_WIDTH = 340;
type Slot = 'mulakat' | 'mulakat2' | 'mulakat3';

function useCalScale() {
  const { width } = useWindowDimensions();
  const aw = width - S.lg * 2 - S.md * 2;
  return aw < BASE_CALENDAR_WIDTH ? aw / BASE_CALENDAR_WIDTH : 1;
}

function DatePickerInline({ value, onPick, onClose }: { value: Date; onPick: (iso: string) => void; onClose: () => void }) {
  const { isDark } = useAppTheme();
  const { language } = useLanguageStore();
  const calendarScale = useCalScale();
  return (
    <View style={Platform.OS === 'ios' ? { width: BASE_CALENDAR_WIDTH * calendarScale, height: 320 * calendarScale, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginVertical: S.xs } : { alignSelf: 'center', marginVertical: S.xs }}>
      <View style={Platform.OS === 'ios' ? { width: BASE_CALENDAR_WIDTH, height: 320, transform: [{ scale: calendarScale }], justifyContent: 'center', alignItems: 'center' } : undefined}>
        <DateTimePicker
          style={Platform.OS === 'ios' ? { width: 320, height: 320 } : undefined}
          value={value} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'}
          themeVariant={isDark ? 'dark' : 'light'} locale={language === 'tr' ? 'tr-TR' : 'en-GB'}
          minimumDate={new Date()} maximumDate={(() => { const d = new Date(); d.setMonth(d.getMonth() + 3); return d; })()}
          onChange={(event: DateTimePickerEvent, date?: Date) => {
            if (Platform.OS === 'android') onClose();
            if (event.type === 'dismissed') { onClose(); return; }
            if (date) { onPick(date.toISOString().split('T')[0]); if (Platform.OS === 'ios') onClose(); }
          }}
        />
      </View>
    </View>
  );
}

/** İkincil slot (mulakat2 / mulakat3): kompakt satır + düzenleme formu. */
function SecondarySlot({ slot, nameKey, dateKey, placeholder, onOpenPreview }: { slot: Slot; nameKey: 'mulakat2Name' | 'mulakat3Name'; dateKey: 'mulakat2Date' | 'mulakat3Date'; placeholder: string; onOpenPreview: (s: Slot) => void }) {
  const { theme, isDark } = useAppTheme();
  const { language } = useLanguageStore();
  const tr = language === 'tr';
  const seasonal = usePrefsStore(s => s.seasonal);
  const setSeasonalPref = usePrefsStore(s => s.setSeasonalPref);
  const clearPlanIds = usePrefsStore(s => s.clearPlanIds);
  const planHabitIds = usePrefsStore(s => (s as any)[`${slot}PlanHabitIds`]) as string[];
  const planTaskIds = usePrefsStore(s => (s as any)[`${slot}PlanTaskIds`]) as number[];
  const removeHabit = useHabitStore(s => s.removeHabit);
  const [expanded, setExpanded] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const name = (seasonal as any)[nameKey] || '';
  const date = (seasonal as any)[dateKey] || '';
  const complete = name.trim() !== '' && date !== '';
  const past = isDatePast(date);
  const daysLeft = daysLeftOf(date);
  const dateObj = date ? new Date(date) : new Date(Date.now() + 21 * 86400000);

  const del = () => {
    planHabitIds.forEach(id => removeHabit(id));
    planTaskIds.forEach(id => retirePlanTask(id, slot));
    clearPlanIds(slot);
    setSeasonalPref(nameKey, ''); setSeasonalPref(dateKey, null);
    setExpanded(false);
  };

  return (
    <View style={{ marginTop: S.xs }}>
      <Separator theme={theme} />
      {complete && !expanded ? (
        <Touchable onPress={() => { Haptics.selectionAsync(); setExpanded(true); }} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, backgroundColor: (past ? theme.error : ACCENT) + '10', borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.sm }} activeOpacity={0.8}>
          {renderModeEmojiIcon('💼', 14, ACCENT)}
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.onSurface, fontWeight: '500', fontSize: F.caption }}>{name}</Text>
            <Text style={{ color: past ? theme.error : ACCENT, fontSize: 11, fontWeight: '500' }}>{past ? (tr ? 'Tarih geçti' : 'Date passed') : (tr ? `${daysLeft} gün kaldı` : `${daysLeft} days left`)}</Text>
          </View>
          <Text style={{ color: ACCENT, fontSize: 11, fontWeight: '600' }}>{tr ? 'Düzenle ›' : 'Edit ›'}</Text>
          <Touchable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); Alert.alert(tr ? 'Mülakatı Sil' : 'Delete Interview', tr ? `"${name}" silinecek. Emin misin?` : `"${name}" will be deleted. Are you sure?`, [{ text: tr ? 'Vazgeç' : 'Cancel', style: 'cancel' }, { text: tr ? 'Sil' : 'Delete', style: 'destructive', onPress: del }]); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 4 }} accessibilityRole="button" accessibilityLabel={tr ? 'Sil' : 'Delete'}>
            <X size={ICON.xs} color={theme.onSurfaceVariant} strokeWidth={2.5} />
          </Touchable>
        </Touchable>
      ) : !complete && !expanded ? (
        <Touchable onPress={() => { Haptics.selectionAsync(); setExpanded(true); }} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, borderWidth: B.thin, borderStyle: 'dashed', borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)', borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.sm }} activeOpacity={0.7}>
          <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption }}>＋</Text>
          <Text style={{ color: theme.onSurfaceVariant, fontWeight: '600', fontSize: F.caption, flex: 1 }}>{slot === 'mulakat2' ? (tr ? 'İkinci mülakat ekle' : 'Add second interview') : (tr ? 'Üçüncü mülakat ekle' : 'Add third interview')}</Text>
        </Touchable>
      ) : null}
      {expanded && (
        <View style={{ gap: S.sm }}>
          <View style={[{ borderRadius: R.md, paddingHorizontal: S.md, height: 40, justifyContent: 'center', borderWidth: B.thin }, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]}>
            <TextInput value={name} onChangeText={(v) => setSeasonalPref(nameKey, v)} placeholder={placeholder} placeholderTextColor={theme.onSurfaceVariant + '70'} style={{ color: theme.onSurface, fontSize: F.caption, fontWeight: '600' }} returnKeyType="done" underlineColorAndroid="transparent" />
          </View>
          <Touchable hitSlop={{ top: 2, bottom: 2, left: 0, right: 0 }} onPress={() => { Haptics.selectionAsync(); setShowPicker(true); }} style={[{ borderRadius: R.md, paddingHorizontal: S.md, height: 40, justifyContent: 'center', borderWidth: B.thin, flexDirection: 'row', alignItems: 'center' }, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]} activeOpacity={0.7}>
            <Text style={{ color: date ? theme.onSurface : theme.onSurfaceVariant + '70', fontSize: F.caption, fontWeight: '600', flex: 1 }}>{date ? formatPlanDate(date, tr) : (tr ? 'Mülakat tarihi seç' : 'Select interview date')}</Text>
            <CalendarDays size={ICON.sm} color={theme.onSurfaceVariant} opacity={0.5} />
          </Touchable>
          {showPicker && <DatePickerInline value={dateObj} onPick={(iso) => setSeasonalPref(dateKey, iso)} onClose={() => setShowPicker(false)} />}
          <View style={{ flexDirection: 'row', gap: S.sm }}>
            <Touchable onPress={() => { if (name || date) del(); setExpanded(false); }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: R.full, paddingVertical: S.sm, borderWidth: B.thin, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)' }} activeOpacity={0.7}>
              <Text style={{ color: theme.onSurfaceVariant, fontWeight: '500', fontSize: F.caption }}>{tr ? 'Kapat' : 'Close'}</Text>
            </Touchable>
            {complete && (<Touchable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setExpanded(false); onOpenPreview(slot); }} style={{ flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, backgroundColor: ACCENT, borderRadius: R.full, paddingVertical: S.sm }} activeOpacity={0.8}><BookOpen size={ICON.xs} color="#fff" /><Text style={{ color: '#fff', fontWeight: '600', fontSize: F.caption }}>{tr ? 'Planı Önizle & Uygula' : 'Preview & Apply Plan'}</Text></Touchable>)}
          </View>
        </View>
      )}
    </View>
  );
}

export function MulakatCard({ onOpenPreview }: { onOpenPreview: (slot: Slot) => void }) {
  const { theme, isDark } = useAppTheme();
  const { language } = useLanguageStore();
  const tr = language === 'tr';

  const seasonal = usePrefsStore(s => s.seasonal);
  const setSeasonalPref = usePrefsStore(s => s.setSeasonalPref);
  const clearPlanIds = usePrefsStore(s => s.clearPlanIds);
  const planHabitIds = usePrefsStore(s => s.mulakatPlanHabitIds);
  const planTaskIds = usePrefsStore(s => s.mulakatPlanTaskIds);
  const habits = useHabitStore(s => s.habits);
  const removeHabit = useHabitStore(s => s.removeHabit);
  const tasks = useTaskStore(s => s.tasks);

  const [expanded, setExpanded] = useState(() => {
    const s = usePrefsStore.getState().seasonal;
    const comp = (s.mulakatName || '').trim() !== '' && (s.mulakatDate || '') !== '';
    if (!comp) return true;
    return !(usePrefsStore.getState().mulakatPlanHabitIds.length > 0 || usePrefsStore.getState().mulakatPlanTaskIds.length > 0);
  });
  const [showPicker, setShowPicker] = useState(false);

  const name = seasonal.mulakatName || '';
  const date = seasonal.mulakatDate || '';
  const isComplete = name.trim() !== '' && date !== '';
  const past = isDatePast(date);
  const daysLeft = daysLeftOf(date);
  const dateObj = date ? new Date(date) : new Date(Date.now() + 21 * 86400000);
  const hasPlan = planHabitIds.length > 0 || planTaskIds.length > 0;

  const todayKey = fmtDateKey();
  const isToday = (d?: string | null) => !!d && !d.startsWith('0001') && fmtDateKey(new Date(d)) === todayKey;
  const planHabits = habits.filter(h => planHabitIds.includes(h.id));
  const wkTasks = tasks.filter(t => planTaskIds.includes(t.id) && (isToday(t.dueDate) || (t.isCompleted && isToday(t.completedAt))));
  const progTotal = planHabits.length + wkTasks.length;
  const progDone = planHabits.filter(h => (h.completedDates ?? []).includes(todayKey)).length + wkTasks.filter(t => t.isCompleted).length;
  const progPct = progTotal > 0 ? Math.round((progDone / progTotal) * 100) : 0;

  const mulakat2Complete = (seasonal.mulakat2Name || '').trim() !== '' && !!seasonal.mulakat2Date;

  const closePlan = () => {
    planHabitIds.forEach(id => removeHabit(id));
    planTaskIds.forEach(id => retirePlanTask(id, 'mulakat'));
    clearPlanIds('mulakat');
    setSeasonalPref('mulakatMode', false); setSeasonalPref('mulakatName', ''); setSeasonalPref('mulakatDate', null);
    setExpanded(false);
  };

  return (
    <View style={{ borderRadius: R.lg, borderWidth: B.thin, overflow: 'hidden', backgroundColor: isDark ? '#1C1C22' : theme.surfaceContainerLowest, borderColor: seasonal.mulakatMode && isComplete ? (past ? theme.error + '40' : ACCENT + '35') : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)') }}>
      <View style={{ paddingHorizontal: S.md, paddingTop: S.md, paddingBottom: seasonal.mulakatMode ? S.sm : S.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
          <View style={{ width: 34, height: 34, borderRadius: R.sm, backgroundColor: (seasonal.mulakatMode && isComplete ? (past ? theme.error : ACCENT) : ACCENT) + '18', alignItems: 'center', justifyContent: 'center' }}>
            {renderModeEmojiIcon('💼', 18, seasonal.mulakatMode && isComplete ? (past ? theme.error : ACCENT) : ACCENT)}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.onSurface, fontWeight: '500', fontSize: F.body }}>{tr ? 'İş Mülakatı' : 'Job Interview'}</Text>
            {seasonal.mulakatMode && isComplete ? (
              <Text style={{ color: past ? theme.error : ACCENT, fontSize: F.caption, fontWeight: '500', marginTop: S.xxs }}>{past ? (tr ? 'Mülakat tarihi geçti' : 'Interview passed') : (tr ? `${daysLeft} gün kaldı` : `${daysLeft} days left`)}</Text>
            ) : (
              <Text style={{ color: theme.onSurfaceMuted, fontSize: F.caption, marginTop: S.xxs }}>{tr ? 'Mülakat tarihine kadar hazırlık planı' : 'Prep plan until your interview date'}</Text>
            )}
          </View>
          <Switch
            value={seasonal.mulakatMode}
            onValueChange={(v) => {
              Haptics.selectionAsync();
              if (!v && seasonal.mulakatMode) {
                if (!hasPlan) { closePlan(); return; }
                Alert.alert(tr ? 'Mülakat Modu Kapatılıyor' : 'Turning off Interview Mode', tr ? 'Eklenen alışkanlıklar ve görevler kaldırılacak. Emin misin?' : 'Added habits and tasks will be removed. Are you sure?', [{ text: tr ? 'İptal' : 'Cancel', style: 'cancel' }, { text: tr ? 'Kapat ve Temizle' : 'Turn Off & Remove', style: 'destructive', onPress: closePlan }]);
              } else if (v) { setSeasonalPref('mulakatMode', true); setExpanded(true); }
            }}
            trackColor={{ false: isDark ? '#3A3A3C' : '#E5E5EA', true: ACCENT + '80' }}
            thumbColor={seasonal.mulakatMode ? ACCENT : (isDark ? '#636366' : '#fff')}
          />
        </View>
      </View>

      {seasonal.mulakatMode && (
        <View style={{ paddingHorizontal: S.md, paddingBottom: S.md, gap: S.sm }}>
          <Separator theme={theme} />
          {!isComplete && !expanded && (
            <Touchable onPress={() => { Haptics.selectionAsync(); setExpanded(true); }} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, borderWidth: B.thin, borderStyle: 'dashed', borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)', borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.md }} activeOpacity={0.7}>
              {renderModeEmojiIcon('💼', 16, theme.onSurfaceVariant)}
              <Text style={{ color: theme.onSurfaceVariant, fontWeight: '500', fontSize: F.body, flex: 1 }}>{tr ? 'Mülakat ekle' : 'Add interview'}</Text>
              <ChevronRight size={ICON.sm} color={theme.onSurfaceVariant} opacity={0.4} />
            </Touchable>
          )}

          {isComplete && !expanded && (
            <View style={{ gap: S.sm }}>
              <View style={{ borderRadius: R.md, overflow: 'hidden', borderWidth: B.thin, borderColor: (past ? theme.error : ACCENT) + '30', backgroundColor: (past ? theme.error : ACCENT) + '08' }}>
                <View style={{ height: 3, backgroundColor: past ? theme.error : ACCENT }} />
                <View style={{ padding: S.md }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, marginBottom: S.sm }}>
                    {renderModeEmojiIcon('💼', 16, ACCENT)}
                    <Text style={{ color: theme.onSurface, fontWeight: '600', fontSize: F.body, flex: 1 }} numberOfLines={1}>{name}</Text>
                    <Touchable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onOpenPreview('mulakat'); }} activeOpacity={0.7} style={{ backgroundColor: ACCENT + (isDark ? '22' : '15'), paddingHorizontal: S.smd, paddingVertical: S.xs, borderRadius: R.full }}>
                      <Text style={{ color: ACCENT, fontSize: F.caption, fontWeight: '700' }}>{hasPlan ? (tr ? 'İçgörü & Önizle ›' : 'Insight & Preview ›') : (tr ? 'Plan Oluştur ›' : 'Create Plan ›')}</Text>
                    </Touchable>
                    <View style={{ width: 1, height: 12, backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)', marginHorizontal: S.xs }} />
                    <Touchable onPress={() => { Haptics.selectionAsync(); setExpanded(true); }} activeOpacity={0.7}>
                      <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '600' }}>{tr ? 'Düzenle' : 'Edit'}</Text>
                    </Touchable>
                  </View>
                  {past ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
                      {renderModeEmojiIcon('📅', 14, theme.error)}
                      <Text style={{ color: theme.error, fontWeight: '500' }}>{tr ? 'Mülakat tarihi geçti' : 'Interview date passed'} · {formatPlanDate(date, tr)}</Text>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: S.lg }}>
                      <View style={{ alignItems: 'center', minWidth: 52 }}>
                        <Text style={{ color: ACCENT, fontWeight: '600', fontSize: 40, lineHeight: 42, letterSpacing: -1 }}>{daysLeft}</Text>
                        <Text style={{ color: ACCENT, fontSize: 10, fontWeight: '600', opacity: 0.7, letterSpacing: 1 }}>{tr ? 'GÜN' : 'DAYS'}</Text>
                      </View>
                      <View style={{ flex: 1, paddingTop: S.xxs }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs }}>
                          {renderModeEmojiIcon('📅', 13, theme.onSurfaceVariant)}
                          <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption }}>{formatPlanDate(date, tr)}</Text>
                        </View>
                        {progTotal > 0 && (
                          <View style={{ marginTop: S.sm, gap: S.xs }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                              <Text style={{ color: theme.onSurfaceVariant, fontSize: 11, fontWeight: '600' }}>{tr ? 'Bugün' : 'Today'}</Text>
                              <Text style={{ color: ACCENT, fontSize: 11, fontWeight: '600' }}>{progDone}/{progTotal} · {progPct}%</Text>
                            </View>
                            <View style={{ height: 5, borderRadius: R.xs, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                              <View style={{ height: 5, borderRadius: R.xs, backgroundColor: ACCENT, width: `${progPct}%` as any }} />
                            </View>
                          </View>
                        )}
                      </View>
                    </View>
                  )}
                </View>
              </View>

              <SecondarySlot slot="mulakat2" nameKey="mulakat2Name" dateKey="mulakat2Date" placeholder={tr ? 'Şirket / Pozisyon (Apple - iOS Dev...)' : 'Company / Role (Apple - iOS Dev...)'} onOpenPreview={onOpenPreview} />
              {mulakat2Complete && (
                <SecondarySlot slot="mulakat3" nameKey="mulakat3Name" dateKey="mulakat3Date" placeholder={tr ? 'Şirket / Pozisyon (Meta - PM...)' : 'Company / Role (Meta - PM...)'} onOpenPreview={onOpenPreview} />
              )}
            </View>
          )}

          {expanded && (
            <View style={{ gap: S.sm }}>
              <View style={[{ borderRadius: R.md, paddingHorizontal: S.md, height: 44, justifyContent: 'center', borderWidth: B.thin }, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]}>
                <TextInput value={name} onChangeText={(v) => setSeasonalPref('mulakatName', v)} placeholder={tr ? 'Şirket / Pozisyon (Google - SWE...)' : 'Company / Role (Google - SWE...)'} placeholderTextColor={theme.onSurfaceVariant + '70'} style={{ color: theme.onSurface, fontSize: F.body, fontWeight: '600' }} returnKeyType="done" underlineColorAndroid="transparent" />
              </View>
              <Touchable onPress={() => { Haptics.selectionAsync(); setShowPicker(true); }} style={[{ borderRadius: R.md, paddingHorizontal: S.md, height: 44, justifyContent: 'center', borderWidth: B.thin, flexDirection: 'row', alignItems: 'center' }, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]} activeOpacity={0.7}>
                <Text style={{ color: date ? theme.onSurface : theme.onSurfaceVariant + '70', fontSize: F.body, fontWeight: '600', flex: 1 }}>{date ? formatPlanDate(date, tr) : (tr ? 'Mülakat tarihi seç' : 'Select interview date')}</Text>
                <CalendarDays size={ICON.sm} color={theme.onSurfaceVariant} opacity={0.5} />
              </Touchable>
              {showPicker && <DatePickerInline value={dateObj} onPick={(iso) => setSeasonalPref('mulakatDate', iso)} onClose={() => setShowPicker(false)} />}
              <View style={{ flexDirection: 'row', gap: S.sm }}>
                <Touchable onPress={() => setExpanded(false)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: R.full, paddingVertical: S.sm + 2, borderWidth: B.thin, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)' }} activeOpacity={0.7}>
                  <Text style={{ color: theme.onSurfaceVariant, fontWeight: '500', fontSize: F.caption }}>{tr ? 'Kapat' : 'Close'}</Text>
                </Touchable>
                {isComplete && (<Touchable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setExpanded(false); onOpenPreview('mulakat'); }} style={{ flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, backgroundColor: ACCENT, borderRadius: R.full, paddingVertical: S.sm + 2 }} activeOpacity={0.8}><BookOpen size={ICON.sm} color="#fff" /><Text style={{ color: '#fff', fontWeight: '600', fontSize: F.caption }}>{tr ? 'Planı Önizle & Uygula' : 'Preview & Apply Plan'}</Text></Touchable>)}
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
