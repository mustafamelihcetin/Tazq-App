import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Dimensions, Animated, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { Touchable } from '@/shared/components/Touchable';
import { S, R, F, B } from '@/shared/constants/tokens';
import * as Haptics from 'expo-haptics';

interface HelpTourModalProps {
  pageId: 'dashboard' | 'focus' | 'tasks' | 'modlar' | 'cockpit';
  onStepChange?: (step: number) => void;
}

export const HelpTourModal: React.FC<HelpTourModalProps> = ({ pageId, onStepChange }) => {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useAppTheme();
  const { completedTours, setTourCompleted, setHelpTourShown, language } = usePrefsStore();

  const isTourShown = completedTours?.[pageId] === true;
  const [currentStep, setCurrentStep] = useState(0);

  // Animations
  const cardSlide = useRef(new Animated.Value(0)).current; // 0 to 1 slide up
  const contentFade = useRef(new Animated.Value(1)).current; // 1 to 0 to 1 step change fade
  const backdropOpacity = useRef(new Animated.Value(0)).current; // Backdrop fade

  const tr = language === 'tr';

  // Tour steps definition
  const getTourSteps = () => {
    switch (pageId) {
      case 'dashboard':
        return [
          {
            title: tr ? 'Tazq Uzay Üssü' : 'Tazq Space Hub',
            desc: tr 
              ? 'Tazq ile üretkenliğini kozmik seviyeye çıkar. İvme motorunu beslemek için günlük rutinlerini tamamla.' 
              : 'Elevate your productivity with Tazq. Complete daily routines to fuel your momentum engine.',
            icon: '🚀',
            color: theme.primary,
          },
          {
            title: tr ? 'Günlük İvme Motoru' : 'Daily Momentum',
            desc: tr 
              ? 'Günlük tamamladığın her görev ivmeni yükseltir. Tatil günlerinde puan erimesini durdurmak için İvme Kalkanı\'nı aktif edebilirsin.' 
              : 'Every completed task drives your speed. Activate the Momentum Shield to freeze score decay on rest days.',
            icon: '⚡',
            color: theme.tertiary,
          },
          {
            title: tr ? 'Günlük Alışkanlıklar' : 'Daily Habits',
            desc: tr 
              ? 'Günlük rutinlerini (Örn: Su iç, kitap oku) gün bitmeden tamamlayıp işaretleyerek serini ve istikrarını koru.' 
              : 'Complete and check off habits (e.g., drink water, read) before the day ends to protect your streaks.',
            icon: '🥛',
            color: theme.streak,
          },
          {
            title: tr ? 'Görev Akışı' : 'Task Flow',
            desc: tr 
              ? 'Tek seferlik ve önem derecesine göre önceliklendirilmiş görevlerini yönet. Tamamlanan her görev ivmene anlık güç sağlar.' 
              : 'Manage one-off tasks prioritized by importance. Checking them off fires instant momentum thrusters.',
            icon: '📝',
            color: theme.success,
          }
        ];
      case 'tasks':
        return [
          {
            title: tr ? 'Görev Planlayıcı' : 'Task Planner',
            desc: tr 
              ? 'Görevlerini önem derecesine göre (Yüksek, Orta, Düşük) önceliklendir. Sürükleyip sıralayarak gününü organize et.' 
              : 'Prioritize tasks by urgency (High, Medium, Low). Drag and drop to sort and organize your daily workflow.',
            icon: '🎯',
            color: theme.success,
          },
          {
            title: tr ? 'Zamanlama & İşlemler' : 'Scheduling & Actions',
            desc: tr 
              ? 'Görevlere bitiş tarihi ata, ertelemek için sağa kaydır veya tamamladıkça tek dokunuşla listeden temizle.' 
              : 'Assign due dates, swipe right to reschedule/delete, or clear completed items with a single tap.',
            icon: '📅',
            color: theme.primary,
          }
        ];
      case 'focus':
        return [
          {
            title: tr ? 'Odaklanma Merkezi' : 'Focus Hub',
            desc: tr 
              ? 'Pomodoro seansları veya kronometre başlatarak pürüzsüz çalış. Odaklandığın her dakika doğrudan ivme skorunu besler.' 
              : 'Start Pomodoro sessions or stopwatches. Every minute of deep work directly fuels and charges your momentum.',
            icon: '⏱️',
            color: theme.primary,
          },
          {
            title: tr ? 'Zen Modu & Nefes Kılavuzu' : 'Zen Mode & Breath Guide',
            desc: tr 
              ? 'Zen Modu ile ekrandaki dikkat dağıtıcıları temizle. Ritmik nefes rehberi (Nefes Al, Tut, Ver) ile zihnini sakinleştir.' 
              : 'Zen Mode clears all screen distractions. Use the rhythmic breath guide (Inhale, Hold, Exhale) to center your mind.',
            icon: '🌀',
            color: theme.secondary,
          },
          {
            title: tr ? 'Doğa Ambiyansları' : 'Ambient Sounds',
            desc: tr 
              ? 'Yağmur, fırtına veya kozmik uğultu... Çalışırken arka planda çalacak doğa seslerini seçerek dış dünyayı sessize al.' 
              : 'Rain, storm, or cosmic hum... Play relaxing nature sounds in the background to block out the external world.',
            icon: '🌧️',
            color: theme.tertiary,
          }
        ];
      case 'modlar':
        return [
          {
            title: tr ? 'Dönemsel Modlar' : 'Seasonal Modes',
            desc: tr 
              ? 'Sınav hazırlığı, Tez yazımı, Ramazan veya Spor hedefleri gibi dönemlik yolculuklarını seçip özel planlar oluştur.' 
              : 'Choose custom journeys like Exam prep, Thesis writing, Ramadan, or Gym targets to build tailored plans.',
            icon: '🔮',
            color: theme.primary,
          },
          {
            title: tr ? 'Kozmik Plan Hazırlığı' : 'Tailored Integration',
            desc: tr 
              ? 'Seçtiğin moda özel üretilen dinamik görevler ve alışkanlıklar günlük akışına ve takvimine otomatik olarak entegre edilir.' 
              : 'Dynamic habits and tasks generated specifically for your selected mode are automatically integrated into your feed.',
            icon: '⚡',
            color: theme.tertiary,
          }
        ];
      case 'cockpit':
        return [
          {
            title: tr ? 'Kokpit Analiz Merkezi' : 'Cockpit Analytics',
            desc: tr 
              ? 'Haftalık gelişim raporunu, toplam odaklanma süreni ve alışkanlık tamamlama oranlarını tek bir panelden izle.' 
              : 'Monitor weekly growth reports, total focus durations, and habit consistency rates inside one dashboard.',
            icon: '📊',
            color: theme.tertiary,
          },
          {
            title: tr ? 'Haftalık Karne & Karşılaştırma' : 'Weekly Review',
            desc: tr 
              ? 'Geçmiş günlerdeki performansını kıyaslayarak üretkenliğindeki istikrarlı artışı grafiklerle takip et.' 
              : 'Compare metrics across days and watch your productivity climb with detailed growth charts.',
            icon: '📈',
            color: theme.success,
          }
        ];
      default:
        return [];
    }
  };

  const steps = getTourSteps();
  const maxStep = steps.length - 1;
  const currentStepData = steps[currentStep];

  // Slide up card & fade in backdrop on mount
  useEffect(() => {
    if (isTourShown) return;

    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(cardSlide, {
        toValue: 1,
        tension: 50,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isTourShown]);

  // Handle step change with haptic & fade transition
  const goToStep = (nextStep: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Fade out current content
    Animated.timing(contentFade, {
      toValue: 0,
      duration: 100,
      useNativeDriver: true,
    }).start(() => {
      setCurrentStep(nextStep);
      if (onStepChange) onStepChange(nextStep);
      
      // Fade in new content
      Animated.timing(contentFade, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    });
  };

  const handleNext = () => {
    if (currentStep < maxStep) {
      goToStep(currentStep + 1);
    } else {
      handleFinish();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      goToStep(currentStep - 1);
    }
  };

  const handleFinish = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    // Slide down & fade out backdrop before closing
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(cardSlide, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setTourCompleted(pageId, true);
      setHelpTourShown(true); // Legacy compatibility
    });
  };

  if (isTourShown || steps.length === 0) return null;

  const cardTranslateY = cardSlide.interpolate({
    inputRange: [0, 1],
    outputRange: [400, 0],
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Background Semi-Transparent Dark Dim */}
      <Animated.View 
        style={[
          styles.backdrop, 
          { opacity: backdropOpacity }
        ]} 
        pointerEvents="auto"
      />

      {/* Main Tour Card Container */}
      <View style={styles.cardWrapper} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
              borderColor: currentStepData?.color ?? theme.primary,
              transform: [{ translateY: cardTranslateY }],
              paddingBottom: insets.bottom + 20,
            }
          ]}
        >
          {/* Top colored indicator bar */}
          <View style={[styles.colorBar, { backgroundColor: currentStepData?.color ?? theme.primary }]} />

          <Animated.View style={{ opacity: contentFade, width: '100%' }}>
            {/* Mascot / Icon bubble */}
            <View style={styles.iconContainer}>
              <Text style={styles.icon}>{currentStepData?.icon}</Text>
            </View>

            {/* Stepper text info */}
            <Text style={[styles.stepText, { color: theme.onSurfaceVariant }]}>
              {currentStep + 1} / {steps.length}
            </Text>

            {/* Title */}
            <Text style={[styles.title, { color: theme.onSurface }]}>
              {currentStepData?.title}
            </Text>

            {/* Description */}
            <Text style={[styles.desc, { color: theme.onSurfaceVariant }]}>
              {currentStepData?.desc}
            </Text>
          </Animated.View>

          {/* Stepper Dots */}
          <View style={styles.dotsRow}>
            {steps.map((_, idx) => (
              <View
                key={idx}
                style={[
                  styles.dot,
                  {
                    backgroundColor: idx === currentStep 
                      ? (currentStepData?.color ?? theme.primary) 
                      : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)'),
                    width: idx === currentStep ? 16 : 6,
                  }
                ]}
              />
            ))}
          </View>

          {/* Controls Footer */}
          <View style={styles.footer}>
            {currentStep > 0 ? (
              <Touchable onPress={handlePrev} style={styles.backBtn}>
                <Text style={[styles.backBtnText, { color: theme.onSurfaceVariant }]}>
                  {tr ? 'Geri' : 'Back'}
                </Text>
              </Touchable>
            ) : (
              <Touchable onPress={handleFinish} style={styles.backBtn}>
                <Text style={[styles.backBtnText, { color: theme.onSurfaceVariant, opacity: 0.6 }]}>
                  {tr ? 'Atla' : 'Skip'}
                </Text>
              </Touchable>
            )}

            <Touchable
              onPress={handleNext}
              style={[
                styles.nextBtn,
                { backgroundColor: currentStepData?.color ?? theme.primary }
              ]}
            >
              <Text style={styles.nextBtnText}>
                {currentStep === maxStep 
                  ? (tr ? 'Başla' : 'Get Started') 
                  : (tr ? 'Sonraki' : 'Next')}
              </Text>
            </Touchable>
          </View>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 9990,
  },
  cardWrapper: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 9991,
  },
  card: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1.2,
    borderBottomWidth: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 20,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  colorBar: {
    width: 60,
    height: 5,
    borderRadius: 3,
    marginBottom: 20,
    opacity: 0.8,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.03)',
    alignSelf: 'center',
    marginBottom: 10,
  },
  icon: {
    fontSize: 34,
  },
  stepText: {
    fontSize: F.caption,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
    opacity: 0.6,
    letterSpacing: 1,
  },
  title: {
    fontSize: F.title2,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  desc: {
    fontSize: F.subhead,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
    marginBottom: 24,
    opacity: 0.85,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 24,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  backBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  backBtnText: {
    fontSize: F.body,
    fontWeight: '600',
  },
  nextBtn: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: R.full,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  nextBtnText: {
    color: '#FFFFFF',
    fontSize: F.body,
    fontWeight: '700',
  },
});
