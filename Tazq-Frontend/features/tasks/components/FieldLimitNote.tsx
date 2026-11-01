import React from 'react';
import { Text } from 'react-native';
import { F, S } from '@/shared/constants/tokens';
import { TASK_LIMITS } from '@/features/tasks/limits';

/*
  BAŞLIK / NOT SINIRI — sınıra çarpmadan önce söyler (bkz. TASK_LIMITS). Başlık uzayınca
  ayrıntının yeri gösterilir: notlar alanı. Sessiz kesme yok; sayaç sınırın altında görünür.
*/
const COPY = {
  tr: { moveToNotes: 'Ayrıntıları notlara yazabilirsin' },
  en: { moveToNotes: 'Put the details in the notes' },
};

export function FieldLimitNote({ title, description, language, color, warn }: {
  title: string; description: string; language: string; color: string; warn: string;
}) {
  const c = COPY[language === 'en' ? 'en' : 'tr'];
  const t = title.length, d = description.length;
  const showTitle = t >= TASK_LIMITS.titleHint;
  const showDesc = d >= TASK_LIMITS.descriptionHint;
  if (!showTitle && !showDesc) return null;
  const line = (n: number, max: number) => `${n}/${max}`;
  return (
    <Text accessibilityLiveRegion="polite" style={{ fontSize: F.caption, color: t >= TASK_LIMITS.title || d >= TASK_LIMITS.description ? warn : color, paddingHorizontal: S.md, paddingTop: S.xs }}>
      {showTitle ? `${line(t, TASK_LIMITS.title)} · ${c.moveToNotes}` : line(d, TASK_LIMITS.description)}
    </Text>
  );
}
