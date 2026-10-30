import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, Modal, ActivityIndicator, StyleSheet, useWindowDimensions } from 'react-native';
import { Plus, Trash2, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { S, R, F, B, ICON, HAIRLINE } from '@/shared/constants/tokens';
import { Touchable } from '@/shared/components/Touchable';
import { GlassSheet } from '@/shared/components/GlassSheet';
import { useKeyboardHeight } from '@/shared/hooks/useKeyboardHeight';
import { SupportService, type SupportTemplate } from '@/shared/services/api';

/*
  DESTEK HAZIR YANITLARI (madde 9, 2026-10-30). Yanıt kutusunun üstünde şablon çipleri: dokununca
  {ad} kullanıcının ilk adıyla dolar ve metin kutuya yazılır (gönderilmez — son kontrol insanda).
  Kutu doluysa şablon sona eklenir, yazılan silinmez. Şablonlar sunucuda, tüm ekip aynı seti görür;
  düzenleme moderatör/süper admin işi (sunucu da öyle kapılar).
*/

type Lang = 'tr' | 'en';

const COPY = {
  tr: { edit: 'Düzenle', title: 'Hazır yanıtlar', hint: '{ad} yazdığın yere kullanıcının adı gelir.', add: 'Şablon ekle', save: 'Kaydet',     titlePh: 'Başlık', bodyPh: 'Merhaba {ad}, …', saveFail: 'Kaydedilemedi', remove: 'Şablonu sil', close: 'Kapat', there: 'merhaba' },
  en: { edit: 'Edit', title: 'Quick replies', hint: 'Where you write {ad}, the user’s name is filled in.', add: 'Add template', save: 'Save',     titlePh: 'Title', bodyPh: 'Hi {ad}, …', saveFail: 'Could not save', remove: 'Delete template', close: 'Close', there: 'there' },
};

/** {ad} → ilk ad (yoksa nötr hitap). Taslak doluysa sona eklenir. */
export function fillTemplate(body: string, userName: string | null | undefined, draft = '', fallback = 'merhaba'): string {
  const first = (userName ?? '').trim().split(/\s+/)[0] || fallback;
  const text = body.replace(/\{ad\}/g, first);
  return draft.trim() ? `${draft.trimEnd()}\n\n${text}` : text;
}

export function useSupportTemplates(enabled: boolean) {
  const [templates, setTemplates] = useState<SupportTemplate[]>([]);
  const load = useCallback(async () => {
    if (!enabled) return;
    try { setTemplates(await SupportService.getTemplates()); } catch { /* çipler görünmez; yanıt elle yazılır */ }
  }, [enabled]);
  useEffect(() => { load(); }, [load]);
  const save = useCallback(async (next: SupportTemplate[]) => { setTemplates(await SupportService.saveTemplates(next)); }, []);
  return { templates, save };
}

export function TemplateChips({ templates, onPick }: { templates: SupportTemplate[]; onPick: (t: SupportTemplate) => void }) {
  const { theme } = useAppTheme();
  if (templates.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: S.xs }}>
      {templates.map(t => (
        <Touchable key={t.id} onPress={() => onPick(t)} accessibilityRole="button" accessibilityLabel={t.title}
          style={{ paddingHorizontal: S.smd, paddingVertical: S.xs, borderRadius: R.full, borderWidth: B.thin, borderColor: theme.outline, backgroundColor: theme.primary + '0F' }}>
          <Text numberOfLines={1} style={{ fontSize: F.caption, fontWeight: '600', color: theme.primary }}>{t.title}</Text>
        </Touchable>
      ))}
    </ScrollView>
  );
}

export function TemplatesHeader({ lang, canEdit, onEdit }: { lang: Lang; canEdit: boolean; onEdit: () => void }) {
  const { theme } = useAppTheme();
  const c = COPY[lang];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={{ fontSize: F.caption, fontWeight: '700', letterSpacing: 0.5, color: theme.onSurfaceMuted }}>{c.title.toLocaleUpperCase(lang === 'en' ? 'en-US' : 'tr-TR')}</Text>
      {canEdit && (
        <Touchable onPress={onEdit} accessibilityRole="button" hitSlop={{ top: S.xs, bottom: S.xs, left: S.xs, right: S.xs }}>
          <Text style={{ fontSize: F.caption, fontWeight: '700', color: theme.primary }}>{c.edit}</Text>
        </Touchable>
      )}
    </View>
  );
}

