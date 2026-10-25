import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, Switch } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { CalendarDays, Clock, Bell, X, Check } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { haptic } from '@/shared/utils/haptics';
import type { AppTheme } from '@/shared/constants/Colors';
import { ICON, S, R, F, HAIRLINE, MIN_TOUCH } from '@/shared/constants/tokens';
import { toDateKey, parseDateKey } from '@/shared/utils/dateKey';
import { localeOf } from '@/shared/utils/lang';
import { quickDates, dueDateLabel, dueTimeLabel } from '@/features/tasks/utils/taskFormDates';
import type { TaskFormCopy } from '@/features/tasks/components/form/taskFormCopy';

/*
  TARİH · SAAT · HATIRLATICI — Yeni Hedef formunun "ne zaman" bölümü.

  ESKİSİ: iki eş kutu ("2026-10-25" ham metni ve ✨ ikonlu saat), dokununca gün/ay/yıl
  için ▲/▼ okları. "Gelecek pazartesi" beş dokunuştu; geçmiş tarih ancak Kaydet'te
  hata veriyordu.

  YENİSİ (Todoist hızlı ekleme + Things "When" + Apple Hatırlatıcılar):
   · Kısayol yongaları: Bugün · Yarın · Hafta sonu · Gelecek hafta · Takvim. Seçili
     yongaya tekrar dokunmak tarihi kaldırır (tek dokunuşla geri alma).
   · Takvim ve saat PLATFORMUN KENDİ seçicisi: iOS'ta sayfanın içinde açılan satır içi
     takvim / çark, Android'de Material iletişim kutusu. Geçmiş gün seçilemiyor
     (minimumDate) — hata göstermeye gerek kalmıyor.
   · Saat ve hatırlatıcı gruplu bir kartta (iOS Ayarlar / Hatırlatıcılar ayrıntısı);
     hatırlatıcı gerçek bir `Switch` — ekran okuyucu "anahtar, açık" der.
*/

type Picker = 'date' | 'time' | null;

export interface ScheduleValue { dueDate: string; dueTime: string | null; reminderEnabled: boolean }

