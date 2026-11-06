import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Plus } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { F, ICON, MIN_TOUCH, R, S, W } from '@/shared/constants/tokens';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { TOPIC_NAME_MAX, type TopicWeight } from '../utils/planCore';
import type { StudyCopy } from './studyCopy';

/*
  LİSTEDE OLMAYAN KONU (2026-11-06, kullanıcı: "belki listelerde eksiğizdir, ağırlığı kendi belirlesin"). Sayı ya da yüzde sorulmaz, çoğu kişi bilmez: az, orta, çok.
  Varsayılan orta: hiçbir şey seçmeden de doğru eklenir.
*/
const LEVELS: TopicWeight[] = ['low', 'mid', 'high'];

export function WeightPicker({ value, onChange, c }: { value: TopicWeight; onChange: (w: TopicWeight) => void; c: StudyCopy }) {
  const { theme } = useAppTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={c.weightTitle} style={st.levels}>
      {LEVELS.map(w => {
        const on = w === value;
        return (
          <Touchable key={w} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => onChange(w)} style={[st.level, { backgroundColor: on ? theme.primaryFill : theme.surfaceContainerHigh }]}>
            <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: on ? theme.onPrimaryFill : theme.onSurface }}>{c.weight[w]}</Text>
          </Touchable>
        );
      })}
    </View>
  );
}

export function StudyAddRow({ label, placeholder, c, withWeight, onAdd }: { label: string; placeholder: string; c: StudyCopy; withWeight: boolean; onAdd: (name: string, weight: TopicWeight) => boolean }) {
  const { theme } = useAppTheme();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [weight, setWeight] = useState<TopicWeight>('mid');
  const [note, setNote] = useState('');
  const save = () => {
    const name = text.trim();
    if (!name) return;
    if (!onAdd(name, weight)) { setNote(c.addRefused); return; }
    setText(''); setNote(''); setWeight('mid');
  };
  if (!open) {
    return (
      <Touchable accessibilityRole="button" accessibilityState={{ expanded: false }} onPress={() => setOpen(true)} style={st.link}>
        <Plus size={ICON.sm} color={theme.primary} />
        <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: theme.primary }}>{label}</Text>
      </Touchable>
    );
  }
  return (
    <View style={st.form}>
      <TextInput autoFocus value={text} onChangeText={setText} maxLength={TOPIC_NAME_MAX} placeholder={placeholder} placeholderTextColor={theme.onSurfaceMuted} returnKeyType="done" onSubmitEditing={save} accessibilityLabel={placeholder}
        style={[st.input, { color: theme.onSurface, backgroundColor: theme.surfaceContainerHigh }]} />
      {withWeight && (
        <>
          <Text style={{ fontSize: F.footnote, color: theme.onSurfaceVariant }}>{c.weightTitle}</Text>
          <WeightPicker value={weight} onChange={setWeight} c={c} />
        </>
      )}
      {!!note && <Text accessibilityLiveRegion="polite" style={{ fontSize: F.footnote, color: theme.warning }}>{note}</Text>}
      <View style={st.actions}>
        <Touchable accessibilityRole="button" onPress={() => { setOpen(false); setText(''); setNote(''); }} style={st.cancel}>
          <Text style={{ fontSize: F.footnote, color: theme.onSurfaceVariant }}>{c.cancel}</Text>
        </Touchable>
        <Touchable accessibilityRole="button" disabled={!text.trim()} onPress={save} style={[st.add, { backgroundColor: text.trim() ? theme.primaryFill : theme.surfaceContainerHigh }]}>
          <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: text.trim() ? theme.onPrimaryFill : theme.onSurfaceMuted }}>{c.addAction}</Text>
        </Touchable>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  link: { flexDirection: 'row', alignItems: 'center', gap: S.xs, minHeight: MIN_TOUCH },
  form: { gap: S.sm, paddingVertical: S.sm },
  input: { minHeight: MIN_TOUCH, borderRadius: R.md, paddingHorizontal: S.smd, fontSize: F.body },
  levels: { flexDirection: 'row', gap: S.xs },
  level: { flex: 1, minHeight: 36, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: S.sm },
  cancel: { minHeight: 36, paddingHorizontal: S.sm, justifyContent: 'center' },
  add: { minHeight: 36, paddingHorizontal: S.md, borderRadius: R.full, justifyContent: 'center' },
});
