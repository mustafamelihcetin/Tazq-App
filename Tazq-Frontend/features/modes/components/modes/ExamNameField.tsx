import React, { useState } from 'react';
import { Keyboard, Text, View, StyleSheet } from 'react-native';
import { Check, Sparkles, X } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { F, W, S, R, B, ICON, MIN_TOUCH } from '@/shared/constants/tokens';
import { fitMaxLength } from '@/shared/utils/fitMaxLength';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { haptic } from '@/shared/utils/haptics';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { canonicalExamName, customExamPreset, detectExamFromInput, liveExamName, popularExams, suggestExams, type ExamPreset } from '@/shared/utils/examPresets';
import { findExamCurriculum } from '@/shared/utils/curriculum';
import { ModeField } from '@/features/modes/components/ModeField';
import { useModeAccent } from '@/shared/hooks/useModeAccent';

/*
  SINAV ADI (2026-11-05, kullanıcı: "kpss yazınca kpss alıyor, KPSS değil; ui/ux'i yukarı çek"). Liste sınavı tanıyordu ama yazılan metin olduğu gibi kalıyordu.
  Yazarken sınavın adı tamamlanınca doğru biçime oturur (kpss → KPSS); takma ad ve yazım hatası öneri olarak gelir, alan bırakılınca kesinleşir (kamu → KPSS).
  Boş alanda sık seçilenler görünür; alttaki tek satır sınavın tanındığını ve konuların hazır olup olmadığını söyler. Listede olmayan sınav engellenmez: ad düzenlenir, konu listesi olmadığı açıkça söylenir, yakın bir sınav varsa sorulur (sessizce başka sınava çevrilmez).
*/
const COPY = {
  tr: {
    popular: 'Sık seçilenler',
    clear: 'Sınav adını temizle',
    known: (n: string) => `${n} tanındı`,
    withTopics: (n: string) => `${n} tanındı, konu listesi hazır`,
    custom: 'Listede yok. Planın konu listesi olmadan, genel çalışma düzeniyle kurulur.',
    didYouMean: (n: string) => `${n} mi demek istedin?`,
  },
  en: {
    popular: 'Popular',
    clear: 'Clear exam name',
    known: (n: string) => `${n} recognised`,
    withTopics: (n: string) => `${n} recognised, topic list ready`,
    custom: 'Not on the list. Your plan is built without a topic list, on a general study routine.',
    didYouMean: (n: string) => `Did you mean ${n}?`,
  },
};

