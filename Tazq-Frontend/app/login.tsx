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
  ScrollView,
  Alert,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView, MotiText } from 'moti';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/Colors';
import { useColorScheme } from 'react-native';
import { LogIn, Fingerprint, Mail, Lock, AlertCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { AuthService } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';

export default function LoginScreen() {
  const { width, height } = useWindowDimensions();
  const colorScheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const paddingHorizontal = width * 0.08;
  const logoSize = width * 0.22;

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
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
      if (err.response?.status === 401) {
        setError('Invalid email or password');
      } else {
        setError('Unable to connect. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Background Orbs */}
      <MotiView
        from={{ opacity: 0, scale: 0.5, translateX: -100 }}
        animate={{ opacity: 0.4, scale: 1, translateX: 0 }}
        transition={{ type: 'timing', duration: 3000, loop: true, repeatReverse: true }}
        style={[styles.orb, { backgroundColor: theme.primary, top: -50, left: -50, width: width * 0.8, height: width * 0.8 }]}
      />
      <MotiView
        from={{ opacity: 0, scale: 0.5, translateX: 100 }}
        animate={{ opacity: 0.3, scale: 1.2, translateX: 50 }}
        transition={{ type: 'timing', duration: 4000, loop: true, repeatReverse: true, delay: 500 }}
        style={[styles.orb, { backgroundColor: theme.secondary, bottom: -100, right: -100, width: width * 0.9, height: width * 0.9 }]}
      />

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView 
            contentContainerStyle={[styles.scrollContent, { paddingHorizontal }]}
            showsVerticalScrollIndicator={false}
          >
            <MotiView 
              from={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', damping: 12 }}
              style={styles.logoContainer}
            >
              <View 
                style={[styles.logoBubble, { width: logoSize, height: logoSize, borderRadius: logoSize * 0.4, backgroundColor: theme.primary }]}
              >
                  <LinearGradient
                    colors={['rgba(255,255,255,0.3)', 'transparent']}
                    style={[StyleSheet.absoluteFill, { borderRadius: logoSize * 0.4 }]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                  <Text style={[styles.logoText, { fontSize: logoSize * 0.45 }]}>T</Text>
              </View>
              
              <MotiText 
                style={[styles.welcomeTitle, { color: theme.onSurface }]}
              >
                Welcome Back
              </MotiText>
            </MotiView>

            <MotiView 
             from={{ opacity: 0, translateY: 30 }}
             animate={{ opacity: 1, translateY: 0 }}
             transition={{ delay: 200, type: 'spring' }}
             style={[styles.glassCard, { borderColor: 'rgba(255,255,255,0.2)' }]}
            >
                <BlurView intensity={Platform.OS === 'ios' ? 40 : 100} tint={colorScheme} style={styles.blurContent}>
                    <View style={styles.formGap}>
                        {error && (
                            <MotiView 
                                from={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                style={[styles.errorBox, { backgroundColor: theme.error + '15', borderColor: theme.error + '30' }]}
                            >
                                <AlertCircle size={18} color={theme.error} />
                                <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
                            </MotiView>
                        )}

                        <View style={[styles.inputWrapper, { backgroundColor: theme.surfaceContainerHigh + '60' }]}>
                            <Mail size={18} color={theme.primary} />
                            <TextInput 
                                placeholder="Email Address" 
                                placeholderTextColor={theme.onSurfaceVariant + '80'}
                                style={[styles.input, { color: theme.onSurface }]}
                                value={email}
                                onChangeText={(val) => { setEmail(val); setError(null); }}
                                autoCapitalize="none"
                                returnKeyType="next"
                            />
                        </View>

                        <View style={[styles.inputWrapper, { backgroundColor: theme.surfaceContainerHigh + '60' }]}>
                            <Lock size={18} color={theme.primary} />
                            <TextInput 
                                placeholder="Password" 
                                placeholderTextColor={theme.onSurfaceVariant + '80'}
                                style={[styles.input, { color: theme.onSurface }]}
                                secureTextEntry={!showPassword}
                                value={password}
                                onChangeText={(val) => { setPassword(val); setError(null); }}
                                returnKeyType="done"
                                onSubmitEditing={handleLogin}
                            />
                            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                <Text style={{ fontSize: 12, fontWeight: '800', color: theme.primary }}>
                                    {showPassword ? 'HIDE' : 'SHOW'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity 
                            onPress={handleLogin}
                            disabled={isLoading}
                            activeOpacity={0.8}
                            style={[styles.ctaButton, { backgroundColor: theme.secondary, shadowColor: theme.secondary }]}
                        >
                            <LinearGradient
                                colors={[theme.secondary, theme.secondaryContainer || theme.secondary]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.gradientBtn}
                            >
                                {isLoading ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <View style={styles.btnContent}>
                                        <LogIn size={20} color="white" strokeWidth={2.5} />
                                        <Text style={styles.ctaText}>Login Now</Text>
                                    </View>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </BlurView>
            </MotiView>

            <View style={styles.footer}>
                <Text style={[styles.footerText, { color: theme.onSurfaceVariant }]}>Don't have an account?</Text>
                <TouchableOpacity onPress={() => router.push('/register')}>
                    <Text style={[styles.signUpText, { color: theme.primary }]}>Sign Up</Text>
                </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  orb: {
    position: 'absolute',
    borderRadius: 1000,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoBubble: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  logoText: {
    color: 'white',
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: -2,
  },
  welcomeTitle: {
    fontSize: 36,
    fontWeight: '900',
    marginTop: 24,
    letterSpacing: -1.5,
  },
  glassCard: {
    borderRadius: 40,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.1,
    shadowRadius: 30,
    elevation: 5,
  },
  blurContent: {
    padding: 32,
  },
  formGap: {
    gap: 20,
  },
  errorBox: {
    padding: 16,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '700',
  },
  inputWrapper: {
    borderRadius: 24,
    paddingHorizontal: 20,
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  input: {
    flex: 1,
    marginLeft: 16,
    fontSize: 16,
    fontWeight: '600',
    height: '100%',
  },
  ctaButton: {
    borderRadius: 24,
    overflow: 'hidden',
    marginTop: 8,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 5,
  },
  gradientBtn: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  ctaText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  footer: {
    marginTop: 32,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  footerText: {
    fontSize: 14,
    fontWeight: '600',
  },
  signUpText: {
    fontSize: 14,
    fontWeight: '900',
  }
});
