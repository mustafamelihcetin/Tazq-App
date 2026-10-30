import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { runOnJS, useReducedMotion, useSharedValue } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useTween } from '@/shared/hooks/useTween';
import { Check } from 'lucide-react-native';
import { DisplayPanel, DisplayStatus, DisplayDivider, DisplayReadout } from '@/shared/components/DisplayPanel';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { TourTarget } from '@/shared/components/TourContext';
import { Touchable } from '@/shared/components/Touchable';
import { CompletionBurst } from '@/shared/components/CompletionBurst';
import { F, S, R, W, ICON } from '@/shared/constants/tokens';
import type { AppTheme } from '@/shared/constants/Colors';
import { haptic } from '@/shared/utils/haptics';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { parseDateKey } from '@/shared/utils/dateKey';
import type { DayStat } from '@/features/dashboard/utils/dayHistory';
import { TodayDetail, type DetailKind, type DetailTask, type DetailHabit } from '@/features/dashboard/components/TodayDetail';

/*
  ── BUGÜN — ÜÇ HALKA (Apple Activity · can-it-be-done/season3/AppleActivity) ──
  Ana sayfa vitrindir; ilk bakışta "günüm nasıl gidiyor" tek nesnede okunmalı.
  Eskiden üç ayrı yüzey vardı: Momentum kartı, BUGÜN kartı (görev halkası + odak
  çizgisi) ve alışkanlık sayısı hiçbir yerde. Artık tek kart, üç ölçü:

    dış  → GÖREV       (bugün biten / bugünün işi)
    orta → ODAK        (dakika / günlük odak hedefi)
    iç   → ALIŞKANLIK  (yapılan / bugünkü alışkanlık)

  Referanstan alınan kurallar:
   · İZ, halkanın KENDİ renginin soluk hâli (Constants.ts → `bg`) — gri çember değil;
     halka tek nesne okunur, boşluk "bu ölçünün dolmamış kısmı" der.
   · Açılışta halkalar SIRAYLA dolar (AppleActivity → timing). Sakin modda dolu çizilir.
   · Renk ÖLÇÜYE sabittir; hedefe ulaşmayı renk değişimi değil göstergedeki tik anlatır
     (renk her zaman aynı şeyi söylesin). Mor YOK (bkz. uxConsistency "çapraz-hue").

  Momentum aynı kartın ALTINDA, saç teliyle ayrılmış (MomentumPulse `embedded`).

  DİJİTAL PANEL (2026-10-30, kullanıcı: "dijital ekran gibi, derli toplu"): kart artık
  gömülü bir ekran (DisplayPanel, temaya uyar). Sıra: durum şeridi (gün · tarih · canlı saat)
  → aktif dönemin plan satırı (`topSlot`) → halkalar + gösterge okumaları → momentum.
  Okumalar araç göstergesi gibi: küçük etiket, altında sabit genişlikli rakam.

  HAFTAYI KAYDIR (2026-10-30, kullanıcı: "etkileşimli, hareketli ama boş değil, anlam katsın"):
  halkaları yatayda sürüklemek ekranı GEÇMİŞ GÜNLERE akıtır (sağa → dün, evvelsi gün…); halkalar
  ve sayılar o günün değerlerine akar, her gün değişiminde hafif tik. Altta 7 nokta nerede
  olunduğunu söyler, dokununca o güne gider. Geçmişteyken saatin yerinde "Bugün" düğmesi.
  Dikey kaydırma her zaman sayfanındır (failOffsetY). Kutlama yalnız CANLI tamamlamada.

  HEDEF ANI (2026-10-30): bir halka gün içinde hedefe ULAŞTIĞI an o halkadan ışık dışa
  açılır (CompletionBurst). Açılışta zaten dolu olan halka patlamaz — kutlama, tamamlama
  anına aittir. Renk yine değişmez; tik + bu tek seferlik ışık anlatır.
*/

const SIZE = 112;
const STROKE = 11;
const GAP = 3;
const C = SIZE / 2;
const radiusAt = (i: number) => C - STROKE / 2 - 1 - i * (STROKE + GAP);

interface Metric {
  label: string;
  value: string;
  progress: number; // 0..1 (taşma kırpılır)
  reached: boolean;
  /** Renk TONU — temadan çözülür (birincil · seri · üçüncül). */
  tone: 'primary' | 'streak' | 'tertiary';
}
type Resolved = Metric & { color: string };

