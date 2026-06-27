import React, { useState, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, Animated, TouchableWithoutFeedback, Easing } from 'react-native';
import { BlurView } from 'expo-blur';
import { useAppTheme } from '../hooks/useAppTheme';
import { Touchable } from './Touchable';
import { S, R, F } from '../constants/tokens';
import { useLanguageStore } from '../store/useLanguageStore';
import { AlertCircle, Info, Trash2, CheckCircle2 } from 'lucide-react-native';

let alertRef: any = null;

export const CustomAlert = {
  alert: (title: string, message?: string, buttons?: any[], options?: any) => {
    if (alertRef) {
      alertRef.show(title, message, buttons, options);
    } else {
      console.warn('CustomAlertModal not mounted, using fallback');
      import('react-native').then(({ Alert }) => {
        Alert.alert(title, message, buttons, options);
      });
    }
  }
};

export function CustomAlertModal() {
  const { theme, isDark } = useAppTheme();
  const { language } = useLanguageStore();
  
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState<string | undefined>('');
  const [buttons, setButtons] = useState<any[]>([]);
  
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.95));
  const [slideAnim] = useState(new Animated.Value(20));

  useEffect(() => {
    alertRef = {
      show: (t: string, m?: string, b?: any[], o?: any) => {
        setTitle(t);
        setMessage(m);
        if (!b || b.length === 0) {
          setButtons([{ text: language === 'tr' ? 'Tamam' : 'OK' }]);
        } else {
          setButtons(b);
        }
        
        setVisible(true);
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
            easing: Easing.out(Easing.exp),
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
            easing: Easing.out(Easing.back(1.5)),
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
            easing: Easing.out(Easing.exp),
          })
        ]).start();
      }
    };
  }, [language]);

  const hide = (callback?: () => void) => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
        easing: Easing.in(Easing.ease),
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 200,
        useNativeDriver: true,
        easing: Easing.in(Easing.ease),
      }),
      Animated.timing(slideAnim, {
        toValue: 10,
        duration: 200,
        useNativeDriver: true,
        easing: Easing.in(Easing.ease),
      })
    ]).start(() => {
      setVisible(false);
      // Callback'i bir sonraki tick'e ertele + izole et: buton onPress'i istisna atsa
      // bile overlay kapanır ve uygulama kilitlenmez (dokunuş bloklanmaz).
      if (callback) {
        setTimeout(() => {
          try { callback(); } catch (e) { console.warn('[CustomAlert] onPress error', e); }
        }, 0);
      }
    });
  };

  if (!visible) return null;

  const isDestructive = buttons.some(b => b.style === 'destructive');
  const IconComponent = isDestructive ? Trash2 : (title.toLowerCase().includes('hata') || title.toLowerCase().includes('error') ? AlertCircle : Info);
  const iconColor = isDestructive ? '#EF4444' : theme.primary;

  // Sıralama: Cancel solda, Primary/Destructive sağda olmalı.
  // Gelen array genelde [Cancel, Destructive] şeklindedir.
  const isVertical = buttons.length > 2;

  return (
    <Modal transparent visible={true} animationType="none" onRequestClose={() => hide()}>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <TouchableWithoutFeedback onPress={() => { /* disable tap to close by default */ }}>
          <BlurView 
            intensity={isDark ? 30 : 20} 
            tint={isDark ? 'dark' : 'light'} 
            style={StyleSheet.absoluteFill} 
          >
            <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.2)' }]} />
          </BlurView>
        </TouchableWithoutFeedback>
        
        <Animated.View style={[
          styles.alertBox, 
          { 
            backgroundColor: isDark ? 'rgba(28, 28, 30, 0.85)' : 'rgba(255, 255, 255, 0.9)',
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
            transform: [
              { scale: scaleAnim },
              { translateY: slideAnim }
            ]
          }
        ]}>
          <BlurView intensity={40} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          
          <View style={styles.content}>
            <View style={[styles.iconContainer, { backgroundColor: iconColor + '15' }]}>
              <IconComponent size={24} color={iconColor} strokeWidth={2.5} />
            </View>
            <Text style={[styles.title, { color: theme.onSurface }]}>{title}</Text>
            {!!message && (
              <Text style={[styles.message, { color: theme.onSurfaceVariant }]}>{message}</Text>
            )}
          </View>
          
          <View style={[styles.buttonContainer, { flexDirection: isVertical ? 'column' : 'row' }]}>
            {buttons.map((btn, idx) => {
              const isBtnDestructive = btn.style === 'destructive';
              const isCancel = btn.style === 'cancel';
              const isPrimary = !isCancel && !isBtnDestructive;
              
              const btnBg = isBtnDestructive 
                ? '#EF4444' 
                : isPrimary 
                  ? theme.primary 
                  : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)');
                  
              const textColor = isCancel ? theme.onSurface : '#FFFFFF';

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
                  <Text style={[
                    styles.buttonText, 
                    { 
                      color: textColor,
                      fontWeight: isCancel ? '600' : '800'
                    }
                  ]}>
                    {btn.text}
                  </Text>
                </Touchable>
              );
            })}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill as any,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999999,
  },
  alertBox: {
    width: '80%',
    maxWidth: 320,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
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
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: S.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: S.xs,
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
    opacity: 0.85,
  },
  buttonContainer: {
    paddingHorizontal: S.lg,
    paddingBottom: S.lg,
    justifyContent: 'space-between',
    width: '100%',
  },
  button: {
    paddingVertical: 12,
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
