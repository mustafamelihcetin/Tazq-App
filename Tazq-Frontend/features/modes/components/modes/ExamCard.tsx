/**
 * ExamCard — "Sınav Takibi" modu (3 slot, preset/öneri/akıllı-varsayılan/review).
 * modlar.tsx'ten çıkarıldı. Veri doğrudan `seasonal`; preset/öneri/saat seçimi lokal UI state.
 * Tarih geçince "nasıl geçti?" review'ı bu bileşende (focus-effect). Önizleme merkezi → onOpenPreview.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Switch, TextInput, Platform, useWindowDimensions } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useFocusEffect } from 'expo-router';
import { ChevronRight, CalendarDays, BookOpen, X, Sprout, TrendingUp, Flame, Sparkles, Target, Calendar } from 'lucide-react-native';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { usePrefsStore } from '../../store/usePrefsStore';
import { useHabitStore, fmtDateKey } from '@/features/habits';
import { useTaskStore } from '@/features/tasks';
import { useToastStore } from '@/shared/store/useToastStore';
import { CustomAlert as Alert } from '@/shared/components/CustomAlert';
import { Touchable } from '@/shared/components/Touchable';
import { renderModeEmojiIcon } from '../../utils/modeIcons';
import { retirePlanTask, formatPlanDate, isDatePast, daysLeftOf , retireModeTasksByTag} from '@/features/modes/utils/planTaskOps';
import { cancelExamCountdownNotifs } from '@/shared/utils/notifications';
import { matchExamName, detectExamFromInput, HOURS_OPTIONS, type ExamPreset } from '@/shared/utils/examPresets';
import { isSeasonalExamActive } from '../../utils/turkishModes';
import { ICON, S, R, F, B, HAIRLINE } from '@/shared/constants/tokens';
import { Separator } from '@/shared/components/Separator';
import { AppIcon } from '@/shared/components/AppIcon';
import { useModeAccent } from '@/shared/hooks/useModeAccent';
import { ProgressRail } from '@/shared/components/ProgressRail';
import { haptic } from '@/shared/utils/haptics';
import { closeModeWithUndo } from '@/features/modes/utils/modeUndo';
import { toDateKey, parseDateKey } from '@/shared/utils/dateKey';

// Vurgu merkezi paletten (bkz. Colors.ModeAccents) — tema-duyarlı + kontrast güvenli.
const BASE_CALENDAR_WIDTH = 340;
type Slot = 'exam' | 'exam2' | 'exam3';
type PreviewPayload = { templateId?: string; examSlot: Slot; examTipTr?: string; examTipEn?: string; examName: string; examDate: string };

function levelTemplateIdFromMinutes(min?: number): string {
  const m = min ?? 90;
  if (m <= 60) return 'level-temel';
  if (m <= 120) return 'level-orta';
  return 'level-ileri';
}

function useCalScale() {
  const { width } = useWindowDimensions();
  const aw = width - S.lg * 2 - S.md * 2;
  return aw < BASE_CALENDAR_WIDTH ? aw / BASE_CALENDAR_WIDTH : 1;
}

function ExamDatePicker({ value, onPick, onClose }: { value: Date; onPick: (iso: string) => void; onClose: () => void }) {
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
          minimumDate={new Date()} maximumDate={(() => { const d = new Date(); d.setMonth(d.getMonth() + 18); return d; })()}
          onChange={(event: DateTimePickerEvent, date?: Date) => {
            if (Platform.OS === 'android') onClose();
            if (event.type === 'dismissed') { onClose(); return; }
            if (date) { onPick(toDateKey(date)); }
          }}
        />
      </View>
    </View>
  );
}

/** Preset adı + öneri dropdown + saat seçici (slot içi). */
function PresetEditor({ name, onName, preset, onPreset, suggestions, onSuggestions, dailyMinutes, onDailyMinutes, placeholder, withLevelLabels }: {
  name: string; onName: (v: string) => void; preset: ExamPreset | null; onPreset: (p: ExamPreset | null) => void;
  suggestions: ExamPreset[]; onSuggestions: (s: ExamPreset[]) => void; dailyMinutes: number | null; onDailyMinutes: (m: number | null) => void;
  placeholder: string; withLevelLabels?: boolean;
}) {
  const { accent: ACCENT, accentText: ACCENT_TX } = useModeAccent('exam');
  const { theme, isDark } = useAppTheme();
  const { language } = useLanguageStore();
  const tr = language === 'tr';
  return (
    <>
      <View style={[{ borderRadius: R.md, paddingHorizontal: S.md, height: 44, justifyContent: 'center', borderWidth: B.thin }, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]}>
        <TextInput
          value={name}
          onChangeText={(v) => {
            onName(v);
            if (!v.trim()) { onSuggestions([]); onPreset(null); onDailyMinutes(null); return; }
            const d = detectExamFromInput(v);
            if (d) {
              onPreset(d);
              onSuggestions([]);
            } else {
              const trimmed = v.trim();
              const customPreset: ExamPreset = {
                id: 'custom-' + encodeURIComponent(trimmed),
                displayName: trimmed,
                shortName: trimmed,
                aliases: [trimmed.toLowerCase()],
                category: 'other',
                defaultDailyMinutes: 90,
                preferredTemplates: ['active-recall', 'spaced-repetition', 'deep-work', 'sprint'],
                tipTr: 'Özel çalışma planı — kendi hızında, düzenli konu tekrarları ve soru çözümü.',
                tipEn: 'Custom study plan — self-paced, regular concept review and practice.',
              };
              onPreset(customPreset);
              onSuggestions(matchExamName(v));
            }
          }}
          placeholder={placeholder} placeholderTextColor={theme.onSurfaceVariant + '70'}
          style={{ color: theme.onSurface, fontSize: F.body, fontWeight: '600' }} returnKeyType="done" underlineColorAndroid="transparent" maxLength={60}
          onSubmitEditing={() => { if (suggestions.length > 0) { const top = suggestions[0]; onName(top.shortName); onPreset(top); onSuggestions([]); } }}
        />
      </View>
      {(suggestions.length > 0 || (name.trim().length > 0 && !preset)) && (
        <View style={{ borderRadius: R.md, borderWidth: B.thin, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.09)', backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surface, overflow: 'hidden', marginTop: -S.xs }}>
          {suggestions.map((p, idx) => (
            <Touchable key={p.id} onPress={() => { haptic.select(); onName(p.shortName); onPreset(p); onSuggestions([]); }} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, paddingVertical: S.smd, borderBottomWidth: HAIRLINE, borderBottomColor: theme.separator }} activeOpacity={0.7}>
              <Text style={{ fontSize: F.body, fontWeight: '500', color: theme.onSurface, minWidth: 44 }}>{p.shortName}</Text>
              <Text style={{ fontSize: F.caption, color: theme.onSurfaceVariant, flex: 1 }} numberOfLines={1}>{p.displayName}</Text>
            </Touchable>
          ))}
          {name.trim().length > 0 && !preset && (
            <Touchable onPress={() => {
              haptic.select();
              const trimmed = name.trim();
              const customPreset: ExamPreset = {
                id: 'custom-' + encodeURIComponent(trimmed),
                displayName: trimmed,
                shortName: trimmed,
                aliases: [trimmed.toLowerCase()],
                category: 'other',
                defaultDailyMinutes: 90,
                preferredTemplates: ['active-recall', 'spaced-repetition', 'deep-work', 'sprint'],
                tipTr: 'Özel çalışma planı — kendi hızında, düzenli konu tekrarları ve soru çözümü.',
                tipEn: 'Custom study plan — self-paced, regular concept review and practice.',
              };
              onName(trimmed);
              onPreset(customPreset);
              onSuggestions([]);
            }} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, paddingVertical: S.smd }} activeOpacity={0.7}>
              <Sparkles size={ICON.xs} color={ACCENT} style={{ marginRight: S.sm }} />
              <Text style={{ fontSize: F.body, fontWeight: '600', color: ACCENT, flex: 1 }}>
                {tr ? `+ Yeni Ekle: "${name}"` : `+ Add Custom: "${name}"`}
              </Text>
            </Touchable>
          )}
        </View>
      )}
    </>
  );
}