const Ring = React.memo(({ index, metric, reduceMotion }: { index: number; metric: Resolved; reduceMotion: boolean }) => {
  const r = radiusAt(index);
  const len = 2 * Math.PI * r;
  /*
    Dolum JS'te ilerler, düz prop olarak çizilir (bkz. useTween). Reanimated
    `animatedProps` ile çizilen yay, tur sırasında ana sayfa yeniden çizildikçe BOŞ
    kalıyordu (cihazda görüldü). Açılışta halkalar SIRAYLA dolar (AppleActivity → timing).
  */
  const p = useTween(Math.min(1, Math.max(0, metric.progress)), { duration: 1100, delay: index * 140, reduceMotion, initial: 0 });
  return (
    <>
      <Circle cx={C} cy={C} r={r} fill="none" stroke={metric.color + '29'} strokeWidth={STROKE} />
      <Circle
        cx={C} cy={C} r={r} fill="none"
        stroke={metric.color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeDasharray={`${len}`}
        strokeDashoffset={len * (1 - p)}
        // Sıfırda yuvarlak uç bir nokta bırakır — boş halkada yay hiç çizilmez.
        opacity={p > 0.001 ? 1 : 0}
      />
    </>
  );
});

export interface TodayRingsProps {
  label: string;
  /** Kartın tek cümlelik durumu ("gün yeni başlıyor", kolay yumurta sürprizi…). */
  caption: string;
  captionHighlight?: boolean;
  metrics: [Metric, Metric, Metric];
  footer?: React.ReactNode;
  /** Panelin en üstü — aktif dönemin plan satırı (kendi ayracını kendisi çizer, yoksa hiçbir şey). */
  topSlot?: React.ReactNode;
  /** Plan boşken görünen davet ("+ Görev ekle") — eski Sıradaki kartının boş hâlinin işi. */
  onAdd?: () => void;
  addLabel?: string;
  showAdd?: boolean;
  onTap?: () => void;
  /** Tur hedefi — dış boşluklu sarmalayıcıyı değil KARTI sarar (delik kart kenarına oturur). */
  tourId?: string;
  /** Açılışta durum şeridinde birkaç saniye görünen selam ("Günaydın, Melih"). */
  greeting?: string;
  /** Okumaya dokununca açılan ayrıntı (bkz. TodayDetail). Verilmezse okumalar dokunulmaz. */
  detail?: { tasks: DetailTask[]; habits: DetailHabit[]; focusMin: number; focusGoal: number; onFocusTask: (t?: DetailTask) => void };
  /** Son 7 gün (eskiden yeniye; sonuncusu bugün) — "haftayı kaydır" (bkz. dayHistory). */
  history?: DayStat[];
  theme: AppTheme;
  padding: number;
}

/** `reached` false → true geçişlerini sayar (ilk çizimdeki dolu hâl sayılmaz). */
function useReachBursts(metrics: Metric[]): number[] {
  const prev = useRef(metrics.map(m => m.reached));
  const [counts, setCounts] = useState(() => metrics.map(() => 0));
  useEffect(() => {
    const now = metrics.map(m => m.reached);
    if (now.some((r, i) => r && !prev.current[i])) setCounts(c => c.map((v, i) => (now[i] && !prev.current[i] ? v + 1 : v)));
    prev.current = now;
  }, [metrics.map(m => m.reached).join(',')]);
  return counts;
}

export const TodayRings = React.memo<TodayRingsProps>(({ tourId, padding, ...rest }) => (
  <View style={styles.wrap}>
    <TourTarget id={tourId ?? 'today'} spotRadius={R.lg}>
      <DisplayPanel padding={padding}>
        <RingsBody {...rest} />
      </DisplayPanel>
    </TourTarget>
  </View>
));

/** Panelin içi: durum şeridi, plan yuvası, halkalar + okumalar, momentum. */
const SCRUB_STEP = 34; // bir gün = bu kadar yatay sürükleme (px)
const BACK_COPY = { tr: { today: 'Bugün', back: 'Bugüne dön', yesterday: 'Dün' }, en: { today: 'Today', back: 'Back to today', yesterday: 'Yesterday' } };

/** Geçmiş günün değerlerini canlı metriklerin biçiminde kurar. */
function pastMetrics(raw: [Metric, Metric, Metric], d: DayStat): [Metric, Metric, Metric] {
  const goal = Number(/\/(\d+)/.exec(raw[1].value)?.[1] ?? 0);
  const ratio = (a: number, b: number) => (b > 0 ? a / b : 0);
  return [
    { ...raw[0], value: d.tasksTotal > 0 ? `${d.tasksDone}/${d.tasksTotal}` : '—', progress: ratio(d.tasksDone, d.tasksTotal), reached: d.tasksTotal > 0 && d.tasksDone >= d.tasksTotal },
    { ...raw[1], value: raw[1].value.replace(/^\d+/, String(d.focusMin)), progress: ratio(d.focusMin, goal), reached: goal > 0 && d.focusMin >= goal },
    { ...raw[2], value: d.habitsTotal > 0 ? `${d.habitsDone}/${d.habitsTotal}` : '—', progress: ratio(d.habitsDone, d.habitsTotal), reached: d.habitsTotal > 0 && d.habitsDone >= d.habitsTotal },
  ];
}

function RingsBody({ label, caption, captionHighlight, metrics: raw, footer, topSlot, onAdd, addLabel, showAdd, onTap, history, greeting, detail }: Omit<TodayRingsProps, 'tourId' | 'padding' | 'theme'>) {
  const { theme } = useAppTheme();
  const language = useLanguageStore(st => st.language);
  const bc = BACK_COPY[language === 'en' ? 'en' : 'tr'];
  const reduceMotion = useReducedMotion();
  const maxBack = history ? history.length - 1 : 0;
  const [back, setBack] = useState(0);
  // Açık ayrıntı yalnız BUGÜNE aittir: geçmişe kayınca kapanır.
  const [open, setOpen] = useState<DetailKind | null>(null);
  const go = (n: number) => { const v = Math.max(0, Math.min(maxBack, n)); if (v !== back) { haptic.select(); setBack(v); if (v > 0) setOpen(null); } };
  const KINDS: DetailKind[] = ['tasks', 'focus', 'habits'];
  const shown = back > 0 && history ? pastMetrics(raw, history[history.length - 1 - back]) : raw;
  const color = (m: Metric) => ({ ...m, color: theme[m.tone] });
  const metrics = shown.map(color) as [Resolved, Resolved, Resolved];
  // Kutlama yalnız CANLI değerlerden: geçmişe kayarken dolu bir gün patlamasın.
  const bursts = useReachBursts(raw.map(color));

  const startBack = useSharedValue(0);
  const lastBack = useSharedValue(0);
  const pan = Gesture.Pan()
    .enabled(maxBack > 0)
    .activeOffsetX([-12, 12])
    .failOffsetY([-10, 10])
    .onBegin(() => { startBack.value = lastBack.value; })
    .onUpdate((e) => {
      const n = Math.max(0, Math.min(maxBack, startBack.value + Math.round(e.translationX / SCRUB_STEP)));
      if (n !== lastBack.value) { lastBack.value = n; runOnJS(go)(n); }
    });
  useEffect(() => { lastBack.value = back; }, [back]);

  const pastDate = back > 0 && history ? parseDateKey(history[history.length - 1 - back].key) : undefined;
  return (
    <>
        <DisplayStatus
          intro={greeting}
          label={back === 1 ? bc.yesterday : undefined}
          date={pastDate}
          right={back > 0 ? (
            <Touchable onPress={() => go(0)} accessibilityRole="button" accessibilityLabel={bc.back} hitSlop={{ top: S.sm, bottom: S.sm, left: S.sm, right: S.sm }}
              style={[styles.todayPill, { backgroundColor: theme.primary + '1F' }]}>
              <Text style={{ fontSize: F.caption, fontWeight: W.semibold, color: theme.primary }}>{`${bc.today} ›`}</Text>
            </Touchable>
          ) : undefined}
        />
        {topSlot}
        {/* Dokunma bir ÖZELLİK değil, kolay yumurta — ekran okuyucu ağacına girmez (bkz. TodayCard). */}
        <Touchable accessible={false} onPress={onTap} activeOpacity={1} accessibilityLabel={label}>
          <GestureDetector gesture={pan}>
          <View style={styles.row}>
            <View
              style={{ width: SIZE, height: SIZE }}
              accessible
              accessibilityRole="image"
              accessibilityLabel={metrics.map(m => `${m.label} ${m.value}`).join(', ')}
            >
              <Svg width={SIZE} height={SIZE}>
                {/* -90°: dolum saat 12'den başlar. */}
                <G rotation="-90" origin={`${C},${C}`}>
                  {metrics.map((m, i) => <Ring key={m.label} index={i} metric={m} reduceMotion={reduceMotion} />)}
                </G>
              </Svg>
              {metrics.map((m, i) => (
                <CompletionBurst key={`b-${m.label}`} trigger={bursts[i]} color={m.color} radius={radiusAt(i) + STROKE / 2} spread={12} particles={10} duration={800} />
              ))}
            </View>

            <View style={styles.legend}>
              {metrics.map((m, i) => {
                const kind = KINDS[i];
                const tappable = !!detail && back === 0;
                const on = open === kind;
                return (
                <Touchable key={m.label} disabled={!tappable} onPress={() => setOpen(on ? null : kind)}
                  accessibilityRole={tappable ? 'button' : undefined} accessibilityState={tappable ? { expanded: on } : undefined}
                  accessibilityLabel={`${m.label} ${m.value}`}
                  style={[styles.legendRow, on && { backgroundColor: m.color + '14' }]}>
                  <View style={[styles.dot, { backgroundColor: m.color }]} />
                  <View style={{ flex: 1 }}>
                    <DisplayReadout label={m.label} value={m.value} />
                  </View>
                  {/* Hedefe ulaşıldı: renk DEĞİŞMEZ, tik belirir. Yer hep ayrılı — sütun kaymasın. */}
                  <View style={styles.tick}>
                    {m.reached && <Check size={ICON.xs} color={m.color} strokeWidth={3} />}
                  </View>
                </Touchable>
                );
              })}
            </View>
          </View>
          </GestureDetector>
          {/* Gün noktaları: nerede olunduğunu söyler, kaydırılabildiğini sezdirir; dokununca o güne. */}
          {history && history.length > 1 && (
            <View style={styles.days} accessibilityRole="adjustable" accessibilityLabel={pastDate ? pastDate.toLocaleDateString(language === 'en' ? 'en-US' : 'tr-TR', { weekday: 'long', day: 'numeric', month: 'long' }) : bc.today}>
              {history.map((d, i) => {
                const b = history.length - 1 - i;
                const on = b === back;
                return (
                  <Touchable key={d.key} accessible={false} onPress={() => go(b)} hitSlop={{ top: S.sm, bottom: S.sm, left: S.xxs, right: S.xxs }}
                    style={[styles.dayDot, { width: on ? 16 : 6, backgroundColor: on ? theme.primary : theme.onSurfaceMuted + '55' }]} />
                );
              })}
            </View>
          )}
          {/* Ayrıntı noktaların ALTINDA: noktalar halkalara aittir. */}
          {open && detail && back === 0 && (
            <TodayDetail kind={open} tasks={detail.tasks} habits={detail.habits} focusMin={detail.focusMin} focusGoal={detail.focusGoal} onFocusTask={detail.onFocusTask} />
          )}
          {/* Alt yazı BUGÜNÜN cümlesi: geçmiş bir güne kaydırılmışken yanlış güne konuşmasın. */}
          {!!caption && back === 0 && <Text style={[styles.caption, { color: captionHighlight ? theme.primary : theme.onSurfaceMuted }]}>{caption}</Text>}
        </Touchable>
        {showAdd && onAdd && addLabel ? (
          <Touchable
            onPress={onAdd}
            accessibilityRole="button"
            accessibilityLabel={addLabel}
            // Hap görsel olarak küçük kalır; dokunma alanı 44 pt'ye tamamlanır (HIG).
            hitSlop={{ top: S.sm, bottom: S.sm, left: S.xs, right: S.xs }}
            style={[styles.addPill, { backgroundColor: theme.primary + '1F' }]}
          >
            <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: theme.primary }}>{`+ ${addLabel}`}</Text>
          </Touchable>
        ) : null}

        {footer ? (
          <>
            <DisplayDivider />
            {footer}
          </>
        ) : null}
    </>
  );
}

TodayRings.displayName = 'TodayRings';

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: S.lg, marginBottom: S.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: S.lg },
  legend: { flex: 1, gap: S.sm }, // okumalar iki satırlık: aralık bir kademe dar
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm, borderRadius: R.sm, paddingHorizontal: S.xs, marginHorizontal: -S.xs, paddingVertical: S.xxs },
  dot: { width: 8, height: 8, borderRadius: R.full },
  tick: { width: ICON.xs, alignItems: 'center' },
  days: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: S.xs, marginTop: S.md },
  dayDot: { height: 6, borderRadius: R.full },
  todayPill: { paddingHorizontal: S.sm, paddingVertical: S.xxs, borderRadius: R.full },
  caption: { fontSize: F.caption, fontWeight: W.semibold, marginTop: S.md, letterSpacing: 0.3 },
  addPill: { alignSelf: 'flex-start', marginTop: S.smd, minHeight: 32, justifyContent: 'center', paddingHorizontal: S.smd, borderRadius: R.full },
});
