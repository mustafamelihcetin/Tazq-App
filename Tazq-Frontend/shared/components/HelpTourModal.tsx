import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, Dimensions, Animated } from 'react-native';
import { Shield, Zap, CheckCircle2, Play, Flame } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { Touchable } from '@/shared/components/Touchable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTour } from '@/shared/components/TourContext';

interface HelpTourModalProps {
  pageId: string;
  coords?: Record<string, { x: number; y: number; w: number; h: number }>;
  onMeasure?: () => void;
  onStepChange?: (step: number) => void;
}

import { useTourStore } from '@/shared/store/useTourStore';

export const HelpTourModal: React.FC<HelpTourModalProps> = ({ pageId, coords: propsCoords, onMeasure: propsOnMeasure, onStepChange }) => {
  const { theme, colorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';
  const { language } = useLanguageStore();
  const tr = language === 'tr';
  const insets = useSafeAreaInsets();

  const tourCoords = useTourStore((s) => s.coords);
  const measureAll = useTourStore((s) => s.measureAll);
  const coords = propsCoords ?? tourCoords;
  const onMeasure = propsOnMeasure ?? measureAll;

  const { completedTours, setTourCompleted, setHelpTourShown } = usePrefsStore();
  const isTourShown = completedTours?.[pageId] === true;
  const [currentStep, setCurrentStep] = useState(0);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const maxStep = pageId === 'dashboard' ? 4 : 2;
  const totalSteps = maxStep + 1;

  // Trigger step change callback to parent
  useEffect(() => {
    if (isTourShown) return;
    if (onStepChange) {
      try {
        onStepChange(currentStep);
      } catch (err) {
        console.error('[HelpTourModal] Error calling onStepChange:', err);
      }
    }
  }, [currentStep, isTourShown]);

  // Trigger measurement when step changes or mounts to ensure alignment
  useEffect(() => {
    if (isTourShown) return;
    if (onMeasure) {
      try {
        onMeasure();
      } catch (err) {
        console.error('[HelpTourModal] Error calling onMeasure:', err);
      }
    }
  }, [currentStep, isTourShown]);

  // Breathing pulse animation for the spotlight scanner on GPU
  useEffect(() => {
    if (isTourShown) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isTourShown]);

  // Spring animations when transitions occur
  useEffect(() => {
    if (isTourShown) return;
    slideAnim.setValue(0);
    Animated.spring(slideAnim, {
      toValue: 1,
      tension: 65,
      friction: 9,
      useNativeDriver: true,
    }).start();
  }, [currentStep, isTourShown]);

  if (isTourShown) return null;

  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentStep < maxStep) {
      setCurrentStep(prev => prev + 1);
    } else {
      setTourCompleted(pageId, true);
      setHelpTourShown(true); // Keep legacy compatibility
    }
  };

  const handlePrev = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTourCompleted(pageId, true);
    setHelpTourShown(true); // Keep legacy compatibility
  };

  const sideInset = screenWidth > 600 ? (screenWidth - 600) / 2 : 0;

  // Validation function to safeguard layout properties against NaN, null, or negative sizes
  const isValidCoordinate = (val?: { x: number; y: number; w: number; h: number }) => {
    if (!val) return false;
    return (
      typeof val.x === 'number' && Number.isFinite(val.x) && val.x >= 0 &&
      typeof val.y === 'number' && Number.isFinite(val.y) && val.y >= 0 &&
      typeof val.w === 'number' && Number.isFinite(val.w) && val.w > 0 &&
      typeof val.h === 'number' && Number.isFinite(val.h) && val.h > 0
    );
  };

  // Helper to dynamically calculate layout coordinates based on pageId, steps, live measurements, or relative fallbacks
  const getStepLayout = () => {
    try {
      if (pageId === 'dashboard') {
        switch (currentStep) {
          case 0: { // Momentum score indicator
            const c = isValidCoordinate(coords?.momentum) ? coords!.momentum : null;
            const targetX = c?.x ?? (16 + sideInset);
            const targetY = c?.y ?? (insets.top + 152);
            const targetW = c?.w ?? (screenWidth - 32 - (2 * sideInset));
            const targetH = c?.h ?? 80;
            return {
              x: targetX,
              y: targetY,
              w: targetW,
              h: targetH,
              radius: 20,
              bubbleTop: targetY + targetH + 12,
              pointerDirection: 'up' as const,
              pointerOffset: targetX + targetW / 2 - 12 - 12,
              color: theme.tertiary,
              titleTr: 'İvme Durumu',
              titleEn: 'Momentum status',
              descTr: 'İvme, senin günlük üretkenlik hızındır (0-100). Görev tamamladıkça, odaklandıkça ve alışkanlıklarını aksatmadıkça artar. Eylemsiz kaldığın her gün %10 soğur.',
              descEn: 'Momentum is your daily productivity score (0-100). It rises as you complete tasks, focus, and do habits. It drops by 10% daily if you are inactive.',
            };
          }
          case 1: { // Habits Section
            const c = isValidCoordinate(coords?.habits) ? coords!.habits : null;
            const targetX = c?.x ?? (16 + sideInset);
            const targetY = c?.y ?? (insets.top + 248);
            const targetW = c?.w ?? (screenWidth - 32 - (2 * sideInset));
            const targetH = c?.h ?? 120;
            return {
              x: targetX,
              y: targetY,
              w: targetW,
              h: targetH,
              radius: 20,
              bubbleTop: targetY + targetH + 12,
              pointerDirection: 'up' as const,
              pointerOffset: targetX + 80,
              color: theme.streak,
              titleTr: 'Günlük Alışkanlıklar',
              titleEn: 'Daily Habits',
              descTr: 'Her gün tekrar ettiğin rutinlerdir (Örn: Su iç, kitap oku). Serini koruyarak ivmenin istikrar payını besler. Gün bitmeden bunları işaretlemelisin.',
              descEn: 'Daily routines that build consistency (e.g., Drink water, read). Keeping streaks directly feeds your momentum. Check them off before the day ends.',
            };
          }
          case 2: { // Tasks Section
            const c = isValidCoordinate(coords?.tasks) ? coords!.tasks : null;
            const targetX = c?.x ?? (16 + sideInset);
            const targetY = c?.y ?? (insets.top + 372);
            const targetW = c?.w ?? (screenWidth - 32 - (2 * sideInset));
            const targetH = c?.h ?? 240;
            const showBubbleAbove = targetY + targetH > screenHeight - 190;
            return {
              x: targetX,
              y: targetY,
              w: targetW,
              h: targetH,
              radius: 20,
              bubbleTop: showBubbleAbove ? undefined : targetY + targetH + 12,
              bubbleBottom: showBubbleAbove ? screenHeight - targetY + 12 : undefined,
              pointerDirection: showBubbleAbove ? 'down' : 'up',
              pointerOffset: targetX + 120,
              color: theme.success,
              titleTr: 'Günlük Görevler',
              titleEn: 'Daily Tasks',
              descTr: 'Tek seferlik, bitiş tarihi ve önem derecesi olan aksiyonlardır (Örn: Raporu gönder). Tamamlandığında önceliğine göre ivme motorunu anlık ateşler.',
              descEn: 'One-off actions with due dates and priorities (e.g., Submit report). Completing them directly fires momentum thrusters based on priority.',
            };
          }
          case 3: { // Focus Tab
            const targetW = 76;
            const targetH = 76;
            const targetX = screenWidth * 0.5 - 38;
            const targetY = screenHeight - targetH - insets.bottom;
            return {
              x: targetX,
              y: targetY,
              w: targetW,
              h: targetH,
              radius: 20,
              bubbleBottom: targetH + 12,
              pointerDirection: 'down' as const,
              pointerOffset: screenWidth * 0.5 - 18,
              color: theme.primary,
              titleTr: 'Derin Odaklanma',
              titleEn: 'Deep Focus',
              descTr: 'Odak ekranından Pomodoro veya kronometre başlatabilirsin. Odaklandığın her dakika ivme motorunu besler ve puanını doğrudan yukarı taşır.',
              descEn: 'Start focus sessions on the Focus tab using Pomodoro. Every single minute spent focusing directly charges your thrusters and raises your score.',
            };
          }
          case 4: { // Cockpit status hub
            const c = isValidCoordinate(coords?.cockpit) ? coords!.cockpit : null;
            const targetW = c?.w ?? 46;
            const targetH = c?.h ?? 46;
            const targetX = c?.x ?? (screenWidth - sideInset - 62);
            const targetY = c?.y ?? (insets.top + 10);
            return {
              x: targetX,
              y: targetY,
              w: targetW,
              h: targetH,
              radius: 23,
              bubbleTop: targetY + targetH + 12,
              pointerDirection: 'up' as const,
              pointerOffset: targetX + targetW / 2 - 18,
              color: theme.tertiary,
              titleTr: 'İvme Kalkanı ve Kokpit',
              titleEn: 'Momentum Shield & Cockpit',
              descTr: 'Hasta veya tatilde olduğunda ivmenin erimesini önlemek için kalkanı açabilirsin. Kalkan, aktif kaldığı gün başına 1 odak şarjı tüketir.',
              descEn: 'Freeze your score on sick/rest days so it doesn’t decay. It consumes 1 charge per day. Earn charges by working, completing focus, or finishing tasks!',
            };
          }
        }
      }

      if (pageId === 'tasks') {
        switch (currentStep) {
          case 0: { // Add task block (FAB)
            const c = isValidCoordinate(coords?.quickAdd) ? coords!.quickAdd : null;
            const targetX = c?.x ?? (screenWidth - sideInset - 80);
            const targetY = c?.y ?? (screenHeight - insets.bottom - 110);
            const targetW = c?.w ?? 64;
            const targetH = c?.h ?? 64;
            return {
              x: targetX,
              y: targetY,
              w: targetW,
              h: targetH,
              radius: 18,
              bubbleBottom: screenHeight - targetY + 12,
              pointerDirection: 'down' as const,
              pointerOffset: targetX + targetW / 2 - 12 - 6,
              color: theme.primary,
              titleTr: 'Yeni Görev Ekle',
              titleEn: 'Add New Task',
              descTr: 'Bu butona tıklayarak hızlıca yeni bir görev ekleyebilirsin. Detaylar ve öncelik seviyesi belirleyebilirsin.',
              descEn: 'Tap this button to quickly add new tasks. Set due dates, priorities, and details.',
            };
          }
          case 1: { // Filter tabs
            const c = isValidCoordinate(coords?.filters) ? coords!.filters : null;
            const targetX = c?.x ?? (16 + sideInset);
            const targetY = c?.y ?? (insets.top + 128);
            const targetW = c?.w ?? (screenWidth - 32 - (2 * sideInset));
            const targetH = c?.h ?? 44;
            return {
              x: targetX,
              y: targetY,
              w: targetW,
              h: targetH,
              radius: 12,
              bubbleTop: targetY + targetH + 12,
              pointerDirection: 'up' as const,
              pointerOffset: targetX + 80,
              color: theme.streak,
              titleTr: 'Kategori Filtreleri',
              titleEn: 'Category Filters',
              descTr: 'Görevlerini aktif ettiğin yaşam modlarına (Örn: Sınav Modu, Ramazan Modu) veya durumlarına göre süzebilirsin.',
              descEn: 'Filter tasks dynamically according to your active life modes (e.g. Exam Mode, Ramazan Mode) or status.',
            };
          }
          case 2: { // Task list
            const c = isValidCoordinate(coords?.list) ? coords!.list : null;
            const targetX = c?.x ?? (16 + sideInset);
            const targetY = c?.y ?? (insets.top + 188);
            const targetW = c?.w ?? (screenWidth - 32 - (2 * sideInset));
            const targetH = c?.h ?? 340;
            return {
              x: targetX,
              y: targetY,
              w: targetW,
              h: targetH,
              radius: 16,
              bubbleTop: targetY + 80,
              pointerDirection: 'up' as const,
              pointerOffset: targetX + 120,
              color: theme.success,
              titleTr: 'Görev Listesi',
              titleEn: 'Task List',
              descTr: 'Görevlerini sürükleyip sıralayabilir, tamamlamak için kutucuğa tıklayabilir ya da basılı tutarak erteleyebilirsin.',
              descEn: 'Hold & drag tasks to sort, click checkboxes to complete, or long press to reschedule/delete.',
            };
          }
        }
      }

      if (pageId === 'focus') {
        switch (currentStep) {
          case 0: { // Timer Circle
            const c = isValidCoordinate(coords?.timer) ? coords!.timer : null;
            const targetX = c?.x ?? (screenWidth / 2 - 110);
            const targetY = c?.y ?? (insets.top + 130);
            const targetW = c?.w ?? 220;
            const targetH = c?.h ?? 220;
            return {
              x: targetX,
              y: targetY,
              w: targetW,
              h: targetH,
              radius: 110,
              bubbleTop: targetY + targetH + 12,
              pointerDirection: 'up' as const,
              pointerOffset: screenWidth / 2 - 18,
              color: theme.primary,
              titleTr: 'Odaklanma Halkası',
              titleEn: 'Focus Circle',
              descTr: 'Buradan seans süresini takip et. Odaklanma oturumu boyunca telefonuna dokunmamak ivme puanını uçurur!',
              descEn: 'Keep track of focus session lengths. Staying off your device during sessions boosts your momentum scores!',
            };
          }
          case 1: { // Mode select
            const c = isValidCoordinate(coords?.modeSelect) ? coords!.modeSelect : null;
            const targetX = c?.x ?? (screenWidth / 2 - 90);
            const targetY = c?.y ?? (insets.top + 368);
            const targetW = c?.w ?? 180;
            const targetH = c?.h ?? 40;
            return {
              x: targetX,
              y: targetY,
              w: targetW,
              h: targetH,
              radius: 12,
              bubbleTop: targetY + targetH + 12,
              pointerDirection: 'up' as const,
              pointerOffset: screenWidth / 2 - 18,
              color: theme.streak,
              titleTr: 'Pomodoro / Kronometre',
              titleEn: 'Pomodoro / Stopwatch',
              descTr: 'Belli hedeflerle çalışmak için Pomodoro döngülerini (25dk odak, 5dk mola), serbest zaman takibi için Kronometre modunu seçebilirsin.',
              descEn: 'Toggle Pomodoro loops (25m focus, 5m break) to target goals, or select Stopwatch for free time tracking.',
            };
          }
          case 2: { // Start Button
            const c = isValidCoordinate(coords?.startButton) ? coords!.startButton : null;
            const targetX = c?.x ?? (32 + sideInset);
            const targetY = c?.y ?? (screenHeight - 150 - insets.bottom);
            const targetW = c?.w ?? (screenWidth - 64 - (2 * sideInset));
            const targetH = c?.h ?? 54;
            return {
              x: targetX,
              y: targetY,
              w: targetW,
              h: targetH,
              radius: 16,
              bubbleBottom: targetH + insets.bottom + 12,
              pointerDirection: 'down' as const,
              pointerOffset: screenWidth / 2 - 18,
              color: theme.success,
              titleTr: 'Oturumu Başlat',
              titleEn: 'Start Session',
              descTr: 'Butona basarak seansı başlat. Arka planda odaklandığın her dakika ivmeni korur ve odak şarjı biriktirir.',
              descEn: 'Tap to start focus sessions. Every single minute spent focusing yields charges and secures your scores.',
            };
          }
        }
      }

      if (pageId === 'cockpit') {
        switch (currentStep) {
          case 0: { // Week Strip / Calendar
            const c = isValidCoordinate(coords?.weekStrip) ? coords!.weekStrip : null;
            const targetX = c?.x ?? (16 + sideInset);
            const targetY = c?.y ?? (insets.top + 80);
            const targetW = c?.w ?? (screenWidth - 32 - (2 * sideInset));
            const targetH = c?.h ?? 84;
            return {
              x: targetX,
              y: targetY,
              w: targetW,
              h: targetH,
              radius: 16,
              bubbleTop: targetY + targetH + 12,
              pointerDirection: 'up' as const,
              pointerOffset: targetX + 80,
              color: theme.tertiary,
              titleTr: 'Haftalık Çizelge',
              titleEn: 'Weekly Strip',
              descTr: 'Bu hafta içindeki günler arasında gezinebilir, geçmiş günlerdeki görev durumunu ve tamamlanma oranlarını izleyebilirsin.',
              descEn: 'Navigate through days of the current week to inspect past task statuses and completion metrics.',
            };
          }
          case 1: { // Daily tasks & habits
            const c = isValidCoordinate(coords?.dailySection) ? coords!.dailySection : null;
            const targetX = c?.x ?? (16 + sideInset);
            const targetY = c?.y ?? (insets.top + 180);
            const targetW = c?.w ?? (screenWidth - 32 - (2 * sideInset));
            const targetH = c?.h ?? 160;
            return {
              x: targetX,
              y: targetY,
              w: targetW,
              h: targetH,
              radius: 16,
              bubbleTop: targetY + targetH + 12,
              pointerDirection: 'up' as const,
              pointerOffset: targetX + 120,
              color: theme.streak,
              titleTr: 'Günlük Rapor Kartı',
              titleEn: 'Daily Status Card',
              descTr: 'Seçili güne ait tüm görev ve alışkanlıkları detaylı olarak listeler. Buradan doğrudan görev durumunu değiştirebilirsin.',
              descEn: 'Lists all tasks and habits for the selected calendar day. You can review and launch items from here.',
            };
          }
          case 2: { // Weekly review stats
            const c = isValidCoordinate(coords?.weeklyReview) ? coords!.weeklyReview : null;
            const targetX = c?.x ?? (16 + sideInset);
            const targetY = c?.y ?? (insets.top + 360);
            const targetW = c?.w ?? (screenWidth - 32 - (2 * sideInset));
            const targetH = c?.h ?? 140;
            const showBubbleAbove = targetY + targetH > screenHeight - 190;
            return {
              x: targetX,
              y: targetY,
              w: targetW,
              h: targetH,
              radius: 16,
              bubbleTop: showBubbleAbove ? undefined : targetY + targetH + 12,
              bubbleBottom: showBubbleAbove ? screenHeight - targetY + 12 : undefined,
              pointerDirection: showBubbleAbove ? 'down' : 'up',
              pointerOffset: targetX + 140,
              color: theme.success,
              titleTr: 'Haftalık Performans Özeti',
              titleEn: 'Weekly Summary',
              descTr: 'Bu haftaki toplam tamamlanan görev sayısını, odaklanma süreni ve alışkanlık istikrarı yüzdelerini takip et.',
              descEn: 'Track total completed tasks, focused duration, and habit consistency rates for the week.',
            };
          }
        }
      }

      if (pageId === 'modlar') {
        switch (currentStep) {
          case 0: { // Preset modes cards
            const c = isValidCoordinate(coords?.presets) ? coords!.presets : null;
            const targetX = c?.x ?? (16 + sideInset);
            const targetY = c?.y ?? (insets.top + 80);
            const targetW = c?.w ?? (screenWidth - 32 - (2 * sideInset));
            const targetH = c?.h ?? 160;
            return {
              x: targetX,
              y: targetY,
              w: targetW,
              h: targetH,
              radius: 16,
              bubbleTop: targetY + targetH + 12,
              pointerDirection: 'up' as const,
              pointerOffset: targetX + 80,
              color: theme.primary,
              titleTr: 'Hazır Yaşam Modları',
              titleEn: 'Preset Life Modes',
              descTr: 'YKS, KPSS veya Ramazan gibi özel dönemler için hazırlanmış hazır hedefleri aktif edebilirsin.',
              descEn: 'Activate curated preset plans tailored for specific periods like YKS, KPSS, or Ramazan.',
            };
          }
          case 1: { // Mode contents
            const c = isValidCoordinate(coords?.contents) ? coords!.contents : null;
            const targetX = c?.x ?? (16 + sideInset);
            const targetY = c?.y ?? (insets.top + 260);
            const targetW = c?.w ?? (screenWidth - 32 - (2 * sideInset));
            const targetH = c?.h ?? 140;
            return {
              x: targetX,
              y: targetY,
              w: targetW,
              h: targetH,
              radius: 16,
              bubbleTop: targetY + targetH + 12,
              pointerDirection: 'up' as const,
              pointerOffset: targetX + 120,
              color: theme.streak,
              titleTr: 'Dönemsel Müfredatlar',
              titleEn: 'Curriculum & Plans',
              descTr: 'Her mod, kendi hedeflerine özel hazır günlük görevler ve alışkanlıklar getirerek ivmene doğrudan katkı sunar.',
              descEn: 'Each mode injects automated daily tasks and habits to supercharge your momentum score.',
            };
          }
          case 2: { // Custom mode creator (overview)
            const c = isValidCoordinate(coords?.overview) ? coords!.overview : null;
            const targetW = c?.w ?? 44;
            const targetH = c?.h ?? 44;
            const targetX = c?.x ?? (sideInset + 16);
            const targetY = c?.y ?? (insets.top + 10);
            return {
              x: targetX,
              y: targetY,
              w: targetW,
              h: targetH,
              radius: 22,
              bubbleTop: targetY + targetH + 12,
              pointerDirection: 'up' as const,
              pointerOffset: targetX + targetW / 2 - 18,
              color: theme.success,
              titleTr: 'Mod Analizleri',
              titleEn: 'Modes Analytics',
              descTr: 'Bu butona dokunarak aktif ettiğin yaşam modlarındaki toplam ilerleme durumunu ve istikrar grafiklerini izleyebilirsin.',
              descEn: 'Tap this icon to open the Modes Summary screen and review overall progress metrics.',
            };
          }
        }
      }

      // Default safe fallback
      return {
        x: 16 + sideInset,
        y: insets.top + 152,
        w: screenWidth - 32 - (2 * sideInset),
        h: 80,
        radius: 20,
        bubbleTop: insets.top + 152 + 80 + 12,
        pointerDirection: 'up' as const,
        pointerOffset: screenWidth / 2 - 18,
        color: theme.primary,
        titleTr: 'Tanıtım Rehberi',
        titleEn: 'Tour Guide',
        descTr: 'Sistem yerleşimi hesaplanıyor, tanımdan devam edebilirsiniz.',
        descEn: 'Calculating layout bounds, you can still safely continue the tour guide.',
      };
    } catch (err) {
      console.error('[HelpTourModal] Layout error caught securely:', err);
      return {
        x: 16 + sideInset,
        y: insets.top + 152,
        w: screenWidth - 32 - (2 * sideInset),
        h: 80,
        radius: 20,
        bubbleTop: insets.top + 152 + 80 + 12,
        pointerDirection: 'up' as const,
        pointerOffset: screenWidth / 2 - 18,
        color: theme.error,
        titleTr: 'Sistem Yükleniyor...',
        titleEn: 'System Loading...',
        descTr: 'Yerleşim hesaplamasında geçici bir gecikme oluştu. Tur rehberine devam edebilirsiniz.',
        descEn: 'A minor layout delay occurred. You may still safely continue the tour guide.',
      };
    }
  };

  const layout = getStepLayout();

  const bubbleStyles = {
    bg: isDark ? '#1C1C1E' : '#FFFFFF',
    border: layout.color,
    text: isDark ? 'rgba(255,255,255,0.9)' : '#1C1C1E',
  };

  const scale = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.95, 1],
  });

  const opacity = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <Modal visible={true} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        
        {/* Breathing glowing spotlight ring exactly at calculated layout bounds */}
        <Animated.View
          style={[
            styles.spotlightRing,
            {
              top: layout.y,
              left: layout.x,
              width: layout.w,
              height: layout.h,
              borderRadius: layout.radius,
              borderColor: layout.color,
              shadowColor: layout.color,
              transform: [{ scale: pulseAnim }],
            }
          ]}
        />

        {/* Animated Coachmark Speech Bubble Container */}
        <Animated.View
          style={[
            styles.bubbleContainer,
            {
              top: layout.bubbleTop,
              bottom: layout.bubbleBottom,
              opacity,
              transform: [{ scale }],
            }
          ]}
        >
          <View style={[styles.bubble, { backgroundColor: bubbleStyles.bg, borderColor: bubbleStyles.border }]}>
            {/* Triangular pointer */}
            <View
              style={[
                styles.pointer,
                {
                  backgroundColor: bubbleStyles.bg,
                  borderColor: bubbleStyles.border,
                  left: layout.pointerOffset,
                  top: layout.pointerDirection === 'up' ? -7 : undefined,
                  bottom: layout.pointerDirection === 'down' ? -7 : undefined,
                  borderLeftWidth: layout.pointerDirection === 'up' ? 1.2 : 0,
                  borderTopWidth: layout.pointerDirection === 'up' ? 1.2 : 0,
                  borderRightWidth: layout.pointerDirection === 'down' ? 1.2 : 0,
                  borderBottomWidth: layout.pointerDirection === 'down' ? 1.2 : 0,
                }
              ]}
            />

            {/* Content layout */}
            <View style={styles.textContainer}>
              <View style={styles.headerRow}>
                <Text style={[styles.title, { color: layout.color }]}>
                  {tr ? layout.titleTr : layout.titleEn}
                </Text>
                
                <Text style={styles.stepBadge}>
                  {currentStep + 1} / {totalSteps}
                </Text>
              </View>
              
              <Text style={[styles.body, { color: bubbleStyles.text }]}>
                {tr ? layout.descTr : layout.descEn}
              </Text>
            </View>

            {/* Stepper Dot Indicator */}
            <View style={styles.stepperRow}>
              <View style={styles.dotsGroup}>
                {[...Array(totalSteps).keys()].map((idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.dot,
                      {
                        backgroundColor: idx === currentStep 
                          ? layout.color 
                          : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)'),
                        width: idx === currentStep ? 14 : 5,
                      }
                    ]}
                  />
                ))}
              </View>
            </View>

            {/* Footer Row Controls */}
            <View style={styles.footerRow}>
              {currentStep > 0 ? (
                <Touchable onPress={handlePrev} style={styles.textBtn}>
                  <Text style={[styles.textBtnLabel, { color: theme.onSurfaceVariant, opacity: 0.6 }]}>
                    {tr ? 'Geri' : 'Back'}
                  </Text>
                </Touchable>
              ) : (
                <Touchable onPress={handleSkip} style={styles.textBtn}>
                  <Text style={[styles.textBtnLabel, { color: theme.onSurfaceVariant, opacity: 0.6 }]}>
                    {tr ? 'Atla' : 'Skip'}
                  </Text>
                </Touchable>
              )}

              <Touchable
                onPress={handleNext}
                style={[
                  styles.primaryBtn,
                  { backgroundColor: layout.color }
                ]}
              >
                <Text style={styles.primaryBtnText}>
                  {currentStep === maxStep 
                    ? (tr ? 'Başla' : 'Let\'s Go') 
                    : (tr ? 'Sonraki' : 'Next')}
                </Text>
              </Touchable>
            </View>
          </View>
        </Animated.View>

      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    position: 'relative',
  },
  spotlightRing: {
    position: 'absolute',
    borderWidth: 2.2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 14,
    elevation: 12,
    zIndex: 9999,
  },
  bubbleContainer: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 10000,
  },
  bubble: {
    padding: 16,
    borderRadius: 22,
    borderWidth: 1.2,
    position: 'relative',
    elevation: 8,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  pointer: {
    position: 'absolute',
    width: 12,
    height: 12,
    transform: [{ rotate: '45deg' }],
    zIndex: 10,
  },
  textContainer: {
    gap: 6,
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  title: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  stepBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#8E8E93',
    backgroundColor: 'rgba(0,0,0,0.04)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  body: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dotsGroup: {
    flexDirection: 'row',
    gap: 5,
  },
  dot: {
    height: 5,
    borderRadius: 2.5,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
    paddingTop: 12,
  },
  textBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  textBtnLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  primaryBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    minWidth: 84,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
  }
});
