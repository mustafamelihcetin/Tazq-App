import React, { useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, TouchableWithoutFeedback, Keyboard, ScrollView } from 'react-native';
import { CustomAlert as Alert } from '@/shared/components/CustomAlert';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { useRouter } from 'expo-router';
import { Mail, Lock, User, AlertCircle, Eye, EyeOff, Check } from 'lucide-react-native';
import { AuthService } from '@/shared/services/api';
import { useAuthStore } from '@/features/user';
import { useToastStore } from '@/shared/store/useToastStore';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { AnimatedBackground } from '@/shared/components/AnimatedBackground';
import { AUTH_COPY, AuthBrand, AuthDivider, AuthField, SocialButton } from '@/features/user/components/AuthParts';
import { ICON, S, R, F, scale, verticalScale } from '@/shared/constants/tokens';
import { Touchable } from '@/shared/components/Touchable';
import { BackButton } from '@/shared/components/BackButton';
import { validateRegister } from '@/shared/utils/validation';
import { httpStatusOf, isNetworkError, errorMessage, errorCode, httpRawDataOf } from '@/shared/utils/errors';
import { readGoogleResponse, isGoogleCancel, googleFailureSuffix } from '@/features/user/utils/googleResponse';
import { haptic } from '@/shared/utils/haptics';
import { swallow } from '@/shared/utils/swallow';
import { useSessionStore } from '@/shared/store/useSessionStore';
import { goHomeAfterAuth } from '@/shared/utils/authNavigation';

/*
  KAYIT — giriş ekranıyla aynı dil (2026-11-01; bkz. AuthParts): marka, sosyal önce, e-posta formu,
  onay kutusu, tek birincil düğme. "Uygulamayı keşfet" soluk bir bağlantıya indi (özendirilmez).
*/
const REGISTER_COPY = {
  tr: {
    name: 'Adın', password: 'Şifre (en az 8 karakter)', create: 'Hesap oluştur',
    showPassword: 'Şifreyi göster', hidePassword: 'Şifreyi gizle',
    consentA11y: 'Kullanım koşullarını, gizlilik politikasını ve KVKK aydınlatma metnini okudum, kabul ediyorum',
    consentLead: '13 yaşından büyüğüm; ', terms: 'Kullanıcı Sözleşmesi', sep1: ', ', privacy: 'Gizlilik Politikası',
    sep2: ' ve ', kvkk: 'KVKK Aydınlatma Metni', consentTail: "'ni okudum, kabul ediyorum.",
    socialLegal: 'Google veya Apple ile devam ederek aynı koşulları kabul etmiş olursun.',
    haveAccount: 'Zaten hesabın var mı?', haveAccountA11y: 'Zaten hesabın var mı? Giriş yap',
    explore: 'Önce uygulamayı tanı',
  },
  en: {
    name: 'Your name', password: 'Password (8+ characters)', create: 'Create account',
    showPassword: 'Show password', hidePassword: 'Hide password',
    consentA11y: 'I have read and accept the terms, privacy policy and data notice',
    consentLead: "I'm 13 or older and accept the ", terms: 'Terms of Service', sep1: ', ', privacy: 'Privacy Policy',
    sep2: ' and ', kvkk: 'Data Protection Notice', consentTail: '.',
    socialLegal: 'By continuing with Google or Apple you accept the same terms.',
    haveAccount: 'Already have an account?', haveAccountA11y: 'Already have an account? Sign in',
    explore: 'See the app first',
  },
};


