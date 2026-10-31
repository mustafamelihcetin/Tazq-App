import React from 'react';
import { MyDayTaskRow, type MyDayTaskRowProps } from '@/features/dashboard/components/MyDayTaskRow';
import { isFocusWorthy } from '@/features/focus/focusWorthy';
import type { AppTheme } from '@/shared/constants/Colors';

const DEMO_ID_PREFIX = 'mock-';
/** Örnek (tur) satırlarının kimliği metin ve `mock-` önekli; canlı görevinki sayı. */
export const isDemoId = (id: string | number) => typeof id === 'string' && id.startsWith(DEMO_ID_PREFIX);

export type MyDayTaskItem = MyDayTaskRowProps['item'];
export type MyDayHandlers = { press: (item: MyDayTaskItem) => void; check: (id: number) => unknown; focus: (item: MyDayTaskItem) => void };
const NOOP = () => {};

/*
  ANA SAYFA GÜNLÜK LİSTESİNİN SATIRI (bkz. app/index.tsx → renderMyDayItem).

  Satıra özgü kapanışlar (bu görevi aç / işaretle / odakla) burada kurulur: bileşen memo'lu,
  yalnız KENDİ satırının verisi değişince yeniden çizilir. İşleyiciler sabit kimlikli
  (useLatestCallback) olduğundan diğer satırları ve ilgisiz state'i etkilemez.
*/
export const MyDayItem = React.memo(({ item, isLast, index, handlers, theme, isDark, tr, focusLabel, priorityColor, prefs }: {
  item: MyDayTaskItem; isLast: boolean; index: number; handlers: MyDayHandlers; theme: AppTheme; isDark: boolean; tr: boolean;
  focusLabel: string; priorityColor: MyDayTaskRowProps['priorityColor']; prefs: MyDayTaskRowProps['prefs'];
}) => (
  <MyDayTaskRow
    item={item}
    isLast={isLast}
    theme={theme}
    isDark={isDark}
    tr={tr}
    onPress={() => handlers.press(item)}
    /*
      Örnek (sahte) satırların kimliği metin; canlı görevinki sayı. Kapı burada:
      sahte bir satıra basmak sessizce hiçbir şey yapmasın diye halka onlarda
      dokunulamaz çiziliyor.
    */
    onCheck={isDemoId(item.id) ? undefined : () => handlers.check(item.id)}
    onFocus={index === 0 && !item.isCompleted && isFocusWorthy(item.original || item) ? (isDemoId(item.id)
      // Turda örnek satır da "Odaklan"ı gösterir (adım onu anlatıyor); örtü dokunuşu
      // yuttuğu için işlevsiz bir gösterim — gerçek görev seçilmez.
      ? NOOP
      : () => handlers.focus(item)) : undefined}
    focusLabel={focusLabel}
    priorityColor={priorityColor}
    prefs={prefs}
  />
));
MyDayItem.displayName = 'MyDayItem';
