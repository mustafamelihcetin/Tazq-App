import React from 'react';
import { View, Text, TextInput, ActivityIndicator, StyleSheet } from 'react-native';
import { Send } from 'lucide-react-native';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { S, R, F, W, ICON } from '@/shared/constants/tokens';
import { Touchable } from '@/shared/components/Touchable';
import type { SupportThreadEntry } from '@/shared/services/api';

/*
  DESTEK KONUŞMASI — iki tarafın ortak görünümü (2026-10-31). Kullanıcı "ben" sağda (vurgu tonu),
  karşı taraf solda (nötr yüzey); her balonun altında kim + ne zaman. Kapalı konuşmada kimin
  kapattığı tek satırla söylenir ve yazma kutusu yerine bilgi çıkar.
    viewer="user"  → ben = kullanıcı, karşı = "Tazq Destek"
    viewer="staff" → ben = ekip,      karşı = kullanıcının adı
*/

type Lang = 'tr' | 'en';
const COPY = {
  tr: {
    locale: 'tr-TR', support: 'Tazq Destek', you: 'Sen', team: 'Ekip', placeholder: 'Yanıt yaz…', send: 'Gönder', close: 'Konuşmayı bitir',
    closedBy: { user: (who: string) => `${who} konuşmayı bitirdi`, staff: () => 'Destek konuşmayı bitirdi' },
    wait: 'Yanıtımızı bekle — en kısa sürede döneceğiz.',
  },
  en: {
    locale: 'en-US', support: 'Tazq Support', you: 'You', team: 'Team', placeholder: 'Write a reply…', send: 'Send', close: 'End conversation',
    closedBy: { user: (who: string) => `${who} ended the conversation`, staff: () => 'Support ended the conversation' },
    wait: 'Hang tight — we will get back to you soon.',
  },
};

export function SupportThread({ entries, viewer, otherName, lang, closedBy, canReply = true, draft, onDraft, onSend, sending, onClose, maxLength = 1000, header }: {
  entries: SupportThreadEntry[];
  viewer: 'user' | 'staff';
  /** staff görünümünde kullanıcının adı. */
  otherName?: string;
  lang: Lang;
  closedBy?: 'user' | 'staff' | null;
  /** false + açık konuşma = "yanıtımızı bekle" (kullanıcı ekibi beklemeden çok yazdı). */
  canReply?: boolean;
  draft: string; onDraft: (t: string) => void; onSend: () => void; sending: boolean;
  onClose?: () => void;
  maxLength?: number;
  /** Yazma kutusunun üstüne (ekip: hazır yanıt çipleri). */
  header?: React.ReactNode;
}) {
  const { theme, isDark } = useAppTheme();
  const c = COPY[lang];
  const when = (iso: string) => new Date(iso).toLocaleDateString(c.locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const mine = (e: SupportThreadEntry) => (viewer === 'staff' ? e.fromStaff : !e.fromStaff);
  const nameOf = (e: SupportThreadEntry) => (mine(e) ? (viewer === 'staff' ? c.team : c.you) : (viewer === 'staff' ? (otherName ?? '—') : c.support));
  const canSend = !!draft.trim() && !sending;
  const closed = !!closedBy;

  return (
    <View style={{ gap: S.sm }}>
      {entries.map((e, i) => {
        const me = mine(e);
        return (
          <View key={`${e.at}-${i}`} style={{ alignItems: me ? 'flex-end' : 'flex-start', gap: S.xxs }}>
            <View style={[styles.bubble, me
              ? { backgroundColor: theme.primary + (isDark ? '2E' : '1A'), borderBottomRightRadius: R.xs }
              : { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderBottomLeftRadius: R.xs }]}>
              <Text style={{ fontSize: F.footnote, lineHeight: 19, color: theme.onSurface }}>{e.body}</Text>
            </View>
            <Text style={{ fontSize: F.caption2, color: theme.onSurfaceMuted }}>{nameOf(e)} · {when(e.at)}</Text>
          </View>
        );
      })}

      {closed ? (
        <Text style={[styles.note, { color: theme.onSurfaceMuted }]}>
          {closedBy === 'staff'
            ? (viewer === 'staff' ? c.closedBy.user(c.team) : c.closedBy.staff())
            : c.closedBy.user(viewer === 'user' ? c.you : (otherName ?? '—'))}
        </Text>
      ) : !canReply ? (
        <Text style={[styles.note, { color: theme.onSurfaceMuted }]}>{c.wait}</Text>
      ) : (
        <View style={{ gap: S.sm, marginTop: S.xs }}>
          {header}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: S.xs }}>
            <TextInput
              value={draft} onChangeText={onDraft} placeholder={c.placeholder} placeholderTextColor={theme.onSurfaceMuted}
              multiline maxLength={maxLength} underlineColorAndroid="transparent" accessibilityLabel={c.placeholder}
              style={[styles.input, { color: theme.onSurface, backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow }]}
            />
            <Touchable onPress={onSend} disabled={!canSend} accessibilityRole="button" accessibilityLabel={c.send} accessibilityState={{ disabled: !canSend, busy: sending }}
              style={[styles.send, { backgroundColor: canSend ? theme.primary : theme.surfaceContainerHigh }]}>
              {sending ? <ActivityIndicator size="small" color={theme.onPrimary} /> : <Send size={ICON.sm} color={canSend ? theme.onPrimary : theme.onSurfaceMuted} />}
            </Touchable>
          </View>
        </View>
      )}

      {!closed && onClose && (
        <Touchable onPress={onClose} accessibilityRole="button" hitSlop={{ top: S.xs, bottom: S.xs, left: S.xs, right: S.xs }} style={{ alignSelf: 'center', paddingVertical: S.xs }}>
          <Text style={{ fontSize: F.caption, fontWeight: W.semibold, color: theme.onSurfaceMuted }}>{c.close}</Text>
        </Touchable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: { maxWidth: '86%', borderRadius: R.lg, paddingHorizontal: S.smd, paddingVertical: S.sm },
  note: { fontSize: F.caption, textAlign: 'center', paddingVertical: S.xs },
  input: { flex: 1, fontSize: F.footnote, borderRadius: R.lg, paddingHorizontal: S.smd, paddingTop: S.sm, paddingBottom: S.sm, minHeight: 40, maxHeight: 110 },
  send: { width: 40, height: 40, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
});