export function ScheduleSection({
  value, onDate, onTime, onReminder, theme, isDark, language, c, now = new Date(),
}: {
  value: ScheduleValue;
  onDate: (dateKey: string) => void;
  onTime: (iso: string | null) => void;
  onReminder: (on: boolean) => void;
  theme: AppTheme;
  isDark: boolean;
  language: string;
  c: TaskFormCopy;
  now?: Date;
}) {
  const [open, setOpen] = useState<Picker>(null);
  const tr = language === 'tr';
  const quick = quickDates(now);
  const isQuick = quick.some((q) => q.dateKey === value.dueDate);
  const customLabel = value.dueDate && !isQuick ? dueDateLabel(value.dueDate, now, language) : '';
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const pickDate = (key: string) => {
    haptic.select();
    onDate(value.dueDate === key ? '' : key);
  };

  const timeValue = () => {
    const d = value.dueTime ? new Date(value.dueTime) : null;
    if (d && !isNaN(d.getTime())) return d;
    const base = new Date(now);
    base.setHours(Math.min(base.getHours() + 1, 23), 0, 0, 0);
    return base;
  };
  // Saat, eski formdaki gibi BUGÜNÜN tarihine yazılı bir ISO damgası; gün `dueDate`'ten gelir.
  const toTimeIso = (d: Date) => { const b = new Date(); b.setHours(d.getHours(), d.getMinutes(), 0, 0); return b.toISOString(); };

  const openCalendar = () => {
    const current = value.dueDate ? parseDateKey(value.dueDate) : today;
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current < today ? today : current,
        mode: 'date',
        minimumDate: today,
        onChange: (e: DateTimePickerEvent, d?: Date) => { if (e.type === 'set' && d) onDate(toDateKey(d)); },
      });
      return;
    }
    setOpen((o) => (o === 'date' ? null : 'date'));
  };

  const openTime = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: timeValue(),
        mode: 'time',
        is24Hour: tr,
        onChange: (e: DateTimePickerEvent, d?: Date) => { if (e.type === 'set' && d) onTime(toTimeIso(d)); },
      });
      return;
    }
    if (!value.dueTime) onTime(toTimeIso(timeValue()));
    setOpen((o) => (o === 'time' ? null : 'time'));
  };

  const timeText = dueTimeLabel(value.dueTime, language);
  const reminderCaption = value.reminderEnabled && value.dueDate
    ? c.reminderAt(`${dueDateLabel(value.dueDate, now, language)}${timeText ? ` ${timeText}` : ''}`)
    : c.reminderOff;

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.chips}
        accessibilityLabel={c.date}
      >
        {quick.map((q) => (
          <DateChip
            key={q.key}
            label={c.quick[q.key]}
            selected={value.dueDate === q.dateKey}
            onPress={() => { setOpen(null); pickDate(q.dateKey); }}
            hint={value.dueDate === q.dateKey ? c.clearDate : undefined}
            theme={theme}
          />
        ))}
        {customLabel ? (
          <DateChip label={customLabel} selected onPress={() => pickDate(value.dueDate)} hint={c.clearDate} theme={theme} />
        ) : null}
        <DateChip
          label={c.pickDate}
          icon={<CalendarDays size={ICON.xs} color={open === 'date' ? theme.primary : theme.onSurfaceVariant} />}
          selected={open === 'date'}
          onPress={openCalendar}
          theme={theme}
        />
      </ScrollView>

      {open === 'date' && Platform.OS === 'ios' && (
        <View style={[styles.card, { backgroundColor: theme.surfaceField, marginTop: S.sm }]}>
          <DateTimePicker
            value={value.dueDate ? parseDateKey(value.dueDate) : today}
            mode="date"
            display="inline"
            minimumDate={today}
            accentColor={theme.primary}
            themeVariant={isDark ? 'dark' : 'light'}
            locale={localeOf(language)}
            onChange={(_e: DateTimePickerEvent, d?: Date) => { if (d) onDate(toDateKey(d)); }}
          />
        </View>
      )}

      <View style={[styles.card, { backgroundColor: theme.surfaceField, marginTop: S.md }]}>
        {/* SAAT */}
        <View style={styles.row}>
          <Clock size={ICON.sm} color={theme.onSurfaceVariant} />
          <Text style={[styles.rowLabel, { color: theme.onSurface }]}>{c.time}</Text>
          {value.dueTime ? (
            <View style={styles.valueGroup}>
              <Touchable
                accessibilityRole="button"
                accessibilityLabel={`${c.time}: ${timeText}`}
                accessibilityState={{ expanded: open === 'time' }}
                onPress={openTime}
                style={[styles.valuePill, { backgroundColor: open === 'time' ? theme.primary + '1F' : theme.surfaceCard }]}
              >
                <Text style={[styles.valueText, { color: open === 'time' ? theme.primary : theme.onSurface }]}>{timeText}</Text>
              </Touchable>
              <Touchable
                accessibilityRole="button"
                accessibilityLabel={c.clearTime}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                onPress={() => { setOpen(null); onTime(null); }}
                style={styles.clearBtn}
              >
                <X size={ICON.xs} color={theme.onSurfaceMuted} />
              </Touchable>
            </View>
          ) : (
            <Touchable accessibilityRole="button" accessibilityLabel={c.addTime} onPress={openTime} style={styles.addBtn}>
              <Text style={[styles.valueText, { color: theme.primary }]}>{c.addTime}</Text>
            </Touchable>
          )}
        </View>

        {open === 'time' && Platform.OS === 'ios' && (
          <View style={styles.spinner}>
            <DateTimePicker
              value={timeValue()}
              mode="time"
              display="spinner"
              themeVariant={isDark ? 'dark' : 'light'}
              locale={localeOf(language)}
              onChange={(_e: DateTimePickerEvent, d?: Date) => { if (d) onTime(toTimeIso(d)); }}
            />
          </View>
        )}

        <View style={[styles.separator, { backgroundColor: theme.separator }]} />

        {/* HATIRLATICI — iki satırlı (ad + durum); dikey boşluk SİMETRİK, anahtar kendi ortalı
            yuvasında. Cihazda görüldü (2026-10-25): yükseklik yalnız yazı bloğundan geliyordu,
            anahtar üstteki ayırıcıya yapışık duruyordu. */}
        <View style={[styles.row, styles.rowTall]}>
          <Bell size={ICON.sm} color={value.reminderEnabled ? theme.primary : theme.onSurfaceVariant} />
          <View style={styles.rowText}>
            <Text style={[styles.rowLabel, styles.rowLabelFlat, { color: theme.onSurface }]}>{c.reminder}</Text>
            <Text numberOfLines={1} style={[styles.caption, { color: value.reminderEnabled ? theme.primary : theme.onSurfaceMuted }]}>
              {reminderCaption}
            </Text>
          </View>
          <View style={styles.switchSlot}>
          <Switch
            value={value.reminderEnabled}
            onValueChange={(on) => { haptic.select(); setOpen(null); onReminder(on); }}
            accessibilityLabel={c.reminder}
            trackColor={{ false: Platform.OS === 'ios' ? undefined : theme.separator, true: theme.primary }}
            thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
          />
          </View>
        </View>
      </View>
    </View>
  );
}

