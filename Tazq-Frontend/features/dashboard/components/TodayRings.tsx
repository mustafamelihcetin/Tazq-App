import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { MotiView } from 'moti';
import { Check } from 'lucide-react-native';
import { DisplayPanel, DisplayStatus, DisplayDivider } from '@/shared/components/DisplayPanel';
import { EntranceStage } from '@/shared/components/EntranceStage';
import { DayOrb, petalsOf } from '@/features/dashboard/components/DayOrb';
import { buildDaySentence } from '@/features/dashboard/utils/daySentence';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { TourTarget } from '@/shared/components/TourContext';
import { Touchable } from '@/shared/components/Touchable';
import { F, S, R, W, ICON } from '@/shared/constants/tokens';
import type { AppTheme } from '@/shared/constants/Colors';
import { haptic } from '@/shared/utils/haptics';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { parseDateKey } from '@/shared/utils/dateKey';
import type { DayStat } from '@/features/dashboard/utils/dayHistory';
import { TodayDetail, type DetailKind, type DetailTask, type DetailHabit } from '@/features/dashboard/components/TodayDetail';

/*
  ── BUGÜN — YAŞAYAN CÜMLE + GÜN ÇİÇEĞİ ───────────────────────────────────────────
  Ana sayfa vitrindir; 2 saniyede "bugün beni ne bekliyor, nasıl gidiyorum" söylenmeli.
  Önce iç içe halkalardı ("renkler çirkin, bakınca anlaşılmıyor" — iç halka kısa kalır, aynı
  oran farklı uzunlukta görünür), sonra yatay ölçerler ("demode"). Kullanıcı: "grafik şart
  değil, daha geniş düşün". Şimdi BİLGİYİ okunur bir cümle taşır (bkz. daySentence): "Bugün
  seni ⟨3 görev⟩, ⟨90 dk odak⟩ ve ⟨1 alışkanlık⟩ bekliyor." — haplar dokunulabilir, bitince
  tiklenir; HİSSİ her işin bir yaprak olduğu çiçek (bkz. DayOrb). Bileşen adı geçmişten
  (testler ve çağıranlar bu adla bağlı).

  DİJİTAL PANEL: gömülü bir ekran (DisplayPanel, temaya uyar). Sıra: durum şeridi
  (gün · tarih · canlı saat) → aktif dönemin plan satırı (`topSlot`) → çiçek + cümle → momentum.

  GÜNLERİ KAYDIR: cümleyi/çiçeği yatayda sürüklemek ekranı GEÇMİŞ GÜNLERE akıtır (sağa → dün…);
  cümle o günü geçmiş zamanla anlatır, her gün değişiminde hafif tik. Altta 7 nokta nerede
  olunduğunu söyler, dokununca o güne gider. Geçmişteyken saatin yerinde "Bugün" düğmesi.
  Dikey kaydırma her zaman sayfanındır (failOffsetY).

  HEDEF ANI: çiçekte yeni bir yaprak dolduğu an tek seferlik kıvılcım (DayOrb →
  CompletionBurst). Açılışta zaten dolu yapraklar patlamaz.
*/

interface Metric {
  label: string;
  value: string;
  progress: number; // 0..1 (taşma kırpılır)
  reached: boolean;
  /** Cümle ve çiçek için ham sayılar (değer metni biçimlenmiş hâli). */
  done: number;
  total: number;
}
type Resolved = Metric & { color: string };


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
  /** Uyanış sinyali (ekrana dönüş, öne gelme, yenileme): artınca çiçekte ışık dalgası, haplarda yerine oturma. */
  wake?: number;
  /** Açılış girişi (bkz. EntranceStage). false → tur açık: panel kaymadan durur. */
  entrance?: boolean;
  /** Son 7 gün (eskiden yeniye; sonuncusu bugün) — "haftayı kaydır" (bkz. dayHistory). */
  history?: DayStat[];
  theme: AppTheme;
  padding: number;
}


