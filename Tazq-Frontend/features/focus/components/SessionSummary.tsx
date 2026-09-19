import React, { useEffect, useState } from 'react';
import { View, Text, Modal } from 'react-native';
import { MotiView } from 'moti';
import { CheckCircle2, Sparkles, Check, Clock } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { GlassSurface } from '@/shared/components/GlassSurface';
import { Separator } from '@/shared/components/Separator';
import { S, F, R, B, ICON } from '@/shared/constants/tokens';
import { track } from '@/shared/utils/analytics';
import { haptic } from '@/shared/utils/haptics';
import { useAppTheme } from '@/shared/hooks/useAppTheme';

/**
 * SEANS ÖZETİ — seans bittiğinde ne oldu, şimdi ne var?
 *
 * ── NEDEN AYRI DOSYA ───────────────────────────────────────────────────────
 * Odak ekranı 2600 satırdı ve özet penceresi onun içinde gömülüydü; bir düğme
 * eklemek bile sayaç/shader kodunun arasına girmeyi gerektiriyordu.
 *
 * ── NE EKLENDİ ─────────────────────────────────────────────────────────────
 *  · BAĞLI GÖREV SORUSU. Seans bir göreve bağlıysa "bitti mi?" diye sorulur.
 *    Eskiden bağ hiçbir sonuca bağlanmıyordu: kullanıcı görevi ayrıca bulup
 *    tamamlamak zorundaydı, çoğu da unutuyordu.
 *  · GÜNLÜK HEDEF. Uygulamada bir günlük odak hedefi vardı ama odak ekranında
 *    hiç görünmüyordu — seans bitince "bugün nerede duruyorum" sorusunun
 *    yanıtlanacağı tek an burası.
 *  · +5 DK. "Biraz daha" demek için yeni süre seçip baştan başlatmak gerekiyordu.
 */

type Lang = 'tr' | 'en';

const COPY = {
  tr: {
    todayLabel: 'Bugün',
    goalDone: 'Günlük hedefin tamam ✦',
    taskQuestion: (title: string) => `“${title}” bitti mi?`,
    taskDone: 'Tamamlandı',
    taskLater: 'Devam edecek',
    taskMarked: '✓ Görev tamamlandı',
    extend: '+5 dk devam',
    rating: 'BU SEANS NASIL GEÇTİ?',
    thanks: 'Geri bildiriminiz kaydedildi, teşekkürler!',
    breakBtn: (m: number) => `${m} dk Mola Başlat`,
    min: 'dk',
  },
  en: {
    todayLabel: 'Today',
    goalDone: 'Daily goal reached ✦',
    taskQuestion: (title: string) => `Is “${title}” done?`,
    taskDone: 'Completed',
    taskLater: 'Still going',
    taskMarked: '✓ Task completed',
    extend: '+5 min more',
    rating: 'HOW WAS THIS SESSION?',
    thanks: 'Feedback recorded, thank you!',
    breakBtn: (m: number) => `Start ${m}-min Break`,
    min: 'min',
  },
};

export interface SessionSummaryProps {
  visible: boolean;
  minutes: number;
  completed: boolean;
  /** Seansa bağlı görev — yoksa soru sorulmaz. */
  taskTitle: string | null;
  dailyMinutes: number;
  dailyGoal: number;
  breakMinutes: number;
  showBreak: boolean;
  language: Lang;
  /** Sözlükten YALNIZ burada kullanılan anahtarlar (bkz. shared/constants/i18n). */
  t: {
    summaryGreatWork: string; summaryGoodStart: string; summaryMinFocused: string;
    summaryCoachCompleted: string; summaryCoachGoodStart: string; summaryBreakSuggestion: string;
    summaryBackHome: string; summaryNewSession: string;
  };
  onClose: () => void;
  onStartBreak: () => void;
  onExtend: () => void;
  onNewSession: () => void;
  onHome: () => void;
  onCompleteTask: () => void;
}

