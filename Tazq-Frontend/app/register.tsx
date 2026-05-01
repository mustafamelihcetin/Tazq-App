import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, useWindowDimensions, KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView, MotiText } from 'moti';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/Colors';
import { UserPlus, ArrowLeft, Mail, Lock, User, AlertCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { AuthService } from '../services/api';

export default function RegisterScreen() {
  const { width } = useWindowDimensions();
  const colorScheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async () => {
    if (!name || !email || !password) { setError('Please fill in all fields'); return; }
    setIsLoading(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await AuthService.register({ name, email, password });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Account created successfully!", [{ text: "OK", onPress: () => router.replace('/login') }]);
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err.response?.status === 400 ? 'Email already in use' : 'Connection error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingVertical: 20 }} showsVerticalScrollIndicator={false}>
            <TouchableOpacity 
                onPress={() => router.replace('/login')}
                style={[styles.backBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}
            >
                <ArrowLeft size={22} color={theme.onSurface} />
            </TouchableOpacity>

            <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} style={styles.header}>
                <Text style={[styles.title, { color: theme.onSurface }]}>Join <Text style={{ color: theme.primary }}>Tazq</Text></Text>
                <Text style={[styles.subtitle, { color: theme.onSurfaceVariant }]}>Start your journey to deep focus.</Text>
            </MotiView>

            <MotiView from={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={[styles.card, { backgroundColor: isDark ? theme.surfaceContainerLow : theme.surfaceContainerLowest, borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
                {error && (
                    <View style={[styles.errorBox, { backgroundColor: theme.error + '10' }]}>
                        <AlertCircle size={16} color={theme.error} />
                        <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
                    </View>
                )}

                <View style={styles.form}>
                    <View style={[styles.inputContainer, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow }]}>
                        <User size={18} color={theme.primary} />
                        <TextInput 
                            placeholder="Full Name" 
                            placeholderTextColor={theme.onSurfaceVariant + '60'}
                            style={[styles.input, { color: theme.onSurface }]}
                            value={name}
                            onChangeText={setName}
                        />
                    </View>

                    <View style={[styles.inputContainer, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow }]}>
                        <Mail size={18} color={theme.primary} />
                        <TextInput 
                            placeholder="Email Address" 
                            placeholderTextColor={theme.onSurfaceVariant + '60'}
                            style={[styles.input, { color: theme.onSurface }]}
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                        />
                    </View>

                    <View style={[styles.inputContainer, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow }]}>
                        <Lock size={18} color={theme.primary} />
                        <TextInput 
                            placeholder="Password" 
                            placeholderTextColor={theme.onSurfaceVariant + '60'}
                            style={[styles.input, { color: theme.onSurface }]}
                            secureTextEntry
                            value={password}
                            onChangeText={setPassword}
                        />
                    </View>

                    <TouchableOpacity onPress={handleRegister} disabled={isLoading} style={[styles.cta, { shadowColor: isDark ? theme.primary : '#000' }]}>
                        <LinearGradient colors={isDark ? [theme.primary, '#3367ff'] : [theme.primary, theme.primaryContainer]} style={styles.gradient}>
                            {isLoading ? <ActivityIndicator color="white" /> : (
                                <View style={styles.btnContent}>
                                    <UserPlus size={20} color="white" />
                                    <Text style={styles.ctaText}>Create Account</Text>
                                </View>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </MotiView>

            <View style={styles.footer}>
                <Text style={{ color: theme.onSurfaceVariant, fontWeight: '600' }}>Already a member?</Text>
                <TouchableOpacity onPress={() => router.replace('/login')}>
                    <Text style={{ color: theme.primary, fontWeight: '800' }}> Login</Text>
                </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  header: { marginBottom: 32 },
  title: { fontSize: 36, fontWeight: '900', letterSpacing: -1.5 },
  subtitle: { fontSize: 16, fontWeight: '500', opacity: 0.6, marginTop: 4 },
  card: { borderRadius: 32, padding: 24, borderWidth: 1.2, shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.1, shadowRadius: 30, elevation: 5 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 16, marginBottom: 20 },
  errorText: { fontSize: 12, fontWeight: '700' },
  form: { gap: 14 },
  inputContainer: { height: 60, borderRadius: 20, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  input: { flex: 1, marginLeft: 12, fontSize: 15, fontWeight: '600' },
  cta: { height: 60, borderRadius: 20, overflow: 'hidden', marginTop: 10, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20 },
  gradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  btnContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ctaText: { color: 'white', fontSize: 16, fontWeight: '900' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 32, marginBottom: 40 }
});
