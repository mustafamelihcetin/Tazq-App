import React from 'react';
import { View, Text } from 'react-native';
import { MotiView } from 'moti';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react-native';
import { useAppTheme } from '../hooks/useAppTheme';
import { S, F } from '../constants/tokens';

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

  const warningColor = isDark ? '#FFB340' : '#FF9500';
  const accentColor = score >= 75 ? theme.tertiary : score >= 40 ? warningColor : theme.primary;

  // Week-over-week delta: yesterday vs 7 days ago
  const yesterday = history[5]?.score ?? -1;
  const weekAgo   = history[0]?.score ?? -1;
  const delta = (yesterday >= 0 && weekAgo >= 0) ? yesterday - weekAgo : null;

  const tr = language === 'tr';

  if (loading) return null;

  return (
    <View style={{ paddingHorizontal: S.lg, flexDirection: 'row', alignItems: 'center', gap: S.md, marginBottom: S.lg }}>

      {/* Score */}
      <MotiView
        from={{ opacity: 0, translateY: 4 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'spring', damping: 18 }}
      >
        <Text style={{ fontSize: 48, fontWeight: '900', letterSpacing: -3, color: accentColor, lineHeight: 52 }}>
          {score}
        </Text>
        <Text style={{ fontSize: 9, fontWeight: '900', letterSpacing: 1.5, color: accentColor, opacity: 0.5, marginTop: -2 }}>
          MOMENTUM
        </Text>
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
              : day.score >= 40 ? warningColor
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
  );
};
