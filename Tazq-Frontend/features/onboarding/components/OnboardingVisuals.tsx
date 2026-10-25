import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Check, Droplet, Play, GraduationCap, Dumbbell, Ban, CalendarDays, Clock, Zap } from 'lucide-react-native';
import { useReduceMotion } from '@/shared/hooks/useReduceMotion';
import { modeAccent, type AppTheme } from '@/shared/constants/Colors';
import { S, R, F, ICON, B } from '@/shared/constants/tokens';

/*
  TANITIM SLAYTLARININ GÖRSELLERİ (2026-10-25, kullanıcı: "premium, modern, elit olmalı").

  Her görsel uygulamanın GERÇEKTEN yaptığını gösterir — süsleme değil, küçük bir demo:
   · today   — günün üç parçası (görev, alışkanlık, odak) tek yığında; görev kendiliğinden işaretlenir
   · smart   — cümle yazılır, motor tarihi/saati/önceliği ayrıştırır, başlık sadeleşir
              (örnek cümle anlama motorunda doğrulandı: "Sunum yarın 15:00, acil")
   · modes   — mod anahtarları sırayla açılır, günün adımları hazırlanır
   · focus   — halka dolar, sayaç işler

  ANİMASYON KURALLARI (Android 9'da görülen hatalardan):
   · RN `Animated` — Reanimated/Moti DEĞİL: ana ekran yeniden çizildiğinde Reanimated'in
     animasyonlu stili ilk değerine dönüyordu (sayfa saniyede bir çiziliyordu → boş ekran).
   · Saydamlıkla GİRİŞ YOK: içerik her zaman görünür; hareket konum/ölçekle anlatılır.
     Görünmez başlayıp hiç görünmeyen içerik riski kalmaz.
   · Sayaç yalnız kendi bileşenini çizer; döngüler yalnız slayt etkinken döner.
   · "Hareketi azalt" açıksa her şey son hâlinde, durağan.
*/

const COPY = {
  tr: {
    task: 'Raporu gönder',
    taskMeta: '10:00 · İş',
    habit: 'Su iç',
    focus: 'Odak',
    sentence: 'Sunum yarın 15:00, acil',
    tomorrow: 'Yarın',
    time: '15:00',
    urgent: 'Acil',
    resultTitle: 'Sunum',
    resultMeta: 'Yarın 15:00 · Yüksek öncelik',
    exam: 'Sınav',
    examSub: 'Günlük çalışma planı',
    fit: 'Spor',
    fitSub: 'Haftalık antrenman',
    quit: 'Bırakma',
    quitSub: 'Gün gün seri',
    focusTask: 'Raporu bitir',
    ready: 'Bugünün 3 adımı hazır',
  },
  en: {
    task: 'Send the report',
    taskMeta: '10:00 · Work',
    habit: 'Drink water',
    focus: 'Focus',
    sentence: 'Presentation tomorrow 3pm, urgent',
    tomorrow: 'Tomorrow',
    time: '3:00 PM',
    urgent: 'Urgent',
    resultTitle: 'Presentation',
    resultMeta: 'Tomorrow 3:00 PM · High priority',
    exam: 'Exam',
    examSub: 'Daily study plan',
    fit: 'Fitness',
    fitSub: 'Weekly training',
    quit: 'Quit',
    quitSub: 'Day-by-day streak',
    focusTask: 'Finish the report',
    ready: 'Today’s 3 steps are ready',
  },
};

type Kind = 'today' | 'smart' | 'modes' | 'focus';

interface VisualProps {
  kind: Kind;
  active: boolean;
  theme: AppTheme;
  isDark: boolean;
  tr: boolean;
  width: number;
  height: number;
}

const EASE = Easing.bezier(0.22, 1, 0.36, 1);
const spring = (v: Animated.Value, toValue: number, delay = 0) =>
  Animated.sequence([Animated.delay(delay), Animated.spring(v, { toValue, damping: 14, stiffness: 160, mass: 0.9, useNativeDriver: true })]);

