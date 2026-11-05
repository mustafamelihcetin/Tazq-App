import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import Reanimated, { FadeIn, FadeInDown, FadeInLeft, FadeInRight, ZoomIn } from 'react-native-reanimated';
import { MotiView } from 'moti';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarDays, ChevronLeft, X } from 'lucide-react-native';
import { create } from 'zustand';
import { GlassSurface } from '@/shared/components/GlassSurface';
import { Touchable } from '@/shared/components/Touchable';
import { F, W, S, R, ICON, MIN_TOUCH, SCRIM } from '@/shared/constants/tokens';
import { useContentMaxWidth } from '@/shared/components/ResponsiveColumns';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useModeAccent } from '@/shared/hooks/useModeAccent';
import { useReduceMotion } from '@/shared/hooks/useReduceMotion';
import { haptic } from '@/shared/utils/haptics';
import { ExamDatePicker } from '../modes/ExamDatePicker';

/*
  HEDEF KURULUMU KABUĞU (2026-11-05, kullanıcı: "kpss için mod açtım, tarih seçtim, direkt başladı; ne konu sordu ne seviye sordu ne planıma yönlendirdi ne tarif var; bu mod belki sadece görünendi, hepsine bak, her biri kendi mantığına göre").
  Kabuk ortak: her ekranda tek soru, ilerleme, geri dönüş, kısa bir sahne ve sonunda Planım. Sorular her hedefin kendi dosyasında.
  Kural: cevap kullanıcı adına verilmez, önceki kurulumdan bir şey devralınmaz, vazgeçilirse hiçbir şey kaydedilmez. Son ekran planın nasıl işlediğini anlatır.
*/
export type SetupKind = 'exam' | 'tez' | 'mulakat' | 'spor' | 'tasarruf' | 'birakma';

export const useGoalSetupStore = create<{ req: { kind: SetupKind; slot: string } | null; open: (kind: SetupKind, slot: string) => void; close: () => void }>(set => ({
  req: null,
  open: (kind, slot) => set({ req: { kind, slot } }),
  close: () => set({ req: null }),
}));

const COPY = {
  tr: { close: 'Kurulumu kapat', back: 'Geri', next: 'Devam', skip: 'Geç', start: 'Planı başlat', how: 'Nasıl işler?', pickDate: 'Tarih seç', changeDate: 'Tarihi değiştir' },
  en: { close: 'Close setup', back: 'Back', next: 'Continue', skip: 'Skip', start: 'Start plan', how: 'How it works', pickDate: 'Pick a date', changeDate: 'Change date' },
};
const LOCALE = { tr: 'tr-TR', en: 'en-GB' };
const BIG = F.display * 2;
const SCENE_MS = 2600;
const SCENE_MS_REDUCED = 500;
const TICK_MIN_MS = 110;

export const daysUntilKey = (key: string) => Math.max(0, Math.round((new Date(`${key}T12:00:00`).getTime() - Date.now()) / 86400000));

/** Sayı hedefine yuvarlanarak gelir; hedef değişince yeniden. */
export function useRoll(target: number, ms: number): number {
  const reduce = useReduceMotion();
  const [v, setV] = useState(reduce ? target : 0);
  const from = useRef(0);
  useEffect(() => {
    if (reduce) { setV(target); return; }
    const start = Date.now();
    const a = from.current;
    let id = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / ms);
      const eased = 1 - (1 - t) * (1 - t) * (1 - t);
      const cur = Math.round(a + (target - a) * eased);
      from.current = cur;
      setV(cur);
      if (t < 1) id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [target, ms, reduce]);
  return v;
}

export interface SetupScene { title: string; big?: number; bigLabel?: string; ticker: string[]; line: string }
export interface SetupStep { key: string; valid: boolean; optional?: boolean; node: React.ReactNode }

