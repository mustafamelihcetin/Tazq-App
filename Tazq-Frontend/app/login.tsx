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
  const { width } = useWindowDimensions();
  const colorScheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setError('Invalid credentials or connection issue.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Dynamic Background Orbs (Stitch UI Style) */}
      <MotiView
        from={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: colorScheme === 'dark' ? 0.2 : 0.05, scale: 1.5 }}
        transition={{ type: 'timing', duration: 4000, loop: true, repeatReverse: true }}
        style={[styles.orb, { backgroundColor: theme.primary, top: -100, right: -50, width: 300, height: 300 }]}
      />
      
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            
            <MotiView 
                from={{ opacity: 0, translateY: -20 }}
                animate={{ opacity: 1, translateY: 0 }}
                style={styles.header}
            >
                <View style={[styles.logoBubble, { backgroundColor: theme.primary }]}>
                    <Text style={styles.logoText}>T</Text>
                </View>
                <Text style={[styles.welcomeTitle, { color: theme.onSurface }]}>Welcome Back</Text>
                <Text style={[styles.welcomeSub, { color: theme.onSurfaceVariant }]}>Sign in to continue your flow</Text>
            </MotiView>

            <View style={styles.formContainer}>
                {error && (
                    <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} style={styles.errorContainer}>
                        <AlertCircle size={16} color={theme.error} />
                        <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
                    </MotiView>
                )}

                <View style={styles.inputGroup}>
                    <View style={[styles.inputWrapper, { backgroundColor: theme.surfaceContainerLow, borderColor: theme.outlineVariant + '30' }]}>
                        <Mail size={18} color={theme.onSurfaceVariant} />
                        <TextInput 
                            placeholder="Email Address" 
                            placeholderTextColor={theme.onSurfaceVariant + '80'}
                            style={[styles.input, { color: theme.onSurface }]}
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                        />
                    </View>

                    <View style={[styles.inputWrapper, { backgroundColor: theme.surfaceContainerLow, borderColor: theme.outlineVariant + '30' }]}>
                        <Lock size={18} color={theme.onSurfaceVariant} />
                        <TextInput 
                            placeholder="Password" 
                            placeholderTextColor={theme.onSurfaceVariant + '80'}
                            style={[styles.input, { color: theme.onSurface }]}
                            secureTextEntry={!showPassword}
                            value={password}
                            onChangeText={setPassword}
                        />
                        <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                            <Text style={[styles.showText, { color: theme.primary }]}>{showPassword ? 'HIDE' : 'SHOW'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <TouchableOpacity 
                    onPress={handleLogin}
                    disabled={isLoading}
                    activeOpacity={0.9}
                    style={styles.loginBtnWrapper}
                >
                    <LinearGradient
                        colors={[theme.primary, theme.primaryContainer]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.loginBtn}
                    >
                        {isLoading ? (
                            <ActivityIndicator color={theme.onPrimary} />
                        ) : (
                            <>
                                <Text style={[styles.loginBtnText, { color: theme.onPrimary }]}>Login Now</Text>
                                <LogIn size={20} color={theme.onPrimary} strokeWidth={3} />
                            </>
                        )}
                    </LinearGradient>
                </TouchableOpacity>

                <View style={styles.footer}>
                    <Text style={[styles.footerText, { color: theme.onSurfaceVariant }]}>New to Tazq?</Text>
                    <TouchableOpacity onPress={() => router.push('/register')}>
                        <Text style={[styles.signUpText, { color: theme.primary }]}> Create Account</Text>
                    </TouchableOpacity>
                </View>
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
    borderRadius: 150,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 32,
    justifyContent: 'center',
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoBubble: {
    width: 80,
    height: 80,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 8,
  },
  logoText: {
    color: 'white',
    fontSize: 40,
    fontWeight: '900',
    fontStyle: 'italic',
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
  },
  welcomeSub: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 8,
  },
  formContainer: {
    gap: 24,
  },
  inputGroup: {
    gap: 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 64,
    borderRadius: 20,
    paddingHorizontal: 20,
    borderWidth: 1.2,
  },
  input: {
    flex: 1,
    marginLeft: 16,
    fontSize: 16,
    fontWeight: '600',
    height: '100%',
  },
  showText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  loginBtnWrapper: {
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  loginBtn: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loginBtnText: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,68,68,0.1)',
    padding: 12,
    borderRadius: 12,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  footerText: {
    fontSize: 14,
    fontWeight: '600',
  },
  signUpText: {
    fontSize: 14,
    fontWeight: '800',
  }
});
