import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import { Easing as REasing } from 'react-native-reanimated';
import {
  Flame,
  Timer,
  Play,
  Sparkles,
  GraduationCap,
  Wind,
  Shield,
  Plus,
  Check,
  Clock,
  CloudRain,
  Coffee,
  Waves,
  Coins,
  Dumbbell,
  BookOpen,
  Search,
  Trash2,
  CalendarClock,
  BarChart3,
  ChevronRight,
} from 'lucide-react-native';
import { MomentumPulse } from '@/shared/components/MomentumPulse';
import { HabitBubble } from '@/shared/components/HabitBubble';
import { MyDayTaskRow } from '@/shared/components/MyDayTaskRow';
import type { AppTheme } from '@/shared/constants/Colors';
import { S, ICON, R } from '@/shared/constants/tokens';
import { AppIcon } from '@/shared/components/AppIcon';

interface Props {
  pageId: string;
  step: number;
  theme: AppTheme;
  isDark: boolean;
  accent: string;
  tr: boolean;
  frameW: number;
}

// Premium dokunma göstergesi — dolu blob değil; genişleyen ince halka + basınca büzülen zarif halka
const TapPoint: React.FC<{ x: number; y: number; k: any; color: string }> = ({ x, y, k, color }) => (
  <View pointerEvents="none" style={{ position: 'absolute', left: x - 26, top: y - 26, width: 52, height: 52, alignItems: 'center', justifyContent: 'center' }}>
    {/* Genişleyen ince dalga */}
    <MotiView
      key={`r${k}`}
      from={{ scale: 0.55, opacity: 0.85 }}
      animate={{ scale: 2, opacity: 0 }}
      transition={{ type: 'timing', duration: 900, easing: REasing.out(REasing.cubic) }}
      style={{ position: 'absolute', width: 26, height: 26, borderRadius: R.full, borderWidth: 1.5, borderColor: color }}
    />
    {/* Basış halkası — zarif, cam hissi */}
    <MotiView
      key={`d${k}`}
      from={{ scale: 1.12, opacity: 0.5 }}
      animate={{ scale: 0.88, opacity: 1 }}
      transition={{ type: 'timing', duration: 300, repeat: 1, repeatReverse: true, easing: REasing.inOut(REasing.ease) }}
      style={{ width: 22, height: 22, borderRadius: R.full, borderWidth: 2, borderColor: color, backgroundColor: 'rgba(255,255,255,0.10)' }}
    />
  </View>
);

// İşlev ekranı yüzeyi — gerçek genişlikte (ölçeksiz), yükseklik içeriğe göre (dinamik + responsive)
const ScaledScreen: React.FC<{ innerW: number; children: React.ReactNode; tap?: { x: number; y: number; k: any; color?: string } }> = ({ children, tap }) => (
  <View style={{ paddingVertical: S.md }}>
    <View style={{ position: 'relative', width: '100%' }}>
      {children}
      {tap && <TapPoint x={tap.x} y={tap.y} k={tap.k} color={tap.color ?? 'rgba(120,120,130,0.5)'} />}
    </View>
  </View>
);

const noop = () => {};
const priorityColorOf = (theme: AppTheme) => (p: string) =>
  p === 'high' ? theme.error : p === 'medium' ? theme.streak : theme.onSurfaceVariant;

// ── Küçük yardımcılar ──
const soft = (d: boolean) => (d ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.045)');

