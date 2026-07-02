import React, { useEffect } from 'react';
import { View, Text, Modal, Animated, StyleSheet, Platform } from 'react-native';
import { BrainCircuit, Zap, Target, Play } from 'lucide-react-native';
import { useSwipeToDismiss } from '@/shared/hooks/useSwipeToDismiss';
import { Touchable } from '@/shared/components/Touchable';
import { S, R, F, B, scale, verticalScale, moderateScale } from '@/shared/constants/tokens';
import { useRouter } from 'expo-router';

interface StatusHubModalProps {
  visible: boolean;
  onClose: () => void;
  theme: any;
  isDark: boolean;
  language: string;
  t: any;
  insight: string;
  momentum: number;
  momentumColor: string;
  todayCompleted: number;
  dailyGoal: number;
  isActive: boolean; // focus active state
  startQuickFocus: () => void;
}

export const StatusHubModal: React.FC<StatusHubModalProps> = ({
  visible,
  onClose,
  theme,
  isDark,
  language,
  t,
  insight,
  momentum,
  momentumColor,
  todayCompleted,
  dailyGoal,
  isActive,
  startQuickFocus,
}) => {
  const router = useRouter();
  const { panResponder, animatedStyle, prepare, slideIn } = useSwipeToDismiss({
    onDismiss: onClose,
  });

  // Prepare position when visibility changes to true
  useEffect(() => {
    if (visible) {
      prepare();
    }
  }, [visible, prepare]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      onShow={slideIn}
    >
      <View style={styles.overlay}>
        <Touchable
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={language === 'tr' ? 'Kapat' : 'Close'}
        />
        <Animated.View
          style={[
            animatedStyle,
            styles.sheet,
            {
              backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
              borderColor: theme.outlineVariant + '40',
            },
          ]}
        >
          {/* Drag Handle */}
          <View {...panResponder.panHandlers} style={styles.dragHandleContainer}>
            <View
              style={[
                styles.dragHandle,
                {
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.15)'
                    : 'rgba(0,0,0,0.12)',
                },
              ]}
            />
          </View>

          {/* Header */}
          <View style={styles.insightHeader}>
            <View style={[styles.insightIcon, { backgroundColor: theme.primary + '15' }]}>
              <BrainCircuit size={20} color={theme.primary} />
            </View>
            <Text style={[styles.insightHeaderTitle, { color: theme.onSurface }]}>
              TAZQ INSIGHTS
            </Text>
          </View>

          {/* Body */}
          <View style={styles.insightBody}>
            <View style={[styles.bentoMini, { backgroundColor: theme.surfaceContainerLow }]}>
              <Text style={[styles.insightMainText, { color: theme.onSurface }]}>
                {insight}
              </Text>
            </View>

            <View style={styles.insightStats}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={[styles.statBento, { backgroundColor: theme.surfaceContainerLow, flex: 1 }]}>
                  <Zap size={16} color={momentumColor} fill={momentumColor} />
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                    style={[styles.statValue, { color: theme.onSurface }]}
                  >
                    {momentum}%
                  </Text>
                  <Text style={[styles.statLabel, { color: theme.onSurfaceVariant }]}>
                    Momentum
                  </Text>
                </View>
                <View style={[styles.statBento, { backgroundColor: theme.surfaceContainerLow, flex: 1 }]}>
                  <Target size={16} color={theme.secondary} />
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                    style={[styles.statValue, { color: theme.onSurface }]}
                  >
                    {todayCompleted}/{dailyGoal}
                  </Text>
                  <Text style={[styles.statLabel, { color: theme.onSurfaceVariant }]}>
                    {t.cockpitTarget}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.cockpitActions}>
            <Touchable
              onPress={() => {
                if (isActive) {
                  onClose();
                  router.replace('/focus');
                } else {
                  startQuickFocus();
                }
              }}
              style={[
                styles.actionButtonMain,
                { backgroundColor: isActive ? theme.tertiary : theme.primary },
              ]}
            >
              <Play size={20} color={theme.onPrimary} fill={theme.onPrimary} />
              <Text style={[styles.actionButtonText, { color: theme.onPrimary }]}>
                {isActive
                  ? t.cockpitGoToFocus
                  : todayCompleted === 0
                  ? t.cockpitPrepTomorrow
                  : t.cockpitFocusNow}
              </Text>
            </Touchable>

            <Touchable
              onPress={onClose}
              style={[styles.actionButtonSecondary, { backgroundColor: theme.surfaceContainerHigh }]}
            >
              <Text style={[styles.actionButtonTextSecondary, { color: theme.onSurfaceVariant }]}>
                {t.cockpitClose}
              </Text>
            </Touchable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: B.thin,
    padding: scale(24),
    gap: scale(24),
  },
  dragHandleContainer: {
    paddingTop: 12,
    paddingBottom: 8,
    alignItems: 'center',
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
  },
  insightIcon: {
    width: scale(36),
    height: scale(36),
    borderRadius: R.sm + 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightHeaderTitle: {
    fontSize: moderateScale(13),
    fontWeight: '600',
    letterSpacing: 1,
    opacity: 0.6,
  },
  insightBody: {
    gap: scale(16),
  },
  bentoMini: {
    padding: scale(16),
    borderRadius: R.md + 4,
  },
  insightMainText: {
    fontSize: moderateScale(16),
    fontWeight: '600',
    lineHeight: verticalScale(24),
    letterSpacing: -0.3,
  },
  insightStats: {
    gap: scale(12),
  },
  statBento: {
    padding: scale(16),
    borderRadius: R.md + 4,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: moderateScale(18),
    fontWeight: '600',
  },
  statLabel: {
    fontSize: moderateScale(10),
    fontWeight: '500',
    opacity: 0.5,
    letterSpacing: 0.5,
  },
  cockpitActions: {
    gap: scale(12),
  },
  actionButtonMain: {
    height: verticalScale(60),
    borderRadius: R.md + 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(12),
  },
  actionButtonText: {
    fontSize: moderateScale(16),
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  actionButtonSecondary: {
    height: verticalScale(52),
    borderRadius: R.md + 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonTextSecondary: {
    fontSize: moderateScale(14),
    fontWeight: '600',
  },
});
