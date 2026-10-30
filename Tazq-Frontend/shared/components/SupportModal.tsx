import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Modal, ScrollView, TextInput, ActivityIndicator, Platform, KeyboardAvoidingView, StyleSheet, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { Send, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SupportService, MySupportMessage } from '@/shared/services/api';
import { CustomAlert as Alert, AlertHost } from '@/shared/components/CustomAlert';
import { Touchable } from '@/shared/components/Touchable';
import { GlassSurface } from '@/shared/components/GlassSurface';
import { ICON, S, R, F, B } from '@/shared/constants/tokens';
import type { AppTheme } from '@/shared/constants/Colors';
import { httpStatusOf, isNetworkError, httpRawDataOf } from '@/shared/utils/errors';
import { swallow } from '@/shared/utils/swallow';
import { haptic } from '@/shared/utils/haptics';
import { SupportThread } from '@/shared/components/SupportThread';

/** Konuşma metinleri (2026-10-31). */
const SM_COPY = {
  tr: {
    ended: 'Bitti', answered: 'Yanıtlandı', waiting: 'Bekliyor', notSent: 'Gönderilemedi', sendFail: 'Mesaj gönderilemedi.',
    endTitle: 'Konuşmayı bitir', endBody: 'Bu konuşmaya artık yazılamaz. Yeni bir konu için yeni mesaj gönderebilirsin.', cancel: 'Vazgeç', end: 'Bitir', back: 'Mesajların',
  },
  en: {
    ended: 'Ended', answered: 'Answered', waiting: 'Waiting', notSent: 'Not sent', sendFail: 'Could not send message.',
    endTitle: 'End conversation', endBody: 'No more replies can be added. You can always start a new message.', cancel: 'Cancel', end: 'End', back: 'Your messages',
  },
};

interface SupportModalProps {
  visible: boolean;
  onClose: () => void;
  theme: AppTheme;
  isDark: boolean;
  language: string;
  t: any;
}