export function ExamNameField({ name, onName, preset, onPreset, suggestions, onSuggestions, onClearHours, placeholder }: {
  name: string; onName: (v: string) => void; preset: ExamPreset | null; onPreset: (p: ExamPreset | null) => void;
  suggestions: ExamPreset[]; onSuggestions: (s: ExamPreset[]) => void; onClearHours: () => void; placeholder: string;
}) {
  const { accent, accentText } = useModeAccent('exam');
  const { theme, isDark } = useAppTheme();
  const language = useLanguageStore(s => s.language);
  const lang = language === 'en' ? 'en' : 'tr';
  const c = COPY[lang];
  const [focused, setFocused] = useState(false);

  const change = (raw: string) => {
    const v = liveExamName(raw);
    onName(v);
    if (!v.trim()) { onSuggestions([]); onPreset(null); onClearHours(); return; }
    onPreset(detectExamFromInput(v) ?? customExamPreset(v.trim()));
    // Tam ad oturduysa öneri kalabalığı yok.
    onSuggestions(suggestExams(v).filter(p => p.shortName !== v));
  };
  const pick = (p: ExamPreset) => {
    haptic.select();
    onName(p.shortName);
    onPreset(p);
    onSuggestions([]);
    Keyboard.dismiss();
  };
  const settle = () => {
    setFocused(false);
    const v = canonicalExamName(name, lang);
    if (v !== name) onName(v);
    if (v) onPreset(detectExamFromInput(v) ?? customExamPreset(v));
    // Satıra dokunma alanı kapanmadan yerine ulaşsın.
    setTimeout(() => onSuggestions([]), 150);
  };
  const clear = () => {
    haptic.select();
    onName('');
    onPreset(null);
    onSuggestions([]);
    onClearHours();
  };

  const known = !!preset && !preset.id.startsWith('custom-');
  // Alan bırakıldı, ad listede yok ama çok yakını var: sessizce çevirmek yerine sor.
  const closest = !focused && !known && name.trim() ? suggestExams(name)[0] ?? null : null;
  const line = !name.trim() || focused && suggestions.length > 0 ? null : known ? (findExamCurriculum(name) ? c.withTopics(preset.shortName) : c.known(preset.shortName)) : focused ? null : c.custom;
  const panel = { borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.09)', backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surface };

  return (
    <>
      <ModeField
        accent={accent}
        value={name}
        onChangeText={change}
        onFocus={() => setFocused(true)}
        onBlur={settle}
        placeholder={placeholder}
        autoCorrect={false}
        returnKeyType="done"
        maxLength={fitMaxLength(60, name)}
        onSubmitEditing={() => { if (suggestions.length > 0 && !detectExamFromInput(name)) pick(suggestions[0]); }}
        suffix={name.length > 0 ? (
          <Touchable accessibilityRole="button" accessibilityLabel={c.clear} onPress={clear} hitSlop={10}>
            <X size={ICON.sm} color={theme.onSurfaceMuted} />
          </Touchable>
        ) : undefined}
      />
      {focused && !name.trim() && (
        <View style={st.popular}>
          <Text style={{ fontSize: F.caption, fontWeight: W.semibold, color: theme.onSurfaceMuted }}>{c.popular}</Text>
          <View style={st.chips}>
            {popularExams(lang).map(p => (
              <Touchable key={p.id} accessibilityRole="button" onPress={() => pick(p)} style={[st.chip, { backgroundColor: theme.surfaceContainerHigh }]}>
                <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: theme.onSurface }}>{p.shortName}</Text>
              </Touchable>
            ))}
          </View>
        </View>
      )}
      {suggestions.length > 0 && (
        <View style={[st.list, panel]}>
          {suggestions.map((p, i) => (
            <Touchable accessibilityRole="button" key={p.id} onPress={() => pick(p)} activeOpacity={0.7} style={[st.row, i > 0 && { borderTopWidth: B.thin, borderTopColor: panel.borderColor }]}>
              <Text style={{ fontSize: F.body, fontWeight: W.semibold, color: theme.onSurface, minWidth: 52 }}>{p.shortName}</Text>
              {p.displayName !== p.shortName && <Text style={{ fontSize: F.caption, color: theme.onSurfaceVariant, flex: 1 }} numberOfLines={1}>{p.displayName}</Text>}
            </Touchable>
          ))}
        </View>
      )}
      {closest && (
        <Touchable accessibilityRole="button" onPress={() => pick(closest)} style={st.mean}>
          <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: accentText }}>{c.didYouMean(closest.shortName)}</Text>
        </Touchable>
      )}
      {line && (
        <View style={st.status}>
          {known ? <Check size={ICON.xs} color={accentText} strokeWidth={3} /> : <Sparkles size={ICON.xs} color={theme.onSurfaceMuted} />}
          <Text style={{ flex: 1, fontSize: F.caption, fontWeight: W.semibold, color: known ? accentText : theme.onSurfaceMuted }}>{line}</Text>
        </View>
      )}
    </>
  );
}

const st = StyleSheet.create({
  popular: { gap: S.xs, marginTop: S.xxs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  chip: { paddingHorizontal: S.smd, minHeight: 36, borderRadius: R.full, justifyContent: 'center' },
  list: { borderRadius: R.md, borderWidth: B.thin, overflow: 'hidden', marginTop: S.xxs },
  row: { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingHorizontal: S.md, minHeight: MIN_TOUCH },
  mean: { alignSelf: 'flex-start', minHeight: MIN_TOUCH - S.sm, justifyContent: 'center' },
  status: { flexDirection: 'row', alignItems: 'center', gap: S.xs, marginTop: S.xxs },
});
