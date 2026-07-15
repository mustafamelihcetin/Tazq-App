import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity, ActivityIndicator, Platform, Linking } from 'react-native';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Zap } from 'lucide-react-native';
import { S, R, B, F } from '@/shared/constants/tokens';
import { swallow } from '@/shared/utils/swallow';
import type { AppTheme } from '@/shared/constants/Colors';

/**
 * Uygulama değerlendirme / geri bildirim modalı.
 *
 * app/index.tsx'ten çıkarıldı: kendi içine kapalı bir akış (5 yerel state + ~185 satır
 * JSX) ana ekranın gövdesinde duruyordu ve ana ekranın state'ini şişiriyordu.
 * Ne zaman gösterileceği kararı burada değil — çağıran verir (evaluateReviewPrompt).
 *
 * Akış: 4-5 yıldız → mağaza yorumuna yönlendir. 1-3 yıldız → mağazaya gönderme,
 * bunun yerine serbest metin al ve destek mesajı olarak ilet (kötü puanı mağazada
 * değil, kendi kanalımızda topla).
 */

const LAST_PROMPT_KEY = 'tazq_last_review_prompt_time';
const POSITIVE_RATING_THRESHOLD = 4;
/** "Teşekkürler" ekranının otomatik kapanmadan önce görünür kaldığı süre. */
const THANK_YOU_DURATION_MS = 1800;

const STORE_URL = Platform.OS === 'ios'
  ? 'https://apps.apple.com/app/tazq-app/id123456789?action=write-review'
  : 'market://details?id=com.tazqapp';

type Props = {
  visible: boolean;
  onClose: () => void;
  theme: AppTheme;
  tr: boolean;
};

