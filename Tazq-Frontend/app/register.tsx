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
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView, MotiText } from 'moti';
import { useRouter } from 'expo-router';
import { Mail, Lock, User, ArrowRight, ArrowLeft, AlertCircle, Eye, EyeOff, CheckSquare, Square } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';
import { AuthService } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import { useAppTheme } from '../hooks/useAppTheme';
import { useLanguageStore } from '../store/useLanguageStore';
import { GlassCard } from '../components/GlassCard';
import { AnimatedBackground } from '../components/AnimatedBackground';
import { TazqLogo } from '../components/TazqLogo';
import { S, R, F, scale, verticalScale, moderateScale } from '../constants/tokens';

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

  const handleRegister = async () => {
    if (!name || !email || !password) {
      setError(tr ? 'Tüm alanları doldurun.' : 'Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      setError(t.login.registerWeakPassword);
      return;
    }
    if (!consentChecked) {
      setError(tr ? 'Devam etmek için sözleşmeleri onaylamanız gerekir.' : 'You must accept the agreements to continue.');
      return;
    }

    setIsLoading(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await AuthService.register({ name, email, password });

      // Auto-login immediately after successful registration
      const { token, refreshToken } = await AuthService.login(email, password);
      const userData = await AuthService.getCurrentUser(token);
      setAuth(userData, token, refreshToken);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/');
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const status = err?.response?.status;
      const body = err?.response?.data ?? '';
      if (status === 400 && typeof body === 'string' && body.includes('zaten')) {
        setError(t.login.registerEmailTaken);
      } else if (status === 400) {
        setError(t.login.registerWeakPassword);
      } else {
        setError(t.login.registerError);
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
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backButton, { top: insets.top + 12 }]}
            activeOpacity={0.7}
          >
            <ArrowLeft size={22} color={theme.onSurface} />
          </TouchableOpacity>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
          <ScrollView
            style={styles.keyboardView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.content, { paddingVertical: isSmallScreen ? 12 : isMediumScreen ? 20 : 32 }]}>
              <MotiView
                from={{ opacity: 0, scale: 0.8, translateY: -20 }}
                animate={{ opacity: 1, scale: 1, translateY: 0 }}
                style={[styles.header, { marginBottom: isSmallScreen ? 12 : 32 }]}
              >
                <TazqLogo size={isSmallScreen ? 44 : isMediumScreen ? 52 : 60} />
                <MotiText
                  from={{ opacity: 0, translateY: 10 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ delay: 200 }}
                  style={[styles.title, { color: theme.onSurface, fontSize: isSmallScreen ? 22 : 28 }]}
                >
                  {t.login.signUp}
                </MotiText>
                <Text style={[styles.subtitle, { color: theme.onSurfaceVariant }]}>
                  {t.onboardingBody2}
                </Text>
              </MotiView>

              <MotiView
                from={{ opacity: 0, translateY: 20 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ delay: 400 }}
                style={styles.cardContainer}
              >
                <GlassCard style={[styles.glassCard, { padding: isSmallScreen ? 16 : 24 }]}>
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

                  <View style={styles.form}>
                    <View style={styles.inputGroup}>
                      <View style={[styles.inputWrapper, { backgroundColor: theme.surfaceContainerLow, borderColor: theme.outlineVariant }]}>
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

                    <View style={styles.inputGroup}>
                      <View style={[styles.inputWrapper, { backgroundColor: theme.surfaceContainerLow, borderColor: theme.outlineVariant }]}>
                        <Mail size={18} color={isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.45)'} />
                        <TextInput
                          placeholder={t.login.email}
                          placeholderTextColor={isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.35)'}
                          style={[styles.input, { color: theme.onSurface }]}
                          value={email}
                          onChangeText={setEmail}
                          autoCapitalize="none"
                          underlineColorAndroid="transparent"
                        />
                      </View>
                    </View>

                    <View style={styles.inputGroup}>
                      <View style={[styles.inputWrapper, { backgroundColor: theme.surfaceContainerLow, borderColor: theme.outlineVariant }]}>
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
                        <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                          {showPassword ? <EyeOff size={18} color={isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.45)'} /> : <Eye size={18} color={isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.45)'} />}
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Legal consent */}
                    <TouchableOpacity
                      onPress={() => { Haptics.selectionAsync(); setConsentChecked(v => !v); }}
                      activeOpacity={0.7}
                      style={styles.consentRow}
                    >
                      {consentChecked
                        ? <CheckSquare size={18} color={theme.primary} />
                        : <Square size={18} color={theme.outlineVariant} />
                      }
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
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={handleRegister}
                      disabled={isLoading}
                      style={styles.registerButton}
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
                    </TouchableOpacity>

                    <View style={styles.dividerRow}>
                      <View style={[styles.divider, { backgroundColor: theme.outlineVariant + '40' }]} />
                      <Text style={[styles.dividerText, { color: theme.onSurfaceVariant }]}>{t.login.orDivider}</Text>
                      <View style={[styles.divider, { backgroundColor: theme.outlineVariant + '40' }]} />
                    </View>

                    <View style={styles.socialRow}>
                      <TouchableOpacity style={[styles.socialButton, { backgroundColor: theme.surfaceContainerHigh, borderColor: theme.outlineVariant }]}>
                        <GoogleIcon color={theme.onSurface} />
                        <Text style={[styles.socialText, { color: theme.onSurface }]}>Google</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.socialButton, { backgroundColor: theme.surfaceContainerHigh, borderColor: theme.outlineVariant }]}>
                        <AppleIcon color={theme.onSurface} />
                        <Text style={[styles.socialText, { color: theme.onSurface }]}>Apple</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </GlassCard>
              </MotiView>

              <MotiView
                from={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 600 }}
                style={styles.footer}
              >
                <View style={styles.footerRow}>
                  <Text style={[styles.footerText, { color: theme.onSurfaceVariant }]}>
                    {t.login.alreadyHaveAccount} 
                  </Text>
                  <TouchableOpacity onPress={() => router.push('/login')}>
                    <Text style={[styles.link, { color: theme.secondary }]}> {t.login.title}</Text>
                  </TouchableOpacity>
                </View>
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
  scrollContent: { flexGrow: 1, justifyContent: 'center' },
  content: { paddingHorizontal: scale(24) },
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
  inputWrapper: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, height: Platform.OS === 'android' ? verticalScale(50) : verticalScale(56), borderRadius: R.md, borderWidth: 1, gap: S.sm + 4 },
  input: { flex: 1, fontSize: F.body + 1, fontWeight: '600', paddingVertical: 0 },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: S.sm + 2, marginTop: verticalScale(2), marginBottom: verticalScale(2) },
  consentText: { flex: 1, fontSize: F.caption, fontFamily: 'Jakarta-SemiBold', lineHeight: verticalScale(16) },
  registerButton: { height: Platform.OS === 'android' ? verticalScale(50) : verticalScale(56), borderRadius: R.md, overflow: 'hidden', marginTop: verticalScale(4) },
  buttonInner: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: moderateScale(10) },
  buttonText: { fontSize: F.subhead + 1, fontWeight: '800' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: S.md, marginVertical: S.xs },
  divider: { flex: 1, height: 1 },
  dividerText: { fontSize: F.caption + 1, fontWeight: '700', opacity: 0.5 },
  socialRow: { flexDirection: 'row', gap: S.md },
  socialButton: { flex: 1, height: Platform.OS === 'android' ? verticalScale(46) : verticalScale(56), borderRadius: R.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: moderateScale(10), borderWidth: 1 },
  socialText: { fontSize: moderateScale(15), fontWeight: '700' },
  footer: { alignItems: 'center', marginTop: Platform.OS === 'android' ? verticalScale(12) : verticalScale(24) },
  footerRow: { flexDirection: 'row', alignItems: 'center' },
  footerText: { fontSize: moderateScale(15), fontWeight: '500' },
  link: { fontSize: moderateScale(15), fontWeight: '800' },
});