/** Etkinken dönen, değilken duran döngü. Dönüş değeri: temizlik. */
function useLoop(active: boolean, reduce: boolean, build: () => Animated.CompositeAnimation, reset: () => void) {
  useEffect(() => {
    if (reduce) return;
    if (!active) { reset(); return; }
    const anim = Animated.loop(build());
    anim.start();
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, reduce]);
}

export function OnboardingVisual(p: VisualProps) {
  switch (p.kind) {
    case 'today': return <TodayStack {...p} />;
    case 'smart': return <SmartInput {...p} />;
    case 'modes': return <ModesPlan {...p} />;
    case 'focus': return <FocusRing {...p} />;
  }
}

/* ── 1 · GÜNÜN, TEK YERDE ─────────────────────────────────────────────────── */
function TodayStack({ active, theme, isDark, tr, width, height }: VisualProps) {
  const c = tr ? COPY.tr : COPY.en;
  const reduce = useReduceMotion();
  const float = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  const check = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  const habit = modeAccent('spor', isDark);

  useEffect(() => {
    if (reduce || !active) return;
    const loops = float.map((v, i) =>
      Animated.loop(Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 2400 + i * 500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 2400 + i * 500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])));
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [active, reduce]);

  useLoop(active, reduce, () => Animated.sequence([
    Animated.delay(700),
    Animated.timing(check, { toValue: 1, duration: 260, easing: EASE, useNativeDriver: true }),
    Animated.delay(2600),
    Animated.timing(check, { toValue: 0, duration: 200, useNativeDriver: true }),
  ]), () => check.setValue(0));

  const lift = (i: number, d: number) => ({ transform: [{ translateY: float[i].interpolate({ inputRange: [0, 1], outputRange: [0, -d] }) }] });
  const card = [styles.card, { backgroundColor: theme.surfaceCard, borderColor: theme.outlineVariant }];
  const cardW = Math.min(width, 300);

  return (
    <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: cardW, gap: S.smd }}>
        {/* Görev — halkası kendiliğinden dolar */}
        <Animated.View style={[...card, lift(0, 5), { marginRight: S.xl }]}>
          <View style={[styles.ring, { borderColor: theme.outline }]}>
            <Animated.View style={[styles.ringFill, { backgroundColor: theme.success, opacity: check, transform: [{ scale: check.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] }]}>
              <Check size={ICON.xs} color={theme.onPrimary} strokeWidth={3} />
            </Animated.View>
          </View>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={[styles.cardTitle, { color: theme.onSurface }]}>{c.task}</Text>
            <Text numberOfLines={1} style={[styles.cardMeta, { color: theme.onSurfaceMuted }]}>{c.taskMeta}</Text>
          </View>
        </Animated.View>

        {/* Alışkanlık — haftanın serisi */}
        <Animated.View style={[...card, lift(1, 4), { marginLeft: S.xl }]}>
          <View style={[styles.iconTile, { backgroundColor: habit + (isDark ? '2E' : '1F') }]}>
            <Droplet size={ICON.sm} color={habit} strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1, gap: S.xs }}>
            <Text numberOfLines={1} style={[styles.cardTitle, { color: theme.onSurface }]}>{c.habit}</Text>
            <View style={{ flexDirection: 'row', gap: S.xxs }}>
              {Array.from({ length: 7 }, (_, i) => (
                <View key={i} style={[styles.streakDot, { backgroundColor: i < 5 ? habit : theme.surfaceField }]} />
              ))}
            </View>
          </View>
        </Animated.View>

        {/* Odak — tek dokunuşla başlar */}
        <Animated.View style={[...card, lift(2, 6), { marginRight: S.lg, backgroundColor: theme.primary, borderColor: theme.primary }]}>
          <View style={[styles.iconTile, { backgroundColor: theme.onPrimary + '26' }]}>
            <Play size={ICON.sm} color={theme.onPrimary} fill={theme.onPrimary} />
          </View>
          <Text style={[styles.cardTitle, { color: theme.onPrimary, flex: 1 }]}>{c.focus}</Text>
          <Text style={[styles.timer, { color: theme.onPrimary }]}>25:00</Text>
        </Animated.View>
      </View>
    </View>
  );
}