export function ReviewPromptModal({ visible, onClose, theme, tr }: Props) {
  const [rating, setRating] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [sending, setSending] = useState(false);

  // "Teşekkürler" ekranını kapatan gecikmeli zamanlayıcı. Ref'te tutulur ki
  // bileşen o süre dolmadan kapanırsa iptal edilebilsin — aksi halde unmount
  // sonrası setState çağrılır (sızıntı + React uyarısı).
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  // Kullanıcıya sorulduğu anı işaretle — cooldown bundan hesaplanır.
  const markPrompted = async () => {
    try {
      await AsyncStorage.setItem(LAST_PROMPT_KEY, Date.now().toString());
    } catch (e) {
      // Yazılamazsa cooldown çalışmaz ve kullanıcı tekrar tekrar rahatsız edilir.
      swallow('reviewPromptModal.markPrompted', e, { capture: true });
    }
  };

  const handleLater = async () => {
    Haptics.selectionAsync();
    onClose();
    await markPrompted();
  };

  const handleSubmit = async () => {
    if (rating === null) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await markPrompted();

    if (rating >= POSITIVE_RATING_THRESHOLD) {
      Linking.openURL(STORE_URL).catch((e: unknown) => swallow('reviewPromptModal.openStoreUrl', e));
      onClose();
      return;
    }

    // Olumsuz puan → mağaza yerine destek kanalına yönlendir.
    const feedback = feedbackText.trim();
    if (!feedback) {
      onClose();
      return;
    }

    setSending(true);
    try {
      const SupportService = require('@/shared/services/api').SupportService;
      await SupportService.sendMessage(`[APP REVIEW feedback - Star rating: ${rating}/5]\n${feedback}`);
      setSubmitted(true);
      closeTimerRef.current = setTimeout(() => {
        closeTimerRef.current = null;
        onClose();
        setSubmitted(false);
        setRating(null);
        setFeedbackText('');
      }, THANK_YOU_DURATION_MS);
    } catch (err) {
      // Geri bildirim kaybolursa kullanıcı yazdığını boşa harcamış olur.
      swallow('reviewPromptModal.sendFeedback', err, { capture: true });
      onClose();
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: S.lg }}>
        <MotiView
          from={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 15 }}
          style={{
            width: '100%',
            maxWidth: 400,
            backgroundColor: theme.surface,
            borderColor: theme.outlineVariant + '40',
            borderWidth: B.thin,
            borderRadius: 24,
            padding: S.lg,
            gap: S.md,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.25,
            shadowRadius: 15,
            elevation: 10,
          }}
        >
          {/* Header */}
          <View style={{ alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 32 }}>✨</Text>
            <Text style={{ color: theme.onSurface, fontSize: 18, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5 }}>
              {tr ? 'TAZQ\'ı Nasıl Buluyorsunuz?' : 'How do you rate TAZQ?'}
            </Text>
            <Text style={{ color: theme.onSurfaceVariant, fontSize: F.body, textAlign: 'center', opacity: 0.8 }}>
              {tr ? 'Görüşleriniz bizim için çok değerli.' : 'Your feedback is very valuable to us.'}
            </Text>
          </View>

          {!submitted ? (
            <>
              {/* Rating Stars Selection */}
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: S.md, marginVertical: S.sm }}>
                {[1, 2, 3, 4, 5].map((star) => {
                  const active = rating !== null && star <= rating;
                  return (
                    <TouchableOpacity
                      key={star}
                      activeOpacity={0.7}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={tr ? `${star} yıldız` : `${star} stars`}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        setRating(star);
                      }}
                      style={{ padding: 4 }}
                    >
                      <Zap
                        size={32}
                        color={active ? '#F59E0B' : theme.onSurfaceVariant + '33'}
                        fill={active ? '#F59E0B' : 'transparent'}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Negative feedback textarea */}
              {rating !== null && rating < POSITIVE_RATING_THRESHOLD && (
                <MotiView
                  from={{ height: 0, opacity: 0 }}
                  animate={{ height: 130, opacity: 1 }}
                  style={{ gap: S.sm, overflow: 'hidden' }}
                >
                  <Text style={{ color: theme.onSurface, fontSize: F.caption, fontWeight: '700' }}>
                    {tr ? 'Sizi ne memnun etmedi? Nasıl düzeltebiliriz?' : 'What went wrong? How can we improve?'}
                  </Text>
                  <TextInput
                    value={feedbackText}
                    onChangeText={setFeedbackText}
                    placeholder={tr ? 'Görüşlerinizi yazın…' : 'Write your feedback…'}
                    placeholderTextColor={theme.onSurfaceVariant + '60'}
                    multiline
                    numberOfLines={3}
                    underlineColorAndroid="transparent"
                    accessibilityLabel={tr ? 'Geri bildirim metni' : 'Feedback text'}
                    style={{
                      backgroundColor: theme.surfaceContainerLow,
                      borderColor: theme.outlineVariant + '60',
                      borderWidth: B.thin,
                      borderRadius: R.md,
                      color: theme.onSurface,
                      fontSize: F.body,
                      padding: S.md,
                      textAlignVertical: 'top',
                      height: 80,
                    }}
                  />
                </MotiView>
              )}

              {/* Action Buttons */}
              <View style={{ flexDirection: 'row', gap: S.sm, marginTop: S.sm }}>
                <TouchableOpacity
                  onPress={handleLater}
                  accessibilityRole="button"
                  style={{ flex: 1, height: 48, borderRadius: R.md, backgroundColor: theme.surfaceContainerHigh, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ color: theme.onSurfaceVariant, fontWeight: '700', fontSize: F.body }}>
                    {tr ? 'Daha Sonra' : 'Later'}
                  </Text>
                </TouchableOpacity>

                {rating !== null && (
                  <TouchableOpacity
                    disabled={sending}
                    onPress={handleSubmit}
                    accessibilityRole="button"
                    style={{ flex: 1, height: 48, borderRadius: R.md, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' }}
                  >
                    {sending ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Text style={{ color: '#FFF', fontWeight: '800', fontSize: F.body }}>
                        {rating >= POSITIVE_RATING_THRESHOLD ? (tr ? 'Yorum Yap' : 'Rate App') : (tr ? 'Gönder' : 'Submit')}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </>
          ) : (
            <MotiView
              from={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              style={{ alignItems: 'center', paddingVertical: S.lg, gap: S.md }}
            >
              <Text style={{ fontSize: 44 }}>❤️</Text>
              <Text style={{ color: theme.onSurface, fontSize: F.subhead, fontWeight: '800', textAlign: 'center' }}>
                {tr ? 'Geri bildiriminiz için teşekkürler!' : 'Thank you for your feedback!'}
              </Text>
              <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, textAlign: 'center', opacity: 0.7 }}>
                {tr ? 'TAZQ\'u geliştirmek için durmaksızın çalışıyoruz.' : 'We are constantly working to improve TAZQ.'}
              </Text>
            </MotiView>
          )}
        </MotiView>
      </View>
    </Modal>
  );
}