export function TemplateEditor({ lang, visible, templates, onClose, onSave }: {
  lang: Lang; visible: boolean; templates: SupportTemplate[]; onClose: () => void; onSave: (t: SupportTemplate[]) => Promise<void>;
}) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const c = COPY[lang];
  const [draft, setDraft] = useState<SupportTemplate[]>(templates);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (visible) { setDraft(templates); setError(null); } }, [visible, templates]);

  const patch = (i: number, p: Partial<SupportTemplate>) => setDraft(d => d.map((t, k) => (k === i ? { ...t, ...p } : t)));
  const submit = async () => {
    setBusy(true); setError(null);
    try { await onSave(draft); onClose(); } catch { setError(c.saveFail); } finally { setBusy(false); }
  };
  const input = { fontSize: F.body, color: theme.onSurface, paddingVertical: S.xs } as const;

  const kb = useKeyboardHeight();
  const { height: screenH } = useWindowDimensions();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: S.md, paddingTop: insets.top + S.md, paddingBottom: (kb > 0 ? kb : insets.bottom) + S.md }}>
        <Touchable style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} accessibilityRole="button" accessibilityLabel={c.close} />
        <GlassSheet maxWidth={560} padding={S.md}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
            <Touchable onPress={onClose} accessibilityRole="button" accessibilityLabel={c.close} hitSlop={{ top: S.xs, bottom: S.xs, left: S.xs, right: S.xs }}>
              <X size={ICON.md} color={theme.onSurface} />
            </Touchable>
            <Text style={{ flex: 1, fontSize: F.title3, fontWeight: '700', color: theme.onSurface }}>{c.title}</Text>
            <Touchable onPress={submit} disabled={busy} accessibilityRole="button" accessibilityState={{ busy }}>
              {busy ? <ActivityIndicator color={theme.primary} /> : <Text style={{ fontSize: F.body, fontWeight: '700', color: theme.primary }}>{c.save}</Text>}
            </Touchable>
          </View>
          <Text style={{ fontSize: F.caption, color: theme.onSurfaceMuted }}>{c.hint}</Text>
          {!!error && <Text style={{ fontSize: F.footnote, color: theme.error }}>{error}</Text>}
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: screenH * 0.6 }} contentContainerStyle={{ gap: S.sm }}>
            {draft.map((t, i) => (
              <View key={t.id || `n${i}`} style={{ borderRadius: R.md, borderWidth: B.thin, borderColor: theme.outline, padding: S.smd, gap: S.xs }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
                  <TextInput value={t.title} onChangeText={v => patch(i, { title: v })} placeholder={c.titlePh} placeholderTextColor={theme.onSurfaceMuted}
                    maxLength={40} style={[input, { flex: 1, fontWeight: '700' }]} />
                  <Touchable onPress={() => setDraft(d => d.filter((_, k) => k !== i))} accessibilityRole="button" accessibilityLabel={c.remove} hitSlop={{ top: S.xs, bottom: S.xs, left: S.xs, right: S.xs }}>
                    <Trash2 size={ICON.sm} color={theme.onSurfaceMuted} />
                  </Touchable>
                </View>
                <View style={{ height: HAIRLINE, backgroundColor: theme.separator }} />
                <TextInput value={t.body} onChangeText={v => patch(i, { body: v })} placeholder={c.bodyPh} placeholderTextColor={theme.onSurfaceMuted}
                  multiline maxLength={1000} style={[input, { minHeight: S.xxl, textAlignVertical: 'top' }]} />
              </View>
            ))}
            {draft.length < 30 && (
              <Touchable onPress={() => setDraft(d => [...d, { id: '', title: '', body: '' }])} accessibilityRole="button"
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, paddingVertical: S.smd, borderRadius: R.md, borderWidth: B.thin, borderStyle: 'dashed', borderColor: theme.outline }}>
                <Plus size={ICON.sm} color={theme.primary} />
                <Text style={{ fontSize: F.body, fontWeight: '600', color: theme.primary }}>{c.add}</Text>
              </Touchable>
            )}
          </ScrollView>
        </GlassSheet>
      </View>
    </Modal>
  );
}

export const templateFallback = (lang: Lang) => COPY[lang].there;
