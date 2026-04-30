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
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
        setError('Connection error. Is backend running?');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <MotiView
        from={{ opacity: 0, scale: 0.5, translateY: -100 }}
        animate={{ opacity: 0.3, scale: 1.2, translateY: -50 }}
        transition={{ type: 'timing', duration: 3500, loop: true, repeatReverse: true }}
        style={[styles.orb, { backgroundColor: theme.secondary, top: -50, right: -50, width: width * 0.8, height: width * 0.8 }]}
      />
      
      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <ScrollView 
            contentContainerStyle={{ flexGrow: 1, paddingHorizontal }}
            showsVerticalScrollIndicator={false}
          >
            <TouchableOpacity 
                onPress={() => router.canGoBack() ? router.back() : router.replace('/login')}
                className="w-12 h-12 rounded-full bg-white/5 items-center justify-center mt-4 mb-6 border border-white/10"
            >
                <ArrowLeft size={22} color={theme.onSurface} />
            </TouchableOpacity>

            <MotiView 
                from={{ opacity: 0, translateY: 20 }}
                animate={{ opacity: 1, translateY: 0 }}
                className="mb-10"
            >
                <MotiText 
                    className="text-5xl font-black tracking-tighter"
                    style={{ color: theme.onSurface }}
                >
                    Create Account
                </MotiText>
            </MotiView>

            <MotiView 
                from={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 150 }}
                className="overflow-hidden rounded-[40px] border border-white/20 shadow-2xl shadow-black/5 mb-8"
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
                            <User size={18} color={theme.secondary} />
                            <TextInput 
                                placeholder="Full Name" 
                                placeholderTextColor={theme.onSurfaceVariant + '80'}
                                className="flex-1 ml-4 text-base font-semibold"
                                style={{ color: theme.onSurface }}
                                value={name}
                                onChangeText={(val) => { setName(val); setError(null); }}
                                returnKeyType="next"
                            />
                        </View>

                        <View className="bg-surface-container-high/40 rounded-[24px] px-5 py-4 flex-row items-center border border-white/10">
                            <Mail size={18} color={theme.secondary} />
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
                            <Lock size={18} color={theme.secondary} />
                            <TextInput 
                                placeholder="Password" 
                                placeholderTextColor={theme.onSurfaceVariant + '80'}
                                className="flex-1 ml-4 text-base font-semibold"
                                style={{ color: theme.onSurface }}
                                secureTextEntry
                                value={password}
                                onChangeText={(val) => { setPassword(val); setError(null); }}
                                returnKeyType="done"
                                onSubmitEditing={handleRegister}
                            />
                        </View>

                        <TouchableOpacity 
                            onPress={handleRegister}
                            disabled={isLoading}
                            activeOpacity={0.8}
                            style={styles.ctaButton}
                            className={`bg-secondary rounded-[24px] overflow-hidden shadow-xl shadow-secondary/30 mt-4 ${isLoading ? 'opacity-70' : ''}`}
                        >
                            <LinearGradient
                                colors={[theme.secondary, theme.secondary_fixed_dim || theme.secondary]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                className="py-5 items-center flex-row justify-center gap-3"
                            >
                                {isLoading ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <>
                                        <UserPlus size={18} color="white" strokeWidth={2.5} />
                                        <Text className="text-white text-lg font-black tracking-tight">Create Account</Text>
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </BlurView>
            </MotiView>

            <View className="mb-10 flex-row justify-center items-center gap-2">
                <Text className="text-sm font-medium" style={{ color: theme.onSurfaceVariant }}>Already have an account?</Text>
                <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/login')}>
                    <Text className="font-black text-sm" style={{ color: theme.primary }}>Login</Text>
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
  ctaButton: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    borderTopWidth: 1.5,
    borderLeftWidth: 1.2,
  }
});
