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
  const forgotRef = useRef<TextInput>(null);

  const handleForgotPassword = async () => {
    if (!forgotEmail.trim()) return;
    setForgotLoading(true);
    setForgotMsg(null);
    try {
      await AuthService.forgotPassword(forgotEmail.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setForgotMsg({ text: t.login.forgotSuccess, success: true });
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setForgotMsg({ text: t.login.forgotError, success: false });
    } finally {
      setForgotLoading(false);
    }
  };

  const isSmallDevice = height < 750;

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
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout') || !err.response) {
        setError(t.login.networkError);
      } else {
        setError(t.login.error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={StyleSheet.absoluteFill}>
            <View style={[styles.blob, { backgroundColor: theme.primaryDim, top: '-10%', left: '-10%', opacity: isDark ? 0.1 : 0.05 }]} />
            <View style={[styles.blob, { backgroundColor: theme.secondary, bottom: '-10%', right: '-10%', opacity: isDark ? 0.1 : 0.05 }]} />
        </View>

        <SafeAreaView style={{ flex: 1 }}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <View style={styles.content}>
                    <View style={[styles.header, { marginBottom: isSmallDevice ? 24 : 48 }]}>
                        <MotiText
                            from={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            style={[styles.brand, { color: theme.onSurface, fontSize: isSmallDevice ? 48 : 64 }]}
                        >
                            TAZQ
                        </MotiText>
                        <MotiText
                            from={{ opacity: 0, translateY: 10 }}
                            animate={{ opacity: 1, translateY: 0 }}
                            transition={{ delay: 200 }}
                            style={[styles.subTitle, { color: theme.onSurfaceVariant, fontSize: isSmallDevice ? 16 : 20 }]}
                        >
                            {t.login.sub}
                        </MotiText>
                    </View>

                    <MotiView
                        from={{ opacity: 0, translateY: 20 }}
                        animate={{ opacity: 1, translateY: 0 }}
                        transition={{ delay: 400 }}
                        style={[
                            styles.card,
                            {
                                backgroundColor: isDark ? 'rgba(18, 18, 18, 0.8)' : 'rgba(255, 255, 255, 0.8)',
                                borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                                padding: isSmallDevice ? 24 : 32
                            }
                        ]}
                    >
                        {error && (
                            <View style={[styles.errorBox, { backgroundColor: theme.error + '15' }]}>
                                <AlertCircle size={16} color={theme.error} />
                                <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
                            </View>
                        )}

                        <View style={[styles.form, { gap: isSmallDevice ? 16 : 24 }]}>
                            <View style={styles.inputGroup}>
                                <Text style={[styles.label, { color: theme.secondary, fontSize: isSmallDevice ? 14 : 16 }]}>{t.login.email}</Text>
                                <TouchableOpacity 
                                    activeOpacity={1}
                                    onPress={() => emailRef.current?.focus()}
                                    style={[styles.inputWrapper, { backgroundColor: isDark ? '#141414' : theme.surfaceContainer, height: isSmallDevice ? 56 : 64 }]}
                                >
                                    <Mail size={18} color={theme.outline} />
                                    <TextInput
                                        ref={emailRef}
                                        placeholder={t.login.email}
                                        placeholderTextColor={theme.outlineVariant}
                                        style={[styles.input, { color: theme.onSurface }]}
                                        value={email}
                                        onChangeText={(v) => { setEmail(v); setError(null); }}
                                        autoCapitalize="none"
                                        keyboardType="email-address"
                                    />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.inputGroup}>
                                <View style={styles.labelRow}>
                                    <Text style={[styles.label, { color: theme.tertiary, fontSize: isSmallDevice ? 14 : 16 }]}>{t.login.password}</Text>
                                    <TouchableOpacity onPress={() => { setForgotEmail(''); setForgotMsg(null); setForgotVisible(true); }}>
                                        <Text style={[styles.forgotText, { color: theme.primary }]}>{t.login.forgotPassword}</Text>
                                    </TouchableOpacity>
                                </View>
                                <TouchableOpacity 
                                    activeOpacity={1}
                                    onPress={() => passwordRef.current?.focus()}
                                    style={[styles.inputWrapper, { backgroundColor: isDark ? '#141414' : theme.surfaceContainer, height: isSmallDevice ? 56 : 64 }]}
                                >
                                    <Lock size={18} color={theme.outline} />
                                    <TextInput
                                        ref={passwordRef}
                                        placeholder="••••••••"
                                        placeholderTextColor={theme.outlineVariant}
                                        style={[styles.input, { color: theme.onSurface }]}
                                        value={password}
                                        onChangeText={(v) => { setPassword(v); setError(null); }}
                                        secureTextEntry={!showPassword}
                                    />
                                    <TouchableOpacity onPress={() => setShowPassword(p => !p)} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                                        {showPassword
                                            ? <EyeOff size={18} color={theme.outline} />
                                            : <Eye size={18} color={theme.outline} />
                                        }
                                    </TouchableOpacity>
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity
                                onPress={handleLogin}
                                disabled={isLoading}
                                style={styles.primaryBtnWrapper}
                            >
                                <MotiView
                                    animate={{ scale: isLoading ? 0.98 : 1, backgroundColor: theme.primary }}
                                    style={[styles.primaryBtn, isDark && styles.neonGlow, { height: isSmallDevice ? 64 : 72 }]}
                                >
                                    {isLoading ? (
                                        <ActivityIndicator color={theme.onPrimary} />
                                    ) : (
                                        <>
                                            <Text style={[styles.primaryBtnText, { color: theme.onPrimary, fontSize: isSmallDevice ? 18 : 20 }]}>{t.login.button}</Text>
                                            <ArrowRight size={22} color={theme.onPrimary} strokeWidth={3} />
                                        </>
                                    )}
                                </MotiView>
                            </TouchableOpacity>
                        </View>

                        <View style={[styles.dividerRow, { marginVertical: isSmallDevice ? 20 : 32 }]}>
                            <View style={[styles.divider, { backgroundColor: theme.outlineVariant + '30' }]} />
                            <Text style={[styles.dividerText, { color: theme.outlineVariant }]}>{t.login.orDivider}</Text>
                            <View style={[styles.divider, { backgroundColor: theme.outlineVariant + '30' }]} />
                        </View>

                        <View style={styles.socialRow}>
                            {[
                              { d: "M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z" },
                              { d: "M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.78 1.18-.19 2.31-.88 3.5-.84 1.58.11 2.81.7 3.56 1.81-3.33 1.94-2.76 6.5.42 7.79-.81 1.6-1.57 3.12-2.56 3.43zM12.03 7.25C11.83 4.2 14.16 1.5 17 1c.29 3.22-2.51 5.92-4.97 6.25z" }
                            ].map((icon, i) => (
                              <View key={i} style={{ position: 'relative' }}>
                                <View style={[styles.socialBtn, { backgroundColor: isDark ? '#1a1a1a' : theme.surfaceContainerHighest, width: isSmallDevice ? 64 : 80, height: isSmallDevice ? 64 : 80, opacity: 0.4 }]}>
                                    <Svg width={24} height={24} viewBox="0 0 24 24" fill={isDark ? "white" : "black"}>
                                        <Path d={icon.d} />
                                    </Svg>
                                </View>
                                <View style={styles.comingSoonBadge}>
                                    <Text style={[styles.comingSoonText, { color: theme.onSurfaceVariant }]}>{t.login.comingSoon}</Text>
                                </View>
                              </View>
                            ))}
                        </View>
                    </MotiView>

                    <View style={[styles.footer, { marginTop: isSmallDevice ? 20 : 40 }]}>
                        <Text style={[styles.footerText, { color: theme.onSurfaceVariant }]}>
                            {t.login.footer}
                            <TouchableOpacity onPress={() => router.push('/register')}>
                                <Text style={{ color: theme.secondary, fontWeight: '700' }}> {t.login.signUp}</Text>
                            </TouchableOpacity>
                        </Text>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
        </View>
    </TouchableWithoutFeedback>
      {/* Forgot Password Modal */}
      <Modal visible={forgotVisible} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <MotiView
              from={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              style={[styles.forgotCard, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)' }]}
            >
              <Text style={[styles.forgotTitle, { color: theme.onSurface, fontSize: isSmallDevice ? 20 : 24 }]}>{t.login.forgotTitle}</Text>
              <Text style={[styles.forgotSub, { color: theme.onSurfaceVariant, fontSize: isSmallDevice ? 13 : 14 }]}>{t.login.forgotSub}</Text>

              {forgotMsg && (
                <View style={[styles.forgotMsgBox, { backgroundColor: forgotMsg.success ? theme.tertiary + '15' : theme.error + '15' }]}>
                  <Text style={{ color: forgotMsg.success ? theme.tertiary : theme.error, fontSize: 13, fontWeight: '700' }}>{forgotMsg.text}</Text>
                </View>
              )}

              <TouchableOpacity 
                activeOpacity={1}
                onPress={() => forgotRef.current?.focus()}
                style={[styles.forgotInput, { backgroundColor: isDark ? '#141414' : theme.surfaceContainer }]}
              >
                <Mail size={16} color={theme.outline} />
                <TextInput
                  ref={forgotRef}
                  placeholder={t.login.email}
                  placeholderTextColor={theme.outlineVariant}
                  style={[{ flex: 1, fontSize: 15, fontWeight: '600', color: theme.onSurface }]}
                  value={forgotEmail}
                  onChangeText={setForgotEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoFocus
                />
              </TouchableOpacity>

              <View style={styles.forgotActions}>
                <TouchableOpacity onPress={() => setForgotVisible(false)} style={[styles.forgotCancelBtn, { borderColor: theme.outlineVariant + '40' }]}>
                  <Text style={{ color: theme.onSurfaceVariant, fontWeight: '700', fontSize: 15 }}>{t.cancel}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleForgotPassword}
                  disabled={forgotLoading || !forgotEmail.trim()}
                  style={[styles.forgotSendBtn, { backgroundColor: forgotEmail.trim() ? theme.primary : theme.surfaceContainerHigh }]}
                >
                  {forgotLoading
                    ? <ActivityIndicator color="white" size="small" />
                    : <Text style={{ color: forgotEmail.trim() ? 'white' : theme.onSurfaceVariant, fontWeight: '800', fontSize: 15 }}>{t.login.forgotSend}</Text>
                  }
                </TouchableOpacity>
              </View>
            </MotiView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  blob: { position: 'absolute', width: '100%', height: '100%', borderRadius: 1000, filter: 'blur(100px)' },
  content: { flex: 1, paddingHorizontal: 24, justifyContent: 'center', alignItems: 'center' },
  header: { alignItems: 'center' },
  brand: { fontFamily: 'Jakarta-ExtraBold', letterSpacing: -4, marginBottom: 4 },
  subTitle: { fontWeight: '500', opacity: 0.8 },
  card: { width: '100%', borderRadius: 48, borderWidth: 1 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16, marginBottom: 16 },
  errorText: { fontSize: 12, fontWeight: '600', flex: 1 },
  form: { width: '100%' },
  inputGroup: { gap: 8 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontWeight: '700' },
  forgotText: { fontSize: 13, fontWeight: '600' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, borderRadius: 24, gap: 12 },
  input: { flex: 1, fontSize: 16, fontWeight: '500' },
  primaryBtnWrapper: { marginTop: 8 },
  primaryBtn: { borderRadius: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  neonGlow: { shadowColor: '#000', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.1, shadowRadius: 15, elevation: 8 },
  primaryBtnText: { fontWeight: '800' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  divider: { flex: 1, height: 1 },
  dividerText: { fontSize: 13, fontWeight: '700', letterSpacing: 2 },
  socialRow: { flexDirection: 'row', justifyContent: 'center', gap: 20 },
  socialBtn: { borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  comingSoonBadge: { position: 'absolute', bottom: -8, left: 0, right: 0, alignItems: 'center' },
  comingSoonText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  footer: { alignItems: 'center' },
  footerText: { fontSize: 15, fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  forgotCard: { width: '100%', borderRadius: 36, padding: 28, borderWidth: 1, gap: 16 },
  forgotTitle: { fontWeight: '900', letterSpacing: -0.5 },
  forgotSub: { fontWeight: '500', lineHeight: 20, marginTop: -8 },
  forgotMsgBox: { borderRadius: 16, padding: 12 },
  forgotInput: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, paddingHorizontal: 18, height: 56 },
  forgotActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  forgotCancelBtn: { flex: 1, height: 52, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  forgotSendBtn: { flex: 1.5, height: 52, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