/* PLANIN KURULDUĞU AN (kullanıcı: "filmselleştir"). En büyük an sessiz geçiyordu. Tek sefer, kısa, dokununca geçer; hareket azaltılmışsa neredeyse hiç sürmez. */
function LaunchScene({ kind, scene, onDone }: { kind: SetupKind; scene: SetupScene; onDone: () => void }) {
  const { theme } = useAppTheme();
  const { accent, accentText } = useModeAccent(kind);
  const reduce = useReduceMotion();
  const rolled = useRoll(scene.big ?? 0, 1100);
  const total = reduce ? SCENE_MS_REDUCED : SCENE_MS;
  const [shown, setShown] = useState(0);
  const done = useRef(false);
  const finish = () => { if (done.current) return; done.current = true; haptic.success(); onDone(); };
  useEffect(() => {
    const t = setTimeout(finish, total);
    if (reduce || scene.ticker.length < 2) return () => clearTimeout(t);
    const every = Math.max(TICK_MIN_MS, (total - 700) / scene.ticker.length);
    const id = setInterval(() => setShown(n => (n + 1 >= scene.ticker.length ? n : n + 1)), every);
    return () => { clearTimeout(t); clearInterval(id); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Touchable accessibilityRole="button" accessibilityLabel={`${scene.title}. ${scene.line}`} activeOpacity={1} onPress={finish} style={st.scene}>
      <Reanimated.Text entering={ZoomIn.duration(420)} numberOfLines={2} adjustsFontSizeToFit style={{ fontSize: BIG, fontWeight: W.bold, textAlign: 'center', color: accentText }}>{scene.title}</Reanimated.Text>
      {scene.big != null && (
        <Reanimated.View entering={FadeInDown.delay(250).duration(360)} style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: F.display, fontWeight: W.bold, color: theme.onSurface, fontVariant: ['tabular-nums'] }}>{rolled}</Text>
          {!!scene.bigLabel && <Text style={{ fontSize: F.footnote, color: theme.onSurfaceVariant }}>{scene.bigLabel}</Text>}
        </Reanimated.View>
      )}
      <View style={st.sceneLine}>
        {scene.ticker.length > 0 && <Reanimated.Text key={shown} entering={FadeInDown.duration(160)} numberOfLines={1} style={{ fontSize: F.body, fontWeight: W.semibold, color: theme.onSurface }}>{scene.ticker[shown]}</Reanimated.Text>}
        <Text style={{ fontSize: F.footnote, color: theme.onSurfaceMuted }}>{scene.line}</Text>
      </View>
      <View style={[st.sceneBar, { backgroundColor: theme.onSurface + '1A' }]}>
        <MotiView from={{ width: '0%' }} animate={{ width: '100%' }} transition={{ type: 'timing', duration: total }} style={{ height: '100%', borderRadius: R.full, backgroundColor: accent }} />
      </View>
    </Touchable>
  );
}

