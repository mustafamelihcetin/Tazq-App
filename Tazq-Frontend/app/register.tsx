import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView, MotiText } from 'moti';
import { useRouter } from 'expo-router';
import { Mail, Lock, User, ArrowRight, ArrowLeft, AlertCircle, Eye, EyeOff, CheckSquare, Square } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';
import { AuthService } from '@/shared/services/api';
import { useAuthStore } from '@/features/user';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { GlassCard } from '@/shared/components/GlassCard';
import { AnimatedBackground } from '@/shared/components/AnimatedBackground';
import { TazqLogo } from '@/shared/components/TazqLogo';
import { S, R, F, scale, verticalScale, moderateScale, B } from '@/shared/constants/tokens';
import { Touchable } from '@/shared/components/Touchable';
import { validateRegister } from '@/shared/utils/validation';

const GoogleIcon = ({ color }: { color: string }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24">
    <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1 .67-2.28 1.07-3.71 1.07-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <Path d="M5.84 14.11c-.22-.67-.35-1.39-.35-2.11s.13-1.44.35-2.11V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.83z" fill="#FBBC05" />
    <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
  </Svg>
);

const AppleIcon = ({ color }: { color: string }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24">
    <Path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.78 1.18-.19 2.31-.88 3.5-.84 1.58.11 2.81.7 3.56 1.81-3.33 1.94-2.76 6.5.42 7.79-.81 1.6-1.57 3.12-2.56 3.43zM12.03 7.25C11.83 4.2 14.16 1.5 17 1c.29 3.22-2.51 5.92-4.97 6.25z" fill={color} />
  </Svg>
);