export const SessionSummary: React.FC<SessionSummaryProps> = ({
  visible, minutes, completed, taskTitle, dailyMinutes, dailyGoal, breakMinutes,
  showBreak, language, t, onClose, onStartBreak, onExtend, onNewSession, onHome, onCompleteTask,
}) => {
  // Zemin (GlassSurface) uygulama temasından gelir; renkler de oradan alınmalı.
  const { theme } = useAppTheme();
  const [userRating, setUserRating] = useState<number | null>(null);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [taskAnswered, setTaskAnswered] = useState<'done' | 'later' | null>(null);
  // Pencere kapalıyken de bağlı kalıyor: her yeni seansta soru ve puanlama sıfırlanmalı,
  // yoksa ikinci seansın özeti birincinin yanıtlarını gösterir.
  useEffect(() => {
    if (!visible) return;
    setUserRating(null);
    setRatingSubmitted(false);
    setTaskAnswered(null);
  }, [visible]);

  const c = COPY[language];
  const goalPct = dailyGoal > 0 ? Math.min(1, dailyMinutes / dailyGoal) : 0;
  const accent = completed ? theme.primary : theme.secondary;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: S.xl }}>
        <MotiView
          from={{ opacity: 0, scale: 0.88 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', damping: 18, stiffness: 280 }}
          style={{ width: '100%', borderRadius: R.sheet, padding: S.xl, alignItems: 'center', gap: S.md }}
        >
          <GlassSurface radius={R.sheet} />
          <MotiView
            from={{ scale: 0.8, opacity: 0, rotate: '-10deg' }}
            animate={{ scale: 1, opacity: 1, rotate: '0deg' }}
            transition={{ type: 'spring', damping: 15, stiffness: 250, delay: 100 }}
            style={{
              width: 72, height: 72, borderRadius: R.full,
              backgroundColor: completed ? theme.primaryContainer : theme.secondaryContainer,
              alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
            }}
          >
            {completed
              ? <CheckCircle2 size={ICON.xl} color={theme.primary} strokeWidth={2.2} />
              : <Sparkles size={ICON.xl} color={theme.secondary} strokeWidth={2.2} />}
          </MotiView>

          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ fontSize: F.title, fontWeight: '700', color: theme.onSurface, letterSpacing: -0.5, textAlign: 'center' }}>
            {completed ? t.summaryGreatWork : t.summaryGoodStart}
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: S.xs }}>
            <Text style={{ fontSize: 52, fontWeight: '700', color: theme.primary, letterSpacing: -2, lineHeight: 56 }}>
              {minutes}
            </Text>
            <Text style={{ fontSize: F.subhead, fontWeight: '700', color: theme.onSurfaceVariant, marginBottom: S.xs }}>
              {t.summaryMinFocused}
            </Text>
          </View>

          {/* Günlük hedef — "bugün nerede duruyorum" sorusunun yanıtı */}
          <View style={{ width: '100%', gap: S.xs }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: F.caption, fontWeight: '700', color: theme.onSurfaceVariant }}>{c.todayLabel}</Text>
              <Text style={{ fontSize: F.caption, fontWeight: '700', color: goalPct >= 1 ? theme.primary : theme.onSurfaceVariant }}>
                {goalPct >= 1 ? c.goalDone : `${dailyMinutes} / ${dailyGoal} ${c.min}`}
              </Text>
            </View>
            <View style={{ height: 6, borderRadius: R.xs, backgroundColor: theme.onSurface + '14', overflow: 'hidden' }}>
              <View style={{ width: `${Math.round(goalPct * 100)}%`, height: '100%', borderRadius: R.xs, backgroundColor: theme.primary }} />
            </View>
          </View>

          {/* Bağlı görev — seansın sonucu göreve de işlensin */}
          {taskTitle ? (
            <View style={{ width: '100%', backgroundColor: theme.onSurface + '0D', borderRadius: R.md, padding: S.md, gap: S.sm }}>
              {taskAnswered === 'done' ? (
                <Text style={{ fontSize: F.body, fontWeight: '700', color: theme.primary }}>{c.taskMarked}</Text>
              ) : taskAnswered === 'later' ? (
                <Text numberOfLines={2} style={{ fontSize: F.caption, fontWeight: '600', color: theme.onSurfaceMuted }}>{taskTitle}</Text>
              ) : (
                <>
                  <Text numberOfLines={2} style={{ fontSize: F.body, fontWeight: '700', color: theme.onSurface }}>
                    {c.taskQuestion(taskTitle)}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: S.sm }}>
                    <Touchable
                      accessibilityRole="button"
                      accessibilityLabel={c.taskDone}
                      onPress={() => { haptic.success(); setTaskAnswered('done'); onCompleteTask(); }}
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, paddingVertical: S.sm, borderRadius: R.full, backgroundColor: theme.primary }}
                    >
                      <Check size={ICON.sm} color={theme.onPrimary} strokeWidth={2.4} />
                      <Text style={{ fontSize: F.footnote, fontWeight: '700', color: theme.onPrimary }}>{c.taskDone}</Text>
                    </Touchable>
                    <Touchable
                      accessibilityRole="button"
                      accessibilityLabel={c.taskLater}
                      onPress={() => setTaskAnswered('later')}
                      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: S.sm, borderRadius: R.full, borderWidth: B.thin, borderColor: theme.onSurface + '26' }}
                    >
                      <Text style={{ fontSize: F.footnote, fontWeight: '700', color: theme.onSurfaceVariant }}>{c.taskLater}</Text>
                    </Touchable>
                  </View>
                </>
              )}
            </View>
          ) : null}

          <View style={{ width: '100%', backgroundColor: (completed ? theme.primaryContainer : theme.secondaryContainer) + '60', borderRadius: R.md, padding: S.md, gap: S.xs }}>
            <Text style={{ fontSize: F.body, fontWeight: '700', color: accent, lineHeight: 20 }}>
              {completed ? t.summaryCoachCompleted : t.summaryCoachGoodStart}
            </Text>
            {completed && (
              <Text style={{ fontSize: F.caption, fontWeight: '600', color: theme.onSurfaceMuted }}>
                {t.summaryBreakSuggestion}
              </Text>
            )}
          </View>

          <View style={{ width: '100%', alignItems: 'center', marginVertical: S.xs }}>
            {!ratingSubmitted ? (
              <>
                <Text style={{ fontSize: F.caption, fontWeight: '700', color: theme.onSurfaceVariant, letterSpacing: 0.5, marginBottom: S.xs }}>
                  {c.rating}
                </Text>
                <View style={{ flexDirection: 'row', gap: S.sm }}>
                  {[1, 2, 3, 4, 5].map((num) => {
                    const emojis = ['😫', '😕', '😐', '🙂', '🤩'];
                    const isSelected = userRating === num;
                    return (
                      <Touchable
                        key={num}
                        accessibilityRole="button"
                        accessibilityLabel={`${num}/5`}
                        hitSlop={{ top: 3, bottom: 3, left: 3, right: 3 }}
                        onPress={() => {
                          setUserRating(num);
                          track('ux_rating_submitted', { score: num, type: 'CES_focus' });
                          setRatingSubmitted(true);
                        }}
                        style={{
                          width: 38, height: 38, borderRadius: R.full,
                          backgroundColor: isSelected ? theme.primary + '20' : 'transparent',
                          justifyContent: 'center', alignItems: 'center',
                          borderWidth: 1, borderColor: isSelected ? theme.primary : 'transparent',
                        }}
                      >
                        <Text style={{ fontSize: F.title3 }}>{emojis[num - 1]}</Text>
                      </Touchable>
                    );
                  })}
                </View>
              </>
            ) : (
              <Text style={{ fontSize: F.caption2, fontWeight: '600', color: theme.tertiary, letterSpacing: 0.2 }}>
                ✦ {c.thanks} ✦
              </Text>
            )}
          </View>

          <Separator theme={theme} spacing={S.xs} />

          <View style={{ width: '100%', flexDirection: 'row', gap: S.sm }}>
            {showBreak && (
              <Touchable
                accessibilityRole="button"
                accessibilityLabel={c.breakBtn(breakMinutes)}
                onPress={onStartBreak}
                style={{ flex: 1, paddingVertical: S.sm, borderRadius: R.full, borderWidth: B.thin, borderColor: theme.tertiary + '50', backgroundColor: theme.tertiary + '12', alignItems: 'center', justifyContent: 'center' }}
              >
                <Text numberOfLines={1} style={{ fontSize: F.footnote, fontWeight: '700', color: theme.tertiary }}>
                  {c.breakBtn(breakMinutes)}
                </Text>
              </Touchable>
            )}
            <Touchable
              accessibilityRole="button"
              accessibilityLabel={c.extend}
              onPress={onExtend}
              style={{ flex: 1, flexDirection: 'row', gap: S.xs, paddingVertical: S.sm, borderRadius: R.full, borderWidth: B.thin, borderColor: theme.primary + '50', backgroundColor: theme.primary + '12', alignItems: 'center', justifyContent: 'center' }}
            >
              <Clock size={ICON.xs} color={theme.primary} />
              <Text numberOfLines={1} style={{ fontSize: F.footnote, fontWeight: '700', color: theme.primary }}>{c.extend}</Text>
            </Touchable>
          </View>

          <Touchable
            accessibilityRole="button"
            accessibilityLabel={t.summaryBackHome}
            onPress={onHome}
            style={{ width: '100%', paddingVertical: S.md, borderRadius: R.full, backgroundColor: theme.primary, alignItems: 'center' }}
          >
            <Text style={{ fontSize: F.subhead, fontWeight: '700', color: theme.onPrimary, letterSpacing: 0.5 }}>
              {t.summaryBackHome}
            </Text>
          </Touchable>

          <Touchable accessibilityRole="button" accessibilityLabel={t.summaryNewSession} onPress={onNewSession} style={{ paddingVertical: S.sm }}>
            <Text style={{ fontSize: F.body, fontWeight: '700', color: theme.onSurfaceMuted }}>
              {t.summaryNewSession}
            </Text>
          </Touchable>
        </MotiView>
      </View>
    </Modal>
  );
};