export function SetupShell({ kind, lang, steps, scene, onClose, onDone }: { kind: SetupKind; lang: 'tr' | 'en'; steps: SetupStep[]; scene: SetupScene; onClose: () => void; onDone: () => void }) {
  const { theme } = useAppTheme();
  const { accent, onAccent } = useModeAccent(kind);
  const insets = useSafeAreaInsets();
  const maxW = useContentMaxWidth();
  const c = COPY[lang];
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [launching, setLaunching] = useState(false);
  const idx = Math.min(step, steps.length - 1);
  const cur = steps[idx];
  const last = idx === steps.length - 1;
  const go = (d: number) => { haptic.select(); setDir(d); setStep(Math.max(0, Math.min(steps.length - 1, idx + d))); };
  const entering = (dir > 0 ? FadeInRight : FadeInLeft).duration(260);
  return (
    <Modal supportedOrientations={['portrait', 'landscape']} visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={[st.scrim, { paddingTop: insets.top + S.md }]}>
        <View style={[st.sheet, { paddingBottom: Math.max(insets.bottom, S.lg) }]}>
          <GlassSurface corners="top" />
          {launching ? <LaunchScene kind={kind} scene={scene} onDone={onDone} /> : (
            <View style={{ flex: 1, width: '100%', maxWidth: maxW, alignSelf: 'center' }}>
              <View style={st.top}>
                <View style={st.progress}>
                  {steps.map((s, i) => (
                    <View key={s.key} style={[st.segment, { backgroundColor: theme.onSurface + '1A' }]}>
                      <MotiView animate={{ width: i <= idx ? '100%' : '0%' }} transition={{ type: 'timing', duration: 320 }} style={{ height: '100%', borderRadius: R.full, backgroundColor: accent }} />
                    </View>
                  ))}
                </View>
                <Touchable accessibilityRole="button" accessibilityLabel={c.close} onPress={onClose} hitSlop={10}>
                  <X size={ICON.md} color={theme.onSurfaceVariant} />
                </Touchable>
              </View>
              <ScrollView style={{ flex: 1 }} contentContainerStyle={st.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Reanimated.View key={cur.key} entering={entering} style={{ gap: S.md }}>{cur.node}</Reanimated.View>
              </ScrollView>
              <View style={st.bar}>
                {idx > 0 && (
                  <Touchable accessibilityRole="button" accessibilityLabel={c.back} onPress={() => go(-1)} style={[st.backBtn, { backgroundColor: theme.surfaceContainerHigh }]}>
                    <ChevronLeft size={ICON.md} color={theme.onSurface} />
                  </Touchable>
                )}
                <Touchable accessibilityRole="button" accessibilityState={{ disabled: !cur.valid }} disabled={!cur.valid} onPress={() => { if (last) { haptic.commit(); setLaunching(true); } else go(1); }} style={[st.nextBtn, { backgroundColor: cur.valid ? accent : theme.surfaceContainerHigh }]}>
                  <Text style={{ fontSize: F.body, fontWeight: W.bold, color: cur.valid ? onAccent : theme.onSurfaceMuted }}>{last ? c.start : cur.optional ? c.skip : c.next}</Text>
                </Touchable>
              </View>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ── Ortak parçalar ── */
export function Question({ title, hint }: { title: string; hint?: string }) {
  const { theme } = useAppTheme();
  return (
    <View style={{ gap: S.xs }}>
      <Text accessibilityRole="header" style={{ fontSize: F.title, fontWeight: W.bold, color: theme.onSurface }}>{title}</Text>
      {!!hint && <Text style={{ fontSize: F.footnote, lineHeight: 19, color: theme.onSurfaceVariant }}>{hint}</Text>}
    </View>
  );
}

export function Choice({ kind, title, sub, on, index = 0, onPress }: { kind: SetupKind; title: string; sub?: string; on: boolean; index?: number; onPress: () => void }) {
  const { theme } = useAppTheme();
  const { accent, onAccent } = useModeAccent(kind);
  return (
    <Reanimated.View entering={FadeInDown.delay(Math.min(index, 10) * 45).duration(240)}>
      <Touchable accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => { haptic.select(); onPress(); }} style={[st.choice, { backgroundColor: on ? accent : theme.surfaceContainerHigh }]}>
        <Text style={{ fontSize: F.body, fontWeight: W.bold, color: on ? onAccent : theme.onSurface }}>{title}</Text>
        {!!sub && <Text style={{ fontSize: F.footnote, color: on ? onAccent : theme.onSurfaceVariant }}>{sub}</Text>}
      </Touchable>
    </Reanimated.View>
  );
}

export function Chips({ kind, items, isOn, onToggle }: { kind: SetupKind; items: { id: string; label: string }[]; isOn: (id: string) => boolean; onToggle: (id: string) => void }) {
  const { theme } = useAppTheme();
  const { accent, onAccent } = useModeAccent(kind);
  return (
    <View style={st.chips}>
      {items.map((it, i) => {
        const on = isOn(it.id);
        return (
          <Reanimated.View key={it.id} entering={FadeInDown.delay(Math.min(i, 12) * 30).duration(220)}>
            <Touchable accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => { haptic.select(); onToggle(it.id); }} style={[st.chip, { backgroundColor: on ? accent : theme.surfaceContainerHigh }]}>
              <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: on ? onAccent : theme.onSurface }}>{it.label}</Text>
            </Touchable>
          </Reanimated.View>
        );
      })}
    </View>
  );
}

export function DateStep({ kind, lang, date, onDate, label, fallbackDays = 60 }: { kind: SetupKind; lang: 'tr' | 'en'; date: string; onDate: (d: string) => void; label: string; fallbackDays?: number }) {
  const { theme } = useAppTheme();
  const { accentText } = useModeAccent(kind);
  const c = COPY[lang];
  const [picking, setPicking] = useState(false);
  const rolled = useRoll(date ? daysUntilKey(date) : 0, 700);
  const obj = date ? new Date(`${date}T12:00:00`) : new Date(Date.now() + fallbackDays * 86400000);
  return (
    <>
      {!!date && (
        <Reanimated.View entering={ZoomIn.duration(240)} style={st.days}>
          <Text style={{ fontSize: BIG, fontWeight: W.bold, color: accentText, fontVariant: ['tabular-nums'] }}>{rolled}</Text>
          <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: theme.onSurfaceVariant }}>{label}</Text>
          <Text style={{ fontSize: F.footnote, color: theme.onSurfaceMuted }}>{obj.toLocaleDateString(LOCALE[lang], { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' })}</Text>
        </Reanimated.View>
      )}
      <Touchable accessibilityRole="button" onPress={() => { haptic.select(); setPicking(true); }} style={[st.dateBtn, { backgroundColor: theme.surfaceContainerHigh }]}>
        <CalendarDays size={ICON.sm} color={theme.onSurface} />
        <Text style={{ fontSize: F.body, fontWeight: W.semibold, color: theme.onSurface }}>{date ? c.changeDate : c.pickDate}</Text>
      </Touchable>
      {picking && <ExamDatePicker value={obj} onPick={onDate} onClose={() => setPicking(false)} />}
    </>
  );
}

export function Summary({ kind, lang, title, heading, facts, how }: { kind: SetupKind; lang: 'tr' | 'en'; title: string; heading: string; facts: [string, string][]; how: string[] }) {
  const { theme } = useAppTheme();
  const { accent, accentText } = useModeAccent(kind);
  return (
    <>
      <Question title={heading} />
      <Text style={{ fontSize: F.title3, fontWeight: W.bold, color: accentText }}>{title}</Text>
      {facts.length > 0 && (
        <View style={st.facts}>
          {facts.map(([n, l], i) => (
            <Reanimated.View key={l} entering={ZoomIn.delay(i * 90).duration(260)} style={[st.fact, { backgroundColor: theme.surfaceContainerHigh }]}>
              <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: F.title, fontWeight: W.bold, color: theme.onSurface, fontVariant: ['tabular-nums'] }}>{n}</Text>
              <Text style={{ fontSize: F.caption, color: theme.onSurfaceVariant }}>{l}</Text>
            </Reanimated.View>
          ))}
        </View>
      )}
      <Text accessibilityRole="header" style={{ fontSize: F.body, fontWeight: W.bold, color: theme.onSurface }}>{COPY[lang].how}</Text>
      {how.map((line, i) => (
        <Reanimated.View key={line} entering={FadeIn.delay(250 + i * 140).duration(320)} style={st.howRow}>
          <View style={[st.howDot, { backgroundColor: accent }]} />
          <Text style={{ flex: 1, fontSize: F.footnote, lineHeight: 20, color: theme.onSurfaceVariant }}>{line}</Text>
        </Reanimated.View>
      ))}
    </>
  );
}

