import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableWithoutFeedback, Easing, BackHandler } from 'react-native';
import { swallow } from '@/shared/utils/swallow';
import { AppBlur } from '@/shared/components/AppBlur';
import { GlassSurface } from '@/shared/components/GlassSurface';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { Touchable } from './Touchable';
import { S, R, F } from '@/shared/constants/tokens';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { AlertCircle, Info, Trash2 } from 'lucide-react-native';

/*
  ── SİSTEM UYARI PENCERESİ YOK (kullanıcı kararı 2026-10-29) ──────────────────────
  Android'de her uyarı bilerek sistemin AlertDialog'una düşüyordu (teal, uygulamadan
  kopuk). Gerekçe: uyarı kendisi bir native Modal'dı; başka bir Modal'ın üstünde
  açılınca Android'de donma, iOS'ta hiç görünmeme oluyordu.
  Çözüm Modal'ı kaldırmak: uyarı, EN ÜSTTEKİ yuvaya (AlertHost) çizilen bir örtü.
  Kök yuva _layout'ta; bir sayfa/sheet Modal'ı uyarı açıyorsa kendi içine de bir
  AlertHost koyar — o açıkken uyarılar onun içinde, yani Modal'ın üstünde görünür.
  Arayüz Alert.alert ile aynı: çağıran kod değişmez.
*/
export interface AlertButton { text?: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void }
type Show = (title: string, message?: string, buttons?: AlertButton[]) => void;

const hosts: { id: string; show: Show }[] = [];
const pending: Parameters<Show>[] = [];

export const CustomAlert = {
  alert: (title: string, message?: string, buttons?: AlertButton[], _options?: unknown) => {
    const top = hosts[hosts.length - 1];
    if (top) top.show(title, message, buttons);
    else pending.push([title, message, buttons]); // kök yuva bağlanınca gösterilir
  },
};