export default function RegisterScreen() {
  const { theme, isDark } = useAppTheme();
  const { t, language } = useLanguageStore();
  const tr = language === 'tr';
  const router = useRouter();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isSmallScreen = height < 750;
  const isMediumScreen = height < 850;

  const setAuth = useAuthStore(state => state.setAuth);

  const [name, setName] = useState('');
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
      console.warn('[Google Sign-In] Failed to require package:', e);
      return;
    }

    setIsLoading(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      const idToken = response.data?.idToken || response.idToken;
      if (!idToken) {
        throw new Error('Google ID Token was not returned.');
      }

      const { token, refreshToken } = await AuthService.googleLogin(idToken);
      const userData = await AuthService.getCurrentUser(token);
      setAuth(userData, token, refreshToken);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/');
    } catch (err: any) {
      console.warn('[Google Sign-In Error]', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (err?.code === 'SIGN_IN_CANCELLED' || err?.message?.includes('Sign in cancelled')) {
        return;
      }
      setError(language === 'tr' ? 'Google ile kayıt başarısız oldu.' : 'Google Sign-In failed.');
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

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

      const { token, refreshToken } = await AuthService.appleLogin(
        identityToken,
        credential.fullName?.givenName || undefined,
        credential.fullName?.familyName || undefined
      );

      const userData = await AuthService.getCurrentUser(token);
      setAuth(userData, token, refreshToken);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/');
    } catch (err: any) {
      console.warn('[Apple Sign-In Error]', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (err?.code === 'ERR_REQUEST_CANCELED' || err?.code === 'ERR_CANCELED') {
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // 1) KAYIT adımı — hatası net bir sebep gösterir ("sebebi yok" olmaz).
      try {
        await AuthService.register({ name, email, password });
      } catch (err: any) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        if (!err?.response) { setError(t.login.networkError); return; }
        const status = err.response.status;
        const body = err.response.data ?? '';
        // Yapısal hata kodunu tercih et; eski düz-metin yanıt için geriye dönük yedek.
        const isEmailTaken =
          (body && typeof body === 'object' && body.error === 'email_taken') ||
          (typeof body === 'string' && body.includes('zaten'));
        if (isEmailTaken) { setError(t.login.registerEmailTaken); return; }
        if (status >= 500) { setError(tr ? 'Sunucu hatası. Lütfen sonra tekrar dene.' : 'Server error. Please try again later.'); return; }
        // Sunucudan açıklayıcı bir mesaj geldiyse onu göster; yoksa genel.
        const serverMsg = typeof body === 'string' ? body : (body?.message || '');
        setError(serverMsg || t.login.registerError);
        return;
      }

      // 2) Kayıt BAŞARILI — otomatik giriş. Bu adımın hatası "kayıt başarısız" DEĞİL:
      // hesap oluştu, sadece otomatik giriş olmadı → kullanıcıyı girişe yönlendir.
      try {
        const { token, refreshToken } = await AuthService.login(email, password);
        const userData = await AuthService.getCurrentUser(token);
        setAuth(userData, token, refreshToken, true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace('/');
      } catch {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setError(tr ? 'Hesabın oluşturuldu — lütfen giriş yap.' : 'Account created — please sign in.');
        setTimeout(() => router.replace('/login'), 1200);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <AnimatedBackground />

        <SafeAreaView style={styles.safeArea}>
          <Touchable
            onPress={() => router.back()}
            style={[styles.backButton, { top: insets.top + 12 }]}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={language === 'tr' ? 'Geri' : 'Back'}
          >
            <ArrowLeft size={22} color={theme.onSurface} />
          </Touchable>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
          <ScrollView
            style={styles.keyboardView}
            contentContainerStyle={[styles.scrollContent, { justifyContent: 'space-between', paddingVertical: isSmallScreen ? 16 : 32 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={{ gap: isSmallScreen ? 8 : isMediumScreen ? 12 : 20, width: '100%' }}>
              <MotiView
                from={{ opacity: 0, scale: 0.8, translateY: -20 }}
                animate={{ opacity: 1, scale: 1, translateY: 0 }}
                style={styles.header}
              >
                <TazqLogo size={isSmallScreen ? 36 : isMediumScreen ? 46 : 56} />
                <MotiText
                  from={{ opacity: 0, translateY: 10 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ delay: 200 }}
                  style={[styles.title, { color: theme.onSurface, fontSize: isSmallScreen ? 18 : isMediumScreen ? 22 : 26, marginTop: isSmallScreen ? 4 : 8 }]}
                >
                  {t.login.signUp}
                </MotiText>
                <Text style={[styles.subtitle, { color: theme.onSurfaceVariant, fontSize: isSmallScreen ? 11 : 13, marginTop: isSmallScreen ? 2 : 4 }]}>
                  {t.onboardingBody2}
                </Text>
              </MotiView>

              <MotiView
                from={{ opacity: 0, translateY: 20 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ delay: 400 }}
                style={styles.cardContainer}
              >
                <GlassCard style={[styles.glassCard, { padding: isSmallScreen ? 12 : isMediumScreen ? 18 : 24 }]}>
                  {error && (
                    <MotiView 
                      from={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      style={[styles.errorContainer, { backgroundColor: theme.error + '15' }]}
                    >
                      <AlertCircle size={16} color={theme.error} />
                      <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
                    </MotiView>
                  )}

                  <View style={[styles.form, { gap: isSmallScreen ? 6 : 12 }]}>
                    <View style={[styles.inputGroup, { gap: isSmallScreen ? 2 : 6 }]}>
                      <View style={[styles.inputWrapper, { backgroundColor: theme.surfaceContainerLow, borderColor: theme.outlineVariant, height: isSmallScreen ? 38 : 48 }]}>
                        <User size={18} color={isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.45)'} />
                        <TextInput
                          placeholder={t.login.name}
                          placeholderTextColor={isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.35)'}
                          style={[styles.input, { color: theme.onSurface }]}
                          value={name}
                          onChangeText={setName}
                          maxLength={50}
                          underlineColorAndroid="transparent"
                        />
                      </View>
                    </View>

                    <View style={[styles.inputGroup, { gap: isSmallScreen ? 2 : 6 }]}>
                      <View style={[styles.inputWrapper, { backgroundColor: theme.surfaceContainerLow, borderColor: theme.outlineVariant, height: isSmallScreen ? 38 : 48 }]}>
                        <Mail size={18} color={isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.45)'} />
                        <TextInput
                          placeholder={t.login.email}
                          placeholderTextColor={isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.35)'}
                          style={[styles.input, { color: theme.onSurface }]}
                          value={email}
                          onChangeText={setEmail}
                          autoCapitalize="none"
                          autoCorrect={false}
                          spellCheck={false}
                          autoComplete="email"
                          textContentType="emailAddress"
                          keyboardType="email-address"
                          underlineColorAndroid="transparent"
                        />
                      </View>
                    </View>

                    <View style={[styles.inputGroup, { gap: isSmallScreen ? 2 : 6 }]}>
                      <View style={[styles.inputWrapper, { backgroundColor: theme.surfaceContainerLow, borderColor: theme.outlineVariant, height: isSmallScreen ? 38 : 48 }]}>
                        <Lock size={18} color={isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.45)'} />
                        <TextInput
                          placeholder="••••••••"
                          placeholderTextColor={isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.35)'}
                          style={[styles.input, { color: theme.onSurface }]}
                          value={password}
                          onChangeText={setPassword}
                          secureTextEntry={!showPassword}
                          underlineColorAndroid="transparent"
                        />
                        <Touchable onPress={() => setShowPassword(!showPassword)} accessibilityRole="button" accessibilityLabel={showPassword ? (language === 'tr' ? 'Şifreyi gizle' : 'Hide password') : (language === 'tr' ? 'Şifreyi göster' : 'Show password')}>
                          {showPassword ? <EyeOff size={18} color={isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.45)'} /> : <Eye size={18} color={isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.45)'} />}
                        </Touchable>
                      </View>
                    </View>

                    {/* Legal consent */}
                    <Touchable
                      onPress={() => { Haptics.selectionAsync(); setConsentChecked(v => !v); }}
                      activeOpacity={0.7}
                      style={[styles.consentRow, { marginVertical: isSmallScreen ? 2 : 4 }]}
                    >
                      <View style={{ marginTop: Platform.OS === 'ios' ? 1 : 2 }}>
                        {consentChecked
                          ? <CheckSquare size={18} color={theme.primary} />
                          : <Square size={18} color={theme.outlineVariant} />
                        }
                      </View>
                      <Text style={[styles.consentText, { color: theme.onSurfaceVariant }]}>
                        {tr ? '' : 'I have read and agree to the '}
                        <Text
                          style={{ color: theme.primary, fontFamily: 'Jakarta-Bold' }}
                          onPress={() => router.push({ pathname: '/legal', params: { doc: 'terms' } })}
                        >
                          {tr ? 'Kullanıcı Sözleşmesi' : 'Terms of Service'}
                        </Text>
                        {tr ? ', ' : ', '}
                        <Text
                          style={{ color: theme.primary, fontFamily: 'Jakarta-Bold' }}
                          onPress={() => router.push({ pathname: '/legal', params: { doc: 'privacy' } })}
                        >
                          {tr ? 'Gizlilik Politikası' : 'Privacy Policy'}
                        </Text>
                        {tr ? ' ve ' : ' and '}
                        <Text
                          style={{ color: theme.primary, fontFamily: 'Jakarta-Bold' }}
                          onPress={() => router.push({ pathname: '/legal', params: { doc: 'kvkk' } })}
                        >
                          {tr ? 'KVKK Aydınlatma Metni' : 'Data Protection Notice'}
                        </Text>
                        {tr ? "'ni okudum ve kabul ediyorum." : '.'}
                      </Text>
                    </Touchable>

                    <Touchable
                      onPress={handleRegister}
                      disabled={isLoading}
                      style={[styles.registerButton, { height: isSmallScreen ? 38 : 48 }]}
                    >
                      <MotiView 
                        animate={{ backgroundColor: theme.secondary }}
                        style={styles.buttonInner}
                      >
                        {isLoading ? (
                          <ActivityIndicator color={theme.onSecondary} />
                        ) : (
                          <>
                            <Text style={[styles.buttonText, { color: theme.onSecondary }]}>{t.login.signUp}</Text>
                            <ArrowRight size={20} color={theme.onSecondary} />
                          </>
                        )}
                      </MotiView>
                    </Touchable>

                    <View style={[styles.dividerRow, { marginVertical: isSmallScreen ? 2 : 8 }]}>
                      <View style={[styles.divider, { backgroundColor: theme.outlineVariant + '40' }]} />
                      <Text style={[styles.dividerText, { color: theme.onSurfaceVariant }]}>{t.login.orDivider}</Text>
                      <View style={[styles.divider, { backgroundColor: theme.outlineVariant + '40' }]} />
                    </View>

                    <View style={styles.socialRow}>
                      <Touchable
                        style={[styles.socialButton, { backgroundColor: theme.surfaceContainerHigh, borderColor: theme.outlineVariant, height: isSmallScreen ? 36 : 44 }]}
                        onPress={handleGoogleSignIn}
                        activeOpacity={0.7}
                        disabled={isLoading}
                      >
                        <GoogleIcon color={theme.onSurface} />
                        <Text style={[styles.socialText, { color: theme.onSurface }]}>Google</Text>
                      </Touchable>
                      {Platform.OS === 'ios' && (
                        <Touchable
                          style={[styles.socialButton, { backgroundColor: theme.surfaceContainerHigh, borderColor: theme.outlineVariant, height: isSmallScreen ? 36 : 44 }]}
                          onPress={handleAppleSignIn}
                          activeOpacity={0.7}
                          disabled={isLoading}
                        >
                          <AppleIcon color={theme.onSurface} />
                          <Text style={[styles.socialText, { color: theme.onSurface }]}>Apple</Text>
                        </Touchable>
                      )}
                    </View>

                    <Text style={[styles.disclaimerText, { color: theme.onSurfaceVariant, marginTop: isSmallScreen ? 4 : 8 }]}>
                      {language === 'tr' ? 'Google veya Apple ile devam ederek, ' : 'By continuing with Google or Apple, you agree to our '}
                      <Text
                        style={{ color: theme.primary, fontWeight: '800' }}
                        onPress={() => router.push({ pathname: '/legal', params: { doc: 'terms' } })}
                      >
                        {language === 'tr' ? 'Kullanıcı Sözleşmesi' : 'Terms of Service'}
                      </Text>
                      {language === 'tr' ? "'ni, " : ', '}
                      <Text
                        style={{ color: theme.primary, fontWeight: '800' }}
                        onPress={() => router.push({ pathname: '/legal', params: { doc: 'privacy' } })}
                      >
                        {language === 'tr' ? 'Gizlilik Politikası' : 'Privacy Policy'}
                      </Text>
                      {language === 'tr' ? ' ve ' : ' and '}
                      <Text
                        style={{ color: theme.primary, fontWeight: '800' }}
                        onPress={() => router.push({ pathname: '/legal', params: { doc: 'kvkk' } })}
                      >
                        {language === 'tr' ? 'KVKK Metni' : 'Data Notice'}
                      </Text>
                      {language === 'tr' ? "'ni kabul etmiş olursunuz." : '.'}
                    </Text>
                  </View>
                </GlassCard>
              </MotiView>
            </View>

              <MotiView
                from={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 600 }}
                style={[styles.footer, { marginTop: error ? (Platform.OS === 'android' ? 6 : 12) : (Platform.OS === 'android' ? 12 : 24) }]}
              >
                <View style={styles.footerRow}>
                  <Text style={[styles.footerText, { color: theme.onSurfaceVariant }]}>
                    {t.login.alreadyHaveAccount} 
                  </Text>
                  <Touchable onPress={() => router.push('/login')}>
                    <Text style={[styles.link, { color: theme.secondary }]}> {t.login.title}</Text>
                  </Touchable>
                </View>
              </MotiView>
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
  title: { fontSize: F.title + 6, fontFamily: 'Jakarta-ExtraBold', marginTop: verticalScale(10), letterSpacing: -0.5 },
  subtitle: { fontSize: F.body, fontWeight: '500', marginTop: verticalScale(4), opacity: 0.7, textAlign: 'center' },
  cardContainer: { width: '100%' },
  glassCard: { width: '100%' },
  errorContainer: { flexDirection: 'row', alignItems: 'center', gap: S.sm, padding: S.sm + 4, borderRadius: R.sm + 4, marginBottom: S.md },
  errorText: { fontSize: F.caption + 2, fontWeight: '600' },
  form: { gap: Platform.OS === 'android' ? moderateScale(12) : moderateScale(16) },
  inputGroup: { gap: S.sm + 4 },
  label: { fontSize: F.caption, fontWeight: '800', letterSpacing: 1 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, height: Platform.OS === 'android' ? verticalScale(50) : verticalScale(56), borderRadius: R.md, borderWidth: B.thin, gap: S.sm + 4 },
  input: { flex: 1, fontSize: F.body + 1, fontWeight: '600', paddingVertical: 0 },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: S.sm + 2, paddingHorizontal: 4, marginTop: verticalScale(2), marginBottom: verticalScale(2) },
  consentText: { flex: 1, fontSize: F.caption, fontFamily: 'Jakarta-SemiBold', lineHeight: verticalScale(16) },
  registerButton: { height: Platform.OS === 'android' ? verticalScale(50) : verticalScale(56), borderRadius: R.md, overflow: 'hidden', marginTop: verticalScale(4) },
  buttonInner: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: moderateScale(10) },
  buttonText: { fontSize: F.subhead + 1, fontWeight: '800' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: S.md, marginVertical: S.xs },
  divider: { flex: 1, height: 1 },
  dividerText: { fontSize: F.caption + 1, fontWeight: '700', opacity: 0.5 },
  socialRow: { flexDirection: 'row', gap: S.md },
  socialButton: { flex: 1, height: Platform.OS === 'android' ? verticalScale(46) : verticalScale(56), borderRadius: R.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: moderateScale(10), borderWidth: B.thin },
  socialText: { fontSize: moderateScale(15), fontWeight: '700' },
  disclaimerText: { fontSize: moderateScale(11), lineHeight: verticalScale(16), textAlign: 'center', marginTop: S.sm + 2, paddingHorizontal: S.xs, opacity: 0.75 },
  footer: { alignItems: 'center', marginTop: Platform.OS === 'android' ? verticalScale(12) : verticalScale(24) },
  footerRow: { flexDirection: 'row', alignItems: 'center' },
  footerText: { fontSize: moderateScale(15), fontWeight: '500' },
  link: { fontSize: moderateScale(15), fontWeight: '800' },
});