function HoursSelector({ preset, dailyMinutes, onPick, withLevelLabels }: { preset: ExamPreset; dailyMinutes: number | null; onPick: (m: number | null) => void; withLevelLabels?: boolean }) {
  const { accent: ACCENT, accentText: ACCENT_TX } = useModeAccent('exam');
  const { theme, isDark } = useAppTheme();
  const { language } = useLanguageStore();
  const tr = language === 'tr';
  return (
    <View style={{ gap: S.sm }}>
      <Text style={{ fontSize: F.caption, fontWeight: '600', color: theme.onSurfaceVariant }}>{tr ? 'Günlük kaç saat çalışabilirsin?' : 'How many hours can you study daily?'}</Text>
      <View style={{ flexDirection: 'row', gap: S.xs, flexWrap: 'wrap' }}>
        {HOURS_OPTIONS.map((opt) => {
          const active = dailyMinutes === opt.minutes;
          const levelObj = opt.minutes <= 60 ? { text: tr ? 'Temel' : 'Foundation', icon: <Sprout size={ICON.xs} color={ACCENT} /> } : opt.minutes <= 120 ? { text: tr ? 'Standart' : 'Standard', icon: <TrendingUp size={ICON.xs} color={ACCENT} /> } : { text: tr ? 'Yoğun' : 'Intensive', icon: <Flame size={ICON.xs} color={ACCENT} /> };
          return (
            <Touchable key={opt.minutes} onPress={() => { haptic.select(); onPick(active ? null : opt.minutes); }} style={{ paddingHorizontal: S.sm + 2, paddingVertical: S.sm, borderRadius: withLevelLabels ? R.md : R.full, borderWidth: B.medium, borderColor: active ? ACCENT : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'), backgroundColor: active ? ACCENT + '18' : 'transparent' }} activeOpacity={0.7}>
              <Text style={{ fontSize: F.caption, fontWeight: '500', color: active ? ACCENT : theme.onSurfaceVariant }}>{tr ? opt.labelTr : opt.labelEn}</Text>
              {withLevelLabels && active && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, marginTop: S.xxs }}>
                  {levelObj.icon}
                  <Text style={{ fontSize: 10, fontWeight: '600', color: ACCENT, opacity: 0.8 }}>{levelObj.text}</Text>
                </View>
              )}
            </Touchable>
          );
        })}
      </View>
      {preset.tipTr && (<Text style={{ fontSize: F.caption, color: theme.onSurfaceMuted, lineHeight: 15 }}>{tr ? preset.tipTr : preset.tipEn}</Text>)}
    </View>
  );
}

