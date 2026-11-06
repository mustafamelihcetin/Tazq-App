import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, TouchableWithoutFeedback, Keyboard, Modal, ScrollView, Linking } from 'react-native';
import { swallow } from '@/shared/utils/swallow';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { useRouter } from 'expo-router';
import { Mail, Lock, AlertCircle, Eye, EyeOff, CheckCircle2, Ban } from 'lucide-react-native';
import { AuthService } from '@/shared/services/api';
import { useAuthStore } from '@/features/user';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { GlassCard } from '@/shared/components/GlassCard';
import { useToastStore } from '@/shared/store/useToastStore';
import { AnimatedBackground } from '@/shared/components/AnimatedBackground';
import { AUTH_COPY, AuthBrand, AuthDivider, AuthField, SocialButton } from '@/features/user/components/AuthParts';
import { ICON, S, R, F, scale, verticalScale, B, SCRIM } from '@/shared/constants/tokens';
import { Touchable } from '@/shared/components/Touchable';
import { CustomAlert as Alert, AlertHost } from '@/shared/components/CustomAlert';
import { validateLogin, isValidEmail } from '@/shared/utils/validation';
import { httpStatusOf, isNetworkError, errorMessage, errorCode, httpDataOf } from '@/shared/utils/errors';
import { readGoogleResponse, isGoogleCancel, googleFailureSuffix } from '@/features/user/utils/googleResponse';
import { haptic } from '@/shared/utils/haptics';
import { goHomeAfterAuth } from '@/shared/utils/authNavigation';

/*
  GİRİŞ EKRANI METİNLERİ (2026-11-01 yeniden düzenleme). Ortak parçalar ve sosyal/alan metinleri: AuthParts.
*/
const LOGIN_COPY = {
  tr: {
    title: 'Tekrar hoş geldin',
    sub: 'Kaldığın yerden devam etmek için giriş yap',
    signIn: 'Giriş yap',
    showPassword: 'Şifreyi göster',
    hidePassword: 'Şifreyi gizle',
    noAccount: 'Hesabın yok mu?',
    guest: 'Şimdilik hesapsız göz at',
    legalLead: 'Devam ederek ',
    terms: 'Kullanıcı Sözleşmesi',
    legalSep1: ', ',
    privacy: 'Gizlilik Politikası',
    legalSep2: ' ve ',
    kvkk: 'KVKK Metni',
    legalTail: '’ni kabul etmiş olursun.',
  },
  en: {
    title: 'Welcome back',
    sub: 'Sign in to pick up where you left off',
    signIn: 'Sign in',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    noAccount: 'New here?',
    guest: 'Browse without an account for now',
    legalLead: 'By continuing you agree to the ',
    terms: 'Terms of Service',
    legalSep1: ', ',
    privacy: 'Privacy Policy',
    legalSep2: ' and ',
    kvkk: 'Data Notice',
    legalTail: '.',
  },
};

