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
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      
      // Pass the token manually to getCurrentUser to avoid 401
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
        setError('Connection error. Is backend running?');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
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

      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <ScrollView 
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal }}
            showsVerticalScrollIndicator={false}
          >
            <MotiView 
              from={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', damping: 12 }}
              className="items-center mb-10"
            >
              <View 
                style={[styles.logoBubble, { width: logoSize, height: logoSize, borderRadius: logoSize * 0.4 }]}
                className="bg-primary items-center justify-center shadow-2xl"
              >
                  <LinearGradient
                    colors={['rgba(255,255,255,0.3)', 'transparent']}
                    className="absolute inset-0 rounded-full"
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                  <Text style={{ fontSize: logoSize * 0.45 }} className="text-white font-black italic tracking-tighter">T</Text>
              </View>
              
              <MotiText 
                className="text-4xl font-black mt-6 tracking-tighter"
                style={{ color: theme.onSurface }}
              >
                Welcome Back
              </MotiText>
            </MotiView>

            <MotiView 
             from={{ opacity: 0, translateY: 30 }}
             animate={{ opacity: 1, translateY: 0 }}
             transition={{ delay: 200, type: 'spring' }}
             className="overflow-hidden rounded-[40px] border border-white/20 shadow-2xl shadow-black/5"
            >
                <BlurView intensity={Platform.OS === 'ios' ? 40 : 100} tint={colorScheme} className="p-8">
                    <View className="gap-5">
                        {error && (
                            <MotiView 
                                from={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="bg-error/10 p-4 rounded-2xl flex-row items-center gap-3 border border-error/20"
                            >
                                <AlertCircle size={18} color={theme.error} />
                                <Text className="text-xs font-bold" style={{ color: theme.error }}>{error}</Text>
                            </MotiView>
                        )}

                        <View className="bg-surface-container-high/40 rounded-[24px] px-5 py-4 flex-row items-center border border-white/10">
                            <Mail size={18} color={theme.primary} />
                            <TextInput 
                                placeholder="Email Address" 
                                placeholderTextColor={theme.onSurfaceVariant + '80'}
                                className="flex-1 ml-4 text-base font-semibold"
                                style={{ color: theme.onSurface }}
                                value={email}
                                onChangeText={(val) => { setEmail(val); setError(null); }}
                                autoCapitalize="none"
                                returnKeyType="next"
                            />
                        </View>

                        <View className="bg-surface-container-high/40 rounded-[24px] px-5 py-4 flex-row items-center border border-white/10">
                            <Lock size={18} color={theme.primary} />
                            <TextInput 
                                placeholder="Password" 
                                placeholderTextColor={theme.onSurfaceVariant + '80'}
                                className="flex-1 ml-4 text-base font-semibold"
                                style={{ color: theme.onSurface }}
                                secureTextEntry
                                value={password}
                                onChangeText={(val) => { setPassword(val); setError(null); }}
                                returnKeyType="done"
                                onSubmitEditing={handleLogin}
                            />
                        </View>

                        <TouchableOpacity 
                            onPress={handleLogin}
                            disabled={isLoading}
                            activeOpacity={0.8}
                            style={styles.ctaButton}
                            className={`bg-primary rounded-[24px] overflow-hidden shadow-xl shadow-primary/30 mt-4 ${isLoading ? 'opacity-70' : ''}`}
                        >
                            <LinearGradient
                                colors={[theme.primary, theme.primary_fixed_dim || theme.primary]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                className="py-5 items-center flex-row justify-center gap-3"
                            >
                                {isLoading ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <>
                                        <LogIn size={18} color="white" strokeWidth={2.5} />
                                        <Text className="text-white text-lg font-black tracking-tight">Login Now</Text>
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </BlurView>
            </MotiView>

            <View className="mt-8 flex-row justify-center items-center gap-2">
                <Text className="text-sm font-medium" style={{ color: theme.onSurfaceVariant }}>Don't have an account?</Text>
                <TouchableOpacity onPress={() => router.push('/register')}>
                    <Text className="font-black text-sm" style={{ color: theme.secondary }}>Sign Up</Text>
                </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  orb: {
    position: 'absolute',
    borderRadius: 1000,
  },
  logoBubble: {
    shadowColor: '#0058bb',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  ctaButton: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    borderTopWidth: 1.5,
    borderLeftWidth: 1.2,
  }
});
