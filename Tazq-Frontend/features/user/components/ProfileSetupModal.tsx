/*
 * HOŞ GELDİN — profil kurulumu (features/user; `shared` alt katmanı features bilmemeli).
 *
 * 2026-10-25 YENİDEN TASARIM (kullanıcı: "hoş geldin modalını baştan geliştir"). Referanslar:
 * Apple HIG onboarding (tek odak, anında geri bildirim, sonra değiştirilebilir olduğunu söyle),
 * Slack/Things profil kurulumu (canlı önizleme), uygulamanın kendi Yeni Alışkanlık formu
 * (ölçülen ızgara, eşmerkezli seçim halkası, büyük harfli bölüm etiketleri).
 *
 * Eski ekranın sorunları ve karşılıkları:
 *  · Seçimin sonucu görünmüyordu (avatar 50 px'lik şeritte, halka hiçbir yerde) → üstte BÜYÜK
 *    canlı önizleme: seçilen avatar + seçilen halka, profilde nasıl görünecekse öyle.
 *  · "Cinsiyetiniz" sorusu yalnız avatarları süzmek için vardı → soru KALKTI; 12 avatar 6×2
 *    ızgarada birlikte. Hassas bir soru az, bir adım kısa. (Spor modu kilo hesabı için
 *    cinsiyeti kendisi soruyor; buradan '' gider, orada sorulur.)
 *  · Avatar ve renk şeritleri yatay kayıyor, son öğeler kenarda yarım kesiliyordu → ızgaralar
 *    kabın ÖLÇÜLEN genişliğine oturur (gridFit), hiçbir öğe kesilmez.
 *  · 19 Tailwind rengi (saf sarı dahil) → 9 renklik özel palet (bkz. avatarRings.ts).
 *  · Verimlilik saati kalın kenarlı kutulardı → görev formundaki kayan seçici (SegmentedControl).
 *  · Uzun ve kaydırmalıydı ("daha kompakt olmalı") → önizleme başlıkla AYNI satırda, ad alanı
 *    etiketsiz, motto bu ekrandan çıktı (isteğe bağlıydı; Profil'den eklenir). İlk ekranda
 *    yalnız görünüm + verimli saat sorulur.
 */
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Animated, Modal, TextInput, ScrollView, StyleSheet, Platform, KeyboardAvoidingView, Image, ActivityIndicator, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { Check } from 'lucide-react-native';
import { AppBlur } from '@/shared/components/AppBlur';
import { Touchable } from '@/shared/components/Touchable';
import { GlassSurface } from '@/shared/components/GlassSurface';
import { ICON, S, R, F, B, MAX_W } from '@/shared/constants/tokens';
import { AVATAR_CONFIGS } from '@/features/user';
import { AVATAR_RINGS, RING_NONE, hasRing } from '@/features/user/utils/avatarRings';
import { SegmentedControl } from '@/shared/components/SegmentedControl';
import type { AppTheme } from '@/shared/constants/Colors';
import { haptic } from '@/shared/utils/haptics';
import { productivityHint } from '@/shared/utils/productivityHour';

type Hour = 'morning' | 'afternoon' | 'evening' | 'night';

interface ProfileSetupModalProps {
  visible: boolean;
  theme: AppTheme;
  isDark: boolean;
  language: 'tr' | 'en';
  t?: unknown;
  currentName: string;
  isNamePlaceholder: boolean;
  onSave: (name: string, avatar: string, borderColor: string, motto: string, productivityHour: string, gender: 'male' | 'female' | '') => Promise<void>;
}

