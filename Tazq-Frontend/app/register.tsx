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
import { UserPlus, ArrowLeft, Mail, Lock, User, CheckCircle2, AlertCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { AuthService } from '../services/api';

export default function RegisterScreen() {
  const { width, height } = useWindowDimensions();
  const colorScheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const router = useRouter();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const paddingHorizontal = width * 0.08;

  const handleRegister = async () => {
    if (!name || !email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await AuthService.register({ name, email, password });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Success", 
        "Account created successfully! Please login.",
        [{ text: "OK", onPress: () => router.replace('/login') }]
      );
    } catch (err: any) {
      console.error(err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (err.response?.status === 400) {
        setError(err.response.data || 'Email already in use');
      } else {
        setError('Unable to connect. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <MotiView
        from={{ opacity: 0, scale: 0.5, translateY: -100 }}
        animate={{ opacity: 0.3, scale: 1.2, translateY: -50 }}
        transition={{ type: 'timing', duration: 3500, loop: true, repeatReverse: true }}
        style={[styles.orb, { backgroundColor: theme.secondary, top: -50, right: -50, width: width * 0.8, height: width * 0.8 }]}
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
            <TouchableOpacity 
                onPress={() => router.canGoBack() ? router.back() : router.replace('/login')}
                style={[styles.backBtn, { backgroundColor: theme.surfaceContainerLow, borderColor: 'rgba(255,255,255,0.1)' }]}
            >
                <ArrowLeft size={22} color={theme.onSurface} />
            </TouchableOpacity>

            <MotiView 
                from={{ opacity: 0, translateY: 20 }}
                animate={{ opacity: 1, translateY: 0 }}
                style={styles.headerContainer}
            >
                <MotiText 
                    style={[styles.title, { color: theme.onSurface }]}
                >
                    Create Account
                </MotiText>
            </MotiView>

            <MotiView 
                from={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 150 }}
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
                            <User size={18} color={theme.secondary} />
                            <TextInput 
                                placeholder="Full Name" 
                                placeholderTextColor={theme.onSurfaceVariant + '80'}
                                style={[styles.input, { color: theme.onSurface }]}
                                value={name}
                                onChangeText={(val) => { setName(val); setError(null); }}
                                returnKeyType="next"
                            />
                        </View>

                        <View style={[styles.inputWrapper, { backgroundColor: theme.surfaceContainerHigh + '60' }]}>
                            <Mail size={18} color={theme.secondary} />
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
                            <Lock size={18} color={theme.secondary} />
                            <TextInput 
                                placeholder="Password" 
                                placeholderTextColor={theme.onSurfaceVariant + '80'}
                                style={[styles.input, { color: theme.onSurface }]}
                                secureTextEntry={!showPassword}
                                value={password}
                                onChangeText={(val) => { setPassword(val); setError(null); }}
                                returnKeyType="done"
                                onSubmitEditing={handleRegister}
                            />
                            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                <Text style={{ fontSize: 12, fontWeight: '800', color: theme.secondary }}>
                                    {showPassword ? 'HIDE' : 'SHOW'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity 
                            onPress={handleRegister}
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
                                        <UserPlus size={20} color="white" strokeWidth={2.5} />
                                        <Text style={styles.ctaText}>Create Account</Text>
                                    </View>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </BlurView>
            </MotiView>

            <View style={styles.footer}>
                <Text style={[styles.footerText, { color: theme.onSurfaceVariant }]}>Already have an account?</Text>
                <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/login')}>
                    <Text style={[styles.loginText, { color: theme.primary }]}>Login</Text>
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
    paddingVertical: 20,
  },
  backBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    borderWidth: 1,
  },
  headerContainer: {
    marginBottom: 40,
  },
  title: {
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: -2,
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
    marginTop: 40,
    marginBottom: 40,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  footerText: {
    fontSize: 14,
    fontWeight: '600',
  },
  loginText: {
    fontSize: 14,
    fontWeight: '900',
  }
});
