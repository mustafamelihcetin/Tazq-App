import React, { useState, useRef } from 'react';
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
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView, MotiText } from 'moti';
import { useRouter } from 'expo-router';
import { Mail, Lock, ArrowRight, AlertCircle, Eye, EyeOff } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';
import { AuthService } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import { useAppTheme } from '../hooks/useAppTheme';
import { useLanguageStore } from '../store/useLanguageStore';
import { GlassCard } from '../components/GlassCard';
import { AnimatedBackground } from '../components/AnimatedBackground';
import { TazqLogo } from '../components/TazqLogo';

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
  const { t } = useLanguageStore();
  const router = useRouter();
  const { height } = useWindowDimensions();
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
  
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const handleLogin = async () => {
    if (!email || !password) {
      setError(t.login.error);
      return;
    }

    setIsLoading(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const { token } = await AuthService.login(email, password);
      const userData = await AuthService.getCurrentUser(token);
      setAuth(userData, token);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/');
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(t.login.error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail.trim()) return;
    setForgotLoading(true);
    try {
      await AuthService.forgotPassword(forgotEmail.trim());
      setForgotMsg({ text: t.login.forgotSuccess, success: true });
    } catch {
      setForgotMsg({ text: t.login.forgotError, success: false });
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
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}
          >
            <View style={styles.content}>
              <MotiView
                from={{ opacity: 0, scale: 0.8, translateY: -20 }}
                animate={{ opacity: 1, scale: 1, translateY: 0 }}
                style={styles.header}
              >
                <TazqLogo size={80} />
                <MotiText 
                  from={{ opacity: 0, translateY: 10 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ delay: 200 }}
                  style={[styles.title, { color: theme.onSurface }]}
                >
                  {t.login.title}
                </MotiText>
                <Text style={[styles.subtitle, { color: theme.onSurfaceVariant }]}>
                  {t.login.sub}
                </Text>
              </MotiView>

              <MotiView
                from={{ opacity: 0, translateY: 20 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ delay: 400 }}
                style={styles.cardContainer}
              >
                <GlassCard style={styles.glassCard}>
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
                      <Text style={[styles.label, { color: theme.onSurfaceVariant }]}>{t.login.email.toUpperCase()}</Text>
                      <View style={[styles.inputWrapper, { backgroundColor: theme.surfaceContainerLow, borderColor: theme.outlineVariant }]}>
                        <Mail size={18} color={theme.outline} />
                        <TextInput
                          ref={emailRef}
                          placeholder={t.login.email}
                          placeholderTextColor={theme.outlineVariant}
                          style={[styles.input, { color: theme.onSurface }]}
                          value={email}
                          onChangeText={setEmail}
                          autoCapitalize="none"
                          keyboardType="email-address"
                        />
                      </View>
                    </View>

                    <View style={styles.inputGroup}>
                      <View style={styles.labelRow}>
                        <Text style={[styles.label, { color: theme.onSurfaceVariant }]}>{t.login.password.toUpperCase()}</Text>
                        <TouchableOpacity onPress={() => setForgotVisible(true)}>
                          <Text style={[styles.forgotText, { color: theme.primary }]}>{t.login.forgotPassword}</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={[styles.inputWrapper, { backgroundColor: theme.surfaceContainerLow, borderColor: theme.outlineVariant }]}>
                        <Lock size={18} color={theme.outline} />
                        <TextInput
                          ref={passwordRef}
                          placeholder="••••••••"
                          placeholderTextColor={theme.outlineVariant}
                          style={[styles.input, { color: theme.onSurface }]}
                          value={password}
                          onChangeText={setPassword}
                          secureTextEntry={!showPassword}
                        />
                        <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                          {showPassword ? <EyeOff size={18} color={theme.outline} /> : <Eye size={18} color={theme.outline} />}
                        </TouchableOpacity>
                      </View>
                    </View>

                    <TouchableOpacity
                      onPress={handleLogin}
                      disabled={isLoading}
                      style={styles.loginButton}
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
                    </TouchableOpacity>

                    {/* OR Divider */}
                    <View style={styles.dividerRow}>
                      <View style={[styles.divider, { backgroundColor: theme.outlineVariant + '40' }]} />
                      <Text style={[styles.dividerText, { color: theme.onSurfaceVariant }]}>{t.login.orDivider}</Text>
                      <View style={[styles.divider, { backgroundColor: theme.outlineVariant + '40' }]} />
                    </View>

                    {/* Social Buttons */}
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

              {/* Fixed Footer Alignment */}
              <MotiView
                from={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 600 }}
                style={styles.footer}
              >
                <View style={styles.footerRow}>
                  <Text style={[styles.footerText, { color: theme.onSurfaceVariant }]}>
                    {t.login.footer}
                  </Text>
                  <TouchableOpacity onPress={() => router.push('/register')}>
                    <Text style={[styles.link, { color: theme.primary }]}> {t.login.signUp}</Text>
                  </TouchableOpacity>
                </View>
              </MotiView>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>

        <Modal visible={forgotVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <GlassCard style={styles.modalCard}>
              <Text style={[styles.modalTitle, { color: theme.onSurface }]}>{t.login.forgotTitle}</Text>
              <Text style={[styles.modalSub, { color: theme.onSurfaceVariant }]}>{t.login.forgotSub}</Text>
              
              <TextInput
                placeholder={t.login.email}
                placeholderTextColor={theme.outlineVariant}
                style={[styles.modalInput, { backgroundColor: theme.surfaceContainerLow, color: theme.onSurface, borderColor: theme.outlineVariant }]}
                value={forgotEmail}
                onChangeText={setForgotEmail}
                autoCapitalize="none"
              />

              <View style={styles.modalActions}>
                <TouchableOpacity onPress={() => setForgotVisible(false)} style={styles.modalCancel}>
                  <Text style={{ color: theme.onSurfaceVariant }}>{t.cancel}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleForgotPassword} style={[styles.modalSend, { backgroundColor: theme.primary }]}>
                  <Text style={{ color: theme.onPrimary }}>{t.login.forgotSend}</Text>
                </TouchableOpacity>
              </View>
            </GlassCard>
          </View>
        </Modal>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  keyboardView: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 40 },
  title: { fontSize: 32, fontFamily: 'Jakarta-ExtraBold', marginTop: 16, letterSpacing: -1 },
  subtitle: { fontSize: 16, fontWeight: '500', marginTop: 4, opacity: 0.7 },
  cardContainer: { width: '100%' },
  glassCard: { width: '100%', padding: 24 },
  errorContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, marginBottom: 16 },
  errorText: { fontSize: 13, fontWeight: '600' },
  form: { gap: 16 },
  inputGroup: { gap: 8 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  forgotText: { fontSize: 12, fontWeight: '700' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 56, borderRadius: 16, borderWidth: 1, gap: 12 },
  input: { flex: 1, fontSize: 16, fontWeight: '600' },
  loginButton: { height: 56, borderRadius: 16, overflow: 'hidden' },
  buttonInner: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  buttonText: { fontSize: 18, fontWeight: '800' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 8 },
  divider: { flex: 1, height: 1 },
  dividerText: { fontSize: 12, fontWeight: '700', opacity: 0.5 },
  socialRow: { flexDirection: 'row', gap: 12 },
  socialButton: { flex: 1, height: 56, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1 },
  socialText: { fontSize: 15, fontWeight: '700' },
  footer: { alignItems: 'center', marginTop: 32 },
  footerRow: { flexDirection: 'row', alignItems: 'center' },
  footerText: { fontSize: 15, fontWeight: '500' },
  link: { fontSize: 15, fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalCard: { padding: 24, gap: 16 },
  modalTitle: { fontSize: 24, fontWeight: '900' },
  modalSub: { fontSize: 14, fontWeight: '500', lineHeight: 20 },
  modalInput: { height: 56, borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, fontSize: 16, fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancel: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalSend: { flex: 2, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