const COPY = {
  tr: {
    welcome: (n: string) => `Hoş geldin, ${n}`,
    create: 'Profilini oluştur',
    sub: 'Görünümünü seç; sonra Profil\'den değiştirebilirsin.',
    subName: 'Adını yaz, görünümünü seç.',
    namePh: 'Adın',
    avatar: 'AVATAR',
    ring: 'HALKA',
    hour: 'EN VERİMLİ OLDUĞUN ZAMAN',
    start: 'Başla',
    hours: { morning: 'Sabah', afternoon: 'Öğlen', evening: 'Akşam', night: 'Gece' } as Record<Hour, string>,
    hourA11y: 'En verimli olduğun zaman',
    nameErr: 'Adın en az 2 harf olmalı.',
    saveErr: 'Kaydedilemedi. Bağlantını kontrol edip tekrar dene.',
    avatarA11y: (n: string) => `Avatar ${n}`,
  },
  en: {
    welcome: (n: string) => `Welcome, ${n}`,
    create: 'Create your profile',
    sub: 'Pick your look; you can change it later in Profile.',
    subName: 'Add your name and pick your look.',
    namePh: 'Your name',
    avatar: 'AVATAR',
    ring: 'RING',
    hour: 'WHEN YOU WORK BEST',
    start: 'Get started',
    hours: { morning: 'Morning', afternoon: 'Midday', evening: 'Evening', night: 'Night' } as Record<Hour, string>,
    hourA11y: 'When you work best',
    nameErr: 'Your name needs at least 2 letters.',
    saveErr: "Couldn't save. Check your connection and try again.",
    avatarA11y: (n: string) => `Avatar ${n}`,
  },
};

/** Önizleme avatarı ve halka kalınlığı — iç görsel `PREVIEW - 2*RING_W`: halka ile resim arasında boşluk kalmaz. */
const PREVIEW = 64;
const RING_W = 3;
const AVATAR_MIN = 38;
const AVATAR_GAP = S.xs;
const DOT = 26;
const SEL = 3;
const HOURS: Hour[] = ['morning', 'afternoon', 'evening', 'night'];

