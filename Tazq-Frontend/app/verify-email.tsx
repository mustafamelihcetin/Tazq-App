import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, useWindowDimensions, KeyboardAvoidingView, Platform, ActivityIndicator, TouchableWithoutFeedback, Keyboard, ScrollView, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView, MotiText } from 'moti';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ArrowRight, MailCheck } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { AuthService } from '@/shared/services/api';
import { useAuthStore } from '@/features/user';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { GlassCard } from '@/shared/components/GlassCard';
import { AnimatedBackground } from '@/shared/components/AnimatedBackground';
import { Touchable } from '@/shared/components/Touchable';
import { useToastStore } from '@/shared/store/useToastStore';
import { ICON, S, R, F, B, scale, verticalScale, moderateScale } from '@/shared/constants/tokens';

const CODE_LEN = 6;

export default function VerifyEmailScreen() {
  const { theme, isDark } = useAppTheme();
  const { language } = useLanguageStore();
  const tr = language === 'tr';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const setAuth = useAuthStore((s) => s.setAuth);
  const { height } = useWindowDimensions();
  const isSmallScreen = height < 750;
  const isMediumScreen = height < 850;

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setInterval(() => setResendIn((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [resendIn]);

  const verify = async (full?: string) => {
    const c = (full ?? code).trim();
    if (c.length !== CODE_LEN || loading || !email) return;
    setLoading(true);
    setError(null);
    Keyboard.dismiss();
    try {
      const { token, refreshToken, isNewUser } = await AuthService.verifyEmail(email, c);
      const userData = await AuthService.getCurrentUser(token);
      setAuth(userData, token, refreshToken, isNewUser ?? true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/');
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(tr ? 'Kod geçersiz veya süresi dolmuş.' : 'Invalid or expired code.');
      setCode('');
      setTimeout(() => inputRef.current?.focus(), 50);
    } finally {
      setLoading(false);
    }
  };

  const onChange = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, CODE_LEN);
    setCode(digits);
    if (error) setError(null);
    if (digits.length === CODE_LEN) verify(digits);
  };

  const resend = async () => {
    if (resendIn > 0 || !email) return;
    try {
      await AuthService.resendVerification(email);
      setResendIn(45);
      Haptics.selectionAsync();
      useToastStore.getState().show(tr ? 'Kod tekrar gönderildi' : 'Code resent', 'success');
    } catch {
      /* sessiz */
    }
  };

  const boxW = isSmallScreen ? scale(40) : scale(46);
  const boxH = isSmallScreen ? verticalScale(46) : verticalScale(54);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <AnimatedBackground />

        <SafeAreaView style={styles.safeArea}>
          <Touchable
            onPress={() => router.replace('/register')}
            style={[styles.backButton, { top: insets.top + 12 }]}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={tr ? 'Geri' : 'Back'}
          >
            <ArrowLeft size={ICON.lg} color={theme.onSurface} />
          </Touchable>

          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <ScrollView
              style={styles.keyboardView}
              contentContainerStyle={[styles.scrollContent, { justifyContent: 'center', paddingVertical: isSmallScreen ? 16 : 32 }]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={{ gap: isSmallScreen ? 16 : isMediumScreen ? 22 : 28, width: '100%' }}>
                {/* Başlık */}
                <MotiView
                  from={{ opacity: 0, scale: 0.8, translateY: -20 }}
                  animate={{ opacity: 1, scale: 1, translateY: 0 }}
                  style={styles.header}
                >
                  <View
                    style={{
                      width: isSmallScreen ? scale(56) : scale(66),
                      height: isSmallScreen ? scale(56) : scale(66),
                      borderRadius: R.lg + 4,
                      backgroundColor: theme.primary + (isDark ? '20' : '14'),
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <MailCheck size={isSmallScreen ? 28 : 34} color={theme.primary} strokeWidth={2.2} />
                  </View>
                  <MotiText
                    from={{ opacity: 0, translateY: 10 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ delay: 200 }}
                    style={[styles.title, { color: theme.onSurface, marginTop: verticalScale(14) }]}
                  >
                    {tr ? 'E-postanı Doğrula' : 'Verify your email'}
                  </MotiText>
                  <Text style={[styles.subtitle, { color: theme.onSurfaceMuted, marginTop: verticalScale(6) }]}>
                    {tr ? '6 haneli kodu şu adrese gönderdik' : 'We sent a 6-digit code to'}
                  </Text>
                  {!!email && (
                    <Text style={[styles.email, { color: theme.onSurface }]} numberOfLines={1}>
                      {email}
                    </Text>
                  )}
                </MotiView>

                {/* Kart */}
                <MotiView
                  from={{ opacity: 0, translateY: 20 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ delay: 400 }}
                  style={{ width: '100%' }}
                >
                  <GlassCard style={{ width: '100%', padding: isSmallScreen ? S.md : S.lg, gap: isSmallScreen ? S.md : S.lg }}>
                    {/* OTP kutuları */}
                    <Pressable onPress={() => inputRef.current?.focus()} style={styles.otpRow}>
                      {Array.from({ length: CODE_LEN }).map((_, i) => {
                        const ch = code[i];
                        const active = i === code.length;
                        const filled = ch != null;
                        const borderColor = error
                          ? theme.error
                          : active
                          ? theme.primary
                          : filled
                          ? theme.outline
                          : theme.outlineVariant;
                        return (
                          <MotiView
                            key={i}
                            animate={{ borderColor, scale: active ? 1.05 : 1 }}
                            transition={{ type: 'timing', duration: 160 }}
                            style={{
                              width: boxW,
                              height: boxH,
                              borderRadius: R.md,
                              borderWidth: active ? B.medium + 0.4 : B.thin,
                              backgroundColor: theme.surfaceContainerLow,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Text style={{ fontSize: F.title, fontFamily: 'Jakarta-ExtraBold', color: theme.onSurface }}>
                              {ch ?? ''}
                            </Text>
                          </MotiView>
                        );
                      })}
                    </Pressable>

                    {/* Gizli giriş (klavyeyi yönetir) */}
                    <TextInput
                      ref={inputRef}
                      value={code}
                      onChangeText={onChange}
                      keyboardType="number-pad"
                      textContentType="oneTimeCode"
                      autoComplete="sms-otp"
                      maxLength={CODE_LEN}
                      autoFocus
                      editable={!loading}
                      style={styles.hiddenInput}
                    />

                    {error && (
                      <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
                    )}

                    {/* Doğrula butonu */}
                    <Touchable
                      onPress={() => verify()}
                      disabled={loading || code.length < CODE_LEN}
                      style={[styles.button, { opacity: code.length < CODE_LEN || loading ? 0.5 : 1 }]}
                    >
                      <MotiView animate={{ backgroundColor: theme.secondary }} style={styles.buttonInner}>
                        {loading ? (
                          <ActivityIndicator color={theme.onSecondary} />
                        ) : (
                          <>
                            <Text style={[styles.buttonText, { color: theme.onSecondary }]}>{tr ? 'Doğrula' : 'Verify'}</Text>
                            <ArrowRight size={ICON.md} color={theme.onSecondary} />
                          </>
                        )}
                      </MotiView>
                    </Touchable>

                    {/* Tekrar gönder */}
                    <View style={styles.resendRow}>
                      <Text style={[styles.resendText, { color: theme.onSurfaceVariant }]}>
                        {tr ? 'Kod gelmedi mi?' : "Didn't get the code?"}
                      </Text>
                      <TouchableOpacity onPress={resend} disabled={resendIn > 0} activeOpacity={0.7} accessibilityRole="button">
                        <Text style={[styles.resendLink, { color: resendIn > 0 ? theme.onSurfaceVariant : theme.secondary }]}>
                          {resendIn > 0 ? `${resendIn}s` : tr ? ' Tekrar gönder' : ' Resend'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </GlassCard>
                </MotiView>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  backButton: { position: 'absolute', left: scale(20), zIndex: 10, width: scale(40), height: scale(40), alignItems: 'center', justifyContent: 'center' },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: scale(24), width: '100%', maxWidth: 480, alignSelf: 'center' },
  header: { alignItems: 'center' },
  title: { fontSize: F.title + 4, fontFamily: 'Jakarta-ExtraBold', letterSpacing: -0.5, textAlign: 'center' },
  subtitle: { fontSize: F.body, fontWeight: '500', textAlign: 'center' },
  email: { fontSize: F.body, fontFamily: 'Jakarta-Bold', marginTop: verticalScale(2), textAlign: 'center' },
  otpRow: { flexDirection: 'row', justifyContent: 'center', gap: scale(8) },
  hiddenInput: { position: 'absolute', opacity: 0, height: 1, width: 1 },
  errorText: { fontSize: F.caption + 2, fontWeight: '600', textAlign: 'center' },
  button: { height: Platform.OS === 'android' ? verticalScale(50) : verticalScale(56), borderRadius: R.md, overflow: 'hidden' },
  buttonInner: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: moderateScale(10) },
  buttonText: { fontSize: F.subhead + 1, fontWeight: '700' },
  resendRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  resendText: { fontSize: moderateScale(14), fontWeight: '500' },
  resendLink: { fontSize: moderateScale(14), fontWeight: '700' },
});