function DateChip({ label, selected, onPress, icon, hint, theme }: {
  label: string; selected: boolean; onPress: () => void; icon?: React.ReactNode; hint?: string; theme: AppTheme;
}) {
  return (
    <Touchable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ selected }}
      activeOpacity={0.7}
      onPress={onPress}
      style={[styles.chip, { backgroundColor: selected ? theme.primary + '1F' : theme.surfaceField }]}
    >
      {icon ?? (selected ? <Check size={ICON.xs} color={theme.primary} strokeWidth={2.4} /> : null)}
      <Text numberOfLines={1} style={[styles.chipText, { color: selected ? theme.primary : theme.onSurfaceVariant, fontWeight: selected ? '600' : '500' }]}>
        {label}
      </Text>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  chips: { gap: S.xs, paddingRight: S.xs },
  chip: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.xxs,
    paddingHorizontal: S.smd,
    borderRadius: R.full,
  },
  chipText: { fontSize: F.footnote, letterSpacing: 0 },
  card: { borderRadius: R.lg, overflow: 'hidden' },
  row: { minHeight: MIN_TOUCH + S.sm, flexDirection: 'row', alignItems: 'center', gap: S.smd, paddingHorizontal: S.md },
  rowTall: { minHeight: MIN_TOUCH + S.lg, paddingVertical: S.smd },
  rowText: { flex: 1, justifyContent: 'center' },
  // iOS anahtarı 51×31, Android ~52×32: yuva ikisini de dikeyde tam ortalar.
  switchSlot: { minHeight: MIN_TOUCH, justifyContent: 'center', alignItems: 'center' },
  rowLabel: { flex: 1, fontSize: F.body, fontWeight: '500' },
  rowLabelFlat: { flex: 0 },
  caption: { fontSize: F.caption2, marginTop: S.xxs / 2 },
  valueGroup: { flexDirection: 'row', alignItems: 'center', gap: S.xxs },
  valuePill: { minHeight: 32, justifyContent: 'center', paddingHorizontal: S.smd, borderRadius: R.sm },
  valueText: { fontSize: F.body, fontWeight: '600', fontVariant: ['tabular-nums'] },
  clearBtn: { width: 28, height: 32, alignItems: 'center', justifyContent: 'center' },
  addBtn: { minHeight: 32, justifyContent: 'center', paddingHorizontal: S.xs },
  spinner: { alignItems: 'center' },
  // Ayırıcı ikonun bittiği yerden başlar (iOS gruplu liste ritmi).
  separator: { height: HAIRLINE, marginLeft: S.md + ICON.sm + S.smd },
});