export const ProfileSetupModal: React.FC<ProfileSetupModalProps> = ({
  visible, theme, isDark, language, currentName, isNamePlaceholder, onSave,
}) => {
  const c = COPY[language === 'tr' ? 'tr' : 'en'];
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('m1');
  const [ring, setRing] = useState<string>(AVATAR_RINGS[1].color);
  const [hour, setHour] = useState<Hour>('morning');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [w, setW] = useState(0);

  useEffect(() => {
    if (!visible) return;
    setName(isNamePlaceholder ? '' : currentName);
    setAvatar('m1');
    // Varsayılan halka marka mavisi: "Yok" ile açılan önizleme sönük duruyordu.
    setRing(AVATAR_RINGS[1].color);
    setHour('morning');
    setError(null);
  }, [visible, currentName, isNamePlaceholder]);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (isNamePlaceholder && trimmed.length < 2) {
      setError(c.nameErr);
      haptic.error();
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await onSave(isNamePlaceholder ? trimmed : currentName, avatar, ring, '', hour, '');
      haptic.success();
    } catch {
      setError(c.saveErr);
      haptic.error();
    } finally {
      setLoading(false);
    }
  };

  const firstName = (isNamePlaceholder ? name : currentName).trim().split(' ')[0];
  const image = AVATAR_CONFIGS.find((a) => a.key === avatar)?.image;
  const ringed = hasRing(ring);
  const inner = PREVIEW - 2 * (ringed ? RING_W : B.thin);

  /*
    12 avatar: sütun sayısı 12'yi TAM bölmeli (6 → iki satır, sığmazsa 4 → üç satır).
    gridFit 5 sütun buluyordu: 5 + 5 + 2, son satır yarım (cihazda görüldü).
  */
  const avatarCols = w > 0 ? ((w - AVATAR_GAP * 5) / 6 >= AVATAR_MIN ? 6 : 4) : 0;
  const avatarCell = avatarCols > 0 ? Math.floor((w - AVATAR_GAP * (avatarCols - 1)) / avatarCols) : 0;

  // Önizleme seçime yaylı küçük bir "pop"la cevap verir — seçimin sonucu hissedilsin.
  const pop = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!visible) return;
    pop.setValue(0.92);
    Animated.spring(pop, { toValue: 1, damping: 9, stiffness: 220, mass: 0.8, useNativeDriver: true }).start();
  }, [avatar, ring]);
  const ringCols = 6;

  const rows = <T,>(items: T[], cols: number) =>
    Array.from({ length: Math.ceil(items.length / cols) }, (_, r) => items.slice(r * cols, r * cols + cols));

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={styles.backdrop}>
        <AppBlur material="thin" />
        {/* Perdeye dokunmak yalnız klavyeyi kapatır; bu ekranın tek çıkışı "Başla". */}
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>

        <View style={[styles.card, { borderColor: theme.outlineVariant }]}>
          <GlassSurface radius={R.sheet} />
          <ScrollView
            style={{ flexGrow: 0 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.body}
          >
            {/* CANLI ÖNİZLEME — profilde nasıl görünecekse öyle. */}
            <View style={styles.hero}>
              <Animated.View
                style={[
                  { transform: [{ scale: pop }] },
                  styles.preview,
                  {
                    borderWidth: ringed ? RING_W : B.thin,
                    borderColor: ringed ? ring : theme.outlineVariant,
                    backgroundColor: theme.surfaceField,
                  },
                ]}
              >
                {image ? <Image source={image} style={{ width: inner, height: inner, borderRadius: inner / 2 }} resizeMode="cover" /> : null}
              </Animated.View>
              <View style={{ flex: 1 }}>
                <Text accessibilityRole="header" numberOfLines={2} style={[styles.title, { color: theme.onSurface }]}>
                  {firstName ? c.welcome(firstName) : c.create}
                </Text>
                <Text style={[styles.subtitle, { color: theme.onSurfaceMuted }]}>
                  {isNamePlaceholder ? c.subName : c.sub}
                </Text>
              </View>
            </View>

            {isNamePlaceholder && (
              <View>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  autoCorrect={false}
                  textContentType="name"
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                  accessibilityLabel={c.namePh}
                  placeholder={c.namePh}
                  placeholderTextColor={theme.onSurfaceMuted}
                  style={[styles.input, { color: theme.onSurface, backgroundColor: theme.surfaceField }]}
                  maxLength={30}
                  underlineColorAndroid="transparent"
                />
              </View>
            )}

            <View onLayout={(e) => setW(Math.floor(e.nativeEvent.layout.width))}>
              <Text style={[styles.label, { color: theme.onSurfaceMuted }]}>{c.avatar}</Text>
              {avatarCell > 0 && (
                <View accessibilityRole="radiogroup" style={{ gap: AVATAR_GAP }}>
                  {rows(AVATAR_CONFIGS, avatarCols).map((row, r) => (
                    <View key={r} style={styles.row}>
                      {Array.from({ length: avatarCols }, (_, k) => {
                        const a = row[k];
                        if (!a) return <View key={`pad-${k}`} style={{ width: avatarCell }} />;
                        const selected = a.key === avatar;
                        const img = avatarCell - 2 * SEL - 4;
                        return (
                          <Touchable
                            key={a.key}
                            accessibilityRole="radio"
                            accessibilityState={{ selected, checked: selected }}
                            accessibilityLabel={c.avatarA11y(a.name)}
                            onPress={() => { if (!selected) { haptic.select(); setAvatar(a.key); } }}
                            style={[styles.avatarCell, { width: avatarCell, height: avatarCell, borderColor: selected ? theme.primary : 'transparent' }]}
                          >
                            <Image source={a.image} style={{ width: img, height: img, borderRadius: img / 2, backgroundColor: theme.surfaceField }} resizeMode="cover" />
                          </Touchable>
                        );
                      })}
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View>
              <Text style={[styles.label, { color: theme.onSurfaceMuted }]}>{c.ring}</Text>
              <View accessibilityRole="radiogroup" style={{ gap: S.sm }}>
                {rows(AVATAR_RINGS, ringCols).map((row, r) => (
                  <View key={r} style={[styles.row, styles.ringRow]}>
                    {row.map((opt) => {
                      const selected = opt.color === ring;
                      const none = opt.color === RING_NONE;
                      return (
                        <Touchable
                          key={opt.key}
                          accessibilityRole="radio"
                          accessibilityState={{ selected, checked: selected }}
                          accessibilityLabel={language === 'tr' ? opt.tr : opt.en}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          onPress={() => { if (!selected) { haptic.select(); setRing(opt.color); } }}
                          style={[styles.dotRing, { borderColor: selected ? (none ? theme.onSurfaceVariant : opt.color) : 'transparent' }]}
                        >
                          <View
                            style={[
                              styles.dot,
                              none
                                ? { backgroundColor: theme.surfaceField, borderWidth: B.thin, borderColor: theme.outlineVariant, borderStyle: 'dashed' }
                                : { backgroundColor: opt.color },
                            ]}
                          >
                            {selected && !none ? <Check size={ICON.xs} color="#FFFFFF" strokeWidth={3} /> : null}
                          </View>
                        </Touchable>
                      );
                    })}
                  </View>
                ))}
              </View>
            </View>

            <View>
              <Text style={[styles.label, { color: theme.onSurfaceMuted }]}>{c.hour}</Text>
              <SegmentedControl
                options={HOURS.map((k) => ({ key: k, label: c.hours[k] }))}
                value={hour}
                onChange={(k) => { haptic.select(); setHour(k); }}
                theme={theme}
                isDark={isDark}
                accessibilityLabel={c.hourA11y}
              />
              {/* Seçimin NE yaptığı — davranışın kendi tablosundan (bkz. productivityHour.ts). */}
              <Text style={[styles.hint, { color: theme.onSurfaceMuted }]}>{productivityHint(hour, language === 'tr' ? 'tr' : 'en')}</Text>
            </View>

          </ScrollView>

          {error && <Text accessibilityLiveRegion="polite" style={[styles.error, { color: theme.error }]}>{error}</Text>}

          {/* "Başla" kaydırıcının DIŞINDA: form uzasa da hep görünür. */}
          <Touchable
            onPress={handleSave}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={c.start}
            accessibilityState={{ busy: loading }}
            style={[styles.btn, { backgroundColor: theme.primary }]}
          >
            {loading ? <ActivityIndicator color={theme.onPrimary} size="small" /> : <Text style={[styles.btnText, { color: theme.onPrimary }]}>{c.start}</Text>}
          </Touchable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.55)' },
  card: {
    width: '90%',
    maxWidth: MAX_W - 40,
    maxHeight: '90%',
    borderRadius: R.sheet,
    borderWidth: B.thin,
    paddingHorizontal: S.lg,
    paddingTop: S.lg,
    paddingBottom: S.lg,
    overflow: 'hidden',
  },
  body: { gap: S.md, paddingBottom: S.xs },
  hero: { flexDirection: 'row', alignItems: 'center', gap: S.md },
  preview: { width: PREVIEW, height: PREVIEW, borderRadius: PREVIEW / 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  title: { fontSize: F.title3, fontFamily: 'Jakarta-Bold', letterSpacing: -0.3 },
  subtitle: { fontSize: F.footnote, lineHeight: 18, marginTop: S.xxs },
  label: { fontSize: F.caption, fontWeight: '600', letterSpacing: 1.2, marginBottom: S.sm, marginLeft: S.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  ringRow: { paddingHorizontal: S.xxs },
  avatarCell: { borderRadius: R.full, borderWidth: SEL, alignItems: 'center', justifyContent: 'center' },
  dotRing: { width: DOT + SEL * 4, height: DOT + SEL * 4, borderRadius: R.full, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dot: { width: DOT, height: DOT, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  input: { fontSize: F.body, paddingHorizontal: S.md, paddingVertical: Platform.OS === 'ios' ? S.smd : S.sm, borderRadius: R.md, minHeight: 48 },
  hint: { fontSize: F.caption, lineHeight: 16, marginTop: S.sm, marginHorizontal: S.xs },
  error: { fontSize: F.caption, fontWeight: '600', textAlign: 'center', marginTop: S.sm },
  btn: { marginTop: S.md, height: 50, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: F.body, fontWeight: '700' },
});
