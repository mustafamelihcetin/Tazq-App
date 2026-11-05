import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, StyleSheet, TextInput, View } from 'react-native';
import { GlassSurface } from '@/shared/components/GlassSurface';
import { Touchable } from '@/shared/components/Touchable';
import { F, MIN_TOUCH, R, S } from '@/shared/constants/tokens';
import { useFocusSheetTheme } from '@/features/focus/hooks/useFocusSheetTheme';
import { useFocusStore } from '@/features/focus/store/useFocusStore';

/*
  AKLA GELEN ŞEY (2026-11-06). Odak ortasında "şunu da yapmalıyım" diyen kişi uygulamadan çıkıp odağını kaybediyordu.
  Tek satır, liste yok, görev oluşmaz: düşünceyi bırak, dön. Karar seans sonuna kalır (bkz. SessionNotesReview).
  Pomodoist notu hemen göreve çeviriyor; biz bilerek çevirmiyoruz: liste açmak odağı böler.
*/
const COPY = {
  tr: { placeholder: 'Aklındakini bırak, seans sonuna kalsın', close: 'Kapat' },
  en: { placeholder: 'Drop the thought, it waits until you finish', close: 'Close' },
};
const MAX_CHARS = 600;

export function SessionNote({ visible, language, onClose, onSaved }: { visible: boolean; language: 'tr' | 'en'; onClose: () => void; onSaved: () => void }) {
  const { theme } = useFocusSheetTheme();
  const c = COPY[language];
  const [text, setText] = useState('');
  useEffect(() => { if (visible) setText(''); }, [visible]);
  const submit = () => {
    if (useFocusStore.getState().addSessionNote(text)) onSaved();
    onClose();
  };
  return (
    <Modal supportedOrientations={['portrait', 'landscape']} visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={styles.root}>
        <Touchable accessibilityRole="button" accessibilityLabel={c.close} activeOpacity={1} onPress={submit} style={{ flex: 1 }} />
        <View style={styles.sheet}>
          <GlassSurface corners="top" />
          <TextInput
            autoFocus
            value={text}
            onChangeText={setText}
            onSubmitEditing={submit}
            placeholder={c.placeholder}
            placeholderTextColor={theme.onSurfaceMuted}
            accessibilityLabel={c.placeholder}
            maxLength={MAX_CHARS}
            returnKeyType="done"
            blurOnSubmit
            style={[styles.input, { color: theme.onSurface }]}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  sheet: { borderTopLeftRadius: R.sheet, borderTopRightRadius: R.sheet, overflow: 'hidden', paddingHorizontal: S.lg, paddingVertical: S.md },
  input: { minHeight: MIN_TOUCH, fontSize: F.body },
});
