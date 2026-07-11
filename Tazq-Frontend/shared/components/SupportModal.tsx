import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Modal, ScrollView, TextInput, ActivityIndicator, Platform, KeyboardAvoidingView, StyleSheet, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { Send } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { SupportService, MySupportMessage } from '@/shared/services/api';
import { CustomAlert as Alert } from '@/shared/components/CustomAlert';
import { Touchable } from '@/shared/components/Touchable';
import { S, R, F, B } from '@/shared/constants/tokens';

interface SupportModalProps {
  visible: boolean;
  onClose: () => void;
  theme: any;
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setSupportText('');
      loadMyMessages();
      Alert.alert(
        tr ? 'Başarılı' : 'Success',
        t.support?.success || (tr ? 'Mesajın bize ulaştı.' : 'Your message has been sent to support.')
      );
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      console.warn('[Support] send failed:', err?.response?.status, err?.response?.data);
      let msg = t.support?.error || (tr ? 'Mesaj gönderilemedi.' : 'Could not send message.');
      if (!err?.response) {
        msg = t.login?.networkError || (tr ? 'Bağlantı hatası. Ağını kontrol et.' : 'Connection failed. Check your network.');
      } else {
        const status = err.response.status;
        const body = err.response.data;
        const serverMsg = typeof body === 'string' ? body : body?.message;
        if (status === 401) {
          msg = tr
            ? 'Oturumun doğrulanamadı. Lütfen çıkıp tekrar giriş yap.'
            : 'Session could not be verified. Please sign out and back in.';
        } else if (status >= 500) {
          const tid = (body && typeof body === 'object' ? ((body as any).traceId || (body as any).TraceId) : '') || '';
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

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <Touchable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          activeOpacity={1}
        />
        <View
          style={[
            styles.modalContent,
            {
              backgroundColor: isDark ? '#1C1C22' : '#FFFFFF',
              paddingBottom: insets.bottom + S.lg,
            },
          ]}
        >
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
            <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, opacity: 0.6, alignSelf: 'flex-end', marginTop: -S.sm }}>
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
                  <Send size={18} color="white" />
                  <Text style={{ color: 'white', fontWeight: '900', fontSize: F.body }}>
                    {t.support?.send || (language === 'tr' ? 'Mesajı Gönder' : 'Send Message')}
                  </Text>
                </>
              )}
            </Touchable>

            {/* Support Message Log */}
            {(loadingMine || myMessages.length > 0) && (
              <View style={{ marginTop: S.sm, gap: S.sm }}>
                <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase', opacity: 0.7 }}>
                  {language === 'tr' ? 'Mesajların' : 'Your messages'}
                </Text>
                <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false}>
                  <View style={{ gap: S.sm }}>
                    {myMessages.map((mm) => (
                      <View
                        key={mm.id}
                        style={{
                          backgroundColor: isDark
                            ? theme.surfaceContainerHigh
                            : theme.surfaceContainerLow,
                          borderRadius: R.md,
                          padding: S.sm,
                          gap: 6,
                        }}
                      >
                        <Text style={{ color: theme.onSurface, fontSize: F.caption, lineHeight: 18 }}>
                          {mm.message}
                        </Text>
                        <Text style={{ color: theme.onSurfaceVariant, fontSize: 9, opacity: 0.5 }}>
                          {new Date(mm.createdAt).toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                        {mm.adminReply ? (
                          <View
                            style={{
                              backgroundColor: '#10B98112',
                              borderLeftWidth: 3,
                              borderLeftColor: '#10B981',
                              borderRadius: R.sm,
                              padding: S.sm,
                              gap: 2,
                            }}
                          >
                            <Text style={{ color: '#10B981', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 }}>
                              {language === 'tr' ? '✓ DESTEK YANITI' : '✓ SUPPORT REPLY'}
                            </Text>
                            <Text style={{ color: theme.onSurface, fontSize: F.caption, lineHeight: 18 }}>
                              {mm.adminReply}
                            </Text>
                          </View>
                        ) : (
                          <Text style={{ color: theme.onSurfaceVariant, fontSize: 10, fontStyle: 'italic', opacity: 0.6 }}>
                            {language === 'tr' ? 'Yanıt bekleniyor…' : 'Awaiting reply…'}
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
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
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    width: '100%',
    maxHeight: '90%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 16,
  },
  modalTitle: {
    fontWeight: '800',
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