export const TodayRings = React.memo<TodayRingsProps>(({ tourId, padding, entrance = true, ...rest }) => (
  // Açılışta sayfanın İLK parçası (sahne 0): açılış katmanı kalkınca panel yükselerek gelir.
  <EntranceStage order={0} enabled={entrance} style={styles.wrap}>
    <TourTarget id={tourId ?? 'today'} spotRadius={R.md}>
      <DisplayPanel padding={padding}>
        <RingsBody {...rest} />
      </DisplayPanel>
    </TourTarget>
  </EntranceStage>
));

/** Panelin içi: durum şeridi, plan yuvası, halkalar + okumalar, momentum. */
const KINDS: DetailKind[] = ['tasks', 'focus', 'habits'];
const SCRUB_STEP = 34; // bir gün = bu kadar yatay sürükleme (px)
const BACK_COPY = { tr: { today: 'Bugün', back: 'Bugüne dön', yesterday: 'Dün' }, en: { today: 'Today', back: 'Back to today', yesterday: 'Yesterday' } };

/** Geçmiş günün değerlerini canlı metriklerin biçiminde kurar. */
function pastMetrics(raw: [Metric, Metric, Metric], d: DayStat): [Metric, Metric, Metric] {
  const goal = Number(/\/(\d+)/.exec(raw[1].value)?.[1] ?? 0);
  const ratio = (a: number, b: number) => (b > 0 ? a / b : 0);
  return [
    { ...raw[0], value: d.tasksTotal > 0 ? `${d.tasksDone}/${d.tasksTotal}` : '—', progress: ratio(d.tasksDone, d.tasksTotal), reached: d.tasksTotal > 0 && d.tasksDone >= d.tasksTotal, done: d.tasksDone, total: d.tasksTotal },
    { ...raw[1], value: raw[1].value.replace(/^\d+/, String(d.focusMin)), progress: ratio(d.focusMin, goal), reached: goal > 0 && d.focusMin >= goal, done: d.focusMin, total: goal },
    { ...raw[2], value: d.habitsTotal > 0 ? `${d.habitsDone}/${d.habitsTotal}` : '—', progress: ratio(d.habitsDone, d.habitsTotal), reached: d.habitsTotal > 0 && d.habitsDone >= d.habitsTotal, done: d.habitsDone, total: d.habitsTotal },
  ];
}

