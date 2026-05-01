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
import { Mail, Lock, User, ArrowRight, AlertCircle, Rocket } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { AuthService } from '../services/api';
import { useAppTheme } from '../hooks/useAppTheme';
import { useLanguageStore } from '../store/useLanguageStore';

export default function RegisterScreen() {
  const { theme, isDark } = useAppTheme();
  const { t } = useLanguageStore();
  const router = useRouter();
  const { height, width } = useWindowDimensions();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSmallDevice = height < 750;

  const handleRegister = async () => {
    if (!name || !email || !password) {
      setError(t.login.error);
      return;
    }

    setIsLoading(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await AuthService.register({ name, email, password });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/login');
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
                {/* Top Bar Branding */}
                <View style={[styles.topBar, { paddingVertical: isSmallDevice ? 12 : 20 }]}>
                    <View style={styles.brandRow}>
                        <Rocket size={isSmallDevice ? 20 : 24} color={theme.onSurface} strokeWidth={3} />
                        <Text style={[styles.brandText, { color: theme.onSurface, fontSize: isSmallDevice ? 18 : 22 }]}>TAZQ</Text>
                    </View>
                    <TouchableOpacity onPress={() => router.replace('/login')}>
                        <Text style={[styles.helpText, { color: theme.onSurfaceVariant, fontSize: isSmallDevice ? 14 : 16 }]}>{t.cancel}</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.content}>
                    {/* Register Card */}
                    <MotiView 
                        from={{ opacity: 0, translateY: 20 }}
                        animate={{ opacity: 1, translateY: 0 }}
                        transition={{ delay: 200 }}
                        style={[
                            styles.card, 
                            { 
                                backgroundColor: isDark ? 'rgba(18, 18, 18, 0.8)' : 'rgba(255, 255, 255, 0.95)',
                                borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                                padding: isSmallDevice ? 24 : 32
                            }
                        ]}
                    >
                        <View style={[styles.cardHeader, { marginBottom: isSmallDevice ? 20 : 32 }]}>
                            <Text style={[styles.cardTitle, { color: theme.onSurface, fontSize: isSmallDevice ? 24 : 28 }]}>{t.addTask}</Text>
                            <Text style={[styles.cardSub, { color: theme.onSurfaceVariant, fontSize: isSmallDevice ? 14 : 16, lineHeight: isSmallDevice ? 20 : 22 }]}>{t.onboardingBody2}</Text>
                        </View>

                        {error && (
                            <View style={[styles.errorBox, { backgroundColor: theme.error + '15' }]}>
                                <AlertCircle size={16} color={theme.error} />
                                <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
                            </View>
                        )}

                        <View style={[styles.form, { gap: isSmallDevice ? 16 : 24 }]}>
                            {/* Name Field */}
                            <View style={styles.inputGroup}>
                                <Text style={[styles.label, { color: theme.onSurfaceVariant, fontSize: isSmallDevice ? 11 : 13 }]}>{t.taskTitle.toUpperCase()}</Text>
                                <View style={[styles.inputWrapper, { backgroundColor: isDark ? '#141414' : '#E8E8E8', height: isSmallDevice ? 56 : 64 }]}>
                                    <User size={18} color={theme.outline} />
                                    <TextInput 
                                        placeholder="John Doe"
                                        placeholderTextColor={theme.outlineVariant}
                                        style={[styles.input, { color: theme.onSurface }]}
                                        value={name}
                                        onChangeText={setName}
                                    />
                                </View>
                            </View>

                            {/* Email Field */}
                            <View style={styles.inputGroup}>
                                <Text style={[styles.label, { color: theme.onSurfaceVariant, fontSize: isSmallDevice ? 11 : 13 }]}>{t.login.email.toUpperCase()}</Text>
                                <View style={[styles.inputWrapper, { backgroundColor: isDark ? '#141414' : '#E8E8E8', height: isSmallDevice ? 56 : 64 }]}>
                                    <Mail size={18} color={theme.outline} />
                                    <TextInput 
                                        placeholder="hello@example.com"
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
                                <Text style={[styles.label, { color: theme.onSurfaceVariant, fontSize: isSmallDevice ? 11 : 13 }]}>{t.login.password.toUpperCase()}</Text>
                                <View style={[styles.inputWrapper, { backgroundColor: isDark ? '#141414' : '#E8E8E8', height: isSmallDevice ? 56 : 64 }]}>
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
                                onPress={handleRegister}
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
                                            <Text style={[styles.primaryBtnText, { color: theme.onPrimary, fontSize: isSmallDevice ? 18 : 20 }]}>{t.addTask}</Text>
                                            <ArrowRight size={22} color={theme.onPrimary} strokeWidth={3} />
                                        </>
                                    )}
                                </MotiView>
                            </TouchableOpacity>
                        </View>
                    </MotiView>

                    {/* Footer */}
                    <View style={[styles.footer, { marginTop: isSmallDevice ? 20 : 40 }]}>
                        <Text style={[styles.footerText, { color: theme.onSurfaceVariant }]}>
                            {t.footer} 
                            <TouchableOpacity onPress={() => router.push('/login')}>
                                <Text style={{ color: theme.secondary, fontWeight: '700' }}> {t.login.title}</Text>
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
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 32 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandText: { fontFamily: 'Jakarta-ExtraBold', letterSpacing: -1 },
  helpText: { fontWeight: '700' },
  content: { flex: 1, paddingHorizontal: 20, justifyContent: 'center', alignItems: 'center' },
  card: { width: '100%', borderRadius: 48, borderWidth: 1 },
  cardHeader: { },
  cardTitle: { fontWeight: '800', marginBottom: 4 },
  cardSub: { fontWeight: '500' },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16, marginBottom: 16 },
  errorText: { fontSize: 12, fontWeight: '600' },
  form: { width: '100%' },
  inputGroup: { gap: 8 },
  label: { fontWeight: '800', letterSpacing: 1 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, borderRadius: 32, gap: 12 },
  input: { flex: 1, fontSize: 16, fontWeight: '600' },
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
  footer: { alignItems: 'center' },
  footerText: { fontSize: 15, fontWeight: '500' },
});
