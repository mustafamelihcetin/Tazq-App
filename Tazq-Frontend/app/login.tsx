import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, useWindowDimensions, KeyboardAvoidingView, Platform, ActivityIndicator, TouchableWithoutFeedback, Keyboard, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView, MotiText } from 'moti';
import { useRouter } from 'expo-router';
import { Mail, Lock, ArrowRight, AlertCircle, Eye, EyeOff, CheckCircle2, Sparkles } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';
import { AuthService } from '@/shared/services/api';
import { useAuthStore } from '@/features/user';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { GlassCard } from '@/shared/components/GlassCard';
import { useToastStore } from '@/shared/store/useToastStore';
import { AnimatedBackground } from '@/shared/components/AnimatedBackground';
import { TazqLogo } from '@/shared/components/TazqLogo';
import { BlurView } from 'expo-blur';
import { S, R, F, scale, verticalScale, moderateScale, B } from '@/shared/constants/tokens';
import { Touchable } from '@/shared/components/Touchable';
import { CustomAlert as Alert } from '@/shared/components/CustomAlert';
import { validateLogin, isValidEmail } from '@/shared/utils/validation';

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

export default function LoginScreen() {
  const { theme, isDark } = useAppTheme();
  const { t, language } = useLanguageStore();
  const router = useRouter();
  const { height } = useWindowDimensions();
  const isSmallScreen = height < 750;
  const isMediumScreen = height < 850;
  const setAuth = useAuthStore(state => state.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [forgotVisible, setForgotVisible] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState<{ text: string; success: boolean } | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

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

      const { token, refreshToken, isNewUser, isReactivated } = await AuthService.googleLogin(idToken);
      const userData = await AuthService.getCurrentUser(token);
      setAuth(userData, token, refreshToken, isNewUser);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (isReactivated) useToastStore.getState().show(language === 'tr' ? 'Tekrar hoş geldin! Hesabın ve tüm verilerin geri geldi.' : 'Welcome back! Your account and data have been restored.', 'success');
      router.replace('/');
    } catch (err: any) {
      console.warn('[Google Sign-In Error]', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (err?.code === 'SIGN_IN_CANCELLED' || err?.message?.includes('Sign in cancelled')) {
        return;
      }
      setError(language === 'tr' ? 'Google ile giriş başarısız oldu.' : 'Google Sign-In failed.');
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

      const { token, refreshToken, isNewUser, isReactivated } = await AuthService.appleLogin(
        identityToken,
        credential.fullName?.givenName || undefined,
        credential.fullName?.familyName || undefined
      );

      const userData = await AuthService.getCurrentUser(token);
      setAuth(userData, token, refreshToken, isNewUser);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (isReactivated) useToastStore.getState().show(language === 'tr' ? 'Tekrar hoş geldin! Hesabın ve tüm verilerin geri geldi.' : 'Welcome back! Your account and data have been restored.', 'success');
      router.replace('/');
    } catch (err: any) {
      console.warn('[Apple Sign-In Error]', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (err?.code === 'ERR_REQUEST_CANCELED' || err?.code === 'ERR_CANCELED') {
        return;
      }
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const { token, refreshToken, isReactivated } = await AuthService.login(email, password);
      const userData = await AuthService.getCurrentUser(token);
      setAuth(userData, token, refreshToken);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (isReactivated) useToastStore.getState().show(language === 'tr' ? 'Tekrar hoş geldin! Hesabın ve tüm verilerin geri geldi.' : 'Welcome back! Your account and data have been restored.', 'success');
      router.replace('/');
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (!err?.response) {
        setError(t.login.networkError);
      } else {
        setError(t.login.error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const closeForgotModal = () => {
    setForgotVisible(false);
    setForgotEmail('');
    setForgotMsg(null);
    setForgotSuccess(false);
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
    } catch (err: any) {
      const errMsg = err.response?.data?.message || err.response?.data || t.login.forgotError;
      setForgotMsg({ text: errMsg, success: false });
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <AnimatedBackground />
        
        <SafeAreaView style={styles.safeArea}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'android' ? 0 : 0}
          >
          <ScrollView
            style={styles.keyboardView}
            contentContainerStyle={[styles.scrollContent, { justifyContent: 'space-between', paddingVertical: isSmallScreen ? 16 : 32 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={{ gap: isSmallScreen ? 8 : isMediumScreen ? 14 : 20, width: '100%' }}>
              <MotiView
                from={{ opacity: 0, scale: 0.8, translateY: -20 }}
                animate={{ opacity: 1, scale: 1, translateY: 0 }}
                style={styles.header}
              >
                <TazqLogo size={isSmallScreen ? 44 : isMediumScreen ? 56 : 72} />
                <MotiText
                  from={{ opacity: 0, translateY: 10 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ delay: 200 }}
                  style={[styles.title, { color: theme.onSurface, fontSize: isSmallScreen ? 20 : isMediumScreen ? 26 : 32, marginTop: isSmallScreen ? 4 : 10 }]}
                >
                  {t.login.title}
                </MotiText>
                <Text style={[styles.subtitle, { color: theme.onSurfaceVariant, fontSize: isSmallScreen ? 12 : 14, marginTop: isSmallScreen ? 2 : 4 }]}>
                  {t.login.sub}
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

                  <View style={[styles.form, { gap: isSmallScreen ? 8 : 14 }]}>
                    <View style={[styles.inputGroup, { gap: isSmallScreen ? 4 : 8 }]}>
                      <View style={[styles.inputWrapper, {
                        backgroundColor: theme.surfaceContainerLow,
                        borderColor: theme.outlineVariant,
                        height: isSmallScreen ? 42 : 52,
                      }]}>
                        <Mail size={18} color={isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.45)'} />
                        <TextInput
                          ref={emailRef}
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
                          returnKeyType="next"
                          onSubmitEditing={() => passwordRef.current?.focus()}
                          underlineColorAndroid="transparent"
                        />
                      </View>
                    </View>

                    <View style={[styles.inputGroup, { gap: isSmallScreen ? 4 : 8 }]}>
                      <View style={[styles.inputWrapper, {
                        backgroundColor: theme.surfaceContainerLow,
                        borderColor: theme.outlineVariant,
                        height: isSmallScreen ? 42 : 52,
                      }]}>
                        <Lock size={18} color={isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.45)'} />
                        <TextInput
                          ref={passwordRef}
                          placeholder="••••••••"
                          placeholderTextColor={isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.35)'}
                          style={[styles.input, { color: theme.onSurface }]}
                          value={password}
                          onChangeText={setPassword}
                          secureTextEntry={!showPassword}
                          underlineColorAndroid="transparent"
                        />
                        <Touchable onPress={() => setShowPassword(!showPassword)} accessibilityRole="button" accessibilityLabel={showPassword ? (language === 'tr' ? 'Şifreyi gizle' : 'Hide password') : (language === 'tr' ? 'Şifreyi göster' : 'Show password')}>
                          {showPassword
                            ? <EyeOff size={18} color={isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.45)'} />
                            : <Eye size={18} color={isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.45)'} />}
                        </Touchable>
                      </View>
                      <Touchable onPress={() => setForgotVisible(true)} style={{ alignSelf: 'flex-end', marginTop: 6 }}>
                        <Text style={[styles.forgotText, { color: theme.primary }]}>{t.login.forgotPassword}</Text>
                      </Touchable>
                    </View>

                    <Touchable
                      onPress={handleLogin}
                      disabled={isLoading}
                      style={[styles.loginButton, { height: isSmallScreen ? 42 : 52 }]}
                    >
                      <MotiView
                        animate={{ backgroundColor: theme.primary }}
                        style={styles.buttonInner}
                      >
                        {isLoading ? (
                          <ActivityIndicator color={theme.onPrimary} />
                        ) : (
                          <>
                            <Text style={[styles.buttonText, { color: theme.onPrimary }]}>{t.login.button}</Text>
                            <ArrowRight size={20} color={theme.onPrimary} />
                          </>
                        )}
                      </MotiView>
                    </Touchable>

                    {/* OR Divider */}
                    <View style={[styles.dividerRow, { marginVertical: isSmallScreen ? 4 : 10 }]}>
                      <View style={[styles.divider, { backgroundColor: theme.outlineVariant + '40' }]} />
                      <Text style={[styles.dividerText, { color: theme.onSurfaceVariant }]}>{t.login.orDivider}</Text>
                      <View style={[styles.divider, { backgroundColor: theme.outlineVariant + '40' }]} />
                    </View>

                    {/* Social Buttons — Coming soon */}
                    <View style={styles.socialRow}>
                      <Touchable
                        style={[styles.socialButton, { backgroundColor: theme.surfaceContainerHigh, borderColor: theme.outlineVariant, height: isSmallScreen ? 38 : 46 }]}
                        onPress={handleGoogleSignIn}
                        activeOpacity={0.7}
                        disabled={isLoading}
                      >
                        <GoogleIcon color={theme.onSurface} />
                        <Text style={[styles.socialText, { color: theme.onSurface }]}>Google</Text>
                      </Touchable>
                      {Platform.OS === 'ios' && (
                        <Touchable
                          style={[styles.socialButton, { backgroundColor: theme.surfaceContainerHigh, borderColor: theme.outlineVariant, height: isSmallScreen ? 38 : 46 }]}
                          onPress={handleAppleSignIn}
                          activeOpacity={0.7}
                          disabled={isLoading}
                        >
                          <AppleIcon color={theme.onSurface} />
                          <Text style={[styles.socialText, { color: theme.onSurface }]}>Apple</Text>
                        </Touchable>
                      )}
                    </View>

                    <Text style={[styles.disclaimerText, { color: theme.onSurfaceVariant, marginTop: isSmallScreen ? 4 : 10 }]}>
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

              {/* Fixed Footer Alignment */}
              <MotiView
                from={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 600 }}
                style={[styles.footer, { marginTop: error ? (isSmallScreen ? 4 : 8) : (isSmallScreen ? 8 : isMediumScreen ? 16 : 28) }]}
              >
                {/* Tek Text + iç span'ler → "TAZQ" marka fontuyla ama footer metniyle AYNI
                    fontSize'ı miras alır: her ekranda/font ölçeğinde aynı baseline, orantılı,
                    küçük ekranda doğru sarar. Resim logosu hizalama derdini bitirir. */}
                <Text style={[styles.footerText, { color: theme.onSurfaceVariant, textAlign: 'center' }]}>
                  <Text style={{ fontFamily: 'Jakarta-ExtraBold', color: theme.onSurface, letterSpacing: -0.5 }}>TAZQ</Text>
                  {language === 'tr' ? '' : ' '}
                  {t.login.footer}{' '}
                  <Text
                    style={[styles.link, { color: theme.primary }]}
                    onPress={() => router.push('/register')}
                    accessibilityRole="link"
                  >
                    {t.login.signUp}
                  </Text>
                </Text>

                <TouchableOpacity
                  onPress={() => router.push('/onboarding')}
                  activeOpacity={0.7}
                  style={{ marginTop: isSmallScreen ? 6 : isMediumScreen ? 10 : 14, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: isSmallScreen ? 3 : 6, paddingHorizontal: 8 }}
                  accessibilityRole="button"
                >
                  <Sparkles size={14} color={theme.primary} strokeWidth={2.2} />
                  <Text style={{ fontSize: 13.5, fontWeight: '700', color: theme.primary, letterSpacing: 0.2 }}>
                    {language === 'tr' ? 'Uygulamayı keşfet' : 'Explore the app'}
                  </Text>
                  <ArrowRight size={15} color={theme.primary} strokeWidth={2.4} />
                </TouchableOpacity>
              </MotiView>
          </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>

        <Modal visible={forgotVisible} transparent animationType="fade">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
            <GlassCard style={styles.modalCard}>
              {forgotSuccess ? (
                <View style={{ alignItems: 'center', gap: S.md, paddingVertical: S.sm }}>
                  <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: theme.tertiary + '15', alignItems: 'center', justifyContent: 'center' }}>
                    <CheckCircle2 size={32} color={theme.tertiary} />
                  </View>
                  <Text style={{ fontFamily: 'Jakarta-ExtraBold', fontSize: F.title, color: theme.onSurface, textAlign: 'center' }}>
                    {language === 'tr' ? 'E-posta Gönderildi' : 'Email Sent'}
                  </Text>
                  <Text style={{ fontSize: 13, color: theme.onSurfaceVariant, textAlign: 'center', lineHeight: 18, fontFamily: 'Jakarta-SemiBold', paddingHorizontal: S.xs }}>
                    {language === 'tr' 
                      ? 'Şifre sıfırlama talimatları e-posta adresinize başarıyla gönderildi. Gelen kutunuzu kontrol edin.'
                      : 'Password reset instructions have been sent to your email. Please check your inbox.'}
                  </Text>
                  <Touchable 
                    onPress={closeForgotModal} 
                    style={{ 
                      backgroundColor: theme.primary, 
                      width: '100%', 
                      marginTop: S.sm, 
                      height: 44, 
                      borderRadius: R.md,
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Text style={{ color: theme.onPrimary, fontWeight: '800', fontFamily: 'Jakarta-Bold' }}>
                      {language === 'tr' ? 'Harika' : 'Got it'}
                    </Text>
                  </Touchable>
                </View>
              ) : (
                <>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.modalTitle, { color: theme.onSurface, fontFamily: 'Jakarta-ExtraBold' }]}>{t.login.forgotTitle}</Text>
                  <Text style={[styles.modalSub, { color: theme.onSurfaceVariant, fontFamily: 'Jakarta-Medium', marginTop: 2, marginBottom: 10 }]}>{t.login.forgotSub}</Text>
                  
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
                      <AlertCircle size={16} color={theme.error} />
                      <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: theme.error }}>{forgotMsg.text}</Text>
                    </MotiView>
                  )}

                  <View style={[styles.inputWrapper, {
                    backgroundColor: theme.surfaceContainerLow,
                    borderColor: theme.outlineVariant,
                    height: 46,
                    marginBottom: S.md,
                  }]}>
                    <Mail size={18} color={isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.45)'} />
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
                      style={{ 
                        flex: 1, 
                        height: 44, 
                        borderRadius: R.md, 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' 
                      }}
                    >
                      <Text style={{ color: theme.onSurfaceVariant, fontFamily: 'Jakarta-Bold', fontSize: 14 }}>{t.cancel}</Text>
                    </Touchable>
                    <Touchable 
                      onPress={handleForgotPassword} 
                      disabled={forgotLoading} 
                      style={{ 
                        flex: 2, 
                        height: 44, 
                        borderRadius: R.md, 
                        backgroundColor: theme.primary, 
                        alignItems: 'center', 
                        justifyContent: 'center' 
                      }}
                    >
                      {forgotLoading ? (
                        <ActivityIndicator color={theme.onPrimary} size="small" />
                      ) : (
                        <Text style={{ color: theme.onPrimary, fontFamily: 'Jakarta-Bold', fontSize: 14 }}>{t.login.forgotSend}</Text>
                      )}
                    </Touchable>
                  </View>
                </>
              )}
            </GlassCard>
          </View>
          </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: scale(24), width: '100%', maxWidth: 480, alignSelf: 'center' },
  header: { alignItems: 'center' },
  title: { fontFamily: 'Jakarta-ExtraBold', letterSpacing: -1.2 },
  subtitle: { fontSize: moderateScale(15), fontWeight: '500', marginTop: verticalScale(6), opacity: 0.6, letterSpacing: 0.1 },
  cardContainer: { width: '100%' },
  glassCard: { width: '100%' },
  errorContainer: { flexDirection: 'row', alignItems: 'center', gap: S.sm, padding: S.sm + 4, borderRadius: R.sm + 4, marginBottom: S.md },
  errorText: { fontSize: F.caption + 2, fontWeight: '600' },
  form: { gap: moderateScale(14) },
  inputGroup: { gap: S.sm + 4 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: F.caption, fontWeight: '800', letterSpacing: 1 },
  forgotText: { fontSize: F.caption + 1, fontWeight: '700' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, height: Platform.OS === 'android' ? verticalScale(52) : verticalScale(56), borderRadius: R.md, borderWidth: B.thin, gap: S.sm + 4 },
  input: { flex: 1, fontSize: F.body + 2, fontWeight: '600', paddingVertical: 0 },
  loginButton: { height: Platform.OS === 'android' ? verticalScale(52) : verticalScale(56), borderRadius: R.md, overflow: 'hidden' },
  buttonInner: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: moderateScale(10) },
  buttonText: { fontSize: F.subhead + 1, fontWeight: '800' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: S.md, marginVertical: S.sm },
  divider: { flex: 1, height: 1 },
  dividerText: { fontSize: F.caption + 1, fontWeight: '700', opacity: 0.5 },
  socialRow: { flexDirection: 'row', gap: S.md },
  socialButton: { flex: 1, height: Platform.OS === 'android' ? verticalScale(48) : verticalScale(56), borderRadius: R.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: moderateScale(10), borderWidth: B.thin },
  socialText: { fontSize: moderateScale(15), fontWeight: '700' },
  disclaimerText: { fontSize: moderateScale(11), lineHeight: verticalScale(16), textAlign: 'center', marginTop: S.sm + 2, paddingHorizontal: S.xs, opacity: 0.75 },
  footer: { alignItems: 'center', marginTop: verticalScale(28) },
  footerRow: { flexDirection: 'row', alignItems: 'center' },
  footerText: { fontSize: moderateScale(15), fontWeight: '500' },
  link: { fontSize: moderateScale(15), fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: scale(24) },
  modalCard: { padding: scale(24), gap: S.md },
  modalTitle: { fontSize: F.title + 2, fontWeight: '900' },
  modalSub: { fontSize: F.body, fontWeight: '500', lineHeight: verticalScale(20) },
  modalInput: { height: verticalScale(56), borderRadius: R.md, borderWidth: B.thin, paddingHorizontal: S.md, fontSize: F.body + 2, fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: S.md },
  modalCancel: { flex: 1, height: verticalScale(48), borderRadius: R.sm + 4, alignItems: 'center', justifyContent: 'center' },
  modalSend: { flex: 2, height: verticalScale(48), borderRadius: R.sm + 4, alignItems: 'center', justifyContent: 'center' },
});

