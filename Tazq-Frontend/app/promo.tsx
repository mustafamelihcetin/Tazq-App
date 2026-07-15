import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, useWindowDimensions, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { useRouter } from 'expo-router';
import {
  X, EyeOff, Play, Timer, Music, Moon, GraduationCap, Dumbbell, Briefcase,
  CheckCircle2, Circle, Flame, TrendingUp, Home, Target, ListChecks, BarChart3,
} from 'lucide-react-native';
import { TazqLogo } from '@/shared/components/TazqLogo';
import { Touchable } from '@/shared/components/Touchable';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { useAuthStore } from '@/features/user';

const INDIGO = '#8B7CF6';
const VIOLET = '#A78BFA';
const TEAL = '#2DD4BF';
const AMBER = '#F59E0B';
const ROSE = '#F472B6';
const GREEN = '#4ADE80';

type Kind = 'focus' | 'deepfocus' | 'modes' | 'tasks' | 'momentum' | 'home' | 'brand';

type SlideDef = {
  kind: Kind;
  colors: string[]; accent: string;
  ebTr: string; ebEn: string;
  tTr: string; tEn: string;
  sTr: string; sEn: string;
};

const SLIDES: SlideDef[] = [
  // 1 — Odak (aurora): en güçlü görsel, ilk izlenim · mor/indigo
  { kind: 'focus', colors: ['#1a0b42', '#2f1280', '#140a30'], accent: '#9B87FF', ebTr: 'TAZQ', ebEn: 'TAZQ', tTr: 'Odağını topla,\nhayatını dengele', tEn: 'Focus deeply,\nlive in balance', sTr: 'Pomodoro, ambiyans sesleri ve zen moduyla derin odaklan.', sEn: 'Deep focus with Pomodoro, ambient sounds and zen mode.' },
  // 2 — Dönemsel Modlar: ayrıştırıcı özellik · teal
  { kind: 'modes', colors: ['#062430', '#0c4258', '#051826'], accent: '#2DD4BF', ebTr: 'Dönemsel Modlar', ebEn: 'Life Modes', tTr: 'Dönemine özel\ngünlük plan', tEn: 'A daily plan\nfor your season', sTr: 'Sınav, spor, kariyer — planın her gün otomatik hazır.', sEn: 'Exams, fitness, career — your plan ready daily.' },
  // 3 — Görevler & Ritüeller: günlük yürütme · magenta/rose
  { kind: 'tasks', colors: ['#26093c', '#4a1266', '#1a0a2e'], accent: '#F472B6', ebTr: 'Görevler & Alışkanlıklar', ebEn: 'Tasks & Habits', tTr: 'Bugünün planı,\nalışkanlıkların', tEn: "Today's plan,\nyour habits", sTr: 'Görevlerini, alışkanlıklarını ve serilerini takip et.', sEn: 'Track your tasks, habits and streaks.' },
  // 4 — Momentum: ilerleme · emerald
  { kind: 'momentum', colors: ['#06271f', '#0d4a3c', '#051c16'], accent: '#34D399', ebTr: 'Momentum', ebEn: 'Insights', tTr: 'İlerlemeni gör,\nmomentumu koru', tEn: 'See progress,\nkeep momentum', sTr: 'Haftalık odak istatistikleri ve momentum skorun.', sEn: 'Weekly focus stats and momentum score.' },
  // 5 — Ana ekran: genel bakış · mavi
  { kind: 'home', colors: ['#0a1444', '#153080', '#0a1030'], accent: '#60A5FA', ebTr: 'Genel Bakış', ebEn: 'Overview', tTr: 'Her şey\ntek yerde', tEn: 'Everything\nin one place', sTr: 'Odak, plan ve alışkanlıklar — dengeli bir gün.', sEn: 'Focus, plans and habits — a balanced day.' },
  // 6 — Marka kapanışı · violet
  { kind: 'brand', colors: ['#1a0b42', '#2f1280', '#140a30'], accent: '#A78BFA', ebTr: 'TAZQ', ebEn: 'TAZQ', tTr: 'Odaklan. İlerle.\nDengede kal.', tEn: 'Focus. Progress.\nStay balanced.', sTr: 'Üretkenliğin ve huzurun bir arada. Bugün başla.', sEn: 'Productivity and calm, together. Start today.' },
];

