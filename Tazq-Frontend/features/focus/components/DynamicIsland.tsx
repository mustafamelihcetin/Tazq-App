import React from 'react';
import { F, S, ICON, R, B } from '@/shared/constants/tokens';
import { View, Text, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { Zap } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useFocusStore } from '../store/useFocusStore';
import { LinearGradient } from 'expo-linear-gradient';

import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { Touchable } from '@/shared/components/Touchable';

export const DynamicIsland = () => {
  const { theme, colorScheme } = useAppTheme();
  const { t } = useLanguageStore();
  const router = useRouter();
  const isActive = useFocusStore(s => s.isActive);
  const seconds = useFocusStore(s => s.seconds);
  const currentTask = useFocusStore(s => s.currentTask);

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  /*
    TİTREŞİM YOK — bilerek.

    `haptic` içe aktarılmış ama çağrılmıyordu; bu bir eksiklik sanılıp titreşim
    eklendi ve GERİ ALINDI: uygulamada "saf gezinme titreşmez" diye yazılı bir kural
    var (bkz. __tests__/haptics.test.ts → "yoğunluk"). Gezinme zaten görsel olarak
    bellidir; nötr bir titreşim burada gezinmenin KENDİSİNİ olay sanmak olur.
    Kullanılmayan içe aktarım, o kaldırma kararının geride kalmış izidir — o da gitti.
  */
  const handlePress = () => {
    router.push('/focus');
  };

  const isDark = colorScheme === 'dark';

  return (
    <MotiView
      from={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      style={styles.container}
    >
      <Touchable
        onPress={handlePress}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel={isActive
          ? `${t.activeFocus}: ${currentTask || t.focusSession} · ${formatTime(seconds)}`
          : `${t.focusReady} · ${t.start}`}
        style={[
            styles.wrapper,
            {
                backgroundColor: isDark ? theme.surfaceContainerHighest : theme.surfaceContainerLowest,
                borderColor: isActive ? theme.primary + '40' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'),
                borderWidth: isActive ? 1.5 : 1.2,
            }
        ]}
      >
        <View style={styles.content}>
            <View style={[styles.iconCircle, { backgroundColor: isActive ? theme.primaryContainer : theme.surfaceContainerHigh }]}>
                {isActive ? (
                  <MotiView
                    animate={{ scale: [1, 1.15, 1] }}
                    transition={{ loop: true, duration: 1800 }}
                  >
                    <Zap size={ICON.md} color={theme.onPrimaryContainer} fill={theme.onPrimaryContainer} />
                  </MotiView>
                ) : (
                  <Zap size={ICON.md} color={theme.onSurfaceVariant} />
                )}
            </View>

            <View style={styles.textContainer}>
                <Text style={[styles.label, { color: isActive ? theme.primary : (isDark ? theme.secondary : theme.onSurfaceVariant) }]}>
                    {isActive ? t.activeFocus : t.dailyGoal}
                </Text>
                {/*
                  Metin ELLE kesilmiyordu artık: `substring(0, 24) + '...'` hem
                  `numberOfLines={1}` ile ikinci kez kırpma yapıyordu hem de karakter
                  sayarak kestiği için emojiyi ORTASINDAN bölebiliyordu (emoji tek
                  karakter değil). Kırpma işini metnin kendisi yapar.
                */}
                <Text adjustsFontSizeToFit minimumFontScale={0.85} style={[styles.title, { color: theme.onSurface }]} numberOfLines={1}>
                    {isActive ? (currentTask || t.focusSession) : t.focusReady}
                </Text>
            </View>

            {/*
              GÖRSEL — dokunulabilir DEĞİL.

              Burada iç içe iki `Touchable` vardı ve ikisi de AYNI şeyi yapıyordu
              (/focus). İç içe dokunma hedefi Android'de güvenilir çalışmıyor ve ekran
              okuyucuya aynı eylemi iki kez sunuyor. Kartın tamamı zaten bir düğme;
              bu yalnız onun göstergesi.

              RENKLER PALETTEN: yeşiller `#34c759`/`#30d158` diye elle yazılıydı, yani
              tema değişince yerinde çakılı kalıyorlardı. Yazı rengi de `'#fff'` idi ve
              bu koyu temada paletin AÇIKÇA reddettiği durum: `theme.primary` (#0A84FF)
              üstünde beyaz 3.65:1 veriyor, AA'dan kalıyor. `onPrimary`/`onTertiary`
              tam bu iş için ölçülmüş çiftler (bkz. Colors → onPrimary notu).
            */}
            <View style={styles.actionButton} pointerEvents="none">
                <LinearGradient
                    colors={isActive
                      ? [theme.success, theme.tertiary]
                      : (isDark ? [theme.primary, theme.primaryDim] : [theme.primary, theme.primaryContainer])}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.btnGradient}
                >
                    <Text style={[styles.actionText, { color: isActive ? theme.onTertiary : theme.onPrimary }]}>
                        {isActive ? formatTime(seconds) : t.start}
                    </Text>
                </LinearGradient>
            </View>
        </View>
      </Touchable>
    </MotiView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: S.lg,
    marginBottom: S.md,
  },
  wrapper: {
    borderRadius: R.xl,
    padding: S.smd,
    borderWidth: B.thin,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.1,
    shadowRadius: 30,
    elevation: 0,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.smd,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: R.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
  },
  label: {
    fontSize: F.caption,
    letterSpacing: 1,
    marginBottom: S.xxs,
    fontFamily: 'Jakarta-ExtraBold',
  },
  title: {
    fontSize: 15,
    fontFamily: 'Jakarta-Bold',
  },
  actionButton: {
    borderRadius: R.full,
    // Gölge rengi kullanım yerinde veriliyordu ve elle yazılmış bir hex taşıyordu;
    // gölge zaten siyah, ayrıca renklendirmeye gerek yok.
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 0,
    overflow: 'hidden',
  },
  btnGradient: {
    paddingHorizontal: S.lmd,
    paddingVertical: S.smd,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontSize: F.footnote,
    fontFamily: 'Jakarta-ExtraBold',
    letterSpacing: -0.2,
  }
});