export const SupportModal: React.FC<SupportModalProps> = ({
  visible,
  onClose,
  theme,
  isDark,
  language,
  t,
}) => {
  const insets = useSafeAreaInsets();
  const [supportText, setSupportText] = useState('');
  const [sendingSupport, setSendingSupport] = useState(false);
  const [myMessages, setMyMessages] = useState<MySupportMessage[]>([]);
  const [loadingMine, setLoadingMine] = useState(false);
  // Açık konuşma (2026-10-31): kullanıcı yanıta yanıt yazabilir, konuşmayı bitirebilir.
  const [openId, setOpenId] = useState<number | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [replying, setReplying] = useState(false);
  const open = myMessages.find(m => m.id === openId) ?? null;
  const sc = SM_COPY[language === 'tr' ? 'tr' : 'en'];

  const loadMyMessages = useCallback(async () => {
    setLoadingMine(true);
    try {
      const r = await SupportService.getMyMessages();
      setMyMessages(r.messages || []);
    } catch {
      // Silently ignore - message list stays empty
    } finally {
      setLoadingMine(false);
    }
  }, []);

  // Fetch conversation history when modal opens
  useEffect(() => {
    if (visible) {
      loadMyMessages();
      setSupportText('');
      setOpenId(null);
      setReplyDraft('');
    }
  }, [visible, loadMyMessages]);

  const handleSendSupport = async () => {
    if (!supportText.trim()) {
      Alert.alert(
        language === 'tr' ? 'Hata' : 'Error',
        t.support?.emptyError || (language === 'tr' ? 'Lütfen bir mesaj yaz.' : 'Please write a message.')
      );
      return;
    }
    const tr = language === 'tr';
    setSendingSupport(true);
    try {
      await SupportService.sendMessage(supportText.trim());
      haptic.success();
      setSupportText('');
      loadMyMessages();
      Alert.alert(
        tr ? 'Başarılı' : 'Success',
        t.support?.success || (tr ? 'Mesajın bize ulaştı.' : 'Your message has been sent to support.')
      );
    } catch (err: unknown) {
      haptic.error();
      swallow('supportModal.sendMessage', err);
      let msg = t.support?.error || (tr ? 'Mesaj gönderilemedi.' : 'Could not send message.');
      if (isNetworkError(err)) {
        msg = t.login?.networkError || (tr ? 'Bağlantı hatası. Ağını kontrol et.' : 'Connection failed. Check your network.');
      } else {
        const status = httpStatusOf(err) ?? 0;
        // Gövde JSON nesnesi de düz metin de olabilir; iki biçim de korunur.
        const body = httpRawDataOf(err);
        const bodyObj: { message?: string; traceId?: string; TraceId?: string } =
          typeof body === 'object' && body !== null ? body : {};
        const serverMsg = typeof body === 'string' ? body : bodyObj.message;
        if (status === 401) {
          msg = tr
            ? 'Oturumun doğrulanamadı. Lütfen çıkıp tekrar giriş yap.'
            : 'Session could not be verified. Please sign out and back in.';
        } else if (status >= 500) {
          const tid = bodyObj.traceId || bodyObj.TraceId || '';
          const code = tid ? ` (${tr ? 'kod' : 'code'}: ${String(tid).slice(-8)})` : '';
          msg = (tr ? 'Sunucu hatası. Lütfen sonra tekrar dene.' : 'Server error. Please try again later.') + code;
        } else if (serverMsg) {
          msg = serverMsg;
        }
      }
      Alert.alert(tr ? 'Hata' : 'Error', msg);
    } finally {
      setSendingSupport(false);
    }
  };

  const threadOf = (m: MySupportMessage) => m.thread ?? [
    { fromStaff: false, body: m.message, at: m.createdAt },
    ...(m.adminReply ? [{ fromStaff: true, body: m.adminReply, at: m.repliedAt ?? m.createdAt }] : []),
  ];
  const statusOf = (m: MySupportMessage) => {
    if (m.closedAt) return { text: sc.ended, color: theme.onSurfaceMuted };
    const last = threadOf(m).slice(-1)[0];
    return last?.fromStaff ? { text: sc.answered, color: theme.success } : { text: sc.waiting, color: theme.warning };
  };

  const sendReply = async () => {
    if (!open || !replyDraft.trim()) return;
    setReplying(true);
    try {
      const updated = await SupportService.userReply(open.id, replyDraft.trim());
      haptic.success();
      setMyMessages(prev => prev.map(m => m.id === open.id ? { ...m, ...updated } : m));
      setReplyDraft('');
    } catch (err: unknown) {
      haptic.error();
      swallow('supportModal.userReply', err);
      const body = httpRawDataOf(err) as { message?: string } | undefined;
      Alert.alert(sc.notSent, body?.message || sc.sendFail);
      loadMyMessages();
    } finally {
      setReplying(false);
    }
  };

  const endConversation = () => {
    if (!open) return;
    Alert.alert(sc.endTitle, sc.endBody, [
      { text: sc.cancel, style: 'cancel' },
      { text: sc.end, style: 'destructive', onPress: async () => {
        try { await SupportService.userClose(open.id); haptic.success(); loadMyMessages(); }
        catch (e) { swallow('supportModal.userClose', e); }
      } },
    ]);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior="padding"
        style={styles.modalOverlay}
      >
        {/* Sayfanın arka planı — ekran okuyucuda adsız bir kontrol olarak belirmesin. */}
        <Touchable
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          activeOpacity={1}
        />
        <View
          style={[
            styles.modalContent,
            {
              paddingBottom: insets.bottom + S.lg,
            },
          ]}
        >
          <GlassSurface corners="top" />
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
          <View
            style={[
              styles.modalHandle,
              {
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.18)'
                  : 'rgba(0,0,0,0.12)',
              },
            ]}
          />
          <Text style={[styles.modalTitle, { color: theme.onSurface, fontSize: F.subhead }]}>
            {t.support?.title || (language === 'tr' ? 'Destek & İletişim' : 'Support & Contact')}
          </Text>
          <View style={{ paddingHorizontal: S.lg, gap: S.md }}>
            {open ? (
              <View style={{ gap: S.sm }}>
                <Touchable onPress={() => { setOpenId(null); setReplyDraft(''); }} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: S.xxs, alignSelf: 'flex-start' }}>
                  <ChevronLeft size={ICON.sm} color={theme.primary} />
                  <Text style={{ color: theme.primary, fontSize: F.footnote, fontWeight: '600' }}>{sc.back}</Text>
                </Touchable>
                <ScrollView style={{ maxHeight: 440 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  <SupportThread entries={threadOf(open)} viewer="user" lang={language === 'tr' ? 'tr' : 'en'} closedBy={open.closedBy ?? null}
                    canReply={open.canReply ?? !open.closedAt} draft={replyDraft} onDraft={setReplyDraft} onSend={sendReply} sending={replying}
                    onClose={endConversation} maxLength={500} />
                </ScrollView>
              </View>
            ) : (<>
            <Text style={{ color: theme.onSurfaceVariant, fontSize: F.body, textAlign: 'center' }}>
              {t.support?.sub || (language === 'tr' ? 'Soru, öneri ve destek taleplerini doğrudan bize ilet.' : 'Send us your questions, feedback, or support requests.')}
            </Text>
            <View
              style={[
                styles.inputGroup,
                {
                  height: 120,
                  backgroundColor: isDark
                    ? theme.surfaceContainerHigh
                    : theme.surfaceContainerLow,
                  paddingVertical: S.sm,
                  alignItems: 'flex-start',
                },
              ]}
            >
              <TextInput
                value={supportText}
                onChangeText={setSupportText}
                placeholder={
                  t.support?.placeholder ||
                  (language === 'tr' ? 'Mesajını buraya yaz...' : 'Write your message here...')
                }
                placeholderTextColor={theme.onSurfaceVariant + '99'}
                style={{ color: theme.onSurface, fontSize: F.body, width: '100%', height: '100%' }}
                multiline
                maxLength={500}
                textAlignVertical="top"
                underlineColorAndroid="transparent"
              />
            </View>
            <Text style={{ color: theme.onSurfaceMuted, fontSize: F.caption, alignSelf: 'flex-end', marginTop: -S.sm }}>
              {supportText.length}/500
            </Text>
            <Touchable
              onPress={handleSendSupport}
              disabled={sendingSupport}
              style={[
                styles.saveBtn,
                {
                  backgroundColor: '#3B82F6',
                  flexDirection: 'row',
                  gap: S.sm,
                  justifyContent: 'center',
                },
              ]}
            >
              {sendingSupport ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Send size={ICON.md} color="white" />
                  <Text style={{ color: 'white', fontWeight: '700', fontSize: F.body }}>
                    {t.support?.send || (language === 'tr' ? 'Mesajı Gönder' : 'Send Message')}
                  </Text>
                </>
              )}
            </Touchable>

            {/* Support Message Log */}
            {(loadingMine || myMessages.length > 0) && (
              <View style={{ marginTop: S.sm, gap: S.sm }}>
                <Text style={{ color: theme.onSurfaceMuted, fontSize: F.caption, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                  {language === 'tr' ? 'Mesajların' : 'Your messages'}
                </Text>
                <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false}>
                  <View style={{ gap: S.sm }}>
                    {myMessages.map((mm) => {
                      const st = statusOf(mm);
                      const last = threadOf(mm).slice(-1)[0];
                      return (
                        <Touchable key={mm.id} onPress={() => setOpenId(mm.id)} accessibilityRole="button"
                          accessibilityLabel={`${mm.message}. ${st.text}`}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow, borderRadius: R.md, padding: S.smd }}>
                          <View style={{ flex: 1, gap: S.xxs }}>
                            <Text numberOfLines={1} style={{ color: theme.onSurface, fontSize: F.footnote, fontWeight: '600' }}>{mm.message}</Text>
                            <Text numberOfLines={1} style={{ color: theme.onSurfaceMuted, fontSize: F.caption }}>{last?.body}</Text>
                          </View>
                          <Text style={{ color: st.color, fontSize: F.caption, fontWeight: '700' }}>{st.text}</Text>
                          <ChevronRight size={ICON.sm} color={theme.onSurfaceMuted} />
                        </Touchable>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            )}
            </>)}
          </View>
        </View>
      </KeyboardAvoidingView>
      <AlertHost />{/* modal içinden açılan uyarı burada, modalın üstünde (bkz. CustomAlert) */}
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: R.sheet,
    borderTopRightRadius: R.sheet,
    width: '100%',
    maxHeight: '90%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: R.xs,
    alignSelf: 'center',
    marginTop: S.smd,
    marginBottom: S.md,
  },
  modalTitle: {
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: S.md,
    letterSpacing: 0.5,
  },
  inputGroup: {
    borderRadius: R.lg,
    paddingHorizontal: S.md,
    justifyContent: 'center',
  },
  saveBtn: {
    height: 52,
    borderRadius: R.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: S.sm,
  },
});