export function AlertHost({ testID = 'alert-host' }: { testID?: string }) {
  const { theme, isDark } = useAppTheme();
  const { language } = useLanguageStore();

  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState<string | undefined>('');
  const [buttons, setButtons] = useState<AlertButton[]>([]);

  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.95));
  const [slideAnim] = useState(new Animated.Value(20));
  const idRef = useRef(`${testID}-${Math.random().toString(36).slice(2, 8)}`);

  useEffect(() => {
    const show: Show = (t, m, b) => {
      setTitle(t);
      setMessage(m);
      setButtons(!b || b.length === 0 ? [{ text: language === 'tr' ? 'Tamam' : 'OK' }] : b);
      setVisible(true);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true, easing: Easing.out(Easing.exp) }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 400, useNativeDriver: true, easing: Easing.out(Easing.back(1.5)) }),
        Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true, easing: Easing.out(Easing.exp) }),
      ]).start();
    };
    const entry = { id: idRef.current, show };
    hosts.push(entry);
    while (hosts[hosts.length - 1] === entry && pending.length) show(...pending.shift()!);
    return () => {
      const i = hosts.indexOf(entry);
      if (i >= 0) hosts.splice(i, 1);
    };
  }, [language]);

  const hide = (callback?: () => void) => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true, easing: Easing.in(Easing.ease) }),
      Animated.timing(slideAnim, { toValue: 10, duration: 200, useNativeDriver: true, easing: Easing.in(Easing.ease) }),
    ]).start(() => {
      setVisible(false);
      // Callback'i bir sonraki tick'e ertele + izole et: buton onPress'i istisna atsa
      // bile örtü kapanır ve uygulama kilitlenmez (dokunuş bloklanmaz).
      if (callback) {
        setTimeout(() => {
          try { callback(); } catch (e) { swallow('customAlert.onPress', e); }
        }, 0);
      }
    });
  };

  // Android geri tuşu = "Vazgeç" (varsa); sistem penceresinin davranışıyla aynı.
  useEffect(() => {
    if (!visible) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      hide(buttons.find(b => b.style === 'cancel')?.onPress);
      return true;
    });
    return () => sub.remove();
  }, [visible, buttons]);

  if (!visible) return null;

  const isDestructive = buttons.some(b => b.style === 'destructive');
  const IconComponent = isDestructive ? Trash2 : (title.toLowerCase().includes('hata') || title.toLowerCase().includes('error') ? AlertCircle : Info);
  const iconColor = isDestructive ? theme.error : theme.primary;
  /*
    MENÜ (birden çok seçenek, ör. alışkanlık menüsü: Mola ver · Dinlendir · Sil):
    çöp kutusu ikonu menüyü bir silme onayı gibi gösteriyordu ve her seçenek dolu mavi
    düğmeydi (cihazda görüldü). Menüde ikon yok, sıradan seçenekler sade; kırmızı yalnız
    yıkıcı olanda. Tek eylemli onaylar eskisi gibi.
  */
  const isMenu = buttons.filter(b => b.style !== 'cancel').length > 1;

  // Sıralama: Cancel solda, Primary/Destructive sağda olmalı.
  // Gelen array genelde [Cancel, Destructive] şeklindedir.
  // Eğer buton etiketlerinden biri uzunsa, taşmayı önlemek için dikey sıralamaya geçiyoruz.
  const hasLongButtonText = buttons.some(b => !!b.text && b.text.length > 12);
  const isVertical = buttons.length > 2 || hasLongButtonText;

  return (
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]} testID={`alert-card-${testID}`}>
        {/* Boş dokunma yakalayıcı (dışarı dokunarak kapatma KAPALI) — ağacın dışında. */}
        <TouchableWithoutFeedback accessible={false} onPress={() => { /* disable tap to close by default */ }}>
          <AppBlur material="thin">
            <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.2)' }]} />
          </AppBlur>
        </TouchableWithoutFeedback>
        
        <Animated.View style={[
          styles.alertBox,
          {
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
            transform: [
              { scale: scaleAnim },
              { translateY: slideAnim }
            ]
          }
        ]}>
          {/* Zemin ortak cam yüzeyden — yarı saydam elle yazılmış renk + ayrı blur yerine. */}
          <GlassSurface radius={R.sheet} />

          <View style={styles.content}>
            {!isMenu && (
              <View style={[styles.iconContainer, { backgroundColor: iconColor + '15' }]}>
                <IconComponent size={24} color={iconColor} strokeWidth={2.5} />
              </View>
            )}
            <Text style={[styles.title, { color: theme.onSurface }]}>{title}</Text>
            {!!message && (
              <Text style={[styles.message, { color: theme.onSurfaceVariant }]}>{message}</Text>
            )}
          </View>
          
          <View style={[styles.buttonContainer, { flexDirection: isVertical ? 'column' : 'row' }]}>
            {buttons.map((btn: AlertButton, idx: number) => {
              const isBtnDestructive = btn.style === 'destructive';
              const isCancel = btn.style === 'cancel';
              const isPrimary = !isCancel && !isBtnDestructive && !isMenu;
              
              const btnBg = isBtnDestructive
                ? theme.error
                : isPrimary 
                  ? theme.primary 
                  : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)');
                  
              const textColor = isPrimary || isBtnDestructive ? '#FFFFFF' : theme.onSurface;

              return (
                <Touchable 
                  key={idx} 
                  activeOpacity={0.8}
                  onPress={() => hide(btn.onPress)}
                  style={[
                    styles.button,
                    {
                      // Tek buton tam genişlik (ortalı); 2 buton yan yana %48; 3+ dikey %100.
                      width: (isVertical || buttons.length === 1) ? '100%' : '48%',
                      backgroundColor: btnBg,
                      marginBottom: isVertical && idx < buttons.length - 1 ? S.sm : 0,
                    }
                  ]}
                >
                  <Text 
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                    style={[
                      styles.buttonText, 
                      { 
                        color: textColor,
                        fontWeight: isCancel ? '600' : '700',
                        fontFamily: 'Jakarta-Bold'
                      }
                    ]}
                  >
                    {btn.text}
                  </Text>
                </Touchable>
              );
            })}
          </View>
        </Animated.View>
      </Animated.View>
  );
}

/** Kök yuva — eski adıyla (_layout bunu bağlıyor). */
export const CustomAlertModal = AlertHost;

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    elevation: 1000, // Android: kardeş görünümlerin (FAB, sekme çubuğu) üstünde
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999999,
  },
  alertBox: {
    width: '80%',
    maxWidth: 320,
    borderRadius: R.sheet,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    backfaceVisibility: 'hidden',
  },
  content: {
    paddingTop: S.xl,
    paddingBottom: S.md,
    paddingHorizontal: S.lg,
    alignItems: 'center',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: R.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: S.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: S.xs,
    letterSpacing: -0.3,
  },
  message: {
    fontSize: F.body,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
  },
  buttonContainer: {
    paddingHorizontal: S.lg,
    paddingBottom: S.lg,
    justifyContent: 'space-between',
    width: '100%',
  },
  button: {
    paddingVertical: S.smd,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 46,
    borderRadius: R.md,
  },
  buttonText: {
    fontSize: 15,
    letterSpacing: 0.2,
  }
});