/* ── 2 · YAZMAN YETERLİ ───────────────────────────────────────────────────── */
function SmartInput({ active, theme, isDark, tr, width, height }: VisualProps) {
  const c = tr ? COPY.tr : COPY.en;
  const reduce = useReduceMotion();
  const sentence = c.sentence;
  const [typed, setTyped] = useState(reduce ? sentence.length : 0);
  const chips = useRef([0, 1, 2].map(() => new Animated.Value(reduce ? 1 : 0))).current;
  const result = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  const caret = useRef(new Animated.Value(1)).current;

  // Yaz → ayrıştır → göster → baştan. Yalnız bu bileşen çizilir.
  useEffect(() => {
    if (reduce || !active) { if (!reduce) { setTyped(0); chips.forEach((c) => c.setValue(0)); result.setValue(0); } return; }
    let alive = true;
    let t: ReturnType<typeof setTimeout>;
    const run = () => {
      if (!alive) return;
      setTyped(0); chips.forEach((c) => c.setValue(0)); result.setValue(0);
      let n = 0;
      const tick = () => {
        if (!alive) return;
        n += 1; setTyped(n);
        if (n < sentence.length) { t = setTimeout(tick, 55); return; }
        Animated.sequence([
          Animated.stagger(140, chips.map((c) => spring(c, 1))),
          spring(result, 1, 120),
        ]).start();
        t = setTimeout(run, 4200);
      };
      t = setTimeout(tick, 500);
    };
    run();
    const blink = Animated.loop(Animated.sequence([
      Animated.timing(caret, { toValue: 0, duration: 450, useNativeDriver: true }),
      Animated.timing(caret, { toValue: 1, duration: 450, useNativeDriver: true }),
    ]));
    blink.start();
    return () => { alive = false; clearTimeout(t); blink.stop(); };
  }, [active, reduce, sentence]);

  const facts = [
    { Ic: CalendarDays, label: c.tomorrow, color: theme.primary },
    { Ic: Clock, label: c.time, color: modeAccent('tez', isDark) },
    { Ic: Zap, label: c.urgent, color: theme.error },
  ];
  const pop = (v: Animated.Value) => ({ transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.001, 1] }) }] });
  const boxW = Math.min(width, 320);

  return (
    <View style={{ width, height, alignItems: 'center', justifyContent: 'center', gap: S.md }}>
      <View style={[styles.input, { width: boxW, backgroundColor: theme.surfaceCard, borderColor: theme.primary }]}>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[styles.inputText, { color: theme.onSurface }]}>
          {sentence.slice(0, typed)}
        </Text>
        <Animated.View style={[styles.caret, { backgroundColor: theme.primary, opacity: caret }]} />
      </View>

      <View style={{ flexDirection: 'row', gap: S.sm }}>
        {facts.map((f, i) => (
          <Animated.View key={f.label} style={[styles.chip, { backgroundColor: f.color + (isDark ? '2E' : '1A') }, pop(chips[i])]}>
            <f.Ic size={ICON.xs} color={f.color} strokeWidth={2.4} />
            <Text style={[styles.chipText, { color: f.color }]}>{f.label}</Text>
          </Animated.View>
        ))}
      </View>

      {/* Sonuç: başlık sadeleşir — "Sunum", gerisi alanlara yerleşti */}
      <Animated.View style={[styles.card, { width: boxW, backgroundColor: theme.surfaceCard, borderColor: theme.outlineVariant }, pop(result)]}>
        <View style={[styles.ring, { borderColor: theme.error }]} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: theme.onSurface }]}>{c.resultTitle}</Text>
          <Text style={[styles.cardMeta, { color: theme.onSurfaceMuted }]}>{c.resultMeta}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

