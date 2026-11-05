import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, View, Text, TextInput, Modal, ScrollView, useWindowDimensions } from 'react-native';
import { MotiView } from 'moti';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { GlassSurface } from '@/shared/components/GlassSurface';
import { S, F, R, B, ICON, MIN_TOUCH, RSPRING, SCRIM } from '@/shared/constants/tokens';
import { AnimatedNumber } from '@/shared/components/AnimatedNumber';
import { useReducedMotion } from 'react-native-reanimated';
import { haptic } from '@/shared/utils/haptics';
import { useFocusSheetTheme } from '@/features/focus/hooks/useFocusSheetTheme';
import { WorldHero } from '@/features/focus/components/WorldStill';
import { SessionNotesReview } from '@/features/focus/components/SessionNotesReview';
import { useFocusStore } from '@/features/focus/store/useFocusStore';
import { lightsFor, sceneOf, LIGHT_NAMES, WORLD_RESULT } from '@/features/focus/utils/focusScenes';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { TASK_LIMITS } from '@/features/tasks/limits';

const CARD_MAX_W = 420;
const HERO_MAX_H = 240;
const HERO_SHARE = 0.3;
const PRIMARY_H = 52;
/** Sahnenin üstündeki yazı: sahne her temada koyu, renk temadan gelmez. */
const HERO_INK = '#FFFFFF';
const HERO_SHADOW = { textShadowColor: 'rgba(0,0,0,0.55)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 8 };

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
 *
 * ── 2026-11-05 SADELEŞTİ (kullanıcı: "ekrandan taştı, minimalist ve kaliteli olmalı") ──
 *  Üst üste 11 bölüm vardı. Artık: canlı sahne ve üstünde dakika, gün çubuğu, varsa görev sorusu, tek ana eylem, sessiz seçenekler.
 *  Kaldırılanlar: kutlama animasyonu (sahne o işi görüyor), koç metni, emoji puanlama (UI'da emoji yok; yükseklik yiyordu).
 */

type Lang = 'tr' | 'en';

const COPY = {
  tr: {
    lights: (n: number, l: { tr: string }) => `+${n} ${l.tr} topladın`,
    todayLabel: 'Bugün',
    goalDone: 'Günlük hedefin tamam ✦',
    taskQuestion: (title: string) => `“${title}” bitti mi?`,
    taskDone: 'Tamamlandı',
    taskLater: 'Devam edecek',
    taskMarked: '✓ Görev tamamlandı',
    extend: '+5 dk devam',
    breakBtn: (m: number) => `${m} dk Mola Başlat`,
    askName: 'Neye odaklandın?',
    addIdle: (n: number) => `Alarmdan sonra da sürdüyse +${n} dk ekle`,
    idleAdded: (n: number) => `+${n} dk eklendi`,
    breathe: '1 dk nefes al',
    sky: 'Gökyüzünde gör',
    min: 'dk',
  },
  en: {
    lights: (n: number, l: { en: string; enOne: string }) => `+${n} ${n === 1 ? l.enOne : l.en} collected`,
    todayLabel: 'Today',
    goalDone: 'Daily goal reached ✦',
    taskQuestion: (title: string) => `Is “${title}” done?`,
    taskDone: 'Completed',
    taskLater: 'Still going',
    taskMarked: '✓ Task completed',
    extend: '+5 min more',
    breakBtn: (m: number) => `Start ${m}-min Break`,
    askName: 'What did you focus on?',
    addIdle: (n: number) => `Kept going after the alarm? Add +${n} min`,
    idleAdded: (n: number) => `+${n} min added`,
    breathe: 'Breathe for 1 min',
    sky: 'See it in your sky',
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
    summaryBackHome: string; summaryNewSession: string;
  };
  onClose: () => void;
  onStartBreak: () => void;
  /** Pomodoro döngü sonunda yok: orada süren şey moladır. */
  onExtend?: () => void;
  /** Koşunun toplamı (+5 dk, Pomodoro turları). Verilmezse bu seans. */
  world?: { minutes: number; plannedMinutes: number } | null;
  /** Görevsiz seansa ad. Verilmezse sorulmaz. */
  onName?: (name: string) => void;
  /** Alarmın üstünden geçen dakika; 0 ise seçenek görünmez. */
  idleMinutes?: number;
  onAddIdle?: (minutes: number) => void;
  onNewSession: () => void;
  onHome: () => void;
  onCompleteTask: () => void;
  /** İki iş bloğu arası kısa nefes molası — ayrı nefes seansına götürür (madde 14). */
  onBreathe?: () => void;
  onOpenSky?: () => void;
}

export const SessionSummary: React.FC<SessionSummaryProps> = ({
  visible, minutes, completed, taskTitle, dailyMinutes, dailyGoal, breakMinutes,
  showBreak, language, t, onClose, onStartBreak, onExtend, onNewSession, onHome, onCompleteTask, onBreathe, onOpenSky, world, onName, idleMinutes = 0, onAddIdle,
}) => {
  // Zemin (GlassSurface) uygulama temasından gelir; renkler de oradan alınmalı.
  // Sahneyi izler: Kor'da biten seansın kapanışı da kor renginde (bkz. sceneSheetTheme).
  const { theme } = useFocusSheetTheme();
  const sceneId = usePrefsStore((st) => st.focusScene);
  const sessionPlanned = useFocusStore((st) => st.totalSeconds) / 60;
  const [added, setAdded] = useState(0);
  const [name, setName] = useState('');
  const nameRef = useRef('');
  const hasOwnName = useFocusStore((st) => !!st.currentTask.trim());
  const askName = !!onName && !taskTitle && !hasOwnName;
  const totalMinutes = (world?.minutes ?? minutes) + added;
  const plannedMinutes = world?.plannedMinutes ?? sessionPlanned;
  const [taskAnswered, setTaskAnswered] = useState<'done' | 'later' | null>(null);
  // Pencere kapalıyken de bağlı kalıyor: her yeni seansta soru ve puanlama sıfırlanmalı,
  // yoksa ikinci seansın özeti birincinin yanıtlarını gösterir.
  useEffect(() => {
    if (!visible) {
      // Klavye açıkken düğmeye basılsa da yazılan kaybolmaz.
      if (nameRef.current.trim()) onName?.(nameRef.current);
      nameRef.current = '';
      return;
    }
    setTaskAnswered(null);
    setAdded(0);
    setName('');
  }, [visible]);

  const c = COPY[language];
  const goalPct = dailyGoal > 0 ? Math.min(1, dailyMinutes / dailyGoal) : 0;
  const prevPct = dailyGoal > 0 ? Math.min(1, Math.max(0, dailyMinutes - minutes) / dailyGoal) : 0;
  const reduceMotion = useReducedMotion();
  const { height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scene = sceneOf(sceneId);
  const pct = plannedMinutes > 0 ? Math.round(Math.min(1, totalMinutes / plannedMinutes) * 100) : 100;
  const collected = lightsFor(totalMinutes);

  const quiet = [
    ...(onExtend ? [{ key: 'extend', label: c.extend, onPress: onExtend }] : []),
    ...(completed && onBreathe ? [{ key: 'breathe', label: c.breathe, onPress: onBreathe }] : []),
    { key: 'new', label: t.summaryNewSession, onPress: onNewSession },
  ];

  return (
    <Modal supportedOrientations={['portrait', 'landscape']} visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: SCRIM, alignItems: 'center', justifyContent: 'center', paddingHorizontal: S.lg, paddingTop: insets.top + S.sm, paddingBottom: insets.bottom + S.sm }}>
        <MotiView
          from={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', ...RSPRING.snappy }}
          style={{ width: '100%', maxWidth: CARD_MAX_W, maxHeight: '100%', borderRadius: R.sheet, overflow: 'hidden' }}
        >
          <GlassSurface radius={R.sheet} />
          {/* Küçük ekranda ve uzun görev adında taşmaz: içerik kayar, pencere ekranda kalır. */}
          <ScrollView bounces={false} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {visible && (
              <WorldHero sceneId={sceneId} minutes={totalMinutes} plannedMinutes={plannedMinutes} height={Math.min(HERO_MAX_H, screenH * HERO_SHARE)}>
                <View accessible accessibilityLabel={`${totalMinutes} ${t.summaryMinFocused}. ${WORLD_RESULT[language][scene.id](pct)}`} style={{ alignItems: 'center', paddingHorizontal: S.lg }}>
                  <Text numberOfLines={1} style={[HERO_SHADOW, { fontSize: F.footnote, fontWeight: '600', color: HERO_INK }]}>{completed ? t.summaryGreatWork : t.summaryGoodStart}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: S.xs }}>
                    {/* Dakika sayarak gelir: emeğin karşılığı toplanarak görünür. */}
                    <AnimatedNumber key={visible ? 'on' : 'off'} value={totalMinutes} from={0} duration={reduceMotion ? 0 : 900} style={[HERO_SHADOW, { fontSize: 56, fontWeight: '700', color: HERO_INK, letterSpacing: -2, lineHeight: 62 }]} />
                    <Text style={[HERO_SHADOW, { fontSize: F.subhead, fontWeight: '600', color: HERO_INK }]}>{t.summaryMinFocused}</Text>
                  </View>
                  <Text numberOfLines={1} adjustsFontSizeToFit style={[HERO_SHADOW, { fontSize: F.footnote, color: HERO_INK }]}>{WORLD_RESULT[language][scene.id](pct)}</Text>
                </View>
              </WorldHero>
            )}

            <View style={{ padding: S.lg, gap: S.md }}>
              {/* Bugün + bu seansın topladıkları: tek blok, kutusuz. */}
              <View style={{ gap: S.xs }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: F.caption, fontWeight: '600', color: theme.onSurfaceVariant }}>{c.todayLabel}</Text>
                  <Text style={{ fontSize: F.caption, fontWeight: '600', color: goalPct >= 1 ? theme.primary : theme.onSurfaceVariant }}>
                    {goalPct >= 1 ? c.goalDone : `${dailyMinutes} / ${dailyGoal} ${c.min}`}
                  </Text>
                </View>
                <View style={{ height: 4, borderRadius: R.xs, backgroundColor: theme.onSurface + '14', overflow: 'hidden' }}>
                  {/* Seans öncesinden başlayıp dolar: bu seansın güne kattığı pay gözle görülür. */}
                  <MotiView
                    key={visible ? 'on' : 'off'}
                    from={{ width: `${Math.round(prevPct * 100)}%` }}
                    animate={{ width: `${Math.round(goalPct * 100)}%` }}
                    transition={reduceMotion ? { type: 'timing', duration: 0 } : { type: 'timing', duration: 700, delay: 250 }}
                    style={{ height: '100%', borderRadius: R.xs, backgroundColor: goalPct >= 1 ? theme.tertiary : theme.primary }}
                  />
                </View>
                {collected > 0 && (
                  onOpenSky ? (
                    <Touchable accessibilityRole="button" onPress={onOpenSky} hitSlop={8} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: S.xxs }}>
                      <Text style={{ fontSize: F.caption, fontWeight: '600', color: theme.onSurfaceVariant }}>{c.lights(collected, LIGHT_NAMES[scene.id])}</Text>
                      <Text style={{ fontSize: F.caption, fontWeight: '600', color: scene.stars[1] }}>{c.sky}</Text>
                    </Touchable>
                  ) : <Text style={{ fontSize: F.caption, fontWeight: '600', color: theme.onSurfaceVariant, paddingTop: S.xxs }}>{c.lights(collected, LIGHT_NAMES[scene.id])}</Text>
                )}
              </View>

              {/* Bağlı görev: seansın sonucu göreve de işlensin. */}
              {taskTitle ? (
                taskAnswered === 'done' ? (
                  <Text style={{ fontSize: F.footnote, fontWeight: '700', color: theme.primary }}>{c.taskMarked}</Text>
                ) : taskAnswered === 'later' ? null : (
                  <View style={{ gap: S.sm }}>
                    <Text numberOfLines={2} style={{ fontSize: F.footnote, fontWeight: '600', color: theme.onSurface }}>{c.taskQuestion(taskTitle)}</Text>
                    <View style={{ flexDirection: 'row', gap: S.sm }}>
                      <Touchable
                        accessibilityRole="button"
                        accessibilityLabel={c.taskDone}
                        onPress={() => { haptic.success(); setTaskAnswered('done'); onCompleteTask(); }}
                        style={{ flex: 1, flexDirection: 'row', minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center', gap: S.xs, borderRadius: R.full, backgroundColor: theme.onSurface + '14' }}
                      >
                        <Check size={ICON.sm} color={theme.onSurface} strokeWidth={2.4} />
                        <Text style={{ fontSize: F.footnote, fontWeight: '600', color: theme.onSurface }}>{c.taskDone}</Text>
                      </Touchable>
                      <Touchable
                        accessibilityRole="button"
                        accessibilityLabel={c.taskLater}
                        onPress={() => setTaskAnswered('later')}
                        style={{ flex: 1, minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center', borderRadius: R.full, borderWidth: B.thin, borderColor: theme.onSurface + '26' }}
                      >
                        <Text style={{ fontSize: F.footnote, fontWeight: '600', color: theme.onSurfaceVariant }}>{c.taskLater}</Text>
                      </Touchable>
                    </View>
                  </View>
                )
              ) : null}

              <SessionNotesReview language={language} />

              {/* Görevsiz seans: tek satır, boş geçilebilir. Görev sorusuyla aynı anda çıkmaz. */}
              {askName && (
                <TextInput
                  value={name}
                  onChangeText={(v) => { setName(v); nameRef.current = v; }}
                  onEndEditing={() => { if (nameRef.current.trim()) { onName?.(nameRef.current); nameRef.current = ''; } }}
                  placeholder={c.askName}
                  placeholderTextColor={theme.onSurfaceMuted}
                  accessibilityLabel={c.askName}
                  maxLength={TASK_LIMITS.title}
                  returnKeyType="done"
                  style={{ minHeight: MIN_TOUCH, paddingHorizontal: S.md, borderRadius: R.md, fontSize: F.footnote, color: theme.onSurface, backgroundColor: theme.onSurface + '0D' }}
                />
              )}

              {/* Alarmdan sonra da sürdüyse: varsayılan eklemez, karar kullanıcının. */}
              {added > 0 ? (
                <Text style={{ fontSize: F.footnote, fontWeight: '600', color: theme.primary, textAlign: 'center' }}>{c.idleAdded(added)}</Text>
              ) : idleMinutes > 0 && onAddIdle ? (
                <Touchable accessibilityRole="button" onPress={() => { setAdded(idleMinutes); onAddIdle(idleMinutes); }} style={{ minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' }}>
                  <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: F.footnote, fontWeight: '600', color: theme.onSurfaceVariant }}>{c.addIdle(idleMinutes)}</Text>
                </Touchable>
              ) : null}

              {/* Tek ana eylem: öneri mola; mola yoksa ana sayfa. */}
              <View style={{ flexDirection: 'row', gap: S.sm }}>
                {showBreak && (
                  <Touchable accessibilityRole="button" accessibilityLabel={c.breakBtn(breakMinutes)} onPress={onStartBreak} style={{ flex: 1, minHeight: PRIMARY_H, borderRadius: R.full, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' }}>
                    <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: F.subhead, fontWeight: '700', color: theme.onPrimary }}>{c.breakBtn(breakMinutes)}</Text>
                  </Touchable>
                )}
                <Touchable accessibilityRole="button" accessibilityLabel={t.summaryBackHome} onPress={onHome} style={{ flex: 1, minHeight: PRIMARY_H, borderRadius: R.full, backgroundColor: showBreak ? theme.onSurface + '14' : theme.primary, alignItems: 'center', justifyContent: 'center' }}>
                  <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: F.subhead, fontWeight: showBreak ? '600' : '700', color: showBreak ? theme.onSurface : theme.onPrimary }}>{t.summaryBackHome}</Text>
                </Touchable>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
                {quiet.map((q) => (
                  <Touchable key={q.key} accessibilityRole="button" accessibilityLabel={q.label} onPress={q.onPress} style={{ flex: 1, minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center', paddingHorizontal: S.xxs }}>
                    <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: F.footnote, fontWeight: '600', color: theme.onSurfaceVariant }}>{q.label}</Text>
                  </Touchable>
                ))}
              </View>
            </View>
          </ScrollView>
        </MotiView>
      </KeyboardAvoidingView>
    </Modal>
  );
};