export default function RegisterScreen() {
  const { theme, isDark } = useAppTheme();
  const { t, language } = useLanguageStore();
  const tr = language === 'tr';
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const setAuth = useAuthStore(state => state.setAuth);

  // Misafirken hoş geldinde girilen ad (bkz. GuestProfile) — ikinci kez yazdırmayız.
  const [name, setName] = useState(() => useSessionStore.getState().guestProfile?.name ?? '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);

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
      swallow('register.googleSignInRequire', e);
      return;
    }

    setIsLoading(true);
    setError(null);
    haptic.commit();

    try {
      await GoogleSignin.hasPlayServices();
      // v13+: iptal hata değil `{ type: 'cancelled' }` — bkz. googleResponse.ts.
      const outcome = readGoogleResponse(await GoogleSignin.signIn());
      if (outcome.kind === 'cancelled') return;
      const { idToken } = outcome;

      /*
        `isNewUser` SUNUCUDAN GELİYOR ve taşınmak ZORUNDA.

        Bu iki sosyal yol onu okumuyordu; `setAuth` dördüncü parametresiz çağrılınca
        bayrak `false`a düşüyordu. Sonucu kullanıcı bildirdi: Google/Apple ile kayıt
        olan biri HOŞ GELDİN (profil kurulumu) ekranını hiç görmüyordu — ana ekranın
        kapısı `isFirstLogin` istiyor (bkz. app/index.tsx). Aynı dosyadaki e-posta yolu
        ve login.tsx'in sosyal yolları bunu baştan doğru yapıyordu; yalnız burası
        ayrışmıştı.
      */
      const { token, refreshToken, isNewUser } = await AuthService.googleLogin(idToken);
      const userData = await AuthService.getCurrentUser(token);
      setAuth(userData, token, refreshToken, isNewUser);
      haptic.success();
      goHomeAfterAuth(router);
    } catch (err: unknown) {
      swallow('register.googleSignIn', err, { capture: true });
      haptic.error();
      if (isGoogleCancel(err)) return;
      setError((language === 'tr' ? 'Google ile kayıt başarısız oldu.' : 'Google Sign-In failed.') + googleFailureSuffix(err, __DEV__));
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

      const { token, refreshToken, isNewUser } = await AuthService.appleLogin(
        identityToken,
        credential.fullName?.givenName || undefined,
        credential.fullName?.familyName || undefined
      );

      const userData = await AuthService.getCurrentUser(token);
      // Bayrak taşınmak zorunda — gerekçe için yukarıdaki Google yolundaki nota bkz.
      setAuth(userData, token, refreshToken, isNewUser);
      haptic.success();
      goHomeAfterAuth(router);
    } catch (err: unknown) {
      swallow('register.appleSignIn', err, { capture: true });
      haptic.error();
      if (errorCode(err) === 'ERR_REQUEST_CANCELED' || errorCode(err) === 'ERR_CANCELED') {
        return;
      }
      setError(language === 'tr' ? 'Apple ile kayıt başarısız oldu.' : 'Apple Sign-In failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    const invalid = validateRegister(name, email, password, consentChecked);
    if (invalid === 'empty') {
      setError(tr ? 'Tüm alanları doldurun.' : 'Please fill in all fields.');
      return;
    }
    if (invalid === 'invalidEmail') {
      setError(t.login.invalidEmail);
      return;
    }
    if (invalid === 'weakPassword') {
      setError(t.login.registerWeakPassword);
      return;
    }
    if (invalid === 'consent') {
      setError(tr ? 'Devam etmek için sözleşmeleri onaylamanız gerekir.' : 'You must accept the agreements to continue.');
      return;
    }

    setIsLoading(true);
    setError(null);
    haptic.commit();

    try {
      // 1) KAYIT adımı — hatası net bir sebep gösterir ("sebebi yok" olmaz).
      let registerRes: { token?: string; refreshToken?: string; needsVerification?: boolean } | null = null;
      try {
        registerRes = await AuthService.register({ name, email, password });
      } catch (err: unknown) {
        haptic.error();
        if (isNetworkError(err)) { setError(t.login.networkError); return; }
        const status = httpStatusOf(err) ?? 0;
        // Ham gövde: bu uç JSON ya da düz metin dönebiliyor, iki dal da korunmalı.
        const body = httpRawDataOf(err) ?? '';
        // Gövde JSON nesnesi de düz metin de olabilir; iki biçim de ele alınır.
        const bodyObj: { error?: string; message?: string; traceId?: string; TraceId?: string } =
          typeof body === 'object' && body !== null ? body : {};
        const bodyText = typeof body === 'string' ? body : '';
        // Yapısal hata kodunu tercih et; eski düz-metin yanıt için geriye dönük yedek.
        const isEmailTaken = bodyObj.error === 'email_taken' || bodyText.includes('zaten');
        if (isEmailTaken) { setError(t.login.registerEmailTaken); return; }
        if (status >= 500) {
          // Destek eşleşmesi için backend traceId'sinin son 8 hanesini "kod" olarak göster.
          const tid = bodyObj.traceId || bodyObj.TraceId || '' || '';
          const code = tid ? ` (${tr ? 'kod' : 'code'}: ${String(tid).slice(-8)})` : '';
          setError((tr ? 'Sunucu hatası. Lütfen sonra tekrar dene.' : 'Server error. Please try again later.') + code);
          return;
        }
        // Sunucudan açıklayıcı bir mesaj geldiyse onu göster; yoksa genel.
        const serverMsg = bodyText || bodyObj.message || '';
        setError(serverMsg || t.login.registerError);
        return;
      }

      /*
        2) KAYIT BAŞARILI — VE OTURUM HEMEN AÇILIYOR.

        ÖLÇÜLEN SORUN: kullanıcı buradan doğrulama ekranına atılıyordu; uygulamadan
        ÇIKIP e-postasını açmak, kodu bulmak ve geri dönmek zorundaydı. Üstelik bu,
        henüz hiçbir değer görmediği anda oluyordu — kayıt yolundaki en pahalı adım.

        Doğrulama kaldırılmadı, ERTELENDİ: kod yine gönderildi, hatırlatma Ayarlar'da
        duruyor ve e-posta gerektiren işler (özet postaları) doğrulanana kadar
        çalışmıyor (sunucu tarafı: ScheduledEmailService).

        Sunucu eski sürümdeyse token gelmez — o zaman ESKİ akış aynen geçerli.
      */
      haptic.success();
      const grantedToken = registerRes?.token;
      if (grantedToken) {
        const userData = await AuthService.getCurrentUser(grantedToken);
        setAuth(userData, grantedToken, registerRes?.refreshToken ?? null, true);
        if (registerRes?.needsVerification) {
          useToastStore.getState().show(t.verifyEmail.toast, 'success');
        }
        goHomeAfterAuth(router);
        return;
      }
      router.push({ pathname: '/verify-email', params: { email } });
    } finally {
      setIsLoading(false);
    }
  };

  const c = REGISTER_COPY[language === 'en' ? 'en' : 'tr'];
  const a = AUTH_COPY[language === 'en' ? 'en' : 'tr'];
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const goLegal = (doc: 'terms' | 'privacy' | 'kvkk') => router.push({ pathname: '/legal', params: { doc } });

  // Klavyeyi kapatan sarmalayıcı `accessible={false}`: kendisi ekran okuyucu ağacının
  // dışında kalır, İÇERİĞİ değil (no-hide-descendants tüm ekranı susturur).
  return (
    <TouchableWithoutFeedback accessible={false} onPress={Keyboard.dismiss}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <AnimatedBackground />

        <SafeAreaView style={styles.safeArea}>
          <BackButton onPress={() => router.back()} style={[styles.backButton, { top: insets.top + 12 }]} />
          <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 320 }} style={styles.stack}>
              <AuthBrand title={t.login.signUp} sub={t.registerSub} theme={theme} markHeight={56} />

              {error && (
                <View accessibilityLiveRegion="polite" style={[styles.errorContainer, { backgroundColor: theme.error + '15' }]}>
                  <AlertCircle size={ICON.sm} color={theme.error} style={{ marginTop: S.xxs }} />
                  <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
                </View>
              )}

              {/* Sosyal kayıt önce ve tam genişlik (bkz. AuthParts). */}
              <View style={styles.socialStack}>
                {Platform.OS === 'ios' && (
                  <SocialButton provider="apple" label={a.apple} onPress={handleAppleSignIn} disabled={isLoading} theme={theme} isDark={isDark} />
                )}
                <SocialButton provider="google" label={a.google} onPress={handleGoogleSignIn} disabled={isLoading} theme={theme} isDark={isDark} />
                <Text style={[styles.disclaimerText, { color: theme.onSurfaceMuted }]}>{c.socialLegal}</Text>
              </View>

              <AuthDivider text={a.orEmail} theme={theme} />

              <View style={styles.form}>
                <AuthField
                  icon={User}
                  theme={theme}
                  accessibilityLabel={c.name}
                  placeholder={c.name}
                  value={name}
                  onChangeText={setName}
                  maxLength={50}
                  autoComplete="name"
                  textContentType="name"
                  returnKeyType="next"
                  onSubmitEditing={() => emailRef.current?.focus()}
                />
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
                  accessibilityLabel={c.password}
                  placeholder={c.password}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoComplete="new-password"
                  textContentType="newPassword"
                  returnKeyType="done"
                  right={
                    <Touchable onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityRole="button" accessibilityLabel={showPassword ? c.hidePassword : c.showPassword}>
                      {showPassword ? <EyeOff size={ICON.sm} color={theme.onSurfaceMuted} /> : <Eye size={ICON.sm} color={theme.onSurfaceMuted} />}
                    </Touchable>
                  }
                />

                {/* Onay kutusu: iki temada okunur çerçeve (onSurfaceMuted), işaretlenince dolu + ✓. */}
                <Touchable
                  onPress={() => { haptic.select(); setConsentChecked(v => !v); }}
                  accessibilityRole="checkbox"
                  accessibilityLabel={c.consentA11y}
                  accessibilityState={{ checked: consentChecked }}
                  activeOpacity={0.7}
                  style={styles.consentRow}
                >
                  <View style={[styles.checkbox, { borderWidth: consentChecked ? 0 : 2, borderColor: theme.onSurfaceMuted, backgroundColor: consentChecked ? theme.primaryFill : 'transparent' }]}>
                    {consentChecked && <Check size={ICON.xs} color={theme.onPrimaryFill} strokeWidth={3} />}
                  </View>
                  <Text style={[styles.consentText, { color: theme.onSurfaceVariant }]}>
                    {c.consentLead}
                    <Text style={[styles.legalLink, { color: theme.onSurface }]} onPress={() => goLegal('terms')} accessibilityRole="link">{c.terms}</Text>
                    {c.sep1}
                    <Text style={[styles.legalLink, { color: theme.onSurface }]} onPress={() => goLegal('privacy')} accessibilityRole="link">{c.privacy}</Text>
                    {c.sep2}
                    <Text style={[styles.legalLink, { color: theme.onSurface }]} onPress={() => goLegal('kvkk')} accessibilityRole="link">{c.kvkk}</Text>
                    {c.consentTail}
                  </Text>
                </Touchable>

                <Touchable
                  onPress={handleRegister}
                  disabled={isLoading}
                  accessibilityRole="button"
                  accessibilityLabel={c.create}
                  accessibilityState={{ disabled: isLoading, busy: isLoading }}
                  style={[styles.registerButton, { backgroundColor: theme.primaryFill, opacity: isLoading ? 0.75 : 1 }]}
                >
                  {isLoading ? <ActivityIndicator color={theme.onPrimaryFill} /> : <Text style={[styles.buttonText, { color: theme.onPrimaryFill }]}>{c.create}</Text>}
                </Touchable>
              </View>
            </MotiView>

            <View style={styles.footer}>
              <Text style={[styles.footerText, { color: theme.onSurfaceVariant }]}>
                {c.haveAccount}{' '}
                <Text style={[styles.link, { color: theme.primary }]} onPress={() => router.push('/login')} accessibilityRole="link" accessibilityLabel={c.haveAccountA11y}>{t.login.title}</Text>
              </Text>

              {/* Tanıtım — özendirilmez: soluk, küçük, simgesiz (bkz. login.tsx hesapsız bağlantısı). */}
              <TouchableOpacity
                onPress={() => router.push('/onboarding')}
                activeOpacity={0.6}
                style={styles.explore}
                accessibilityRole="button"
                accessibilityLabel={c.explore}
              >
                <Text style={[styles.exploreText, { color: theme.onSurfaceMuted }]}>{c.explore}</Text>
              </TouchableOpacity>
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
  backButton: { position: 'absolute', left: scale(20), zIndex: 10 },
  scrollContent: { flexGrow: 1, justifyContent: 'space-between', paddingHorizontal: scale(24), paddingTop: S.xxl, paddingBottom: S.xl, width: '100%', maxWidth: 440, alignSelf: 'center', gap: S.xl },
  stack: { gap: S.lg, width: '100%' },
  errorContainer: { flexDirection: 'row', alignItems: 'flex-start', gap: S.sm, padding: S.smd, borderRadius: R.md },
  errorText: { flex: 1, fontSize: F.footnote, fontWeight: '600', lineHeight: verticalScale(18), flexWrap: 'wrap' },
  socialStack: { gap: S.smd },
  form: { gap: S.smd },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: S.smd, paddingVertical: S.xs },
  checkbox: { width: 20, height: 20, borderRadius: R.xs, alignItems: 'center', justifyContent: 'center', marginTop: S.xxs },
  consentText: { flex: 1, fontSize: F.caption, fontWeight: '500', lineHeight: 18 },
  registerButton: { height: 52, borderRadius: R.md, alignItems: 'center', justifyContent: 'center', marginTop: S.xs },
  buttonText: { fontSize: F.body, fontWeight: '700' },
  disclaimerText: { fontSize: F.caption, lineHeight: 17, textAlign: 'center', paddingHorizontal: S.sm },
  legalLink: { fontWeight: '600', textDecorationLine: 'underline' },
  footer: { alignItems: 'center', gap: S.md },
  footerText: { fontSize: F.body, fontWeight: '500' },
  link: { fontSize: F.body, fontWeight: '700' },
  explore: { paddingVertical: S.sm, paddingHorizontal: S.md },
  exploreText: { fontSize: F.footnote, fontWeight: '500' },
});

export { RouteErrorBoundary as ErrorBoundary } from '@/shared/components/CrashFallback'; // çökerse yalnız bu ekran düşer