/** Tek nabız — her ~3.8 sn artar. Animasyonlar sürekli dönmez; beat başına bir kez oynar. */
const useBeat = (ms = 3800) => {
  const [b, setB] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setB((x) => x + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
  return b;
};

/** Gerçekçi geri sayım — saniyede bir azalır (1500→1440 arası döner). Çember göstergesi buna oranlı döner. */
const useTimerSecs = () => {
  const [secs, setSecs] = useState(1500);
  useEffect(() => {
    const id = setInterval(() => setSecs((s) => (s <= 1440 ? 1500 : s - 1)), 950);
    return () => clearInterval(id);
  }, []);
  return secs;
};
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

/** Premium timer çemberi — dolan ilerleme yayı + ışıldayan uç + nabız halesi + tatlı zaman */
const TimerCircle: React.FC<{ secs: number; angle: number; accent: string; theme: AppTheme; isDark: boolean; tr: boolean }> = ({ secs, angle, accent, theme, isDark, tr }) => {
  const SIZE = 144;
  const STROKE = 9;
  const ringR = (SIZE - STROKE) / 2;
  const C = 2 * Math.PI * ringR;
  const frac = (angle % 360) / 360;
  const off = C * (1 - frac);
  const rad = ((angle % 360) - 90) * (Math.PI / 180);
  const tipX = SIZE / 2 + ringR * Math.cos(rad);
  const tipY = SIZE / 2 + ringR * Math.sin(rad);
  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');
  const track = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)';
  const numLight = { fontSize: 36, fontWeight: '200' as const, letterSpacing: 1, color: '#fff', fontVariant: ['tabular-nums'] as any };
  const innerR = ringR - STROKE / 2 - 2;
  return (
    <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
      {/* İç dünya — canlı ışıltılı cam orb */}
      <View style={{ position: 'absolute', width: innerR * 2, height: innerR * 2, borderRadius: innerR, overflow: 'hidden', backgroundColor: isDark ? '#0d0f17' : '#0e1020' }}>
        <LinearGradient colors={[accent + '55', accent + '18', 'transparent']} start={{ x: 0.2, y: 0 }} end={{ x: 0.85, y: 1 }} style={StyleSheet.absoluteFill} />
        {/* yavaşça süzülen ışık huzmesi */}
        <MotiView
          from={{ translateX: -innerR * 0.3, translateY: -innerR * 0.25, opacity: 0.45 }}
          animate={{ translateX: innerR * 0.35, translateY: innerR * 0.3, opacity: 0.85 }}
          transition={{ type: 'timing', duration: 4200, loop: true, repeatReverse: true, easing: REasing.inOut(REasing.ease) }}
          style={{ position: 'absolute', top: '18%', left: '22%', width: innerR, height: innerR, borderRadius: innerR, backgroundColor: accent + '33' }}
        />
        {/* üst parıltı */}
        <View style={{ position: 'absolute', top: -innerR * 0.35, alignSelf: 'center', width: innerR * 1.3, height: innerR * 0.7, borderRadius: innerR, backgroundColor: 'rgba(255,255,255,0.06)' }} />
      </View>

      {/* İlerleme yayı */}
      <Svg width={SIZE} height={SIZE} style={{ position: 'absolute' }}>
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={ringR} stroke={track} strokeWidth={STROKE} fill="none" />
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={ringR}
          stroke={accent}
          strokeWidth={STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${C} ${C}`}
          strokeDashoffset={off}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </Svg>

      {/* Işıldayan ilerleme ucu */}
      <View pointerEvents="none" style={{ position: 'absolute', left: tipX - 6, top: tipY - 6, width: 12, height: 12, borderRadius: R.full, backgroundColor: '#fff', borderWidth: 2.5, borderColor: accent, shadowColor: accent, shadowOpacity: 1, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } }} />

      {/* Tatlı zaman — orb'un içinde yüzer */}
      <MotiView key={secs} from={{ scale: 1.035 }} animate={{ scale: 1 }} transition={{ type: 'timing', duration: 280, easing: REasing.out(REasing.cubic) }} style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <Text style={numLight}>{mm}</Text>
        <Text style={{ fontSize: 30, fontWeight: '200', color: '#fff', marginHorizontal: S.xxs, opacity: secs % 2 === 0 ? 1 : 0.25 }}>:</Text>
        <Text style={numLight}>{ss}</Text>
      </MotiView>
    </View>
  );
};

/** from→to sayan, bir süre bekleyip baştan başlayan sayaç */
const CountUp: React.FC<{
  from: number;
  to: number;
  duration?: number;
  hold?: number;
  format?: (v: number) => string;
  style?: any;
}> = ({ from, to, duration = 1300, hold = 2400, format, style }) => {
  const [v, setV] = useState(from);
  const raf = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    let cancelled = false;
    const run = () => {
      const t0 = Date.now();
      const loop = () => {
        if (cancelled) return;
        const p = Math.min(1, (Date.now() - t0) / duration);
        setV(Math.round(from + (to - from) * p));
        if (p < 1) raf.current = requestAnimationFrame(loop);
        else timer.current = setTimeout(() => { setV(from); run(); }, hold);
      };
      loop();
    };
    run();
    return () => {
      cancelled = true;
      if (raf.current) cancelAnimationFrame(raf.current);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [from, to, duration, hold]);
  return <Text style={style}>{format ? format(v) : v}</Text>;
};

export const TourFeaturePreview: React.FC<Props> = ({ pageId, step, theme, isDark, accent, tr, frameW }) => {
  const key = `${pageId}-${step}`;
  // Tek nabız — animasyonlar sürekli dönmez, ~3.8 sn'de bir baştan oynar
  const beat = useBeat(3800);
  const toggle = beat % 2 === 1;
  const cyc3 = beat % 3;
  const cyc7 = beat % 7;
  const timerSecs = useTimerSecs();
  const timerAngle = ((1500 - timerSecs) * 6) % 360; // saniyede 6° → dakikada bir tam tur

  const wrap = (children: React.ReactNode) => (
    <View style={styles.screen}>{children}</View>
  );

  // Gerçek ekranlardaki kart görünümü (BentoCard benzeri)
  const card: any = {
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    backgroundColor: isDark ? '#16171c' : '#ffffff',
    padding: S.md,
  };

  const sectionLabel = { fontSize: 9, fontWeight: '700', letterSpacing: 1, opacity: 0.6 } as const;

  switch (key) {
    // ───────────────── DASHBOARD (gerçek bileşenler) ─────────────────
    case 'dashboard-0': // Gerçek dashboard kesiti: selamlama + MomentumPulse + Bugün
      return (
        <ScaledScreen innerW={frameW}>
          <View>
            <View style={{ paddingHorizontal: S.md, marginBottom: S.smd }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: theme.onSurface, letterSpacing: -0.5 }}>
                {tr ? 'Günaydın, ' : 'Good morning, '}
                <Text style={{ color: theme.primary }}>{tr ? 'Melih' : 'Alex'}</Text>
              </Text>
            </View>
            <MomentumPulse
              score={84}
              language={tr ? 'tr' : 'en'}
              history={[
                { date: '1', score: 42 },
                { date: '2', score: 55 },
                { date: '3', score: 48 },
                { date: '4', score: 63 },
                { date: '5', score: 71 },
                { date: '6', score: 66 },
                { date: '7', score: 84 },
              ]}
            />
            <View style={{ paddingHorizontal: S.md }}>
              {/* İvme Kalkanı — tatil günlerinde skor erimesini durdurur */}
              <View style={[card, { padding: S.smd, flexDirection: 'row', alignItems: 'center', gap: S.smd, borderColor: toggle ? theme.streak + '55' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)') }]}>
                <View style={{ width: 34, height: 34, borderRadius: R.md, backgroundColor: theme.streak, alignItems: 'center', justifyContent: 'center' }}>
                  <Shield size={ICON.sm} color="#FFFFFF" strokeWidth={2.3} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: theme.onSurface }}>{tr ? 'İvme Kalkanı' : 'Momentum Shield'}</Text>
                  <Text style={{ fontSize: 9.5, fontWeight: '600', color: toggle ? theme.streak : theme.onSurfaceVariant, opacity: toggle ? 1 : 0.5 }}>{toggle ? (tr ? 'Aktif · skor donduruldu' : 'Active · score frozen') : (tr ? 'Devre dışı' : 'Inactive')}</Text>
                </View>
                <MotiView animate={{ backgroundColor: toggle ? theme.streak : (isDark ? '#3a3a3c' : '#e5e5ea') }} transition={{ type: 'timing', duration: 260 }} style={{ width: 34, height: 20, borderRadius: R.sm, padding: S.xxs, justifyContent: 'center' }}>
                  <MotiView animate={{ translateX: toggle ? 14 : 0 }} transition={{ type: 'spring', damping: 16 }} style={{ width: 16, height: 16, borderRadius: R.full, backgroundColor: '#fff' }} />
                </MotiView>
              </View>
            </View>
          </View>
        </ScaledScreen>
      );

    case 'dashboard-1': { // Gerçek ritüel bubble'ları — ortadaki tamamlanıyor
      const habits = [
        { id: 'h1', color: theme.tertiary, emoji: '💧', title: tr ? 'Su' : 'Water', streak: 6, isCompleted: true, isSkipped: false },
        { id: 'h2', color: theme.primary, emoji: '📖', title: tr ? 'Kitap' : 'Read', streak: toggle ? 5 : 4, isCompleted: toggle, isSkipped: false },
        { id: 'h3', color: theme.streak, emoji: '🧘', title: tr ? 'Medite' : 'Meditate', streak: 3, isCompleted: false, isSkipped: false },
      ];
      return (
        <ScaledScreen innerW={frameW} tap={{ x: 123, y: 66, k: toggle, color: theme.primary }}>
          <View style={{ paddingHorizontal: S.md }}>
            <Text style={{ fontSize: 9, fontWeight: '700', letterSpacing: 1.5, color: theme.onSurfaceVariant }}>
              {tr ? 'BUGÜNKÜ ALIŞKANLIKLARIM' : 'MY DAILY HABITS'}
            </Text>
            <Text style={{ fontSize: 8.5, color: theme.onSurfaceMuted, marginTop: S.xxs }}>
              {tr ? 'Alışkanlığı tamamlamak için bas' : 'Tap habit to complete'}
            </Text>
            <View style={{ flexDirection: 'row', gap: S.md, paddingVertical: S.md }}>
              {habits.map((h) => (
                <HabitBubble key={h.id} item={h} theme={theme} isDark={isDark} tr={tr} onPress={noop} onLongPress={noop} />
              ))}
            </View>
          </View>
        </ScaledScreen>
      );
    }

    case 'dashboard-2': { // Gerçek görev satırları — ilki tamamlanıyor
      const tasks = [
        { priority: 'high', isCompleted: toggle, original: { title: tr ? 'Raporu yaz' : 'Write report' } },
        { priority: 'medium', isCompleted: false, original: { title: tr ? 'E-postaları yanıtla' : 'Reply emails' } },
        { priority: 'low', isCompleted: false, original: { title: tr ? 'Spor salonu' : 'Go to gym' } },
      ];
      return (
        <ScaledScreen innerW={frameW} tap={{ x: frameW - 30, y: 46, k: toggle, color: theme.primary }}>
          <View style={{ paddingHorizontal: S.md }}>
            <Text style={{ fontSize: 9, fontWeight: '700', letterSpacing: 1.5, color: theme.onSurfaceVariant, marginBottom: S.xs }}>
              {tr ? 'GÜNLÜK GÖREVLERİM' : 'MY DAILY TASKS'}
            </Text>
            {tasks.map((t, i) => (
              <MyDayTaskRow
                key={i}
                item={t}
                isLast={i === tasks.length - 1}
                theme={theme}
                isDark={isDark}
                tr={tr}
                onPress={noop}
                priorityColor={priorityColorOf(theme)}
                prefs={{}}
              />
            ))}
          </View>
        </ScaledScreen>
      );
    }

    case 'dashboard-3': // Kokpit girişi: BUGÜN kartı + haftalık karne butonu
      return (
        <ScaledScreen innerW={frameW} tap={{ x: frameW - 34, y: 96, k: cyc3, color: theme.primary }}>
          <View style={{ paddingHorizontal: S.md }}>
            <View style={[card, { overflow: 'hidden', marginBottom: S.smd }]}>
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.primary + (isDark ? '20' : '12') }} />
              <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 0.5, color: theme.onSurfaceMuted }}>
                {tr ? 'BUGÜN' : 'TODAY'}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: S.xs, marginTop: S.xs }}>
                <CountUp from={0} to={6} duration={1200} hold={1500} style={{ fontSize: 40, fontWeight: '600', letterSpacing: -2.5, color: theme.primary }} />
                <Text style={{ fontSize: 18, fontWeight: '600', color: theme.onSurfaceMuted }}>/8</Text>
                <Text style={{ fontSize: 11, fontWeight: '600', color: theme.onSurfaceMuted, marginLeft: S.sm }}>
                  {tr ? 'görev tamamlandı' : 'tasks done'}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: S.smd, paddingHorizontal: S.md, borderRadius: R.md, backgroundColor: theme.tertiary + '18' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
                <BarChart3 size={ICON.sm} color={theme.tertiary} strokeWidth={2.4} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: theme.tertiary }}>{tr ? 'Haftalık karneni gör' : 'View weekly review'}</Text>
              </View>
              <ChevronRight size={ICON.sm} color={theme.tertiary} strokeWidth={2.6} />
            </View>
          </View>
        </ScaledScreen>
      );

    // ───────────────── TASKS ─────────────────
    case 'tasks-0': { // Arama + filtre çipleri + görev ekle (FAB)
      const active = cyc3;
      const labels = tr ? ['Tümü', 'Bugün', 'Yüksek', 'Bitti'] : ['All', 'Today', 'High', 'Done'];
      const rows = [
        { priority: 'high', isCompleted: false, original: { title: tr ? 'Sunumu bitir' : 'Finish deck' } },
        { priority: 'medium', isCompleted: false, original: { title: tr ? 'Faturaları öde' : 'Pay bills' } },
      ];
      return (
        <ScaledScreen innerW={frameW} tap={{ x: frameW - 34, y: 176, k: toggle, color: theme.primary }}>
          <View style={{ paddingHorizontal: S.md }}>
            {/* Arama çubuğu */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, backgroundColor: soft(isDark), borderRadius: R.full, paddingHorizontal: S.md, height: 38, marginBottom: S.smd }}>
              <Search size={ICON.sm} color={theme.onSurfaceVariant} strokeWidth={2.2} />
              <Text style={{ fontSize: 12, color: theme.onSurfaceMuted }}>{tr ? 'Görev ara…' : 'Search tasks…'}</Text>
            </View>
            {/* Filtre çipleri */}
            <View style={{ flexDirection: 'row', gap: S.sm, marginBottom: S.smd }}>
              {labels.map((l, i) => {
                const on = i === active;
                return (
                  <MotiView key={i} animate={{ borderColor: on ? theme.primary : isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.14)' }} transition={{ type: 'timing', duration: 240 }}
                    style={{ borderWidth: 1, borderRadius: R.full, paddingVertical: S.xs, paddingHorizontal: S.smd, backgroundColor: on ? (isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.05)') : 'transparent' }}>
                    <Text style={{ fontSize: 12, fontWeight: on ? '700' : '600', color: on ? theme.primary : theme.onSurfaceVariant }}>{l}</Text>
                  </MotiView>
                );
              })}
            </View>
            {rows.map((t, i) => (
              <MyDayTaskRow key={i} item={t} isLast={i === rows.length - 1} theme={theme} isDark={isDark} tr={tr} onPress={noop} priorityColor={priorityColorOf(theme)} prefs={{}} />
            ))}
          </View>
          {/* FAB — görev ekle */}
          <MotiView
            key={`fab${beat}`}
            from={{ scale: 1 }}
            animate={{ scale: 1.12 }}
            transition={{ type: 'timing', duration: 550, repeat: 2, repeatReverse: true, easing: REasing.inOut(REasing.ease) }}
            style={{ position: 'absolute', right: 16, top: 158, width: 46, height: 46, borderRadius: R.full, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center', shadowColor: theme.primary, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8 }}
          >
            <Plus size={ICON.lg} color="#fff" strokeWidth={2.6} />
          </MotiView>
        </ScaledScreen>
      );
    }

    case 'tasks-1': { // Kaydırarak ertele/sil + tamamla
      const rows = [
        { priority: 'medium', isCompleted: false, original: { title: tr ? 'Faturaları öde' : 'Pay bills' } },
        { priority: 'low', isCompleted: toggle, original: { title: tr ? 'Kitap oku' : 'Read a book' } },
      ];
      return (
        <ScaledScreen innerW={frameW} tap={{ x: frameW - 30, y: 88, k: toggle, color: theme.primary }}>
          <View style={{ paddingHorizontal: S.md }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: theme.onSurface, marginBottom: S.sm }}>{tr ? 'Yaklaşanlar' : 'Upcoming'}</Text>
            {/* Kaydırılan satır → ertele/sil aksiyonları */}
            <View style={{ height: 50, borderRadius: R.md, overflow: 'hidden', justifyContent: 'center', marginBottom: S.xxs }}>
              <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, flexDirection: 'row' }}>
                <View style={{ width: 46, backgroundColor: theme.tertiary, alignItems: 'center', justifyContent: 'center' }}>
                  <CalendarClock size={ICON.sm} color="#fff" strokeWidth={2.4} />
                </View>
                <View style={{ width: 46, backgroundColor: theme.error, alignItems: 'center', justifyContent: 'center' }}>
                  <Trash2 size={ICON.sm} color="#fff" strokeWidth={2.4} />
                </View>
              </View>
              <MotiView
                key={`sw${beat}`}
                from={{ translateX: 0 }}
                animate={{ translateX: -92 }}
                transition={{ type: 'timing', duration: 900, repeat: 1, repeatReverse: true, delay: 400, easing: REasing.inOut(REasing.ease) }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: S.smd, height: 50, borderRadius: R.md, paddingHorizontal: S.smd, backgroundColor: theme.background }}
              >
                <View style={{ width: 7, height: 7, borderRadius: R.full, backgroundColor: theme.error }} />
                <Text style={{ fontSize: 14, fontWeight: '600', color: theme.onSurface, flex: 1 }}>{tr ? 'Spor salonu' : 'Go to gym'}</Text>
              </MotiView>
            </View>
            {rows.map((t, i) => (
              <MyDayTaskRow key={i} item={t} isLast={i === rows.length - 1} theme={theme} isDark={isDark} tr={tr} onPress={noop} priorityColor={priorityColorOf(theme)} prefs={{}} />
            ))}
          </View>
        </ScaledScreen>
      );
    }

    // ───────────────── FOCUS (her adım farklı işlev) ─────────────────
    case 'focus-0': { // Çalışma modu + ambiyans sesleri
      const sounds = [
        { Ic: CloudRain, l: tr ? 'Yağmur' : 'Rain' },
        { Ic: Coffee, l: tr ? 'Kafe' : 'Cafe' },
        { Ic: Waves, l: tr ? 'Okyanus' : 'Ocean' },
      ];
      return (
        <ScaledScreen innerW={frameW}>
          <View style={{ paddingHorizontal: S.md, gap: S.md }}>
            <View style={{ alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: soft(isDark), borderRadius: R.xl, padding: S.xs }}>
                {[Wind, Timer, Shield].map((Ic, i) => {
                  const on = i === cyc3;
                  return (
                    <MotiView key={i} animate={{ backgroundColor: on ? theme.primary + '20' : 'transparent' }} transition={{ type: 'timing', duration: 240 }} style={{ padding: S.smd, borderRadius: R.lg }}>
                      <Ic size={17} color={on ? theme.primary : theme.onSurfaceVariant} strokeWidth={2.5} />
                    </MotiView>
                  );
                })}
              </View>
            </View>
            <View>
              <Text style={[sectionLabel, { color: theme.onSurfaceVariant, marginBottom: S.sm }]}>{tr ? 'AMBİYANS SESLERİ' : 'AMBIENT SOUNDS'}</Text>
              <View style={{ flexDirection: 'row', gap: S.sm }}>
                {sounds.map((s, i) => {
                  const on = i === cyc3;
                  return (
                    <MotiView key={i} animate={{ borderColor: on ? theme.tertiary : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'), backgroundColor: on ? theme.tertiary + '14' : 'transparent' }} transition={{ type: 'timing', duration: 240 }}
                      style={{ flex: 1, alignItems: 'center', gap: S.xs, paddingVertical: S.smd, borderRadius: R.md, borderWidth: 1 }}>
                      <s.Ic size={17} color={on ? theme.tertiary : theme.onSurfaceVariant} strokeWidth={2.2} />
                      <Text style={{ fontSize: 10, fontWeight: '700', color: on ? theme.tertiary : theme.onSurfaceVariant }}>{s.l}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: S.xxs, height: 10 }}>
                        {[0, 1, 2].map((b) => (
                          <MotiView key={`eq${beat}-${b}`} from={{ height: 3 }} animate={{ height: on ? 9 : 3 }} transition={{ type: 'timing', duration: 380, repeat: on ? 5 : 0, repeatReverse: true, delay: b * 120 }} style={{ width: 2.5, borderRadius: R.xs, backgroundColor: on ? theme.tertiary : theme.onSurfaceVariant + '55' }} />
                        ))}
                      </View>
                    </MotiView>
                  );
                })}
              </View>
            </View>
          </View>
        </ScaledScreen>
      );
    }

    case 'focus-1': // Zamanlayıcı + süre seçimi (çalışan seans)
      return (
        <ScaledScreen innerW={frameW}>
          <View style={{ alignItems: 'center', gap: S.md, paddingTop: S.xxs }}>
            <TimerCircle secs={timerSecs} angle={timerAngle} accent={theme.primary} theme={theme} isDark={isDark} tr={tr} />
            <View style={{ flexDirection: 'row', gap: S.sm }}>
              {['15', '25', '50'].map((m, i) => {
                const on = i === 1;
                return (
                  <View key={i} style={{ paddingVertical: S.sm, paddingHorizontal: S.md, borderRadius: R.full, backgroundColor: on ? theme.primary : soft(isDark) }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: on ? '#fff' : theme.onSurfaceVariant }}>{m}{tr ? 'dk' : 'm'}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </ScaledScreen>
      );

    case 'focus-2': // Başlat + katı/zen kontrolleri
      return (
        <ScaledScreen innerW={frameW}>
          <View style={{ alignItems: 'center', gap: S.lmd, paddingTop: S.xs }}>
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <MotiView key={`fr${beat}`} from={{ scale: 0.5, opacity: 0.45 }} animate={{ scale: 1.9, opacity: 0 }} transition={{ type: 'timing', duration: 900, repeat: 1, easing: REasing.out(REasing.ease) }} style={{ position: 'absolute', width: 72, height: 72, borderRadius: R.full, backgroundColor: theme.primary + '40' }} />
              <View style={{ width: 72, height: 72, borderRadius: R.full, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center', shadowColor: theme.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 8 }}>
                <Play size={ICON.xl} color="#fff" fill="#fff" style={{ marginLeft: S.xs }} />
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingVertical: S.sm, paddingHorizontal: S.md, borderRadius: R.full, backgroundColor: theme.primary + '18' }}>
              <Shield size={ICON.xs} color={theme.primary} strokeWidth={2.4} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: theme.primary }}>{tr ? 'Katı Mod açık' : 'Strict Mode on'}</Text>
            </View>
          </View>
        </ScaledScreen>
      );

    case 'focus-3': { // Seans başlar → çembere dokun → koyu sade Zen ekranı
      const H = 224;
      const RING = 128;
      const zen = beat % 2 === 1; // aydınlık seans ↔ koyu Zen arası geçiş
      const stars = [
        [0.12, 0.18, 1.6], [0.26, 0.42, 1], [0.18, 0.72, 1.4], [0.08, 0.55, 1],
        [0.34, 0.14, 1], [0.4, 0.8, 1.6], [0.5, 0.26, 1], [0.62, 0.16, 1.3],
        [0.7, 0.5, 1], [0.8, 0.24, 1.5], [0.88, 0.62, 1], [0.92, 0.4, 1.2],
        [0.58, 0.82, 1], [0.74, 0.78, 1.4], [0.3, 0.62, 1], [0.86, 0.85, 1],
        [0.05, 0.32, 1.2], [0.22, 0.9, 1], [0.46, 0.55, 1.3], [0.54, 0.68, 1],
        [0.66, 0.34, 1.5], [0.78, 0.62, 1], [0.94, 0.72, 1.3], [0.15, 0.4, 1],
        [0.38, 0.36, 1], [0.5, 0.9, 1.4], [0.68, 0.9, 1], [0.82, 0.46, 1.2],
      ];
      return (
        <View style={{ height: H, overflow: 'hidden', backgroundColor: theme.background }}>
          {/* Katman 1: aydınlık çalışan seans + çembere dokunma */}
          <MotiView animate={{ opacity: zen ? 0 : 1 }} transition={{ type: 'timing', duration: 450 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: S.smd }}>
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <TimerCircle secs={timerSecs} angle={timerAngle} accent={theme.primary} theme={theme} isDark={isDark} tr={tr} />
              {/* Çembere dokunma göstergesi — çemberin alt kenarında */}
              {!zen && (
                <View pointerEvents="none" style={{ position: 'absolute', bottom: -8, alignItems: 'center' }}>
                  <MotiView key={`ztap${beat}`} from={{ scale: 0.55, opacity: 0.85 }} animate={{ scale: 2, opacity: 0 }} transition={{ type: 'timing', duration: 900, repeat: 2, easing: REasing.out(REasing.cubic) }} style={{ position: 'absolute', width: 26, height: 26, borderRadius: R.full, borderWidth: 1.5, borderColor: theme.secondary }} />
                  <MotiView key={`zdot${beat}`} from={{ scale: 1.12, opacity: 0.5 }} animate={{ scale: 0.88, opacity: 1 }} transition={{ type: 'timing', duration: 340, repeat: 3, repeatReverse: true, easing: REasing.inOut(REasing.ease) }} style={{ width: 22, height: 22, borderRadius: R.full, borderWidth: 2, borderColor: theme.secondary, backgroundColor: 'rgba(255,255,255,0.10)' }} />
                </View>
              )}
            </View>
            <Text style={{ fontSize: 11, fontWeight: '600', color: theme.onSurfaceMuted }}>{tr ? 'çembere dokun →' : 'tap the circle →'}</Text>
          </MotiView>

          {/* Katman 2: koyu yıldız gökyüzü + kozmik saat (Zen) */}
          <MotiView animate={{ opacity: zen ? 1 : 0 }} transition={{ type: 'timing', duration: 600 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
            <LinearGradient colors={['#010006', '#08031d', '#13042b', '#06162d']} start={{ x: 0.1, y: 0.1 }} end={{ x: 0.9, y: 0.9 }} style={StyleSheet.absoluteFill} />
            {stars.map(([xf, yf, s], i) => (
              <View key={i} style={{ position: 'absolute', left: xf * frameW, top: yf * H, width: s, height: s, borderRadius: s, backgroundColor: 'rgba(255,255,255,0.85)' }} />
            ))}
            <View style={{ width: RING, height: RING, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ position: 'absolute', width: RING, height: RING, borderRadius: RING / 2, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.18)' }}>
                <View style={{ position: 'absolute', top: 0, left: '50%', marginLeft: -0.5, width: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.45)' }} />
                <View style={{ position: 'absolute', top: '50%', marginTop: -0.5, right: 0, width: 6, height: 1, backgroundColor: 'rgba(255,255,255,0.45)' }} />
                <View style={{ position: 'absolute', bottom: 0, left: '50%', marginLeft: -0.5, width: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.45)' }} />
                <View style={{ position: 'absolute', top: '50%', marginTop: -0.5, left: 0, width: 6, height: 1, backgroundColor: 'rgba(255,255,255,0.45)' }} />
              </View>
              <View style={{ position: 'absolute', width: RING, height: RING, alignItems: 'center', transform: [{ rotate: `${timerAngle}deg` }] }}>
                <View style={{ position: 'absolute', top: -8, width: 16, height: 16, alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{ position: 'absolute', width: 16, height: 16, borderRadius: R.full, backgroundColor: 'rgba(0,229,255,0.18)' }} />
                  <View style={{ width: 8, height: 8, backgroundColor: '#fff', transform: [{ rotate: '45deg' }] }} />
                </View>
              </View>
              <Text style={{ fontSize: 26, fontWeight: '300', letterSpacing: 1, color: '#fff' }}>{mmss(timerSecs)}</Text>
              <Text style={{ fontSize: 8, fontWeight: '700', letterSpacing: 3, color: 'rgba(0,229,255,0.85)', marginTop: S.xxs }}>ZEN</Text>
            </View>
          </MotiView>
        </View>
      );
    }

    // ───────────────── MODLAR ─────────────────
    case 'modlar-0': // Haftalık Merkez — genel bakış (aktif mod durumu)
      return (
        <ScaledScreen innerW={frameW}>
          <View style={{ paddingHorizontal: S.md }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: theme.onSurface, letterSpacing: -0.5 }}>{tr ? 'Haftalık Merkez' : 'Weekly Hub'}</Text>
            <Text style={{ fontSize: 12, color: theme.onSurfaceMuted, marginTop: S.xs, marginBottom: S.smd }}>
              {tr ? 'Aktif dönem hedeflerini tek yerden takip et' : 'Track your active seasonal goals in one place'}
            </Text>

            <View style={[card, { borderColor: theme.primary + '40', backgroundColor: isDark ? theme.primary + '1A' : theme.primary + '12', padding: S.smd }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.smd }}>
                <AppIcon Icon={GraduationCap} color={theme.primary} size={44} radius={R.md} iconSize={ICON.lg} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: 14 }}>{tr ? 'Sınav Planı' : 'Exam Plan'}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: S.xs }}>
                    <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 20, letterSpacing: -0.5 }}>13</Text>
                    <Text style={{ color: theme.primary, fontWeight: '600', fontSize: 11 }}>{tr ? 'gün kaldı' : 'days left'}</Text>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end', gap: S.xs }}>
                  <View style={{ flexDirection: 'row', gap: S.xs }}>
                    {[0, 1, 2, 3].map((i) => (
                      <View key={i} style={{ width: 7, height: 7, borderRadius: R.full, backgroundColor: i < 3 ? theme.primary : theme.onSurfaceVariant + '30' }} />
                    ))}
                  </View>
                  <Text style={{ fontSize: 9, fontWeight: '600', color: theme.onSurfaceVariant }}>{tr ? 'bugün 3/4' : 'today 3/4'}</Text>
                </View>
              </View>
              <Text style={{ color: theme.onSurfaceVariant, fontSize: 11, fontWeight: '500', marginTop: S.smd, lineHeight: 16 }}>
                {tr ? 'Son düzlük! Bugünkü planına sadık kal, hedefe çok az kaldı.' : 'Final stretch! Stick to today’s plan, you’re almost there.'}
              </Text>
            </View>
          </View>
        </ScaledScreen>
      );

    case 'modlar-1': { // Hazır mod seçimi (ızgaradan bir hedef seç)
      const modes = [
        { Ic: GraduationCap, l: tr ? 'Sınav' : 'Exam', c: theme.primary },
        { Ic: BookOpen, l: tr ? 'Tez' : 'Thesis', c: theme.tertiary },
        { Ic: Coins, l: tr ? 'Tasarruf' : 'Savings', c: theme.secondary },
        { Ic: Dumbbell, l: tr ? 'Spor' : 'Fitness', c: theme.success },
      ];
      return (
        <ScaledScreen innerW={frameW}>
          <View style={{ paddingHorizontal: S.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: S.smd }}>
              <Sparkles size={ICON.xs} color="#8B5CF6" />
              <Text style={[sectionLabel, { color: theme.onSurfaceVariant, textTransform: 'uppercase' }]}>{tr ? 'Yeni Hedef Keşfet' : 'Discover New Goals'}</Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>
              {modes.map((m, i) => {
                const on = i === cyc7 % 4;
                return (
                  <MotiView
                    key={i}
                    animate={{ borderColor: on ? m.c : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)'), backgroundColor: on ? m.c + '16' : (isDark ? '#16171c' : '#fff'), scale: on ? 1.03 : 1 }}
                    transition={{ type: 'spring', damping: 15 }}
                    style={{ width: '47%', flexDirection: 'row', alignItems: 'center', gap: S.smd, padding: S.smd, borderRadius: R.md, borderWidth: 1.2 }}
                  >
                    <View style={{ width: 34, height: 34, borderRadius: R.md, backgroundColor: m.c, alignItems: 'center', justifyContent: 'center' }}>
                      <m.Ic size={ICON.sm} color="#FFFFFF" strokeWidth={2.3} />
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: theme.onSurface }}>{m.l}</Text>
                  </MotiView>
                );
              })}
            </View>
          </View>
        </ScaledScreen>
      );
    }

    case 'modlar-2': { // Gerçek "Aktif Hedeflerim" listesi
      const items = tr ? ['Edebiyat çalış', 'Deneme sınavı', 'Su iç'] : ['Study literature', 'Practice exam', 'Drink water'];
      return (
        <ScaledScreen innerW={frameW}>
          <View style={{ paddingHorizontal: S.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: S.sm }}>
              <Flame size={ICON.sm} color="#F97316" />
              <Text style={{ color: theme.onSurfaceVariant, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>{tr ? 'Aktif Hedeflerim' : 'Active Goals'}</Text>
            </View>
            {items.map((it, i) => (
              <MotiView
                key={`${toggle}-${i}`}
                from={{ opacity: 0, translateX: 20 }}
                animate={{ opacity: 1, translateX: 0 }}
                transition={{ type: 'timing', duration: 340, delay: i * 120 }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: S.smd, paddingVertical: S.smd, borderBottomWidth: i < 2 ? 1 : 0, borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }}
              >
                <View style={{ width: 7, height: 7, borderRadius: R.full, backgroundColor: theme.primary }} />
                <Text style={{ color: theme.onSurface, fontSize: 14, fontWeight: '600' }}>{it}</Text>
              </MotiView>
            ))}
          </View>
        </ScaledScreen>
      );
    }

    // ───────────────── COCKPIT ─────────────────
    case 'cockpit-0': { // Gerçek "BU HAFTA" şeridi
      const day = cyc7;
      const abbr = tr ? ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'] : ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
      return (
        <ScaledScreen innerW={frameW}>
          <View style={{ paddingHorizontal: S.md }}>
            <View style={card}>
              <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: theme.onSurfaceMuted, marginBottom: S.smd }}>{tr ? 'BU HAFTA' : 'THIS WEEK'}</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                {abbr.map((a, i) => {
                  const today = i === 2;
                  const sel = i === day;
                  return (
                    <MotiView
                      key={i}
                      animate={{ backgroundColor: today ? theme.primary + '18' : sel ? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)') : 'transparent', borderColor: sel ? theme.primary + '70' : 'transparent' }}
                      transition={{ type: 'timing', duration: 220 }}
                      style={{ alignItems: 'center', width: 28, paddingVertical: S.sm, borderRadius: R.sm, borderWidth: 1, gap: S.xs }}
                    >
                      <Text style={{ fontSize: 9, fontWeight: '700', color: today ? theme.primary : theme.onSurfaceVariant, opacity: i < 2 && !today ? 0.4 : 1 }}>{a}</Text>
                      <View style={{ width: 6, height: 6, borderRadius: R.full, backgroundColor: today || sel ? theme.primary : theme.onSurfaceVariant + '40' }} />
                    </MotiView>
                  );
                })}
              </View>
            </View>
          </View>
        </ScaledScreen>
      );
    }

    case 'cockpit-1': { // Gerçek günlük bölüm (başlık + görev ekle + satırlar)
      const tasks = [
        { priority: 'high', isCompleted: toggle, original: { title: tr ? 'Matematik tekrarı' : 'Math review' } },
        { priority: 'low', isCompleted: false, original: { title: tr ? 'Akşam yürüyüşü' : 'Evening walk' } },
      ];
      return (
        <ScaledScreen innerW={frameW} tap={{ x: frameW - 30, y: 74, k: toggle, color: theme.primary }}>
          <View style={{ paddingHorizontal: S.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: S.sm }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: theme.onSurface }}>{tr ? 'PAZARTESİ' : 'MONDAY'}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, backgroundColor: theme.primary + '18', paddingHorizontal: S.smd, paddingVertical: S.sm, borderRadius: R.full }}>
                <Plus size={ICON.xs} color={theme.primary} strokeWidth={2.5} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: theme.primary }}>{tr ? 'Görev Ekle' : 'Add Task'}</Text>
              </View>
            </View>
            <View style={[card, { padding: 0, overflow: 'hidden' }]}>
              {tasks.map((t, i) => (
                <MyDayTaskRow key={i} item={t} isLast={i === tasks.length - 1} theme={theme} isDark={isDark} tr={tr} onPress={noop} priorityColor={priorityColorOf(theme)} prefs={{}} />
              ))}
            </View>
          </View>
        </ScaledScreen>
      );
    }

    case 'cockpit-2': { // Gerçek "Haftalık Özet" stat çipleri
      const stats = [
        { Ic: Check, val: '23', lbl: tr ? 'Tamamlandı' : 'Completed', c: theme.success },
        { Ic: Clock, val: tr ? '4s 20d' : '4h 20m', lbl: tr ? 'Odak' : 'Focus', c: theme.primary },
        { Ic: Flame, val: '86%', lbl: tr ? 'Alışkanlık' : 'Habits', c: theme.streak },
      ];
      return (
        <ScaledScreen innerW={frameW}>
          <View style={{ paddingHorizontal: S.md }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: theme.onSurface, marginBottom: S.smd }}>{tr ? 'Haftalık Özet' : 'Weekly Review'}</Text>
            <View style={{ flexDirection: 'row', gap: S.sm }}>
              {stats.map((s, i) => (
                <View key={i} style={{ flex: 1, alignItems: 'center', gap: S.xs, paddingVertical: S.smd, borderRadius: R.md, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}>
                  <s.Ic size={15} color={s.c} strokeWidth={2.5} />
                  <Text style={{ fontSize: 15, fontWeight: '700', color: s.c }}>{s.val}</Text>
                  <Text style={{ fontSize: 9, fontWeight: '600', color: theme.onSurfaceVariant }}>{s.lbl}</Text>
                </View>
              ))}
            </View>

            {/* Haftalık hedef ilerlemesi */}
            <View style={[card, { marginTop: S.smd, padding: S.smd }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: S.sm }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: theme.onSurface }}>{tr ? 'Haftalık Hedef' : 'Weekly Goal'}</Text>
                <Text style={{ fontSize: 11, fontWeight: '700', color: theme.success }}>23/30</Text>
              </View>
              <View style={{ height: 7, borderRadius: R.xs, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                <MotiView
                  from={{ width: '10%' }}
                  animate={{ width: '77%' }}
                  transition={{ type: 'timing', duration: 1200, easing: REasing.out(REasing.cubic) }}
                  style={{ height: 7, borderRadius: R.xs, backgroundColor: theme.success }}
                />
              </View>
            </View>
          </View>
        </ScaledScreen>
      );
    }

    default:
      return wrap(<View style={styles.center} />);
  }
};

const styles = StyleSheet.create({
  screen: { flex: 1, padding: S.md, justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
