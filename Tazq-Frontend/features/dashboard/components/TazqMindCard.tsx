import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MotiView, AnimatePresence } from 'moti';
import { CalendarClock, CheckCircle2, Wind, Sparkles } from 'lucide-react-native';
import { TazqLogo } from '@/shared/components/TazqLogo';
import { BentoCard } from '@/shared/components/BentoCard';
import { Touchable } from '@/shared/components/Touchable';
import { F, S, W, ICON, LH, trackingFor } from '@/shared/constants/tokens';
import type { AppTheme } from '@/shared/constants/Colors';
import { Task } from '@/features/tasks/store/useTaskStore';

export interface TazqMindCardProps {
  overdueCount: number;
  suggestedTasks: Task[];
  onOptimize: () => void;
  onUndo?: () => void;
  theme: AppTheme;
  tr: boolean;
}

export const TazqMindCard = React.memo<TazqMindCardProps>(
  ({ overdueCount, suggestedTasks, onOptimize, onUndo, theme, tr }) => {
    const [optimized, setOptimized] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

    const handleOptimize = () => {
      onOptimize();
      setOptimized(true);
      
      timeoutRef.current = setTimeout(() => {
        setDismissed(true);
      }, 4000);
    };

    const handleUndo = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (onUndo) onUndo();
      setOptimized(false);
    };

    React.useEffect(() => {
      return () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      };
    }, []);

    if (dismissed) return null;

    if (optimized) {
      return (
        <MotiView
          from={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          style={styles.wrap}
        >
          <BentoCard index={0} style={[styles.card, { backgroundColor: theme.surfaceContainerLowest }]}>
            <View style={styles.successRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }}>
                <CheckCircle2 size={ICON.md} color={theme.tertiary} />
                <Text style={[styles.successText, { color: theme.onSurface, flex: 1 }]}>
                  {tr ? 'Derin bir nefes. Denge sağlandı.' : 'Deep breath. Balance restored.'}
                </Text>
              </View>
              
              <Touchable onPress={handleUndo} style={styles.undoBtn}>
                <Text style={[styles.undoText, { color: theme.tertiary }]}>
                  {tr ? 'Geri Al' : 'Undo'}
                </Text>
              </Touchable>
            </View>
          </BentoCard>
        </MotiView>
      );
    }

    if (overdueCount < 3) return null;

    return (
      <AnimatePresence>
        <MotiView
          from={{ opacity: 0, translateY: -10 }}
          animate={{ opacity: 1, translateY: 0 }}
          exit={{ opacity: 0, translateY: -10 }}
          transition={{ type: 'spring', damping: 14 }}
          style={styles.wrap}
        >
          <BentoCard 
            index={0} 
            style={[
              styles.card, 
              { 
                backgroundColor: theme.tertiary + '0A',
                borderColor: theme.tertiary + '15',
                borderWidth: 1,
              }
            ]}
          >
            {/* Su markası (Watermark) arka plan efekti */}
            <View style={styles.watermark}>
              <Wind size={140} color={theme.tertiary} opacity={0.06} strokeWidth={1} />
            </View>

            <View style={styles.contentWrap}>
              <View style={styles.eyebrowRow}>
                <Sparkles size={14} color={theme.tertiary} />
                <View style={{ marginLeft: 2 }}>
                  <TazqLogo height={16} />
                </View>
                <Text style={[styles.eyebrowText, { color: theme.tertiary }]}>Zen</Text>
              </View>
              
              <Text style={[styles.headline, { color: theme.onSurface }]}>
                {tr ? 'Dengeye Dönme Vakti' : 'Time to Rebalance'}
              </Text>

              <Text style={[styles.body, { color: theme.onSurfaceMuted }]}>
                {tr
                  ? `Geçmişten sarkan ${overdueCount} görev birikti. Bugüne temiz ve ferah bir başlangıç yapmak ister misin?`
                  : `You have ${overdueCount} overdue tasks. Would you like to clear your schedule and start fresh today?`}
              </Text>
            </View>

            <View style={styles.actions}>
              <Touchable onPress={() => setDismissed(true)} style={styles.dismissButton}>
                <Text style={[styles.dismissText, { color: theme.onSurfaceMuted }]}>
                  {tr ? 'Ben hallederim' : 'I got this'}
                </Text>
              </Touchable>

              <Touchable onPress={handleOptimize} style={[styles.button, { backgroundColor: theme.tertiary }]}>
                <CalendarClock size={ICON.sm} color={theme.onTertiary} />
                <Text style={[styles.buttonText, { color: theme.onTertiary }]}>
                  {tr ? 'Dengele' : 'Rebalance'}
                </Text>
              </Touchable>
            </View>
          </BentoCard>
        </MotiView>
      </AnimatePresence>
    );
  }
);

TazqMindCard.displayName = 'TazqMindCard';

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: S.lg,
    marginBottom: S.lg,
  },
  card: {
    padding: S.lg,
    overflow: 'hidden',
  },
  watermark: {
    position: 'absolute',
    right: -20,
    bottom: -20,
    transform: [{ rotate: '-15deg' }],
  },
  contentWrap: {
    alignItems: 'flex-start',
    marginBottom: S.md,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: S.sm,
    backgroundColor: 'rgba(255,255,255,0.0)',
  },
  eyebrowText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginLeft: -10,
  },
  headline: {
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.5,
    marginBottom: S.xs,
  },
  body: {
    fontSize: F.callout,
    lineHeight: F.callout * LH.relaxed,
    textAlign: 'left',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: S.md,
  },
  dismissButton: {
    paddingHorizontal: S.sm,
    paddingVertical: S.sm,
  },
  dismissText: {
    fontSize: 14,
    fontWeight: '500',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.xs,
    paddingVertical: S.sm,
    paddingHorizontal: S.md,
    borderRadius: S.xl,
  },
  buttonText: {
    fontSize: F.footnote,
    fontWeight: W.semibold,
  },
  successRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  successText: {
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  undoBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 8,
  },
  undoText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