export default function PromoScreen() {
  const router = useRouter();
  const { language } = useLanguageStore();
  // Promo içinde yerel dil — uygulamanın genel dilini değiştirmeden TR/EN screenshot alabilmek için
  const [lang, setLang] = useState<'tr' | 'en'>(language === 'en' ? 'en' : 'tr');
  const tr = lang === 'tr';
  const role = useAuthStore((s) => s.user?.role);
  const { width: W, height: H } = useWindowDimensions();

  const [chrome, setChrome] = useState(true);
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => { if (role && role !== 'Admin') router.replace('/'); }, [role]);
  useEffect(() => {
    StatusBar.setBarStyle('light-content');
    StatusBar.setHidden(!chrome, 'fade');
  }, [chrome]);
  useEffect(() => () => { StatusBar.setHidden(false); }, []);

  if (role !== 'Admin') return null;

  const onScroll = (e: any) => {
    const p = Math.round(e.nativeEvent.contentOffset.x / W);
    if (p !== page) setPage(p);
  };

  // Telefon çerçevesi ölçüsü
  let fh = H * 0.62;
  let fw = fh / 2.05;
  if (fw > W * 0.72) { fw = W * 0.72; fh = fw * 2.05; }
  const S = fw / 234; // ölçek (temel genişlik 234)

  // ── Temsili ekranlar (gerçek uygulamaya sadık) ───────────────────────────
  const MockScreen: React.FC<{ kind: Kind }> = ({ kind }) => {
    // ── Altın-oran temelli ortak tasarım tokenları ──
    const PHI = 1.618;
    const u = 8 * S;                               // temel birim
    const pad = Math.round(u * PHI);               // ~13
    const gap = Math.round(u * 1.5);               // 12
    const rad = Math.round(u * 2);                 // 16
    const CARD = { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', borderRadius: rad } as const;
    const LAB = { color: 'rgba(255,255,255,0.45)', fontWeight: '800' as const, letterSpacing: 1.2, fontSize: 9.5 * S };
    // Tip ölçeği (φ adımlı): cap · body · h1 · big
    const T = { cap: 10.5 * S, body: 12.5 * S, sub: 11 * S, h1: 20 * S, big: 30 * S };
    const chip = (c: string, sz: number) => ({ width: sz, height: sz, borderRadius: Math.round(sz * 0.32), backgroundColor: c + '26', alignItems: 'center' as const, justifyContent: 'center' as const });

    if (kind === 'focus' || kind === 'deepfocus') {
      const dia = fw * 0.64;
      return (
        <View style={{ flex: 1, backgroundColor: '#080b16', padding: pad }}>
          <LinearGradient colors={['#0c1024', '#080b16', '#05070f']} style={StyleSheet.absoluteFill} />
          <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: T.sub, fontWeight: '700', textAlign: 'center', letterSpacing: 0.5, marginTop: u }}>{tr ? 'Derin Odak' : 'Deep Focus'}</Text>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: gap * 1.6 }}>
            {/* aurora daire */}
            <View style={{ width: dia, height: dia, borderRadius: dia / 2, borderWidth: 5 * S, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              <LinearGradient colors={['#141d3a', '#101a34', '#0a0f22']} style={StyleSheet.absoluteFill} />
              <View style={{ position: 'absolute', top: '10%', left: '12%', width: dia * 0.55, height: dia * 0.55, borderRadius: dia, backgroundColor: INDIGO, opacity: 0.42 }} />
              <View style={{ position: 'absolute', bottom: '8%', right: '10%', width: dia * 0.5, height: dia * 0.5, borderRadius: dia, backgroundColor: TEAL, opacity: 0.3 }} />
              <View style={{ position: 'absolute', top: '32%', left: '34%', width: dia * 0.42, height: dia * 0.42, borderRadius: dia, backgroundColor: VIOLET, opacity: 0.26 }} />
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <Text style={{ color: '#FFFFFF', fontSize: dia * 0.22, fontWeight: '200', letterSpacing: -1, textShadowColor: 'rgba(150,180,255,0.5)', textShadowRadius: 14 }}>24</Text>
                <Text style={{ color: INDIGO, fontSize: dia * 0.2, fontWeight: '200', marginHorizontal: 1 }}>:</Text>
                <Text style={{ color: '#FFFFFF', fontSize: dia * 0.22, fontWeight: '200', letterSpacing: -1, textShadowColor: 'rgba(150,180,255,0.5)', textShadowRadius: 14 }}>18</Text>
              </View>
            </View>
            {/* özellik ikonları — renkli çip + etiket */}
            <View style={{ flexDirection: 'row', gap: u * 2.2, justifyContent: 'center' }}>
              {[[Timer, 'Pomodoro', INDIGO], [Music, tr ? 'Ambiyans' : 'Ambient', TEAL], [Moon, 'Zen', VIOLET]].map(([Ic, l, c]: any) => (
                <View key={l} style={{ alignItems: 'center', gap: 8 * S }}>
                  <View style={[chip(c, 44 * S), { borderWidth: 1, borderColor: c + '4D' }]}><Ic size={21 * S} color={c} /></View>
                  <Text style={{ color: 'rgba(255,255,255,0.85)', fontWeight: '700', fontSize: 10 * S }}>{l}</Text>
                </View>
              ))}
            </View>
          </View>
          {/* alt kontrol */}
          <View style={{ alignItems: 'center', paddingBottom: u }}>
            <View style={{ width: dia * 0.36, height: dia * 0.36, borderRadius: dia, backgroundColor: INDIGO, alignItems: 'center', justifyContent: 'center', shadowColor: INDIGO, shadowOpacity: 0.6, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } }}>
              <Play size={dia * 0.15} color="#FFFFFF" fill="#FFFFFF" />
            </View>
          </View>
        </View>
      );
    }

    if (kind === 'modes') {
      const rows = [
        [GraduationCap, tr ? 'Sınav Modu' : 'Exam Mode', tr ? 'Günlük çalışma bloğu' : 'Daily study block', AMBER, '68%'],
        [Dumbbell, tr ? 'Spor Modu' : 'Fitness Mode', tr ? 'Antrenman & alışkanlık' : 'Workout & habit', ROSE, '41%'],
        [Briefcase, tr ? 'Kariyer Modu' : 'Career Mode', tr ? 'Hedef odaklı görevler' : 'Goal-focused tasks', INDIGO, '25%'],
      ];
      return (
        <View style={{ flex: 1, backgroundColor: '#0a1220', padding: pad, gap: gap }}>
          <View style={{ marginTop: u * 0.5 }}>
            <Text style={{ color: '#FFFFFF', fontSize: T.h1, fontWeight: '900', letterSpacing: -0.4 }}>{tr ? 'Dönemsel Modlar' : 'Life Modes'}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: T.sub, marginTop: 3 * S }}>{tr ? 'Dönemine özel günlük planın' : 'Your daily plan for the season'}</Text>
          </View>
          {rows.map(([Ic, name, sub, c, pct]: any) => (
            <View key={name} style={[CARD, { padding: pad, gap: u * 1.1 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: u * 1.25 }}>
                <View style={chip(c, 40 * S)}><Ic size={20 * S} color={c} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: T.body + 1 }}>{name}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: T.cap, marginTop: 2 * S }}>{sub}</Text>
                </View>
                <Text style={{ color: c, fontWeight: '900', fontSize: T.body }}>{pct}</Text>
              </View>
              <View style={{ height: 5 * S, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3 }}>
                <View style={{ width: pct, height: '100%', backgroundColor: c, borderRadius: 3 }} />
              </View>
            </View>
          ))}
        </View>
      );
    }

    if (kind === 'tasks') {
      const tasks: [string, boolean][] = [
        [tr ? 'Sabah 25 dk derin odak' : 'Morning 25 min deep focus', true],
        [tr ? 'Proje sunumunu hazırla' : 'Prepare project deck', false],
        [tr ? 'Spor: 30 dk koşu' : 'Workout: 30 min run', false],
        [tr ? 'Akşam okuma alışkanlığı' : 'Evening reading habit', false],
      ];
      return (
        <View style={{ flex: 1, backgroundColor: '#120c22', padding: pad, gap: gap }}>
          <View style={{ marginTop: u * 0.5 }}>
            <Text style={LAB}>{tr ? 'BUGÜN · 6 TEMMUZ' : 'TODAY · JUL 6'}</Text>
            <Text style={{ color: '#FFFFFF', fontSize: T.h1, fontWeight: '900', letterSpacing: -0.4, marginTop: 3 * S }}>{tr ? 'Günün Planı' : 'Your Day'}</Text>
          </View>
          <View style={[CARD, { paddingHorizontal: pad, paddingVertical: u * 0.4 }]}>
            {tasks.map(([t, done], i) => (
              <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: u * 1.25, paddingVertical: u * 1.1, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: 'rgba(255,255,255,0.06)' }}>
                {done ? <CheckCircle2 size={20 * S} color={GREEN} /> : <Circle size={20 * S} color="rgba(255,255,255,0.32)" />}
                <Text style={{ flex: 1, color: done ? 'rgba(255,255,255,0.42)' : '#FFFFFF', fontSize: T.body, fontWeight: '600', textDecorationLine: done ? 'line-through' : 'none' }}>{t}</Text>
              </View>
            ))}
          </View>
          <Text style={[LAB, { marginTop: u * 0.25 }]}>{tr ? 'ALIŞKANLIKLAR' : 'HABITS'}</Text>
          <View style={{ flexDirection: 'row', gap: u * 1.1 }}>
            {[[tr ? 'Su iç' : 'Hydrate', '12', GREEN], [tr ? 'Meditasyon' : 'Meditate', '7', TEAL]].map(([n, s, c]: any) => (
              <View key={n} style={[CARD, { flex: 1, padding: pad, gap: u * 0.75 }]}>
                <Text style={{ color: '#FFFFFF', fontSize: T.body, fontWeight: '700' }}>{n}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 * S }}>
                  <Flame size={14 * S} color={AMBER} />
                  <Text style={{ color: AMBER, fontSize: T.body, fontWeight: '900' }}>{s} {tr ? 'gün' : 'd'}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      );
    }

    if (kind === 'momentum') {
      const bars = [0.4, 0.65, 0.5, 0.85, 0.7, 0.95, 0.6];
      const days = ['P', 'S', 'Ç', 'P', 'C', 'C', 'P'];
      return (
        <View style={{ flex: 1, backgroundColor: '#08171c', padding: pad, gap: gap }}>
          <Text style={{ color: '#FFFFFF', fontSize: T.h1, fontWeight: '900', lineHeight: T.h1 * 1.3, letterSpacing: -0.4, marginTop: u * 0.5 }}>{tr ? 'Momentum' : 'Insights'}</Text>
          <View style={[CARD, { padding: pad, flexDirection: 'row', alignItems: 'center', gap: pad }]}>
            <View style={{ width: 76 * S, height: 76 * S, borderRadius: 38 * S, borderWidth: 5 * S, borderColor: TEAL, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#FFFFFF', fontSize: T.big, fontWeight: '900', letterSpacing: -0.5 }}>84</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 * S }}>
                <TrendingUp size={15 * S} color={GREEN} />
                <Text style={{ color: '#FFFFFF', fontSize: T.body + 1, fontWeight: '800' }}>{tr ? 'Momentum skoru' : 'Momentum'}</Text>
              </View>
              <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: T.sub, marginTop: 4 * S }}>{tr ? 'Bu hafta 6.5 sa odak' : '6.5 h focused this week'}</Text>
            </View>
          </View>
          <View style={[CARD, { padding: pad, gap: gap }]}>
            <Text style={LAB}>{tr ? 'HAFTALIK ODAK' : 'WEEKLY FOCUS'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: u * 0.8, height: 62 * S }}>
              {bars.map((v, i) => (
                <View key={i} style={{ flex: 1, alignItems: 'center', gap: 5 * S }}>
                  <View style={{ width: '100%', height: 54 * S * v, backgroundColor: i === 5 ? TEAL : 'rgba(45,212,191,0.35)', borderRadius: 4 }} />
                  <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 8 * S, fontWeight: '700' }}>{days[i]}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      );
    }

    // home
    return (
      <View style={{ flex: 1, backgroundColor: '#0b0f1e', padding: pad, gap: gap }}>
        <View style={{ marginTop: u * 0.5 }}>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: T.sub }}>{tr ? 'İyi akşamlar,' : 'Good evening,'}</Text>
          <Text style={{ color: '#FFFFFF', fontSize: T.h1, fontWeight: '900', letterSpacing: -0.4 }}>{tr ? 'Deniz' : 'Alex'}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: u * 1.1 }}>
          {[[Target, tr ? 'Odak' : 'Focus', '1.5 sa', INDIGO], [ListChecks, tr ? 'Görev' : 'Tasks', '3/5', VIOLET], [Flame, tr ? 'Seri' : 'Streak', '12', AMBER]].map(([Ic, l, v, c]: any) => (
            <View key={l} style={[CARD, { flex: 1, paddingVertical: pad, paddingHorizontal: u, alignItems: 'center', gap: u }]}>
              <View style={chip(c, 34 * S)}><Ic size={17 * S} color={c} /></View>
              <Text style={{ color: '#FFFFFF', fontSize: T.body + 2.5, fontWeight: '900', letterSpacing: -0.3 }}>{v}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 9.5 * S, fontWeight: '700' }}>{l}</Text>
            </View>
          ))}
        </View>
        <View style={{ backgroundColor: 'rgba(139,124,246,0.14)', borderWidth: 1, borderColor: 'rgba(139,124,246,0.3)', borderRadius: rad, padding: pad, gap: u * 0.75 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: u }}>
            <View style={chip(INDIGO, 30 * S)}><Home size={15 * S} color={INDIGO} /></View>
            <Text style={{ color: '#FFFFFF', fontSize: T.body + 1, fontWeight: '800' }}>{tr ? 'Bugünün önceliği' : "Today's priority"}</Text>
          </View>
          <Text style={{ color: 'rgba(255,255,255,0.78)', fontSize: T.body }}>{tr ? 'Proje sunumunu hazırla' : 'Prepare project deck'}</Text>
        </View>
        <View style={[CARD, { padding: pad, flexDirection: 'row', alignItems: 'center', gap: u * 1.25 }]}>
          <View style={chip(TEAL, 30 * S)}><BarChart3 size={16 * S} color={TEAL} /></View>
          <Text style={{ flex: 1, color: '#FFFFFF', fontSize: T.body, fontWeight: '600' }}>{tr ? 'Haftalık momentum: 84' : 'Weekly momentum: 84'}</Text>
          <TrendingUp size={15 * S} color={GREEN} />
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0f22' }}>
      <ScrollView ref={scrollRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={16}>
        {SLIDES.map((slide) => (
          <View key={slide.kind} style={{ width: W, height: H }}>
            <LinearGradient colors={slide.colors as any} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
            {/* Renk parıltısı — kenarsız köşe gradyanı (sert daire yok) */}
            <LinearGradient pointerEvents="none" colors={[slide.accent + '40', 'transparent']} start={{ x: 0.92, y: 0.04 }} end={{ x: 0.35, y: 0.5 }} style={StyleSheet.absoluteFill} />
            <LinearGradient pointerEvents="none" colors={['transparent', slide.accent + '1F']} start={{ x: 0.4, y: 0.6 }} end={{ x: 0.05, y: 1 }} style={StyleSheet.absoluteFill} />
            <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
              <View style={{ flex: 1, paddingHorizontal: 28, paddingTop: H * 0.035, paddingBottom: 30 }}>
                <MotiView from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 450 }}>
                  <Text style={{ color: slide.accent, fontSize: 13, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase' }}>{tr ? slide.ebTr : slide.ebEn}</Text>
                  <Text style={{ color: '#FFFFFF', fontSize: Math.min(32, W * 0.08), fontWeight: '900', letterSpacing: -0.6, marginTop: 8, lineHeight: Math.min(42, W * 0.108), paddingBottom: 2 }}>{tr ? slide.tTr : slide.tEn}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '500', marginTop: 8, lineHeight: 20 }}>{tr ? slide.sTr : slide.sEn}</Text>
                </MotiView>
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <MotiView from={{ opacity: 0, scale: 0.94, translateY: 14 }} animate={{ opacity: 1, scale: 1, translateY: 0 }} transition={{ type: 'timing', duration: 550, delay: 120 }}>
                    {slide.kind === 'brand' ? (
                      <MotiView from={{ scale: 0.92 }} animate={{ scale: 1 }} transition={{ loop: true, repeatReverse: true, type: 'timing', duration: 3200 }} style={{ alignItems: 'center' }}>
                        <View style={{ width: 168, height: 168, borderRadius: 84, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(139,124,246,0.14)', borderWidth: 1, borderColor: 'rgba(139,124,246,0.3)' }}>
                          <TazqLogo size={90} variant="white" />
                        </View>
                      </MotiView>
                    ) : (
                      /* Telefon çerçevesi + temsili ekran */
                      <View style={{ width: fw, height: fh, borderRadius: 34 * S, backgroundColor: '#000', padding: 6 * S, borderWidth: 2, borderColor: 'rgba(255,255,255,0.16)', shadowColor: slide.accent, shadowOpacity: 0.5, shadowRadius: 28, shadowOffset: { width: 0, height: 12 } }}>
                        <View style={{ flex: 1, borderRadius: 29 * S, overflow: 'hidden' }}>
                          <MockScreen kind={slide.kind} />
                        </View>
                        <View style={{ position: 'absolute', top: 12 * S, alignSelf: 'center', width: fw * 0.3, height: 7 * S, borderRadius: 4, backgroundColor: '#000' }} />
                      </View>
                    )}
                  </MotiView>
                </View>
              </View>
            </SafeAreaView>
          </View>
        ))}
      </ScrollView>

      {chrome ? (
        <>
          <SafeAreaView edges={['top']} style={{ position: 'absolute', top: 0, left: 0, right: 0 }} pointerEvents="box-none">
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 6 }}>
              <Touchable accessibilityRole="button" accessibilityLabel={lang === 'tr' ? 'Kapat' : 'Close'} hitSlop={{ top: 2, bottom: 2, left: 2, right: 2 }} onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' }}>
                <X size={20} color="#FFFFFF" />
              </Touchable>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {/* TR / EN dil düğmesi */}
                <View style={{ flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 20, padding: 3 }}>
                  {(['tr', 'en'] as const).map((lg) => (
                    <Touchable key={lg} onPress={() => setLang(lg)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 17, backgroundColor: lang === lg ? '#FFFFFF' : 'transparent' }}>
                      <Text style={{ color: lang === lg ? '#000000' : '#FFFFFF', fontWeight: '800', fontSize: 12.5 }}>{lg.toUpperCase()}</Text>
                    </Touchable>
                  ))}
                </View>
                <Touchable hitSlop={{ top: 2, bottom: 2, left: 0, right: 0 }} onPress={() => setChrome(false)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.35)' }}>
                  <EyeOff size={16} color="#FFFFFF" />
                  <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>{tr ? 'Temiz' : 'Clean'}</Text>
                </Touchable>
              </View>
            </View>
          </SafeAreaView>
          <SafeAreaView edges={['bottom']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }} pointerEvents="box-none">
            <View style={{ alignItems: 'center', paddingBottom: 10, gap: 10 }}>
              <View style={{ flexDirection: 'row', gap: 7 }}>
                {SLIDES.map((_, i) => (
                  <View key={i} style={{ width: i === page ? 22 : 7, height: 7, borderRadius: 4, backgroundColor: i === page ? '#FFFFFF' : 'rgba(255,255,255,0.35)' }} />
                ))}
              </View>
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{tr ? `${page + 1} / ${SLIDES.length} · kaydır` : `${page + 1} / ${SLIDES.length} · swipe`}</Text>
            </View>
          </SafeAreaView>
        </>
      ) : (
        <SafeAreaView edges={['top']} style={{ position: 'absolute', top: 0, right: 0 }}>
          <Touchable onPress={() => setChrome(true)} activeOpacity={1} style={{ width: 56, height: 56 }} accessibilityRole="button" accessibilityLabel={tr ? 'Arayüzü göster' : 'Show controls'} />
        </SafeAreaView>
      )}
    </View>
  );
}