const st = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: SCRIM },
  sheet: { flex: 1, borderTopLeftRadius: R.sheet, borderTopRightRadius: R.sheet, paddingHorizontal: S.lg, paddingTop: S.md, overflow: 'hidden' },
  top: { flexDirection: 'row', alignItems: 'center', gap: S.md, minHeight: MIN_TOUCH },
  progress: { flex: 1, flexDirection: 'row', gap: S.xs },
  segment: { flex: 1, height: 4, borderRadius: R.full, overflow: 'hidden' },
  body: { paddingVertical: S.md, gap: S.md },
  days: { alignItems: 'center', gap: S.xxs, paddingVertical: S.md },
  dateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, minHeight: MIN_TOUCH, borderRadius: R.md },
  choice: { minHeight: MIN_TOUCH + S.md, borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.smd, gap: S.xxs, justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  chip: { paddingHorizontal: S.md, minHeight: MIN_TOUCH - S.xs, borderRadius: R.full, justifyContent: 'center' },
  facts: { flexDirection: 'row', gap: S.sm },
  fact: { flex: 1, borderRadius: R.md, paddingVertical: S.md, paddingHorizontal: S.xs, alignItems: 'center', gap: S.xxs },
  howRow: { flexDirection: 'row', gap: S.sm },
  howDot: { width: S.sm, height: S.sm, borderRadius: R.full, marginTop: S.xs + S.xxs },
  bar: { flexDirection: 'row', gap: S.sm, paddingTop: S.sm },
  backBtn: { width: MIN_TOUCH + S.xs, minHeight: MIN_TOUCH + S.xs, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  nextBtn: { flex: 1, minHeight: MIN_TOUCH + S.xs, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  scene: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: S.lg },
  sceneLine: { alignItems: 'center', gap: S.xxs, minHeight: S.xl + S.lg },
  sceneBar: { width: '70%', height: 4, borderRadius: R.full, overflow: 'hidden' },
});