/** İkincil sınav (exam2 / exam3). */
function ExamSlot({ slot, nameKey, dateKey, placeholder, addLabel, onOpenPreview }: { slot: Slot; nameKey: 'exam2Name' | 'exam3Name'; dateKey: 'exam2Date' | 'exam3Date'; placeholder: string; addLabel: string; onOpenPreview: (p: PreviewPayload) => void }) {
  const { accent: ACCENT, accentText: ACCENT_TX } = useModeAccent('exam');
  const { theme, isDark } = useAppTheme();
  const { language } = useLanguageStore();
  const tr = language === 'tr';
  const seasonal = usePrefsStore(s => s.seasonal);
  const setSeasonalPref = usePrefsStore(s => s.setSeasonalPref);
  const clearPlanIds = usePrefsStore(s => s.clearPlanIds);
  const planHabitIds = usePrefsStore(s => (s as any)[`${slot}PlanHabitIds`]) as string[];
  const planTaskIds = usePrefsStore(s => (s as any)[`${slot}PlanTaskIds`]) as number[];
  const removeHabit = useHabitStore(s => s.removeHabit);

  const name = (seasonal as any)[nameKey] || '';
  const date = (seasonal as any)[dateKey] || '';

  const [preset, setPreset] = useState<ExamPreset | null>(() => {
    if (!name) return null;
    const detected = detectExamFromInput(name);
    if (detected) return detected;
    return {
      id: 'custom-' + encodeURIComponent(name),
      displayName: name,
      shortName: name,
      aliases: [name.toLowerCase()],
      category: 'other',
      defaultDailyMinutes: 90,
      preferredTemplates: ['active-recall', 'spaced-repetition', 'deep-work', 'sprint'],
      tipTr: 'Özel çalışma planı — kendi hızında, düzenli konu tekrarları ve soru çözümü.',
      tipEn: 'Custom study plan — self-paced, regular concept review and practice.',
    };
  });

  const past = isDatePast(date);
  const daysLeft = daysLeftOf(date);
  const dateObj = date ? new Date(date) : new Date(Date.now() + 60 * 86400000);

  const [expanded, setExpanded] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [suggestions, setSuggestions] = useState<ExamPreset[]>([]);
  // Gunluk sure KULLANICININ SECIMI — sessizce doldurulmaz.
  //
  // Eskiden bir preset secilir secilmez `setDailyMinutes(preset.defaultDailyMinutes)`
  // calisiyordu. Sonuc: kullanici sinavi secer secmez "Plani Sec" dugmesi beliriyor,
  // basinca da seviye (Temel/Orta/Ileri) ONUN ADINA secilmis oluyordu. Kullanici
  // "saati secmedim ama plan olustu" diyordu — hakliydi, hic sorulmamisti.
  //
  // Artik null kalir; onerilen sik HoursSelector'de vurgulanir ama SECIM sayilmaz.
  /*
    Ana karttaki ile AYNI düzeltme: seçim kalıcı (bkz. ExamCard → dailyMinutes).
    Yalnız bileşen belleğinde tutulduğunda, kart yeniden kurulunca kurulum
    "tamamlanmamış"a düşüyor ve kullanıcı adı+tarihi girdiği hâlde "Sınav ekle"
    görüyordu.
  */
  const [dailyMinutes, setDailyMinutes] = useState<number | null>(
    () => usePrefsStore.getState().planSpecs[slot]?.dailyMinutes ?? null,
  );

  const pickDailyMinutes = useCallback((m: number | null) => {
    setDailyMinutes(m);
    usePrefsStore.getState().setPlanDraftMinutes(slot, m);
  }, [slot]);

  // Preset GERÇEKTEN değişince önceki seçim geçersizdir (farklı sınav, farklı tempo).
  // İlk çalıştırma atlanıyor: eskiden mount'ta da tetiklenip kayıtlı seçimi siliyordu.
  const presetIdRef = useRef(preset?.id);
  useEffect(() => {
    if (presetIdRef.current === preset?.id) return;
    presetIdRef.current = preset?.id;
    setDailyMinutes(null);
    usePrefsStore.getState().setPlanDraftMinutes(slot, null);
  }, [preset?.id, slot]);

  // Kurulum, UC adimin da tamamlanmasiyla biter: ad + tarih + gunluk sure.
  // Sure eksikken plan uretilirse seviye kullaniciya sorulmadan secilmis olur.
  const complete = name.trim() !== '' && date !== '' && !!preset && dailyMinutes !== null;

  const del = () => {
    planHabitIds.forEach(id => removeHabit(id));
    planTaskIds.forEach(id => retirePlanTask(id, slot));
    retireModeTasksByTag(slot, name);
    retireModeTasksByTag('exam', name);
    clearPlanIds(slot);
    setSeasonalPref(nameKey, ''); setSeasonalPref(dateKey, null);
    setPreset(null); setDailyMinutes(null); setExpanded(false);
  };

  return (
    <View style={{ marginTop: S.xs }}>
      <Separator theme={theme} />
      {complete && !expanded ? (
        <Touchable onPress={() => { haptic.select(); setExpanded(true); }} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, backgroundColor: (past ? theme.error : ACCENT) + '10', borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.sm }} activeOpacity={0.8}>
          <AppIcon Icon={Target} color={ACCENT} size={24} radius={R.sm} iconSize={ICON.sm} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.onSurface, fontWeight: '500', fontSize: F.caption }}>{name}</Text>
            <Text style={{ color: past ? theme.error : ACCENT, fontSize: F.caption, fontWeight: '500' }}>{past ? (tr ? 'Tarih geçti' : 'Date passed') : (tr ? `${daysLeft} gün kaldı` : `${daysLeft} days left`)}</Text>
          </View>
          <Text style={{ color: ACCENT_TX, fontSize: F.caption, fontWeight: '600' }}>{tr ? 'Düzenle ›' : 'Edit ›'}</Text>
          <Touchable onPress={() => { haptic.commit(); Alert.alert(tr ? 'Sınavı Sil' : 'Delete Exam', tr ? `"${name}" silinecek. Emin misin?` : `"${name}" will be deleted. Are you sure?`, [{ text: tr ? 'Vazgeç' : 'Cancel', style: 'cancel' }, { text: tr ? 'Sil' : 'Delete', style: 'destructive', onPress: del }]); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 4 }} accessibilityRole="button" accessibilityLabel={tr ? 'Sil' : 'Delete'}>
            <X size={ICON.xs} color={theme.onSurfaceVariant} strokeWidth={2.5} />
          </Touchable>
        </Touchable>
      ) : !complete && !expanded ? (
        <Touchable onPress={() => { haptic.select(); setExpanded(true); }} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, borderWidth: B.thin, borderStyle: 'dashed', borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)', borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.sm }} activeOpacity={0.7}>
          <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption }}>＋</Text>
          <Text style={{ color: theme.onSurfaceVariant, fontWeight: '600', fontSize: F.caption, flex: 1 }}>{addLabel}</Text>
        </Touchable>
      ) : null}
      {expanded && (
        <View style={{ gap: S.sm }}>
          <PresetEditor name={name} onName={(v) => setSeasonalPref(nameKey, v)} preset={preset} onPreset={setPreset} suggestions={suggestions} onSuggestions={setSuggestions} dailyMinutes={dailyMinutes} onDailyMinutes={pickDailyMinutes} placeholder={placeholder} />
          <Touchable hitSlop={{ top: 2, bottom: 2, left: 0, right: 0 }} onPress={() => { haptic.select(); setShowPicker(true); }} style={[{ borderRadius: R.md, paddingHorizontal: S.md, height: 40, justifyContent: 'center', borderWidth: B.thin, flexDirection: 'row', alignItems: 'center' }, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]} activeOpacity={0.7}>
            <Text style={{ color: date ? theme.onSurface : theme.onSurfaceVariant + '70', fontSize: F.caption, fontWeight: '600', flex: 1 }}>{date ? formatPlanDate(date, tr) : (tr ? 'Sınav tarihi seç' : 'Select date')}</Text>
            <CalendarDays size={ICON.sm} color={theme.onSurfaceVariant} opacity={0.5} />
          </Touchable>
          {showPicker && <ExamDatePicker value={dateObj} onPick={(iso) => setSeasonalPref(dateKey, iso)} onClose={() => setShowPicker(false)} />}
          {preset && <HoursSelector preset={preset} dailyMinutes={dailyMinutes} onPick={pickDailyMinutes} />}
          <View style={{ flexDirection: 'row', gap: S.sm }}>
            {/*
              "KAPAT" VERİ SİLMEZ.

              Burada `if (name || date) del();` vardı: kullanıcı sınavı ve tarihi girip
              "Kapat"a bastığında girdiği her şey SİLİNİYORDU. Kartın kendisi de boş
              hâline döndüğü için kullanıcı, yaptığı işin kaybolduğunu ancak geri
              döndüğünde fark ediyordu — mod açık ama sınav yok.

              "Kapat" bir vazgeçme değil, bir görünüm eylemidir: paneli kapatır, veriyi
              korur. Silmek isteyen kullanıcı için ayrı ve açıkça adlandırılmış bir yol
              olmalı; yıkıcı eylem asla nötr bir etikete saklanmaz.

              Yarım kalan kurulum da korunuyor: ad girilip tarih girilmemişse bile
              kullanıcı geri döndüğünde kaldığı yerden devam eder.
            */}
            <Touchable onPress={() => setExpanded(false)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: R.full, paddingVertical: S.sm, borderWidth: B.thin, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)' }} activeOpacity={0.7}>
              <Text style={{ color: theme.onSurfaceVariant, fontWeight: '500', fontSize: F.caption }}>{tr ? 'Kapat' : 'Close'}</Text>
            </Touchable>
            {complete && (<Touchable onPress={() => { haptic.surface(); setExpanded(false); onOpenPreview({ templateId: levelTemplateIdFromMinutes(dailyMinutes ?? preset?.defaultDailyMinutes), examSlot: slot, examTipTr: preset?.tipTr, examTipEn: preset?.tipEn, examName: name, examDate: date }); }} style={{ flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, backgroundColor: ACCENT, borderRadius: R.full, paddingVertical: S.sm }} activeOpacity={0.8}><BookOpen size={ICON.xs} color="#fff" /><Text style={{ color: '#fff', fontWeight: '600', fontSize: F.caption }}>{tr ? 'Planı Seç ›' : 'Choose Plan ›'}</Text></Touchable>)}
          </View>
        </View>
      )}
    </View>
  );
}

