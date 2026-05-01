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
  Keyboard
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView, MotiText } from 'moti';
import { useRouter } from 'expo-router';
import { Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react-native';
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
  const { height, width } = useWindowDimensions();
  const setAuth = useAuthStore(state => state.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      console.error(err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(t.login.error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* 🎭 Ambient Background Gradients */}
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
                    {/* Header / Brand */}
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

                    {/* Login Card */}
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
                            {/* Email Field */}
                            <View style={styles.inputGroup}>
                                <Text style={[styles.label, { color: theme.secondary, fontSize: isSmallDevice ? 14 : 16 }]}>{t.login.email}</Text>
                                <View style={[styles.inputWrapper, { backgroundColor: isDark ? '#141414' : theme.surfaceContainer, height: isSmallDevice ? 56 : 64 }]}>
                                    <Mail size={18} color={theme.outline} />
                                    <TextInput 
                                        placeholder={t.login.email}
                                        placeholderTextColor={theme.outlineVariant}
                                        style={[styles.input, { color: theme.onSurface }]}
                                        value={email}
                                        onChangeText={setEmail}
                                        autoCapitalize="none"
                                    />
                                </View>
                            </View>

                            {/* Password Field */}
                            <View style={styles.inputGroup}>
                                <View style={styles.labelRow}>
                                    <Text style={[styles.label, { color: theme.tertiary, fontSize: isSmallDevice ? 14 : 16 }]}>{t.login.password}</Text>
                                    <TouchableOpacity>
                                        <Text style={[styles.forgotText, { color: theme.primary }]}>{t.cancel}</Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={[styles.inputWrapper, { backgroundColor: isDark ? '#141414' : theme.surfaceContainer, height: isSmallDevice ? 56 : 64 }]}>
                                    <Lock size={18} color={theme.outline} />
                                    <TextInput 
                                        placeholder="••••••••"
                                        placeholderTextColor={theme.outlineVariant}
                                        style={[styles.input, { color: theme.onSurface }]}
                                        value={password}
                                        onChangeText={setPassword}
                                        secureTextEntry
                                    />
                                </View>
                            </View>

                            {/* Action Button */}
                            <TouchableOpacity 
                                onPress={handleLogin}
                                disabled={isLoading}
                                style={styles.primaryBtnWrapper}
                            >
                                <MotiView 
                                    animate={{ 
                                        scale: isLoading ? 0.98 : 1,
                                        backgroundColor: theme.primary
                                    }}
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

                        {/* Divider */}
                        <View style={[styles.dividerRow, { marginVertical: isSmallDevice ? 20 : 32 }]}>
                            <View style={[styles.divider, { backgroundColor: theme.outlineVariant + '30' }]} />
                            <Text style={[styles.dividerText, { color: theme.outlineVariant }]}>{t.filterAll.toUpperCase() === 'HEPSİ' ? 'VEYA' : 'OR'}</Text>
                            <View style={[styles.divider, { backgroundColor: theme.outlineVariant + '30' }]} />
                        </View>

                        {/* Social Actions */}
                        <View style={styles.socialRow}>
                            <TouchableOpacity style={[styles.socialBtn, { backgroundColor: isDark ? '#1a1a1a' : theme.surfaceContainerHighest, width: isSmallDevice ? 64 : 80, height: isSmallDevice ? 64 : 80 }]}>
                                <Svg width={24} height={24} viewBox="0 0 24 24" fill={isDark ? "white" : "black"}>
                                    <Path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z" />
                                </Svg>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.socialBtn, { backgroundColor: isDark ? '#1a1a1a' : theme.surfaceContainerHighest, width: isSmallDevice ? 64 : 80, height: isSmallDevice ? 64 : 80 }]}>
                                <Svg width={24} height={24} viewBox="0 0 24 24" fill={isDark ? "white" : "black"}>
                                    <Path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.78 1.18-.19 2.31-.88 3.5-.84 1.58.11 2.81.7 3.56 1.81-3.33 1.94-2.76 6.5.42 7.79-.81 1.6-1.57 3.12-2.56 3.43zM12.03 7.25C11.83 4.2 14.16 1.5 17 1c.29 3.22-2.51 5.92-4.97 6.25z" />
                                </Svg>
                            </TouchableOpacity>
                        </View>
                    </MotiView>

                    {/* Footer */}
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
  errorText: { fontSize: 12, fontWeight: '600' },
  form: { width: '100%' },
  inputGroup: { gap: 8 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontWeight: '700' },
  forgotText: { fontSize: 13, fontWeight: '600' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, borderRadius: 24, gap: 12 },
  input: { flex: 1, fontSize: 16, fontWeight: '500' },
  primaryBtnWrapper: { marginTop: 8 },
  primaryBtn: { borderRadius: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  neonGlow: {
    shadowColor: '#3367ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
  },
  primaryBtnText: { fontWeight: '800' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  divider: { flex: 1, height: 1 },
  dividerText: { fontSize: 13, fontWeight: '700', letterSpacing: 2 },
  socialRow: { flexDirection: 'row', justifyContent: 'center', gap: 20 },
  socialBtn: { borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  footer: { alignItems: 'center' },
  footerText: { fontSize: 15, fontWeight: '500' },
});