/* ── 3 · YAŞAM MODLARI ────────────────────────────────────────────────────── */
function ModesPlan({ active, theme, isDark, tr, width, height }: VisualProps) {
  const c = tr ? COPY.tr : COPY.en;
  const reduce = useReduceMotion();
  const on = useRef([0, 1, 2].map(() => new Animated.Value(reduce ? 1 : 0))).current;
  const ready = useRef(new Animated.Value(reduce ? 1 : 0)).current;

  useLoop(active, reduce, () => Animated.sequence([
    Animated.delay(400),
    Animated.stagger(380, on.map((v) => Animated.timing(v, { toValue: 1, duration: 320, easing: EASE, useNativeDriver: true }))),
    spring(ready, 1, 150),
    Animated.delay(2800),
    Animated.parallel([...on, ready].map((v) => Animated.timing(v, { toValue: 0, duration: 220, useNativeDriver: true }))),
  ]), () => { on.forEach((v) => v.setValue(0)); ready.setValue(0); });

  const rows = [
    { key: 'exam', Ic: GraduationCap, title: c.exam, sub: c.examSub },
    { key: 'spor', Ic: Dumbbell, title: c.fit, sub: c.fitSub },
    { key: 'birakma', Ic: Ban, title: c.quit, sub: c.quitSub },
  ];
  const boxW = Math.min(width, 320);
  const TRACK = 40;
  const THUMB = 18;

  return (
    <View style={{ width, height, alignItems: 'center', justifyContent: 'center', gap: S.sm }}>
      {rows.map((r, i) => {
        const c = modeAccent(r.key, isDark);
        return (
          <View key={r.key} style={[styles.card, { width: boxW, backgroundColor: theme.surfaceCard, borderColor: theme.outlineVariant }]}>
            <View style={[styles.iconTile, { backgroundColor: c + (isDark ? '2E' : '1F') }]}>
              <r.Ic size={ICON.sm} color={c} strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: theme.onSurface }]}>{r.title}</Text>
              <Text style={[styles.cardMeta, { color: theme.onSurfaceMuted }]}>{r.sub}</Text>
            </View>
            {/* Anahtar: renkli zemin üstüne ölçekle gelir (renk ara değeri yerel sürücüde yok) */}
            <View style={[styles.track, { width: TRACK, backgroundColor: theme.surfaceField }]}>
              <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: R.full, backgroundColor: c, opacity: on[i] }]} />
              <Animated.View style={[styles.thumb, { width: THUMB, height: THUMB, backgroundColor: theme.surfaceCard, transform: [{ translateX: on[i].interpolate({ inputRange: [0, 1], outputRange: [0, TRACK - THUMB - 4] }) }] }]} />
            </View>
          </View>
        );
      })}
      <Animated.View style={[styles.chip, { marginTop: S.xs, backgroundColor: theme.primary }, { transform: [{ scale: ready.interpolate({ inputRange: [0, 1], outputRange: [0.001, 1] }) }] }]}>
        <Check size={ICON.xs} color={theme.onPrimary} strokeWidth={3} />
        <Text style={[styles.chipText, { color: theme.onPrimary }]}>{c.ready}</Text>
      </Animated.View>
    </View>
  );
}

/* ── 4 · DERİN ODAK ───────────────────────────────────────────────────────── */
const ACircle = Animated.createAnimatedComponent(Circle);
/** Gösterilen seans: 25 dakika (saniye). */
const TOTAL = 25 * 60;

