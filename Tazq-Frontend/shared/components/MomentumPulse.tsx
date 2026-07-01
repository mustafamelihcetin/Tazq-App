import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { MotiView } from 'moti';
import { TrendingUp, TrendingDown, Minus, CheckCircle2, Zap, Flame } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { S, F, R } from '@/shared/constants/tokens';
import { Touchable } from '@/shared/components/Touchable';

interface DayScore { date: string; score: number }

interface Props {
  score: number;
  history: DayScore[];
  language: string;
  loading?: boolean;
}

export const MomentumPulse: React.FC<Props> = ({ score, history, language, loading }) => {
  const { theme, colorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';
  const [infoVisible, setInfoVisible] = useState(false);

  const accentColor = score >= 75 ? theme.tertiary : score >= 40 ? theme.warning : theme.primary;

  // Week-over-week delta: yesterday vs 7 days ago
  const yesterday = history[5]?.score ?? -1;
  const weekAgo   = history[0]?.score ?? -1;
  const delta = (yesterday >= 0 && weekAgo >= 0) ? yesterday - weekAgo : null;

  const tr = language === 'tr';

  if (loading) return null;

  return (
    <>
    <View style={{ paddingHorizontal: S.lg, flexDirection: 'row', alignItems: 'center', gap: S.md, marginBottom: S.lg }}>

      {/* Score + info */}
      <MotiView
        from={{ opacity: 0, translateY: 4 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'spring', damping: 18 }}
      >
        <Text style={{ fontSize: 48, fontWeight: '900', letterSpacing: -3, color: accentColor, lineHeight: 52 }}>
          {score}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: -2 }}>
          <Text style={{ fontSize: 9, fontWeight: '900', letterSpacing: 1.5, color: accentColor, opacity: 0.5 }}>
            MOMENTUM
          </Text>
          <Touchable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setInfoVisible(true); }}
            style={{ width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: accentColor + '22' }}
          >
            <Text style={{ fontSize: 9, fontWeight: '900', color: accentColor }}>ⓘ</Text>
          </Touchable>
        </View>
      </MotiView>

      {/* Divider */}
      <View style={{ width: 1, height: 36, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)' }} />

      {/* Sparkline */}
      <View style={{ flex: 1, gap: 5 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 24 }}>
          {history.map((day, i) => {
            const has = day.score >= 0;
            const isToday = i === 6;
            const h = has ? Math.max(3, Math.round((day.score / 100) * 24)) : 3;
            const barColor = !has
              ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)')
              : day.score >= 75 ? theme.tertiary
              : day.score >= 40 ? theme.warning
              : theme.primary;
            return (
              <MotiView
                key={day.date}
                from={{ height: 0 }}
                animate={{ height: h }}
                transition={{ type: 'spring', damping: 16, delay: i * 35 }}
                style={{
                  flex: 1,
                  borderRadius: 3,
                  backgroundColor: barColor,
                  opacity: isToday ? 1 : 0.45,
                }}
              />
            );
          })}
        </View>
        <Text style={{ fontSize: 9, fontWeight: '700', color: theme.onSurfaceVariant, opacity: 0.4, letterSpacing: 0.3 }}>
          {tr ? 'son 7 gün' : 'last 7 days'}
        </Text>
      </View>

      {/* Trend */}
      {delta !== null && (
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 300 }}
          style={{ alignItems: 'center', gap: 3 }}
        >
          {delta > 0
            ? <TrendingUp size={14} color={theme.tertiary} strokeWidth={2.5} />
            : delta < 0
            ? <TrendingDown size={14} color={theme.error} strokeWidth={2.5} />
            : <Minus size={14} color={theme.onSurfaceVariant} strokeWidth={2.5} />}
          <Text style={{
            fontSize: 11,
            fontWeight: '800',
            color: delta > 0 ? theme.tertiary : delta < 0 ? theme.error : theme.onSurfaceVariant,
            opacity: delta === 0 ? 0.4 : 1,
          }}>
            {delta > 0 ? `+${delta}` : delta}
          </Text>
        </MotiView>
      )}
    </View>

    {/* Momentum formula info modal */}
    <Modal visible={infoVisible} transparent animationType="fade" onRequestClose={() => setInfoVisible(false)}>
      <Touchable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 32 }} activeOpacity={1} onPress={() => setInfoVisible(false)}>
        <MotiView
          from={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 18 }}
          style={{ backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderRadius: 24, padding: 24, width: '100%', gap: 14 }}
        >
          <Text style={{ fontSize: 16, fontWeight: '900', color: accentColor, letterSpacing: -0.5 }}>
            {tr ? 'Momentum Nasıl Hesaplanır?' : 'How is Momentum Calculated?'}
          </Text>
          <Text style={{ fontSize: 13, fontWeight: '500', color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)', lineHeight: 20 }}>
            {tr
              ? 'Momentum, takip etmen gereken tek skor. Görevlerin, odağın ve serin bir araya gelip onu besler:'
              : 'Momentum is the one score to watch. Your tasks, focus, and streak come together to feed it:'}
          </Text>
          {[
            { icon: <CheckCircle2 size={16} color={theme.success} />, label: tr ? 'Görev Tamamlama' : 'Task Completion', pct: '40%', color: theme.success },
            { icon: <Zap size={16} color={accentColor} />, label: tr ? 'Odak Süresi' : 'Focus Time', pct: '35%', color: accentColor },
            { icon: <Flame size={16} color={theme.streak} />, label: tr ? 'Günlük Seri' : 'Daily Streak', pct: '25%', color: theme.streak },
          ].map((row) => (
            <View key={row.label} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {row.icon}
                <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.8)' }}>{row.label}</Text>
              </View>
              <Text style={{ fontSize: 14, fontWeight: '900', color: row.color }}>{row.pct}</Text>
            </View>
          ))}
          <Touchable onPress={() => setInfoVisible(false)} style={{ backgroundColor: accentColor, borderRadius: 14, paddingVertical: 12, alignItems: 'center', marginTop: 4 }}>
            <Text style={{ fontSize: 14, fontWeight: '900', color: '#fff' }}>{tr ? 'Anladım' : 'Got it'}</Text>
          </Touchable>
        </MotiView>
      </Touchable>
    </Modal>
    </>
  );
};