export default function LoginScreen() {
  const { theme, isDark } = useAppTheme();
  const { t, language } = useLanguageStore();
  const router = useRouter();
  const setAuth = useAuthStore(state => state.setAuth);
  const startGuest = useAuthStore(state => state.startGuest);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bannedInfo, setBannedInfo] = useState<{ reason: string; until: string | null } | null>(null);

  const [forgotVisible, setForgotVisible] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState<{ text: string; success: boolean } | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotResendIn, setForgotResendIn] = useState(0);
  
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  // 403 banlı yanıtını ayrı "askıya alındı" kutusuna dönüştürür (login/google/apple ortak)
  const applyBannedIfAny = (err: any): boolean => {
    const d = err?.response?.data;
    if (err?.response?.status === 403 && d?.banned) {
      const tr = language === 'tr';
      const until = d.bannedUntil
        ? new Date(d.bannedUntil).toLocaleString(tr ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : null;
      setBannedInfo({ reason: d.reason || (tr ? 'Belirtilmedi' : 'Not specified'), until });
      return true;
    }
    return false;
  };

  const handleGoogleSignIn = async () => {
    let GoogleSignin: any;
    const { NativeModules } = require('react-native');
    if (!NativeModules.RNGoogleSignin) {
      Alert.alert(
        language === 'tr' ? 'Desteklenmiyor' : 'Unsupported',
        language === 'tr'
          ? 'Google ile giriş bu cihaz derlemesinde desteklenmiyor. Lütfen yeni bir geliştirici build\'i alın.'
          : 'Google Sign-In is not supported in this client build. Please build a new development client.'
      );
      return;
    }

    try {
      GoogleSignin = require('@react-native-google-signin/google-signin').GoogleSignin;
    } catch (e) {
      swallow('login.googleSignInRequire', e);
      return;
    }

    setIsLoading(true);
    setError(null);
    setBannedInfo(null);
    haptic.commit();

    try {
      await GoogleSignin.hasPlayServices();
      // v13+: iptal hata değil `{ type: 'cancelled' }` — bkz. googleResponse.ts.
      const outcome = readGoogleResponse(await GoogleSignin.signIn());
      if (outcome.kind === 'cancelled') return;
      const { idToken } = outcome;

      const { token, refreshToken, isNewUser, isReactivated } = await AuthService.googleLogin(idToken);
      const userData = await AuthService.getCurrentUser(token);
      setAuth(userData, token, refreshToken, isNewUser);
      haptic.success();
      if (isReactivated) useToastStore.getState().show(language === 'tr' ? 'Tekrar hoş geldin! Hesabın ve tüm verilerin geri geldi.' : 'Welcome back! Your account and data have been restored.', 'success');
      goHomeAfterAuth(router);
    } catch (err: unknown) {
      swallow('login.googleSignIn', err, { capture: true });
      haptic.error();
      if (isGoogleCancel(err)) return;
      if (applyBannedIfAny(err)) return;
      setError((language === 'tr' ? 'Google ile giriş başarısız oldu.' : 'Google Sign-In failed.') + googleFailureSuffix(err, __DEV__));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    let AppleAuthentication: any;
    try {
      AppleAuthentication = require('expo-apple-authentication');
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert(
          language === 'tr' ? 'Desteklenmiyor' : 'Unsupported',
          language === 'tr'
            ? 'Apple ile giriş bu cihazda desteklenmiyor.'
            : 'Apple Sign-In is not supported on this device.'
        );
        return;
      }
    } catch (e) {
      Alert.alert(
        language === 'tr' ? 'Desteklenmiyor' : 'Unsupported',
        language === 'tr'
          ? 'Apple ile giriş bu cihaz derlemesinde desteklenmiyor. Lütfen yeni bir geliştirici build\'i alın.'
          : 'Apple Sign-In is not supported in this client build. Please build a new development client.'
      );
      return;
    }

    setIsLoading(true);
    setError(null);
    setBannedInfo(null);
    haptic.commit();

    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const identityToken = credential.identityToken;
      if (!identityToken) {
        throw new Error('Apple identity token was not returned.');
      }

      const { token, refreshToken, isNewUser, isReactivated } = await AuthService.appleLogin(
        identityToken,
        credential.fullName?.givenName || undefined,
        credential.fullName?.familyName || undefined
      );

      const userData = await AuthService.getCurrentUser(token);
      setAuth(userData, token, refreshToken, isNewUser);
      haptic.success();
      if (isReactivated) useToastStore.getState().show(language === 'tr' ? 'Tekrar hoş geldin! Hesabın ve tüm verilerin geri geldi.' : 'Welcome back! Your account and data have been restored.', 'success');
      goHomeAfterAuth(router);
    } catch (err: unknown) {
      swallow('login.appleSignIn', err, { capture: true });
      haptic.error();
      if (errorCode(err) === 'ERR_REQUEST_CANCELED' || errorCode(err) === 'ERR_CANCELED') {
        return;
      }
      if (applyBannedIfAny(err)) return;
      setError(language === 'tr' ? 'Apple ile giriş başarısız oldu.' : 'Apple Sign-In failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    const invalid = validateLogin(email, password);
    if (invalid === 'empty') {
      setError(t.login.error);
      return;
    }
    if (invalid === 'invalidEmail') {
      setError(t.login.invalidEmail);
      return;
    }

    setIsLoading(true);
    setError(null);
    setBannedInfo(null);
    haptic.commit();

    try {
      const res = await AuthService.login(email, password);
      /*
        DOĞRULANMAMIŞ HESAP ARTIK GİRİŞ YAPIYOR: yeni sunucu bu durumda da token
        döndürüyor, yanında yalnız bir HATIRLATMA bayrağı geliyor. Token YOKSA sunucu
        eski sürümdür ve eski davranış (doğrulama ekranı) geçerlidir — uygulama
        güncellenmiş ama sunucu güncellenmemişse kullanıcı kilitte kalmasın.
      */
      if (res?.needsVerification && !res?.token) {
        haptic.destructive();
        router.push({ pathname: '/verify-email', params: { email } });
        return;
      }
      const { token, refreshToken, isReactivated } = res;
      const userData = await AuthService.getCurrentUser(token);
      setAuth(userData, token, refreshToken);
      haptic.success();
      if (isReactivated) useToastStore.getState().show(language === 'tr' ? 'Tekrar hoş geldin! Hesabın ve tüm verilerin geri geldi.' : 'Welcome back! Your account and data have been restored.', 'success');
      goHomeAfterAuth(router);
    } catch (err: unknown) {
      haptic.error();
      const data = httpDataOf<{ banned?: boolean; reason?: string; bannedUntil?: string }>(err);
      if (isNetworkError(err)) {
        setError(t.login.networkError);
      } else if (httpStatusOf(err) === 403 && data.banned) {
        // Askıya alınmış hesap → ayrı, özel bir bilgilendirme kutusunda göster
        const tr = language === 'tr';
        const reason = data.reason || (tr ? 'Belirtilmedi' : 'Not specified');
        const until = data.bannedUntil
          ? new Date(data.bannedUntil).toLocaleString(tr ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
          : null;
        setBannedInfo({ reason, until });
      } else {
        setError(t.login.error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // "Tekrar gönder" için geri sayım
  useEffect(() => {
    if (forgotResendIn <= 0) return;
    const id = setInterval(() => setForgotResendIn((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [forgotResendIn]);

  const closeForgotModal = () => {
    setForgotVisible(false);
    setForgotEmail('');
    setForgotMsg(null);
    setForgotSuccess(false);
    setForgotResendIn(0);
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail.trim()) return;
    if (!isValidEmail(forgotEmail)) {
      setForgotMsg({ text: t.login.invalidEmail, success: false });
      return;
    }
    setForgotLoading(true);
    setForgotMsg(null);
    try {
      await AuthService.forgotPassword(forgotEmail.trim());
      setForgotSuccess(true);
      setForgotResendIn(45);
    } catch (err: unknown) {
      const errMsg = httpDataOf<{ message?: string }>(err).message || t.login.forgotError;
      setForgotMsg({ text: errMsg, success: false });
    } finally {
      setForgotLoading(false);
    }
  };

  // Başarı ekranından yeni bağlantı yolla (öncekini backend geçersiz kılar)
  const resendForgot = async () => {
    if (forgotResendIn > 0 || forgotLoading) return;
    setForgotLoading(true);
    try {
      await AuthService.forgotPassword(forgotEmail.trim());
      setForgotResendIn(45);
      haptic.select();
      useToastStore.getState().show(language === 'tr' ? 'Yeni bağlantı gönderildi' : 'New link sent', 'success');
    } catch {
      /* sessiz — güvenlik için hesap varlığını sızdırmayız */
    } finally {
      setForgotLoading(false);
    }
  };

  const c = LOGIN_COPY[language === 'en' ? 'en' : 'tr'];
  const a = AUTH_COPY[language === 'en' ? 'en' : 'tr'];
  const goLegal = (doc: 'terms' | 'privacy' | 'kvkk') => router.push({ pathname: '/legal', params: { doc } });

  return (
    <TouchableWithoutFeedback accessible={false} onPress={Keyboard.dismiss}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <AnimatedBackground />

        <SafeAreaView style={styles.safeArea}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 320 }} style={styles.stack}>
              <AuthBrand title={c.title} sub={c.sub} theme={theme} />

              {error && (
                <View accessibilityLiveRegion="polite" style={[styles.errorContainer, { backgroundColor: theme.error + '15' }]}>
                  <AlertCircle size={ICON.sm} color={theme.error} style={{ marginTop: S.xxs }} />
                  <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
                </View>
              )}

              {bannedInfo && (
                <View style={[styles.bannedBox, { backgroundColor: theme.error + '12', borderColor: theme.error + '35' }]}>
                  <View style={styles.bannedHeader}>
                    <View style={[styles.bannedIcon, { backgroundColor: theme.error + '20' }]}>
                      <Ban size={ICON.sm} color={theme.error} strokeWidth={2.4} />
                    </View>
                    <Text style={[styles.bannedTitle, { color: theme.error }]}>
                      {language === 'tr' ? 'Hesabın askıya alındı' : 'Your account is suspended'}
                    </Text>
                  </View>
                  <View style={styles.bannedRow}>
                    <Text style={[styles.bannedLabel, { color: theme.onSurfaceVariant }]}>{language === 'tr' ? 'Sebep' : 'Reason'}</Text>
                    <Text style={[styles.bannedValue, { color: theme.onSurface }]}>{bannedInfo.reason}</Text>
                  </View>
                  <View style={styles.bannedRow}>
                    <Text style={[styles.bannedLabel, { color: theme.onSurfaceVariant }]}>{language === 'tr' ? 'Süre' : 'Duration'}</Text>
                    <Text style={[styles.bannedValue, { color: theme.onSurface }]}>
                      {bannedInfo.until ? (language === 'tr' ? `${bannedInfo.until} tarihine kadar` : `Until ${bannedInfo.until}`) : (language === 'tr' ? 'Kalıcı' : 'Permanent')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => Linking.openURL(`mailto:destek@tazqapp.com?subject=${encodeURIComponent((language === 'tr' ? 'Ban itirazı - ' : 'Ban appeal - ') + email)}`)}
                    activeOpacity={0.7}
                    accessibilityRole="link"
                    accessibilityLabel={language === 'tr' ? 'Hesap kapatmaya itiraz et — destek e-postası aç' : 'Appeal the ban — open support email'}
                    style={[styles.bannedAppeal, { borderColor: theme.error + '30' }]}
                  >
                    <Mail size={ICON.xs} color={theme.error} />
                    <Text style={[styles.bannedAppealText, { color: theme.error }]}>
                      {language === 'tr' ? 'İtiraz et: destek@tazqapp.com' : 'Appeal: destek@tazqapp.com'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Sosyal giriş önce ve tam genişlik (bkz. AuthParts): telefonda en hızlı yol. */}
              <View style={styles.socialStack}>
                {Platform.OS === 'ios' && (
                  <SocialButton provider="apple" label={a.apple} onPress={handleAppleSignIn} disabled={isLoading} theme={theme} isDark={isDark} />
                )}
                <SocialButton provider="google" label={a.google} onPress={handleGoogleSignIn} disabled={isLoading} theme={theme} isDark={isDark} />
              </View>

              <AuthDivider text={a.orEmail} theme={theme} />

              <View style={styles.form}>
                <AuthField
                  ref={emailRef}
                  icon={Mail}
                  theme={theme}
                  accessibilityLabel={a.email}
                  placeholder={a.email}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                  keyboardType="email-address"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />
                <AuthField
                  ref={passwordRef}
                  icon={Lock}
                  theme={theme}
                  accessibilityLabel={a.password}
                  placeholder={a.password}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoComplete="current-password"
                  textContentType="password"
                  returnKeyType="go"
                  onSubmitEditing={handleLogin}
                  right={
                    <Touchable onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityRole="button" accessibilityLabel={showPassword ? c.hidePassword : c.showPassword}>
                      {showPassword ? <EyeOff size={ICON.sm} color={theme.onSurfaceMuted} /> : <Eye size={ICON.sm} color={theme.onSurfaceMuted} />}
                    </Touchable>
                  }
                />
                <Touchable onPress={() => setForgotVisible(true)} style={styles.forgot} accessibilityRole="button" accessibilityLabel={t.login.forgotPassword}>
                  <Text style={[styles.forgotText, { color: theme.primary }]}>{t.login.forgotPassword}</Text>
                </Touchable>

                <Touchable
                  onPress={handleLogin}
                  disabled={isLoading}
                  accessibilityRole="button"
                  accessibilityLabel={c.signIn}
                  accessibilityState={{ disabled: isLoading, busy: isLoading }}
                  style={[styles.loginButton, { backgroundColor: theme.primaryFill, opacity: isLoading ? 0.75 : 1 }]}
                >
                  {isLoading ? <ActivityIndicator color={theme.onPrimaryFill} /> : <Text style={[styles.buttonText, { color: theme.onPrimaryFill }]}>{c.signIn}</Text>}
                </Touchable>
              </View>

              <Text style={[styles.disclaimerText, { color: theme.onSurfaceMuted }]}>
                {c.legalLead}
                <Text style={[styles.legalLink, { color: theme.onSurfaceVariant }]} onPress={() => goLegal('terms')} accessibilityRole="link">{c.terms}</Text>
                {c.legalSep1}
                <Text style={[styles.legalLink, { color: theme.onSurfaceVariant }]} onPress={() => goLegal('privacy')} accessibilityRole="link">{c.privacy}</Text>
                {c.legalSep2}
                <Text style={[styles.legalLink, { color: theme.onSurfaceVariant }]} onPress={() => goLegal('kvkk')} accessibilityRole="link">{c.kvkk}</Text>
                {c.legalTail}
              </Text>
            </MotiView>

            <View style={styles.footer}>
              <Text style={[styles.footerText, { color: theme.onSurfaceVariant }]}>
                {c.noAccount}{' '}
                <Text style={[styles.link, { color: theme.primary }]} onPress={() => router.push('/register')} accessibilityRole="link">{t.login.signUp}</Text>
              </Text>

              {/*
                HESAPSIZ DENEME — özendirilmez (2026-11-01, kullanıcı): marka rengi, simge ve ok kalktı;
                en altta soluk, küçük bir bağlantı. Seçenek durur ama varsayılan yol hesaptır.
              */}
              <TouchableOpacity
                onPress={() => { startGuest(); goHomeAfterAuth(router); }}
                activeOpacity={0.6}
                style={styles.guest}
                accessibilityRole="button"
                accessibilityLabel={t.guest.tryWithoutAccount}
                accessibilityHint={t.guest.tryHint}
              >
                <Text style={[styles.guestText, { color: theme.onSurfaceMuted }]}>{c.guest}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>

        <Modal supportedOrientations={['portrait', 'landscape']} visible={forgotVisible} transparent animationType="fade">
          <KeyboardAvoidingView
            behavior="padding"
            style={{ flex: 1 }}
          >
          <TouchableWithoutFeedback accessible={false} onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <GlassCard style={styles.modalCard} floating>
              {forgotSuccess ? (
                <View style={{ alignItems: 'center', gap: S.md, paddingVertical: S.sm }}>
                  <View style={{ width: 56, height: 56, borderRadius: R.full, backgroundColor: theme.tertiary + '15', alignItems: 'center', justifyContent: 'center' }}>
                    <CheckCircle2 size={ICON.xl} color={theme.tertiary} />
                  </View>
                  <Text style={{ fontFamily: 'Jakarta-ExtraBold', fontSize: F.title, color: theme.onSurface, textAlign: 'center' }}>
                    {language === 'tr' ? 'E-posta Gönderildi' : 'Email Sent'}
                  </Text>
                  <Text style={{ fontSize: F.footnote, color: theme.onSurfaceVariant, textAlign: 'center', lineHeight: 18, fontFamily: 'Jakarta-SemiBold', paddingHorizontal: S.xs }}>
                    {language === 'tr' 
                      ? 'Şifre sıfırlama talimatları e-posta adresinize başarıyla gönderildi. Gelen kutunuzu kontrol edin.'
                      : 'Password reset instructions have been sent to your email. Please check your inbox.'}
                  </Text>
                  <Touchable 
                    onPress={closeForgotModal} 
                    accessibilityRole="button"
                    accessibilityLabel={language === 'tr' ? 'Tamam, kapat' : 'OK, close'}
                    style={{ 
                      backgroundColor: theme.primaryFill, 
                      width: '100%', 
                      marginTop: S.sm, 
                      height: 44, 
                      borderRadius: R.md,
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Text style={{ color: theme.onPrimaryFill, fontWeight: '700', fontFamily: 'Jakarta-Bold' }}>
                      {language === 'tr' ? 'Harika' : 'Got it'}
                    </Text>
                  </Touchable>

                  <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: S.xs, marginTop: S.xxs }}>
                    <Text style={{ fontSize: 12.5, color: theme.onSurfaceVariant, fontFamily: 'Jakarta-Medium' }}>
                      {language === 'tr' ? 'Ulaşmadı mı?' : "Didn't arrive?"}
                    </Text>
                    <TouchableOpacity onPress={resendForgot} disabled={forgotResendIn > 0 || forgotLoading} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={language === 'tr' ? 'Sıfırlama e-postasını tekrar gönder' : 'Resend reset email'} accessibilityState={{ disabled: forgotResendIn > 0 || forgotLoading }}>
                      <Text style={{ fontSize: 12.5, fontWeight: '700', fontFamily: 'Jakarta-Bold', color: forgotResendIn > 0 ? theme.onSurfaceVariant : theme.primary }}>
                        {forgotResendIn > 0
                          ? (language === 'tr' ? `${forgotResendIn} sn sonra tekrar gönder` : `Resend in ${forgotResendIn}s`)
                          : (language === 'tr' ? 'Tekrar gönder' : 'Resend')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.modalTitle, { color: theme.onSurface, fontFamily: 'Jakarta-ExtraBold' }]}>{t.login.forgotTitle}</Text>
                  <Text style={[styles.modalSub, { color: theme.onSurfaceVariant, fontFamily: 'Jakarta-Medium', marginTop: S.xxs, marginBottom: S.smd }]}>{t.login.forgotSub}</Text>
                  
                  {forgotMsg && (
                    <MotiView 
                      from={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      style={{ 
                        flexDirection: 'row', 
                        alignItems: 'center', 
                        gap: S.sm, 
                        padding: S.sm + 4, 
                        borderRadius: R.sm + 4, 
                        backgroundColor: theme.error + '15',
                        marginBottom: S.sm
                      }}
                    >
                      <AlertCircle size={ICON.sm} color={theme.error} />
                      <Text style={{ flex: 1, fontSize: F.footnote, fontWeight: '600', color: theme.error }}>{forgotMsg.text}</Text>
                    </MotiView>
                  )}

                  <View style={[styles.inputWrapper, {
                    backgroundColor: theme.surfaceContainerLow,
                    borderColor: theme.outlineVariant,
                    height: 46,
                    marginBottom: S.md,
                  }]}>
                    <Mail size={ICON.md} color={isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.45)'} />
                    <TextInput
                      placeholder={t.login.email}
                      placeholderTextColor={isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.35)'}
                      style={[styles.input, { color: theme.onSurface }]}
                      value={forgotEmail}
                      onChangeText={setForgotEmail}
                      autoCapitalize="none"
                      autoCorrect={false}
                      spellCheck={false}
                      autoComplete="email"
                      textContentType="emailAddress"
                      keyboardType="email-address"
                      underlineColorAndroid="transparent"
                    />
                  </View>

                  <View style={styles.modalActions}>
                    <Touchable 
                      onPress={closeForgotModal} 
                      accessibilityRole="button"
                      accessibilityLabel={language === 'tr' ? 'İptal' : 'Cancel'}
                      style={{ 
                        flex: 1, 
                        height: 44, 
                        borderRadius: R.md, 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' 
                      }}
                    >
                      <Text style={{ color: theme.onSurfaceVariant, fontFamily: 'Jakarta-Bold', fontSize: F.body }}>{t.cancel}</Text>
                    </Touchable>
                    <Touchable 
                      onPress={handleForgotPassword} 
                      disabled={forgotLoading} 
                      accessibilityRole="button"
                      accessibilityLabel={language === 'tr' ? 'Sıfırlama bağlantısı gönder' : 'Send reset link'}
                      accessibilityState={{ disabled: forgotLoading, busy: forgotLoading }} 
                      style={{ 
                        flex: 2, 
                        height: 44, 
                        borderRadius: R.md, 
                        backgroundColor: theme.primaryFill, 
                        alignItems: 'center', 
                        justifyContent: 'center' 
                      }}
                    >
                      {forgotLoading ? (
                        <ActivityIndicator color={theme.onPrimaryFill} size="small" />
                      ) : (
                        <Text style={{ color: theme.onPrimaryFill, fontFamily: 'Jakarta-Bold', fontSize: F.body }}>{t.login.forgotSend}</Text>
                      )}
                    </Touchable>
                  </View>
                </>
              )}
            </GlassCard>
          </View>
          </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
          <AlertHost />{/* modal içinden açılan uyarı burada, modalın üstünde (bkz. CustomAlert) */}
        </Modal>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'space-between', paddingHorizontal: scale(24), paddingVertical: S.xl, width: '100%', maxWidth: 440, alignSelf: 'center', gap: S.xl },
  stack: { gap: S.lg, width: '100%' },
  errorContainer: { flexDirection: 'row', alignItems: 'flex-start', gap: S.sm, padding: S.smd, borderRadius: R.md },
  errorText: { flex: 1, fontSize: F.footnote, fontWeight: '600', lineHeight: verticalScale(18), flexWrap: 'wrap' },
  bannedBox: { borderWidth: B.thin, borderRadius: R.md, padding: S.md, gap: S.sm },
  bannedHeader: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  bannedIcon: { width: 30, height: 30, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  bannedTitle: { flex: 1, fontSize: F.body, fontWeight: '700', letterSpacing: -0.2 },
  bannedRow: { flexDirection: 'row', alignItems: 'flex-start', gap: S.sm },
  bannedLabel: { width: 52, fontSize: F.caption, fontWeight: '700' },
  bannedValue: { flex: 1, fontSize: F.footnote, fontWeight: '600', lineHeight: verticalScale(17) },
  bannedAppeal: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, borderWidth: B.thin, borderRadius: R.md, paddingVertical: S.sm, marginTop: S.xxs },
  bannedAppealText: { fontSize: F.footnote, fontWeight: '700' },
  socialStack: { gap: S.smd },
  form: { gap: S.smd },
  forgot: { alignSelf: 'flex-end', paddingVertical: S.xs },
  forgotText: { fontSize: F.footnote, fontWeight: '600' },
  loginButton: { height: 52, borderRadius: R.md, alignItems: 'center', justifyContent: 'center', marginTop: S.xs },
  buttonText: { fontSize: F.body, fontWeight: '700' },
  disclaimerText: { fontSize: F.caption, lineHeight: 17, textAlign: 'center', paddingHorizontal: S.sm },
  legalLink: { fontWeight: '600', textDecorationLine: 'underline' },
  footer: { alignItems: 'center', gap: S.md },
  footerText: { fontSize: F.body, fontWeight: '500' },
  link: { fontSize: F.body, fontWeight: '700' },
  guest: { paddingVertical: S.sm, paddingHorizontal: S.md },
  guestText: { fontSize: F.footnote, fontWeight: '500' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, borderRadius: R.md, borderWidth: B.thin, gap: S.smd },
  input: { flex: 1, fontSize: F.body, fontWeight: '600', height: '100%', textAlignVertical: 'center' },
  modalOverlay: { flex: 1, backgroundColor: SCRIM, justifyContent: 'center', padding: scale(24) },
  modalCard: { padding: scale(24), gap: S.md },
  modalTitle: { fontSize: F.title + 2, fontWeight: '700' },
  modalSub: { fontSize: F.body, fontWeight: '500', lineHeight: verticalScale(20) },
  modalActions: { flexDirection: 'row', gap: S.md },
});

export { RouteErrorBoundary as ErrorBoundary } from '@/shared/components/CrashFallback'; // çökerse yalnız bu ekran düşer