function FocusRing({ active, theme, tr, height }: VisualProps) {
  const c = tr ? COPY.tr : COPY.en;
  const reduce = useReduceMotion();
  const size = Math.round(height * 0.86);
  const stroke = Math.max(8, Math.round(size * 0.055));
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const prog = useRef(new Animated.Value(reduce ? 0.35 : 0)).current;
  const secOf = (v: number) => Math.round((1 - v) * TOTAL);
  const [sec, setSec] = useState(secOf(reduce ? 0.35 : 0));

  /*
    TEK SAAT (kullanıcı: "süre de çarkla aynı hızda akmalı, ortak bir yerde buluşmalı").
    Sayaç ayrı bir setInterval'le gerçek saniyeyi sayıyordu, halka ise 9 sn'de doluyordu —
    ikisi hiç buluşmuyordu. Artık sayaç HALKANIN DEĞERİNDEN türetilir: 25:00 → 00:00 halka
    tamamlanırken, aynı doğrusal hızla; ikisi aynı karede biter, kısa bir an orada durur.
  */
  useEffect(() => {
    const id = prog.addListener(({ value }) => {
      const next = secOf(value);
      setSec((s) => (s === next ? s : next));
    });
    return () => prog.removeListener(id);
  }, []);

  // Halka yerel sürücüsüz (SVG özniteliği); döngü yalnız etkinken döner.
  useEffect(() => {
    if (reduce || !active) { if (!reduce) prog.setValue(0); return; }
    prog.setValue(0);
    const anim = Animated.loop(Animated.sequence([
      Animated.delay(400),
      Animated.timing(prog, { toValue: 1, duration: 10000, easing: Easing.linear, useNativeDriver: false }),
      Animated.delay(1400),
      Animated.timing(prog, { toValue: 0, duration: 500, easing: EASE, useNativeDriver: false }),
    ]));
    anim.start();
    return () => anim.stop();
  }, [active, reduce]);

  const mm = String(Math.floor(sec / 60)).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');

  return (
    <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={theme.surfaceField} strokeWidth={stroke} fill="none" />
          <ACircle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={theme.primary}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${circ} ${circ}`}
            strokeDashoffset={prog.interpolate({ inputRange: [0, 1], outputRange: [circ, 0] })}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        <Text style={[styles.bigTimer, { color: theme.onSurface, fontSize: Math.round(size * 0.2) }]}>{`${mm}:${ss}`}</Text>
        <Text numberOfLines={1} style={[styles.cardMeta, { color: theme.onSurfaceMuted }]}>{c.focusTask}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: S.smd, paddingHorizontal: S.md, paddingVertical: S.smd, borderRadius: R.lg, borderWidth: B.thin },
  cardTitle: { fontSize: F.subhead, fontWeight: '600' },
  cardMeta: { fontSize: F.caption, fontWeight: '500', marginTop: S.xxs },
  ring: { width: 22, height: 22, borderRadius: R.full, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  ringFill: { position: 'absolute', top: -2, left: -2, right: -2, bottom: -2, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  iconTile: { width: 34, height: 34, borderRadius: R.md, alignItems: 'center', justifyContent: 'center' },
  streakDot: { width: 10, height: 10, borderRadius: R.full },
  timer: { fontSize: F.subhead, fontWeight: '700', fontVariant: ['tabular-nums'] },
  input: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: S.md, borderRadius: R.lg, borderWidth: 1.5 },
  inputText: { fontSize: F.body, fontWeight: '500', flexShrink: 1 },
  caret: { width: 2, height: 22, marginLeft: S.xxs, borderRadius: R.xs },
  chip: { flexDirection: 'row', alignItems: 'center', gap: S.xs, paddingHorizontal: S.smd, paddingVertical: S.xs, borderRadius: R.full },
  chipText: { fontSize: F.caption, fontWeight: '700' },
  track: { height: 22, borderRadius: R.full, justifyContent: 'center', paddingHorizontal: S.xxs },
  thumb: { borderRadius: R.full },
  bigTimer: { fontWeight: '700', letterSpacing: -1, fontVariant: ['tabular-nums'] },
});