export function ExamCard({ onOpenPreview }: { onOpenPreview: (p: PreviewPayload) => void }) {
  const { accent: ACCENT, accentText: ACCENT_TX } = useModeAccent('exam');
  const { theme, isDark } = useAppTheme();
  const { language } = useLanguageStore();
  const tr = language === 'tr';
  const showToast = useToastStore(s => s.show);

  const seasonal = usePrefsStore(s => s.seasonal);
  const setSeasonalPref = usePrefsStore(s => s.setSeasonalPref);
  const clearPlanIds = usePrefsStore(s => s.clearPlanIds);
  const examReviewShown = usePrefsStore(s => s.examReviewShown);
  const setExamReviewShown = usePrefsStore(s => s.setExamReviewShown);
  const examPlanHabitIds = usePrefsStore(s => s.examPlanHabitIds);
  const examPlanTaskIds = usePrefsStore(s => s.examPlanTaskIds);
  const exam2PlanHabitIds = usePrefsStore(s => s.exam2PlanHabitIds);
  const exam2PlanTaskIds = usePrefsStore(s => s.exam2PlanTaskIds);
  const exam3PlanHabitIds = usePrefsStore(s => s.exam3PlanHabitIds);
  const exam3PlanTaskIds = usePrefsStore(s => s.exam3PlanTaskIds);
  const habits = useHabitStore(s => s.habits);
  const removeHabit = useHabitStore(s => s.removeHabit);
  const tasks = useTaskStore(s => s.tasks);

  const name = seasonal.examName || '';
  const date = seasonal.examDate || '';

  const [preset, setPreset] = useState<ExamPreset | null>(() => {
    if (!name) return null;
    const detected = detectExamFromInput(name);
    if (detected) return detected;
    return {
      id: 'custom-' + encodeURIComponent(name),
      displayName: name,
      shortName: name,
      aliases: [name.toLowerCase()],
      category: 'other',
      defaultDailyMinutes: 90,
      preferredTemplates: ['active-recall', 'spaced-repetition', 'deep-work', 'sprint'],
      tipTr: 'Özel çalışma planı — kendi hızında, düzenli konu tekrarları ve soru çözümü.',
      tipEn: 'Custom study plan — self-paced, regular concept review and practice.',
    };
  });

  const past = isDatePast(date);
  const daysLeft = daysLeftOf(date);
  const dateObj = date ? new Date(date) : new Date(Date.now() + 60 * 86400000);
  const hasPlan = examPlanHabitIds.length > 0 || examPlanTaskIds.length > 0;

  const exam2Complete = (seasonal.exam2Name || '').trim() !== '' && !!seasonal.exam2Date;
  const exam3Complete = (seasonal.exam3Name || '').trim() !== '' && !!seasonal.exam3Date;

  const [expanded, setExpanded] = useState(() => {
    const s = usePrefsStore.getState().seasonal;
    const comp = (s.examName || '').trim() !== '' && (s.examDate || '') !== '';
    const hasActivePlan = (usePrefsStore.getState().examPlanHabitIds.length > 0 || usePrefsStore.getState().examPlanTaskIds.length > 0);
    // Kurulum devam ederken (plan henüz uygulanmamışsa) kart DAİMA açık kalır.
    // Tarih seçildiğinde kart kendi kendine daralmaz ("Kurulumu tamamla"ya geçip yukarı zıplamaz).
    if (!hasActivePlan) return true;
    return !comp;
  });
  const [showPicker, setShowPicker] = useState(false);
  const [suggestions, setSuggestions] = useState<ExamPreset[]>([]);
  /*
    GÜNLÜK SÜRE ARTIK KALICI — kurulumun ortasında kaybolmuyor.

    Süre yalnız bileşen belleğindeydi ve mount'ta `null`a çekiliyordu. Kart yeniden
    kurulduğu anda (moda geri dönüş, ekran dönmesi) seçim siliniyor, `isComplete` false
    oluyor ve kart "Sınav ekle" diyordu — halbuki sınav adı ve tarihi kayıtlıydı ve
    üstteki özet onları gösteriyordu. Kullanıcı açısından yaptığı iş buhar oluyordu.

    Süre KULLANICININ SEÇİMİ olmaya devam ediyor: sessizce varsayılan atanmıyor, yalnız
    seçilmişse hatırlanıyor.
  */
  const [dailyMinutes, setDailyMinutes] = useState<number | null>(
    () => usePrefsStore.getState().planSpecs.exam?.dailyMinutes ?? null,
  );

  const pickDailyMinutes = useCallback((m: number | null) => {
    setDailyMinutes(m);
    usePrefsStore.getState().setPlanDraftMinutes('exam', m);
  }, []);

  /*
    Sınav DEĞİŞİRSE süre sıfırlanır — 90 dakikalık YDS planı seçip sonra TUS'a geçen
    kullanıcı, farkında olmadan eski süreyle devam etmemeli.

    Ama bu YALNIZCA gerçek değişimde olmalı: eskiden aynı etki mount'ta da çalışıyor
    ve kayıtlı seçimi siliyordu. `ref` ile ilk çalıştırma atlanıyor.
  */
  const presetIdRef = useRef(preset?.id);
  useEffect(() => {
    if (presetIdRef.current === preset?.id) return;
    presetIdRef.current = preset?.id;
    setDailyMinutes(null);
    usePrefsStore.getState().setPlanDraftMinutes('exam', null);
  }, [preset?.id]);

  // Kurulum UC adimla biter: ad + tarih + gunluk sure. Sure secilmeden plan
  // uretilirse seviye (Temel/Orta/Ileri) kullaniciya sorulmadan secilmis olur.
  const isComplete = name.trim() !== '' && date !== '' && !!preset && dailyMinutes !== null;

  // YKS/KPSS otomatik-aktif çakışma uyarısı.
  const conflict = (() => {
    const n = name.toUpperCase();
    // Sınav tarihleri TEK KAYNAKTAN (turkishModes). Burada YKS/KPSS tablolarının
    // ÜÇÜNCÜ elle yazılmış kopyası duruyordu (modlar.tsx'teki ikincisi daha önce
    // temizlenmişti). İkinci kopya, birincisi güncellendiğinde sessizce eskir ve
    // çakışma uyarısı yanlış çalışır.
    const yks = isSeasonalExamActive('yks');
    const kpss = isSeasonalExamActive('kpss');
    if (yks && ['YKS', 'TYT', 'AYT'].some(k => n.includes(k))) return tr ? '⚠️ YKS modu zaten otomatik aktif — bu plan onunla çakışabilir' : '⚠️ YKS mode is already auto-active — this plan may overlap';
    if (kpss && n.includes('KPSS')) return tr ? '⚠️ KPSS modu zaten otomatik aktif — bu plan onunla çakışabilir' : '⚠️ KPSS mode is already auto-active — this plan may overlap';
    return null;
  })();

  // Bugünkü ilerleme.
  const todayKey = fmtDateKey();
  const isToday = (d?: string | null) => !!d && !d.startsWith('0001') && fmtDateKey(new Date(d)) === todayKey;
  const planHabits = habits.filter(h => examPlanHabitIds.includes(h.id));
  const wkTasks = tasks.filter(t => examPlanTaskIds.includes(t.id) && (isToday(t.dueDate) || (t.isCompleted && isToday(t.completedAt))));
  const progTotal = planHabits.length + wkTasks.length;
  const progDone = planHabits.filter(h => (h.completedDates ?? []).includes(todayKey)).length + wkTasks.filter(t => t.isCompleted).length;
  const progPct = progTotal > 0 ? Math.round((progDone / progTotal) * 100) : 0;

  const closeAll = () => {
    cancelExamCountdownNotifs();
    examPlanHabitIds.forEach(id => removeHabit(id)); examPlanTaskIds.forEach(id => retirePlanTask(id, 'exam'));
    exam2PlanHabitIds.forEach(id => removeHabit(id)); exam2PlanTaskIds.forEach(id => retirePlanTask(id, 'exam2'));
    exam3PlanHabitIds.forEach(id => removeHabit(id)); exam3PlanTaskIds.forEach(id => retirePlanTask(id, 'exam3'));
    retireModeTasksByTag('exam', seasonal.examName);
    retireModeTasksByTag('exam2', seasonal.exam2Name);
    retireModeTasksByTag('exam3', seasonal.exam3Name);
    clearPlanIds('exam'); clearPlanIds('exam2'); clearPlanIds('exam3');
    setSeasonalPref('examMode', false); setSeasonalPref('examName', ''); setSeasonalPref('examDate', null);
    setSeasonalPref('exam2Name', ''); setSeasonalPref('exam2Date', null);
    setSeasonalPref('exam3Name', ''); setSeasonalPref('exam3Date', null);
    setExamReviewShown(false); setExpanded(false);
  };
  // Toast'i ARTIK closeModeWithUndo gosteriyor ("Geri al" aksiyonuyla birlikte).
  // Burada da gostermek iki toast ustuste bindiriyordu ve ikincisinde geri alma yoktu.
  const closeWithReview = () => { closeAll(); };

  // Tarih geçince "nasıl geçti?" review (bir kez).
  useFocusEffect(
    React.useCallback(() => {
      const st = usePrefsStore.getState();
      const s = st.seasonal;
      if (s.examMode && s.examDate && !st.examReviewShown && parseDateKey(s.examDate).setHours(23, 59, 59, 999) < Date.now()) {
        setExamReviewShown(true);
        const nm = s.examName || (tr ? 'Sınav' : 'Exam');
        setTimeout(() => {
          Alert.alert(tr ? `🎓 ${nm} tamamlandı!` : `🎓 ${nm} is over!`, tr ? 'Nasıl geçti?' : 'How did it go?', [
            { text: tr ? 'Harika geçti 🎉' : 'It went great 🎉', onPress: () => closeModeWithUndo('exam', closeWithReview, tr ? 'Sınav modu kapatıldı' : 'Exam mode closed', tr ? 'Geri al' : 'Undo') },
            { text: tr ? 'Orta geçti 😅' : 'So-so 😅', onPress: () => closeModeWithUndo('exam', closeWithReview, tr ? 'Sınav modu kapatıldı' : 'Exam mode closed', tr ? 'Geri al' : 'Undo') },
            { text: tr ? 'Zor geçti 😢' : 'It was tough 😢', onPress: () => closeModeWithUndo('exam', closeWithReview, tr ? 'Sınav modu kapatıldı' : 'Exam mode closed', tr ? 'Geri al' : 'Undo') },
          ]);
        }, 400);
      }
    }, [tr])
  );

  const delSlot1 = () => {
    examPlanHabitIds.forEach(id => removeHabit(id)); examPlanTaskIds.forEach(id => retirePlanTask(id, 'exam'));
    clearPlanIds('exam'); setSeasonalPref('examName', ''); setSeasonalPref('examDate', null); setPreset(null); setExpanded(false);
    if (!exam2Complete && !exam3Complete) setSeasonalPref('examMode', false);
  };

  return (
    <View style={{ borderRadius: R.lg, borderWidth: B.thin, overflow: 'hidden', backgroundColor: theme.surfaceCard, borderColor: seasonal.examMode && isComplete ? (past ? theme.error + '40' : ACCENT + '35') : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)') }}>
      <View style={{ paddingHorizontal: S.md, paddingTop: S.md, paddingBottom: seasonal.examMode ? S.sm : S.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
          <AppIcon Icon={BookOpen} color={seasonal.examMode && isComplete ? (past ? theme.error : ACCENT) : ACCENT} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.onSurface, fontWeight: '500', fontSize: F.body }}>{tr ? 'Sınav Takibi' : 'Exam Mode'}</Text>
            {seasonal.examMode && isComplete ? (
              <Text style={{ color: past ? theme.error : ACCENT, fontSize: F.caption, fontWeight: '500', marginTop: S.xxs }}>{past ? (tr ? 'Tarih geçti' : 'Date has passed') : (tr ? `${daysLeft} gün kaldı` : `${daysLeft} days left`)}</Text>
            ) : (
              <Text style={{ color: theme.onSurfaceMuted, fontSize: F.caption, marginTop: S.xxs }}>{tr ? 'Herhangi bir sınav için çalışma planı' : 'Study plan for any exam'}</Text>
            )}
          </View>
          <Switch
            value={seasonal.examMode}
            onValueChange={(v) => {
              haptic.select();
              if (!v && seasonal.examMode) {
                const hasItems = examPlanHabitIds.length > 0 || examPlanTaskIds.length > 0;
                if (!hasItems) { closeAll(); return; }
                Alert.alert(tr ? 'Sınav Takibi Kapatılıyor' : 'Turning off Exam Mode', tr ? 'Eklenen tüm alışkanlıklar ve görevler kaldırılacak. Emin misin?' : 'All added habits and tasks will be removed. Are you sure?', [{ text: tr ? 'İptal' : 'Cancel', style: 'cancel' }, { text: tr ? 'Kapat ve Temizle' : 'Turn Off & Remove', style: 'destructive', onPress: closeAll }]);
              } else if (v) { setSeasonalPref('examMode', true); setExpanded(true); }
            }}
            trackColor={{ false: isDark ? '#3A3A3C' : '#E5E5EA', true: (past ? theme.error : ACCENT) + '80' }}
            thumbColor={seasonal.examMode ? (past ? theme.error : ACCENT) : (isDark ? '#636366' : '#fff')}
          />
        </View>
      </View>

      {seasonal.examMode && (
        <View style={{ paddingHorizontal: S.md, paddingBottom: S.md, gap: S.sm }}>
          <Separator theme={theme} />
          {!isComplete && !expanded && (
            <Touchable onPress={() => { haptic.select(); setExpanded(true); }} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, borderWidth: B.thin, borderStyle: 'dashed', borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)', borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.md }} activeOpacity={0.7}>
              <AppIcon Icon={Target} color={theme.onSurfaceVariant} size={24} radius={R.sm} iconSize={ICON.sm} />
              {/*
                YARIM KURULUM "EKLE" DEMEZ.

                Bu satır her tamamlanmamış durumda "Sınav ekle" yazıyordu — sınav adı ve
                tarihi girilmiş, yalnız günlük süre kalmışken bile. Kullanıcı açısından bu
                "girdiklerim silinmiş" demekti; üstteki özet tarihi gösterdiği için de
                ekran kendi kendisiyle çelişiyordu.

                Artık üç durum ayrı: hiç başlanmamış (ekle), yarım kalmış (devam et),
                tamamlanmış (ayrı blokta zaten gösteriliyor).
              */}
              <Text style={{ color: theme.onSurfaceVariant, fontWeight: '500', fontSize: F.body, flex: 1 }}>
                {name.trim() || date
                  ? (tr ? 'Kurulumu tamamla' : 'Finish setup')
                  : (tr ? 'Sınav ekle' : 'Add exam')}
              </Text>
              <ChevronRight size={ICON.sm} color={theme.onSurfaceVariant} opacity={0.4} />
            </Touchable>
          )}

          {isComplete && !expanded && (
            <View style={{ gap: S.sm }}>
              <View style={{ borderRadius: R.md, overflow: 'hidden', borderWidth: B.thin, borderColor: (past ? theme.error : ACCENT) + '30', backgroundColor: (past ? theme.error : ACCENT) + '08' }}>
                <View style={{ height: 3, backgroundColor: past ? theme.error : ACCENT }} />
                <View style={{ padding: S.md }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, marginBottom: S.sm }}>
                    <AppIcon Icon={Target} color={ACCENT} size={24} radius={R.sm} iconSize={ICON.sm} />
                    <Text style={{ color: theme.onSurface, fontWeight: '600', fontSize: F.body, flex: 1 }} numberOfLines={1}>{name}</Text>
                    <Touchable onPress={() => { haptic.surface(); onOpenPreview({ templateId: !hasPlan ? levelTemplateIdFromMinutes(dailyMinutes ?? preset?.defaultDailyMinutes ?? 90) : undefined, examSlot: 'exam', examTipTr: preset?.tipTr, examTipEn: preset?.tipEn, examName: name, examDate: date }); }} activeOpacity={0.7} style={{ backgroundColor: ACCENT + (isDark ? '22' : '15'), paddingHorizontal: S.smd, paddingVertical: S.xs, borderRadius: R.full }}>
                      <Text style={{ color: ACCENT_TX, fontSize: F.caption, fontWeight: '700' }}>{hasPlan ? (tr ? 'İçgörü & Önizle ›' : 'Insight & Preview ›') : (tr ? 'Planı Seç ›' : 'Choose Plan ›')}</Text>
                    </Touchable>
                    <View style={{ width: 1, height: 12, backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)', marginHorizontal: S.xs }} />
                    <Touchable onPress={() => { haptic.select(); setExpanded(true); }} activeOpacity={0.7}>
                      <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '600' }}>{tr ? 'Düzenle' : 'Edit'}</Text>
                    </Touchable>
                    <Touchable onPress={() => { haptic.commit(); Alert.alert(tr ? 'Sınavı Sil' : 'Delete Exam', tr ? `"${name}" silinecek. Emin misin?` : `"${name}" will be deleted. Are you sure?`, [{ text: tr ? 'Vazgeç' : 'Cancel', style: 'cancel' }, { text: tr ? 'Sil' : 'Delete', style: 'destructive', onPress: delSlot1 }]); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 4 }} style={{ marginLeft: S.sm }} accessibilityRole="button" accessibilityLabel={tr ? 'Sil' : 'Delete'}>
                      <X size={ICON.sm} color={theme.onSurfaceVariant} strokeWidth={2.5} />
                    </Touchable>
                  </View>
                  {past ? (
                    <View style={{ gap: S.sm }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
                        {<Calendar size={ICON.sm} color={theme.error} />}
                        <Text style={{ color: theme.error, fontWeight: '500', fontSize: F.body }}>{tr ? 'Tarih geçti' : 'Date has passed'}</Text>
                        <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption }}>· {formatPlanDate(date, tr)}</Text>
                      </View>
                      <Touchable onPress={() => { haptic.commit(); closeWithReview(); }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, backgroundColor: theme.error + '12', borderRadius: R.md, paddingVertical: S.sm, borderWidth: B.thin, borderColor: theme.error + '25' }} activeOpacity={0.75}>
                        <Text style={{ color: theme.error, fontWeight: '600', fontSize: F.caption }}>{tr ? 'Sınavı Tamamla & Kapat' : 'Complete & Close Exam'}</Text>
                      </Touchable>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: S.lg }}>
                      <View style={{ alignItems: 'center', minWidth: 52 }}>
                        <Text style={{ color: ACCENT, fontWeight: '600', fontSize: 40, lineHeight: 42, letterSpacing: -1 }}>{daysLeft}</Text>
                        <Text style={{ color: ACCENT, fontSize: 10, fontWeight: '600', opacity: 0.7, letterSpacing: 1 }}>{tr ? 'GÜN' : 'DAYS'}</Text>
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
                              <Text style={{ color: ACCENT_TX, fontSize: F.caption, fontWeight: '600' }}>{progDone}/{progTotal} · {progPct}%</Text>
                            </View>
                            <ProgressRail variant="segments" value={progDone} total={progTotal} color={ACCENT} />
                          </View>
                        )}
                      </View>
                    </View>
                  )}
                </View>
              </View>

              <ExamSlot slot="exam2" nameKey="exam2Name" dateKey="exam2Date" placeholder={tr ? 'İkinci sınav adı (örn: YDS, ALES...)' : 'Second exam name (e.g. IELTS, GRE...)'} addLabel={tr ? 'İkinci sınav ekle (YKS + TYT gibi)' : 'Add second exam (e.g. SAT + ACT)'} onOpenPreview={onOpenPreview} />
              {exam2Complete && (
                <ExamSlot slot="exam3" nameKey="exam3Name" dateKey="exam3Date" placeholder={tr ? 'Üçüncü sınav adı (örn: YDS, DGS...)' : 'Third exam name (e.g. TOEFL, GMAT...)'} addLabel={tr ? 'Üçüncü sınav ekle' : 'Add third exam'} onOpenPreview={onOpenPreview} />
              )}
            </View>
          )}

          {expanded && (
            <View style={{ gap: S.sm }}>
              <PresetEditor name={name} onName={(v) => setSeasonalPref('examName', v)} preset={preset} onPreset={setPreset} suggestions={suggestions} onSuggestions={setSuggestions} dailyMinutes={dailyMinutes} onDailyMinutes={pickDailyMinutes} placeholder={tr ? 'Sınav adı (örn: ALES, DGS, KPSS...)' : 'Exam name (e.g. SAT, GRE, IELTS...)'} />
              {conflict && (<Text style={{ fontSize: F.caption, color: '#F59E0B', fontWeight: '500', paddingHorizontal: S.xxs }}>{conflict}</Text>)}
              <Touchable onPress={() => { haptic.select(); setShowPicker(true); }} style={[{ borderRadius: R.md, paddingHorizontal: S.md, height: 44, justifyContent: 'center', borderWidth: B.thin, flexDirection: 'row', alignItems: 'center' }, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]} activeOpacity={0.7}>
                <Text style={{ color: date ? theme.onSurface : theme.onSurfaceVariant + '70', fontSize: F.body, fontWeight: '600', flex: 1 }}>{date ? formatPlanDate(date, tr) : (tr ? 'Sınav tarihi seç' : 'Select exam date')}</Text>
                <CalendarDays size={ICON.sm} color={theme.onSurfaceVariant} opacity={0.5} />
              </Touchable>
              {showPicker && <ExamDatePicker value={dateObj} onPick={(iso) => setSeasonalPref('examDate', iso)} onClose={() => setShowPicker(false)} />}
              {preset && <HoursSelector preset={preset} dailyMinutes={dailyMinutes} onPick={pickDailyMinutes} withLevelLabels />}
              <View style={{ flexDirection: 'row', gap: S.sm }}>
                <Touchable onPress={() => setExpanded(false)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: R.full, paddingVertical: S.sm + 2, borderWidth: B.thin, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)' }} activeOpacity={0.7}>
                  <Text style={{ color: theme.onSurfaceVariant, fontWeight: '500', fontSize: F.caption }}>{tr ? 'Kapat' : 'Close'}</Text>
                </Touchable>
                {/* Kurulum bitmediyse dugme SESSIZCE KAYBOLMAZ — ne eksik oldugu yazar.
                    Eskiden yalnizca gizleniyordu; kullanici neyi beklediğini bilemiyordu. */}
                {isComplete ? (<Touchable onPress={() => { haptic.surface(); setExpanded(false); onOpenPreview({ templateId: levelTemplateIdFromMinutes(dailyMinutes ?? preset?.defaultDailyMinutes ?? 90), examSlot: 'exam', examTipTr: preset?.tipTr, examTipEn: preset?.tipEn, examName: name, examDate: date }); }} style={{ flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, backgroundColor: ACCENT, borderRadius: R.full, paddingVertical: S.sm + 2 }} activeOpacity={0.8}><BookOpen size={ICON.sm} color="#fff" /><Text style={{ color: '#fff', fontWeight: '600', fontSize: F.caption }}>{tr ? 'Planı Seç ›' : 'Choose Plan ›'}</Text></Touchable>) : (
                  <View style={{ flex: 2, alignItems: 'center', justifyContent: 'center', paddingVertical: S.sm + 2, borderRadius: R.full, borderWidth: B.thin, borderStyle: 'dashed', borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.12)' }}>
                    <Text style={{ color: theme.onSurfaceVariant, fontWeight: '600', fontSize: F.caption }}>
                      {!name.trim() || !preset ? (tr ? 'Önce sınavı seç' : 'Pick the exam first')
                        : !date ? (tr ? 'Sınav tarihini seç' : 'Pick the exam date')
                        : (tr ? 'Günlük süreni seç' : 'Pick your daily time')}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
