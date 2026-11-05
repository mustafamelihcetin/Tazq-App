import React, { useEffect } from 'react';
import { Platform, View, useWindowDimensions } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { S } from '@/shared/constants/tokens';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { toDateKey } from '@/shared/utils/dateKey';

const BASE_CALENDAR_WIDTH = 340;
const LOCALE = { tr: 'tr-TR', en: 'en-GB' };

function useCalScale() {
  const { width } = useWindowDimensions();
  const aw = width - S.lg * 2 - S.md * 2;
  return aw < BASE_CALENDAR_WIDTH ? aw / BASE_CALENDAR_WIDTH : 1;
}

export function ExamDatePicker({ value, onPick, onClose }: { value: Date; onPick: (iso: string) => void; onClose: () => void }) {
  const { isDark } = useAppTheme();
  const { language } = useLanguageStore();
  const calendarScale = useCalScale();
  // iOS inline takvim açılır açılmaz `value`'yu seçili gösteriyor ama onChange dokununca ateşleniyor: görünen ile kayıtlı eşitlenir.
  // Android'de açılan iletişim kutusundan vazgeçilebilir: seçilmemiş tarih yazılmaz (2026-11-05, kullanıcının seçmediği tarih uydurulmaz).
  useEffect(() => { if (Platform.OS === 'ios') onPick(toDateKey(value)); }, []);
  return (
    <View style={Platform.OS === 'ios' ? { width: BASE_CALENDAR_WIDTH * calendarScale, height: 320 * calendarScale, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginVertical: S.xs } : { alignSelf: 'center', marginVertical: S.xs }}>
      <View style={Platform.OS === 'ios' ? { width: BASE_CALENDAR_WIDTH, height: 320, transform: [{ scale: calendarScale }], justifyContent: 'center', alignItems: 'center' } : undefined}>
        <DateTimePicker
          style={Platform.OS === 'ios' ? { width: 320, height: 320 } : undefined}
          value={value} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'}
          themeVariant={isDark ? 'dark' : 'light'} locale={LOCALE[language === 'en' ? 'en' : 'tr']}
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
