import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TextInput, ScrollView, StyleSheet, Platform, KeyboardAvoidingView, Image, ActivityIndicator, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { BlurView } from 'expo-blur';
import { Touchable } from '@/shared/components/Touchable';
import { S, R, F, B, MAX_W } from '@/shared/constants/tokens';
import { AVATAR_CONFIGS } from '@/features/user';
import * as Haptics from 'expo-haptics';
import { Sunrise, Sun, Sunset, Moon, Zap } from 'lucide-react-native';

interface ProfileSetupModalProps {
  visible: boolean;
  theme: any;
  isDark: boolean;
  language: 'tr' | 'en';
  t: any;
  currentName: string;
  isNamePlaceholder: boolean;
  onSave: (name: string, avatar: string, borderColor: string, motto: string, productivityHour: string, gender: 'male' | 'female' | '') => Promise<void>;
}

export const ProfileSetupModal: React.FC<ProfileSetupModalProps> = ({
  visible,
  theme,
  isDark,
  language,
  t,
  currentName,
  isNamePlaceholder,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('m1');
  const [selectedBorderColor, setSelectedBorderColor] = useState('transparent');
  const [motto, setMotto] = useState('');
  const [productivityHour, setProductivityHour] = useState<'morning' | 'afternoon' | 'evening' | 'night'>('morning');
  const [gender, setGender] = useState<'male' | 'female' | ''>('male');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setName(isNamePlaceholder ? '' : currentName);
      setGender('male');
      setSelectedAvatar('m1');
      setSelectedBorderColor('transparent');
      setMotto('');
      setProductivityHour('morning');
      setError(null);
    }
  }, [visible, currentName, isNamePlaceholder]);

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (isNamePlaceholder && trimmedName.length < 2) {
      setError(language === 'tr' ? 'Lütfen en az 2 karakterden oluşan bir isim girin.' : 'Please enter a name with at least 2 characters.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await onSave(
        isNamePlaceholder ? trimmedName : currentName,
        selectedAvatar,
        selectedBorderColor,
        motto.trim(),
        productivityHour,
        gender
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err) {
      setError(language === 'tr' ? 'Bir hata oluştu, lütfen tekrar deneyin.' : 'An error occurred, please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      setLoading(false);
    }
  };

  const borderColors = [
    { key: 'transparent', color: 'transparent', labelTr: 'Yok', labelEn: 'None' },
    { key: 'red', color: '#FF4D4D', labelTr: 'Kırmızı', labelEn: 'Red' },
    { key: 'fuchsia', color: '#F43F5E', labelTr: 'Fuşya', labelEn: 'Fuchsia' },
    { key: 'rose', color: '#F472B6', labelTr: 'Gül', labelEn: 'Rose' },
    { key: 'orange', color: '#FB923C', labelTr: 'Turuncu', labelEn: 'Orange' },
    { key: 'bronze', color: '#FDBA74', labelTr: 'Bronz', labelEn: 'Bronze' },
    { key: 'gold', color: '#F59E0B', labelTr: 'Altın', labelEn: 'Gold' },
    { key: 'yellow', color: '#FFFF00', labelTr: 'Sarı', labelEn: 'Yellow' },
    { key: 'lime', color: '#A3E635', labelTr: 'Fıstık', labelEn: 'Lime' },
    { key: 'green', color: '#4ADE80', labelTr: 'Yeşil', labelEn: 'Green' },
    { key: 'mint', color: '#34D399', labelTr: 'Nane', labelEn: 'Mint' },
    { key: 'teal', color: '#2DD4BF', labelTr: 'Turkuaz', labelEn: 'Teal' },
    { key: 'sky', color: '#38BDF8', labelTr: 'Gök', labelEn: 'Sky Blue' },
    { key: 'blue', color: '#60A5FA', labelTr: 'Mavi', labelEn: 'Blue' },
    { key: 'indigo', color: '#818CF8', labelTr: 'İndigo', labelEn: 'Indigo' },
    { key: 'purple', color: '#A855F7', labelTr: 'Mor', labelEn: 'Purple' },
    { key: 'lavender', color: '#C084FC', labelTr: 'Lavanta', labelEn: 'Lavender' },
    { key: 'silver', color: '#E2E8F0', labelTr: 'Gümüş', labelEn: 'Silver' },
    { key: 'slate', color: '#64748B', labelTr: 'Kül', labelEn: 'Slate' },
  ] as const;

  const prodHourOptions = [
    { key: 'morning',   labelTr: 'Sabah',   labelEn: 'Morning',   hint: '07:00', icon: (color: string) => <Sunrise size={16} color={color} /> },
    { key: 'afternoon', labelTr: 'Öğlen',   labelEn: 'Afternoon', hint: '12:00', icon: (color: string) => <Sun size={16} color={color} /> },
    { key: 'evening',   labelTr: 'Akşam',   labelEn: 'Evening',   hint: '17:00', icon: (color: string) => <Sunset size={16} color={color} /> },
    { key: 'night',     labelTr: 'Gece',    labelEn: 'Night',     hint: '21:00', icon: (color: string) => <Moon size={16} color={color} /> },
  ] as const;

  // Filter avatars based on gender:
  const filteredAvatars = AVATAR_CONFIGS.filter((config) => {
    if (gender === 'male') return config.key.startsWith('m');
    if (gender === 'female') return config.key.startsWith('f');
    return true;
  });

  return (
    <Modal visible={visible} transparent animationType="fade">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.7)' }}>
        <BlurView intensity={20} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        
        <View style={[styles.card, { backgroundColor: isDark ? '#1C1C22' : '#FFFFFF', borderColor: theme.outlineVariant + '40', borderWidth: B.thin }]}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
          <View style={{ alignItems: 'center', marginBottom: S.xs }}>
            {!isNamePlaceholder && (
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.primaryContainer, alignItems: 'center', justifyContent: 'center', marginBottom: S.xs, marginTop: S.xs }}>
                <Zap size={20} color={theme.primary} fill={theme.primary} />
              </View>
            )}
            <Text style={[styles.title, { color: theme.onSurface }]}>
              {isNamePlaceholder 
                ? (language === 'tr' ? 'TAZQ Profilini Oluştur' : 'Create TAZQ Profile')
                : (language === 'tr' ? `Hoş Geldin, ${currentName.trim().split(' ')[0]}` : `Welcome, ${currentName.trim().split(' ')[0]}`)}
            </Text>
            <Text style={[styles.subtitle, { color: theme.onSurfaceVariant }]}>
              {isNamePlaceholder
                ? (language === 'tr' ? 'Sana hitap edebilmemiz için bilgilerini tamamla.' : 'Please complete your details so we can address you.')
                : (language === 'tr' ? 'Profilini özelleştirip TAZQ deneyimine hemen başla.' : 'Customize your profile and start your TAZQ experience.')}
            </Text>
          </View>

          <View style={{ gap: S.md }}>
            {isNamePlaceholder && (
              <View style={styles.section}>
                <Text style={[styles.label, { color: theme.onSurfaceVariant }]}>
                  {language === 'tr' ? 'İsminiz' : 'Your Name'}
                </Text>
                <View style={[styles.inputContainer, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow }]}>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder={language === 'tr' ? 'Lütfen adınızı girin' : 'Please enter your name'}
                    placeholderTextColor={theme.onSurfaceVariant + '80'}
                    style={[styles.input, { color: theme.onSurface, flex: 1, height: '100%', textAlignVertical: 'center' }]}
                    maxLength={30}
                    underlineColorAndroid="transparent"
                  />
                </View>
              </View>
            )}

            {/* Gender Selection */}
            <View style={styles.section}>
              <Text style={[styles.label, { color: theme.onSurfaceVariant }]}>
                {language === 'tr' ? 'Cinsiyetiniz' : 'Your Gender'}
              </Text>
              <View style={{ flexDirection: 'row', gap: S.xs }}>
                {([
                  { key: 'male', labelTr: 'Erkek', labelEn: 'Male' },
                  { key: 'female', labelTr: 'Kadın', labelEn: 'Female' },
                ] as const).map((g) => {
                  const isSelected = gender === g.key;
                  return (
                    <Touchable
                      key={g.key}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setGender(g.key);
                        if (g.key === 'male') {
                          setSelectedAvatar('m1');
                        } else {
                          setSelectedAvatar('f1');
                        }
                      }}
                      style={[styles.goalChip, {
                        borderColor: isSelected ? theme.primary : theme.outline + '20',
                        backgroundColor: isSelected ? theme.primaryContainer : 'transparent',
                      }]}
                    >
                      <Text style={{
                        fontSize: 12,
                        fontFamily: 'Jakarta-Bold',
                        color: isSelected ? theme.onPrimaryContainer : theme.onSurfaceVariant,
                      }}>
                        {language === 'tr' ? g.labelTr : g.labelEn}
                      </Text>
                    </Touchable>
                  );
                })}
              </View>
            </View>

            {/* Profile Picture */}
            <View style={styles.section}>
              <Text style={[styles.label, { color: theme.onSurfaceVariant }]}>
                {language === 'tr' ? 'Profil Resmi' : 'Profile Picture'}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: S.xs, paddingVertical: S.xs }}>
                {filteredAvatars.map((config) => {
                  const isSelected = selectedAvatar === config.key;
                  return (
                    <Touchable
                      key={config.id}
                      onPress={() => { Haptics.selectionAsync(); setSelectedAvatar(config.key); }}
                      style={[styles.avatarWrapper, {
                        borderColor: isSelected ? theme.primary : theme.outline + '20',
                        borderWidth: isSelected ? 2.5 : 1,
                      }]}
                    >
                      <Image source={config.image} style={{ width: 50, height: 50 }} resizeMode="cover" />
                    </Touchable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Border Color */}
            <View style={styles.section}>
              <Text style={[styles.label, { color: theme.onSurfaceVariant }]}>
                {language === 'tr' ? 'Çerçeve Rengi' : 'Border Color'}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: S.sm, paddingVertical: S.xs }}>
                {borderColors.map((colorOpt) => {
                  const isSelected = selectedBorderColor === colorOpt.color;
                  return (
                    <Touchable
                      key={colorOpt.key}
                      onPress={() => { Haptics.selectionAsync(); setSelectedBorderColor(colorOpt.color); }}
                      style={[styles.colorBubble, {
                        backgroundColor: colorOpt.color === 'transparent' ? (isDark ? '#2C2C35' : '#E5E7EB') : colorOpt.color,
                        borderColor: isSelected ? theme.primary : 'transparent',
                        borderWidth: isSelected ? 2.5 : 0,
                      }]}
                    >
                      {colorOpt.color === 'transparent' && (
                        <Text style={{ fontSize: 9, fontWeight: '700', color: theme.onSurfaceVariant }}>
                          {language === 'tr' ? 'Yok' : 'None'}
                        </Text>
                      )}
                    </Touchable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Productivity Hour */}
            <View style={styles.section}>
              <Text style={[styles.label, { color: theme.onSurfaceVariant }]}>
                {language === 'tr' ? 'En Verimli Olduğun Zaman' : 'Peak Productivity Time'}
              </Text>
              <View style={{ flexDirection: 'row', gap: S.xs }}>
                {prodHourOptions.map((opt) => {
                  const isSelected = productivityHour === opt.key;
                  const itemColor = isSelected ? theme.primary : theme.onSurfaceVariant;
                  return (
                    <Touchable
                      key={opt.key}
                      onPress={() => { Haptics.selectionAsync(); setProductivityHour(opt.key); }}
                      style={[styles.goalChip, {
                        borderColor: isSelected ? theme.primary : theme.outline + '20',
                        backgroundColor: isSelected ? theme.primaryContainer : 'transparent',
                      }]}
                    >
                      {opt.icon(itemColor)}
                      <Text style={{
                        fontSize: 10,
                        fontFamily: 'Jakarta-Bold',
                        color: isSelected ? theme.onPrimaryContainer : theme.onSurfaceVariant,
                        marginTop: 4,
                      }}>
                        {language === 'tr' ? opt.labelTr : opt.labelEn}
                      </Text>
                    </Touchable>
                  );
                })}
              </View>
            </View>

            {/* Personal Motto */}
            <View style={styles.section}>
              <Text style={[styles.label, { color: theme.onSurfaceVariant }]}>
                {language === 'tr' ? 'Kişisel Motto' : 'Personal Motto'}
              </Text>
              <View style={[styles.inputContainer, { backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLow }]}>
                <TextInput
                  value={motto}
                  onChangeText={setMotto}
                  placeholder={language === 'tr' ? 'Örn: Gürültüyü sustur, odağını keşfet...' : 'e.g. Silence the noise, discover your focus...'}
                  placeholderTextColor={theme.onSurfaceVariant + '80'}
                  style={[styles.input, { color: theme.onSurface }]}
                  maxLength={100}
                  underlineColorAndroid="transparent"
                />
              </View>
            </View>
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <Touchable
            onPress={handleSave}
            disabled={loading}
            style={[styles.btn, { backgroundColor: theme.primary, marginTop: S.md }]}
          >
            {loading ? (
              <ActivityIndicator color={theme.onPrimary} size="small" />
            ) : (
              <Text style={[styles.btnText, { color: theme.onPrimary }]}>
                {language === 'tr' ? 'Başla' : 'Let\'s Go'}
              </Text>
            )}
          </Touchable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '90%',
    maxWidth: MAX_W - 40,
    borderRadius: R.lg,
    padding: S.lg,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Jakarta-Bold',
    textAlign: 'center',
    marginBottom: S.xs,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Jakarta-SemiBold',
    textAlign: 'center',
    marginBottom: S.md,
    opacity: 0.7,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: S.sm,
  },
  section: {
    width: '100%',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: S.xs,
    opacity: 0.8,
  },
  inputContainer: {
    borderRadius: R.md,
    paddingHorizontal: S.md,
    paddingVertical: Platform.OS === 'ios' ? 12 : 6,
  },
  input: {
    fontSize: 14,
    fontFamily: 'Jakarta-Bold',
  },
  avatarWrapper: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: R.sm,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btn: {
    width: '100%',
    padding: 14,
    borderRadius: R.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
