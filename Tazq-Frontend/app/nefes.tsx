import React, { useEffect, useState } from 'react';
import { View, Text, BackHandler } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { MotiView } from 'moti';
import { useSharedValue } from 'react-native-reanimated';
import { X } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { BreathPalette } from '@/shared/constants/Colors';
import { S, R, F, W, ICON, MIN_TOUCH } from '@/shared/constants/tokens';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { haptic } from '@/shared/utils/haptics';
import { patternOf, cycleSec, type BreathId } from '@/features/breath/patterns';
import { BREATH_COPY } from '@/features/breath/breathCopy';
import { useBreathStore } from '@/features/breath/useBreathStore';
import { BreathPicker } from '@/features/breath/components/BreathPicker';
import { BreathRun } from '@/features/breath/components/BreathRun';
import { BreathOrb } from '@/features/breath/components/BreathOrb';
import { preloadCompletionChime, playCompletionChime } from '@/features/focus/completionChime';

/*
  NEFES SEANSI (madde 14) — ayar değil, kendi başına bir seans (kullanıcı kararı
  2026-10-30). Odak sayacının üstündeki "NEFES AL" yazısı kaldırıldı: çalışırken nefes
  saymak dikkati böler. Giriş iki yerden: odak modları ("Nefes") ve odak bitiş özeti
  (iki iş bloğu arası kısa nefes molası). Seans ODAK DAKİKASINA SAYILMAZ (mola ≠ odak).
  Ekran temadan bağımsız koyu: göz kapanmaya yakınken parlak zemin rahatsız eder.
*/
const INK = '#FFFFFF';
const MIN_RECORD_SEC = 20; // bundan kısası "denedim, vazgeçtim" — geçmişe yazılmaz

type Stage = { kind: 'pick' } | { kind: 'run'; key: number } | { kind: 'done'; sec: number; full: boolean };

export default function BreathScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { language } = useLanguageStore();
  const lang = language === 'en' ? 'en' : 'tr';
  const c = BREATH_COPY[lang];
  const params = useLocalSearchParams<{ p?: string; m?: string }>();
  const { sound, setSound, lastId, setLast, record } = useBreathStore();

  const [id, setId] = useState<BreathId>(patternOf(params.p ?? lastId).id);
  const [minutes, setMinutes] = useState<number>(Number(params.m) || patternOf(params.p ?? lastId).minutes);
  const [stage, setStage] = useState<Stage>({ kind: 'pick' });
  const pal = BreathPalette[id];
  const restLevel = useSharedValue(0.35);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const start = () => { haptic.commit(); setLast(id); preloadCompletionChime(); setStage({ kind: 'run', key: Date.now() }); };
  const end = (sec: number, full: boolean) => {
    if (sec >= MIN_RECORD_SEC) record({ at: new Date().toISOString(), id, sec: Math.round(sec) });
    if (full) playCompletionChime(() => haptic.alarm());
    setStage(sec >= MIN_RECORD_SEC ? { kind: 'done', sec, full } : { kind: 'pick' });
  };

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stage.kind === 'done') { setStage({ kind: 'pick' }); return true; }
      return false;
    });
    return () => sub.remove();
  }, [stage.kind]);

  const pickMinutes = (m: number) => { haptic.select(); setMinutes(m); };
  const pick = (next: BreathId) => { if (next === id) return; haptic.select(); setId(next); setMinutes(patternOf(next).minutes); };
  const toggleSound = () => { haptic.select(); setSound(!sound); };

  return (
    <View style={{ flex: 1, backgroundColor: pal.bg[1] }}>
      <StatusBar style="light" />
      <LinearGradient colors={[pal.bg[0], pal.bg[1]]} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      <View style={{ flex: 1, paddingTop: insets.top + S.xs, paddingBottom: insets.bottom }}>
        {stage.kind === 'pick' && (
          <>
            <View style={{ flexDirection: 'row', paddingHorizontal: S.sm }}>
              <Touchable onPress={close} accessibilityRole="button" accessibilityLabel={c.close} style={{ width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' }}>
                <X size={ICON.lg} color={INK} />
              </Touchable>
            </View>
            <BreathPicker lang={lang} id={id} minutes={minutes} sound={sound} onPick={pick} onMinutes={pickMinutes} onSound={toggleSound} onStart={start} />
          </>
        )}
        {stage.kind === 'run' && (
          <BreathRun key={stage.key} lang={lang} id={id} minutes={minutes} sound={sound} onSound={toggleSound} onEnd={end} />
        )}
        {stage.kind === 'done' && (
          <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ type: 'timing', duration: 500 }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: S.lg, gap: S.md }}>
            <BreathOrb id={id} size={200} level={restLevel} />
            <Text style={{ fontSize: F.display, fontWeight: W.semibold, color: pal.accent }}>{c.doneTitle}</Text>
            <Text style={{ fontSize: F.callout, color: 'rgba(255,255,255,0.75)', textAlign: 'center' }}>
              {c.doneBody(c.dur(stage.sec), Math.max(1, Math.floor(stage.sec / cycleSec(patternOf(id)))))}
            </Text>
            <View style={{ alignSelf: 'stretch', gap: S.sm, marginTop: S.lg }}>
              <Touchable onPress={() => router.replace('/focus')} accessibilityRole="button" style={{ minHeight: 56, borderRadius: R.full, alignItems: 'center', justifyContent: 'center', backgroundColor: pal.accent }}>
                <Text style={{ fontSize: F.callout, fontWeight: W.semibold, color: pal.bg[1] }}>{c.toFocus}</Text>
              </Touchable>
              <Touchable onPress={start} accessibilityRole="button" style={{ minHeight: 52, borderRadius: R.full, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' }}>
                <Text style={{ fontSize: F.callout, fontWeight: W.semibold, color: INK }}>{c.again}</Text>
              </Touchable>
              <Touchable onPress={close} accessibilityRole="button" style={{ minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: F.body, color: 'rgba(255,255,255,0.6)' }}>{c.close}</Text>
              </Touchable>
            </View>
          </MotiView>
        )}
      </View>
    </View>
  );
}

export { RouteErrorBoundary as ErrorBoundary } from '@/shared/components/CrashFallback'; // çökerse yalnız bu ekran düşer
