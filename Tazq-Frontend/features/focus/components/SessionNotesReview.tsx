import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Touchable } from '@/shared/components/Touchable';
import { F, MIN_TOUCH, R, S } from '@/shared/constants/tokens';
import { swallow } from '@/shared/utils/swallow';
import { useFocusSheetTheme } from '@/features/focus/hooks/useFocusSheetTheme';
import { useFocusStore } from '@/features/focus/store/useFocusStore';
import { capture } from '@/features/tasks/nlp/capture';
import { applyCapture, toDrafts } from '@/features/onboarding/utils/captureFlow';

/*
  Seans sonunda bırakılan notlar. Anlama motoru görev ya da alışkanlık önerir (LLM yok), karar tek dokunuşla.
  Karar verilmeyen not kaybolmaz, sonraki özette yine çıkar.
*/
const COPY = {
  tr: { count: (n: number) => `${n} not bıraktın`, add: 'Ekle', remove: 'Sil' },
  en: { count: (n: number) => `${n} ${n === 1 ? 'note' : 'notes'} left`, add: 'Add', remove: 'Delete' },
};

export function SessionNotesReview({ language }: { language: 'tr' | 'en' }) {
  const { theme } = useFocusSheetTheme();
  const notes = useFocusStore((s) => s.sessionNotes);
  const removeNote = useFocusStore((s) => s.removeSessionNote);
  const [open, setOpen] = useState(false);
  const c = COPY[language];
  if (!notes || notes.length === 0) return null;

  const add = (id: string, text: string) => {
    removeNote(id);
    applyCapture({ drafts: toDrafts(capture(text, language)), lang: language, acceptMode: false })
      .catch((e: unknown) => swallow('focus.noteToTask', e, { capture: true }));
  };

  return (
    <View style={{ gap: S.xs }}>
      <Touchable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen((v) => !v)} style={{ minHeight: MIN_TOUCH, justifyContent: 'center' }}>
        <Text style={{ fontSize: F.footnote, fontWeight: '600', color: theme.onSurface }}>{c.count(notes.length)}</Text>
      </Touchable>
      {open && notes.map((n) => (
        <View key={n.id} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingLeft: S.md, paddingVertical: S.xxs, borderRadius: R.md, backgroundColor: theme.onSurface + '0D' }}>
          <Text numberOfLines={2} style={{ flex: 1, fontSize: F.footnote, color: theme.onSurface }}>{n.text}</Text>
          <Touchable accessibilityRole="button" accessibilityLabel={`${c.add}: ${n.text}`} onPress={() => add(n.id, n.text)} style={{ minHeight: MIN_TOUCH, paddingHorizontal: S.sm, justifyContent: 'center' }}>
            <Text style={{ fontSize: F.footnote, fontWeight: '700', color: theme.primary }}>{c.add}</Text>
          </Touchable>
          <Touchable accessibilityRole="button" accessibilityLabel={`${c.remove}: ${n.text}`} onPress={() => removeNote(n.id)} style={{ minHeight: MIN_TOUCH, paddingHorizontal: S.sm, justifyContent: 'center' }}>
            <Text style={{ fontSize: F.footnote, color: theme.onSurfaceVariant }}>{c.remove}</Text>
          </Touchable>
        </View>
      ))}
    </View>
  );
}
