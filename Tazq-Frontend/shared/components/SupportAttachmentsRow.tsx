import React, { useState } from 'react';
import { View, Text, Image, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { ImagePlus } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { CustomAlert as Alert } from '@/shared/components/CustomAlert';
import { SupportService, type SupportAttachmentMeta } from '@/shared/services/api';
import { F, S, R, B, ICON } from '@/shared/constants/tokens';
import type { AppTheme } from '@/shared/constants/Colors';
import { httpStatusOf } from '@/shared/utils/errors';
import { swallow } from '@/shared/utils/swallow';

/*
  DESTEK FOTOĞRAFLARI (2026-11-01, kullanıcı: "destek kısmında dosya/fotoğraf ekleme, MB sınırı, sunucu şişmesin").
  Konuşmanın altında küçük resimler + "Fotoğraf ekle". Sınırlar SUNUCUDA zorlanır (bkz. SupportAttachments.cs);
  burada yalnız erken ve anlaşılır uyarı: fotoğraf seçilirken sıkıştırılır (kalite 0.6), 3 MB'ı aşarsa gönderilmez.
  Belge (PDF) için yerel belge seçici gerekir — yeni derlemeyle gelir.
*/
export const SUPPORT_MAX_BYTES = 3 * 1024 * 1024;
export const SUPPORT_MAX_PER_CONVERSATION = 6;

const COPY = {
  tr: { add: 'Fotoğraf ekle', addA11y: 'Konuşmaya fotoğraf ekle', limit: (n: number) => `${n}/${SUPPORT_MAX_PER_CONVERSATION} · en fazla 3 MB`, tooBig: 'Fotoğraf çok büyük', tooBigBody: 'En fazla 3 MB olabilir. Ekran görüntüsü ya da daha küçük bir fotoğraf dene.', full: 'Bu konuşma için fotoğraf sınırı doldu.', quota: 'Fotoğraf alanın doldu (20 MB). Eski konuşmalar kapandıkça yer açılır.', fail: 'Fotoğraf gönderilemedi', failBody: 'Bağlantını kontrol edip tekrar dene.', perm: 'Fotoğraflara erişim izni gerekli', permBody: 'Ayarlardan fotoğraf iznini açabilirsin.', open: 'Fotoğrafı aç' },
  en: { add: 'Add photo', addA11y: 'Add a photo to the conversation', limit: (n: number) => `${n}/${SUPPORT_MAX_PER_CONVERSATION} · up to 3 MB`, tooBig: 'Photo is too large', tooBigBody: 'It can be up to 3 MB. Try a screenshot or a smaller photo.', full: 'Photo limit reached for this conversation.', quota: 'Your photo space is full (20 MB). It frees up as old conversations close.', fail: 'Photo not sent', failBody: 'Check your connection and try again.', perm: 'Photo access needed', permBody: 'You can allow photo access in Settings.', open: 'Open photo' },
};

export function SupportAttachmentsRow({ conversationId, items, canAdd, onAdded, theme, lang }: {
  conversationId: number;
  items: SupportAttachmentMeta[];
  canAdd: boolean;
  onAdded: (item: SupportAttachmentMeta) => void;
  theme: AppTheme;
  lang: 'tr' | 'en';
}) {
  const c = COPY[lang];
  const [busy, setBusy] = useState(false);
  const full = items.length >= SUPPORT_MAX_PER_CONVERSATION;

  const pick = async () => {
    if (busy) return;
    if (full) { Alert.alert(c.full); return; }
    let ImagePicker: typeof import('expo-image-picker');
    try { ImagePicker = require('expo-image-picker'); } catch (e) { swallow('support.pickerRequire', e); return; }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert(c.perm, c.permBody); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, exif: false });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    if (a.fileSize && a.fileSize > SUPPORT_MAX_BYTES) { Alert.alert(c.tooBig, c.tooBigBody); return; }
    setBusy(true);
    try {
      const item = await SupportService.uploadAttachment(conversationId, a.uri, a.fileName ?? 'photo.jpg', a.mimeType ?? 'image/jpeg');
      onAdded(item);
    } catch (e: unknown) {
      const st = httpStatusOf(e);
      if (st === 413) Alert.alert(c.tooBig, c.tooBigBody);
      else if (st === 409) Alert.alert(c.quota);
      else { swallow('support.upload', e); Alert.alert(c.fail, c.failBody); }
    } finally {
      setBusy(false);
    }
  };

  if (!items.length && !canAdd) return null;
  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: S.sm }}>
        {items.map(it => (
          <View key={it.id} accessible accessibilityRole="image" accessibilityLabel={c.open}
            style={[styles.thumb, { borderColor: it.fromStaff ? theme.primary : theme.outlineVariant }]}>
            <Image source={SupportService.attachmentSource(it.id)} style={styles.img} resizeMode="cover" />
          </View>
        ))}
        {canAdd && !full && (
          <Touchable onPress={pick} disabled={busy} accessibilityRole="button" accessibilityLabel={c.addA11y}
            style={[styles.thumb, styles.add, { borderColor: theme.outlineVariant, backgroundColor: theme.surfaceField }]}>
            {busy ? <ActivityIndicator color={theme.primary} /> : <ImagePlus size={ICON.md} color={theme.primary} />}
          </Touchable>
        )}
      </ScrollView>
      {canAdd && <Text style={[styles.hint, { color: theme.onSurfaceMuted }]}>{c.add} · {c.limit(items.length)}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: S.xs, marginTop: S.sm },
  thumb: { width: 64, height: 64, borderRadius: R.md, borderWidth: B.thin, overflow: 'hidden' },
  img: { width: '100%', height: '100%' },
  add: { alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed' },
  hint: { fontSize: F.caption },
});