function RingsBody({ label, caption, captionHighlight, metrics: raw, footer, topSlot, onAdd, addLabel, showAdd, onTap, history, greeting, detail, wake = 0 }: Omit<TodayRingsProps, 'tourId' | 'padding' | 'theme'>) {
  const { theme } = useAppTheme();
  const language = useLanguageStore(st => st.language);
  const bc = BACK_COPY[language === 'en' ? 'en' : 'tr'];
  const reduceMotion = useReducedMotion();
  const maxBack = history ? history.length - 1 : 0;
  const [back, setBack] = useState(0);
  // Açık ayrıntı yalnız BUGÜNE aittir: geçmişe kayınca kapanır.
  const [open, setOpen] = useState<DetailKind | null>(null);
  const go = (n: number) => { const v = Math.max(0, Math.min(maxBack, n)); if (v !== back) { haptic.select(); setBack(v); if (v > 0) setOpen(null); } };
  const shown = back > 0 && history ? pastMetrics(raw, history[history.length - 1 - back]) : raw;
  // Tek renk: sürüyorsa marka mavisi, hedefe ulaştıysa başarı yeşili (+ tik).
  const color = (m: Metric) => ({ ...m, color: m.reached ? theme.success : theme.primary });
  const metrics = shown.map(color) as [Resolved, Resolved, Resolved];
  // Günün cümlesi: hapta kalan (bugün) ya da yapılan (geçmiş) — bkz. daySentence.
  const sentence = buildDaySentence(metrics.map((m, i) => ({ kind: KINDS[i], done: m.done, total: m.total })), language === 'en' ? 'en' : 'tr', back > 0);
  const plainSentence = sentence.map(seg => seg.s).join(' ').replace(/ ,/g, ',');

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

  /*
    UYANIŞTA CÜMLE YENİDEN OKUNUR: bir an kısılıp hafifçe yerine oturur (çiçekteki ışık
    dalgasıyla aynı anda). Hap yeniden MOUNT edilmez — ekran okuyucu odağı yerinde kalır.
    Hareket azaltılmışsa yalnız ton geçişi (kayma yok). İlk çizimde oynamaz.
  */
  const reread = useSharedValue(1);
  const firstWake = useRef(wake);
  useEffect(() => {
    if (wake === firstWake.current) return;
    reread.value = 0;
    reread.value = withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) });
  }, [wake, reread]);
  const rereadStyle = useAnimatedStyle(() => ({
    opacity: 0.5 + 0.5 * reread.value,
    transform: [{ translateY: reduceMotion ? 0 : (1 - reread.value) * 3 }],
  }));

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
          <View style={styles.dayRow} accessible accessibilityLabel={plainSentence}>
            <DayOrb units={petalsOf({ tasks: metrics[0], focus: metrics[1], habits: metrics[2] })} wake={wake} />
            <Animated.View style={[styles.sentence, rereadStyle]}>
              {sentence.map((seg, si) => seg.t === 'text' ? (
                // Noktalama (",") önceki parçaya yapışık: satır aralığı boşluğu geri alınır ("3 görev ," olmasın).
                seg.s.split(' ').map((w, wi) => <Text key={`${si}-${wi}`} style={[styles.word, { color: theme.onSurface }, /^[,.;:]$/.test(w) && { marginLeft: -S.xs }]}>{w}</Text>)
              ) : (
                // Değeri değişen hap sekmeden yerine oturur (anahtar = metin): ne değiştiği görülür.
                <MotiView key={`${seg.kind}-${seg.s}`} from={{ scale: reduceMotion ? 1 : 0.92 }} animate={{ scale: 1 }} transition={{ type: 'timing', duration: 300, easing: Easing.out(Easing.cubic) }}>
                <Touchable disabled={!detail || back > 0} onPress={() => setOpen(open === seg.kind ? null : seg.kind)}
                  accessibilityRole="button" accessibilityState={{ expanded: open === seg.kind }} accessibilityLabel={seg.s}
                  hitSlop={{ top: S.xs, bottom: S.xs }}
                  style={[styles.token, { backgroundColor: (seg.done ? theme.success : theme.primary) + (open === seg.kind ? '2E' : '17') }]}>
                  <Text style={[styles.word, { color: seg.done ? theme.success : theme.primary }]}>{seg.s}</Text>
                </Touchable>
                </MotiView>
              ))}
            </Animated.View>
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
          {!!caption && back === 0 && captionHighlight && <Text style={[styles.caption, { color: captionHighlight ? theme.primary : theme.onSurfaceMuted }]}>{caption}</Text>}
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
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: S.md },
  sentence: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: S.xs, rowGap: S.xs },
  word: { fontSize: F.title3, fontWeight: W.semibold, letterSpacing: -0.2 },
  token: { borderRadius: R.sm, paddingHorizontal: S.xs, paddingVertical: S.xxs },
  wrap: { paddingHorizontal: S.lg, marginBottom: S.lg },
  days: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: S.xs, marginTop: S.md },
  dayDot: { height: 6, borderRadius: R.full },
  todayPill: { paddingHorizontal: S.sm, paddingVertical: S.xxs, borderRadius: R.full },
  caption: { fontSize: F.caption, fontWeight: W.semibold, marginTop: S.md, letterSpacing: 0.3 },
  addPill: { alignSelf: 'flex-start', marginTop: S.smd, minHeight: 32, justifyContent: 'center', paddingHorizontal: S.smd, borderRadius: R.full },
});
