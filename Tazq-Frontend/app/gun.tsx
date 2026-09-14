import React, { useMemo, useState } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Clock3, Sparkles, SunMoon } from 'lucide-react-native';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { useCollapsibleHeader } from '@/shared/hooks/useCollapsibleHeader';
import { DottedBackground } from '@/shared/components/DottedBackground';
import { PeekMenu, type PeekItem } from '@/shared/components/PeekMenu';
import { Touchable } from '@/shared/components/Touchable';
import { BentoCard } from '@/shared/components/BentoCard';
import { S, R, F, B, ICON, MAX_W, HAIRLINE, topBarSpace } from '@/shared/constants/tokens';
import { useContentMaxWidth } from '@/shared/components/ResponsiveColumns';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { useToastStore } from '@/shared/store/useToastStore';
import { useActiveTasks, getLocalizedTaskTitle, type Task } from '@/features/tasks';
import { completeTask, setTaskDue, archiveTask, localDateISO, timeAtHour } from '@/features/tasks/utils/taskActions';
import { useFocusStore } from '@/features/focus';
import { haptic } from '@/shared/utils/haptics';
import { langOf } from '@/shared/utils/lang';

/**
 * BUGÜN — günün SAAT ekseni.
 *
 * ── EKSİK OLAN EKSEN ──────────────────────────────────────────────────────────
 * Uygulama "ne" yapılacağını (görevler), "ne kadar" yapıldığını (skor, istatistik) ve
 * "neden" yapıldığını (modlar) biliyordu; ama "NE ZAMAN" sorusunun hiçbir karşılığı
 * yoktu. Görevlerin saati vardı, modlar günlük odak dakikası belirliyordu — ikisini de
 * saat ekseninde gösteren tek bir ekran bile yoktu. Plan kâğıttan çıkıp listeye
 * giriyor, güne hiç girmiyordu.
 *
 * Bu ekran o ekseni veriyor: günün saatleri, üstlerine yerleşmiş işler, "şimdi" işareti
 * ve günün sonunda bir kapanış.
 *
 * ── YERLEŞTİRME: SÜRÜKLEME YOK, İKİ DOKUNUŞ ───────────────────────────────────
 * Saati olmayan bir işi güne yerleştirmek için sürükleme beklenirdi. Sürükleme dar
 * ekranda kaydırma ile çakışır, erişilebilirlik açısından da kötüdür (ekran okuyucuyla
 * sürüklenemez). Onun yerine: işe dokun → saate dokun. Aynı sonuç, tek elle, ekran
 * okuyucuyla da yapılabilir.
 *
 * ── ODAK BAĞI: TEKLİF, DAYATMA DEĞİL ──────────────────────────────────────────
 * Bir işe dokununca çıkan menüde "Bu işe odaklan" var. Her görev odak seansına
 * uygun değildir ("süt al", "15:00 toplantı"); bu yüzden bağ hiçbir yerde otomatik
 * kurulmuyor, hiçbir görevde zorunlu değil ve kurulmadığında hiçbir şey değişmiyor.
 * Kurulduğunda seansın dakikaları o göreve yazılıyor (bkz. useFocusStore).
 */

/**
 * Tarih biçimlendirmenin locale'i.
 *
 * Satır içinde `tr ? 'tr-TR' : 'en-US'` yazmak çeviri borcu sayaçlarını kirletiyor
 * (bkz. i18nRatchet) — oysa bu bir METİN seçimi değil, kod normalleştirmesi. Tablo
 * hem o karışıklığı bitiriyor hem de yeni bir dil eklenince tek satır kalıyor.
 */
const DATE_LOCALE = { tr: 'tr-TR', en: 'en-US' } as const;

/**
 * Basılı tutma eşiği.
 *
 * RN'in varsayılanı 500ms ve bu ekranda uzun geliyor: kullanıcı işi taşımak mı menüyü
 * mü istediğine hızlı karar veriyor. iOS'un bağlam menüsü bandı ~300-400ms.
 */
const LONG_PRESS_MS = 320;

/** Eksenin varsayılan penceresi — işler daha erken/geç ise kendiliğinden genişler. */
const DAY_START_HOUR = 8;
const DAY_END_HOUR = 22;

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const hourOf = (iso?: string | null): number | null => {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d.getHours();
};

export default function GunScreen() {
  const { theme, isDark } = useAppTheme();
  const { t, language } = useLanguageStore();
  const d = t.dayView;
  // Dil kodu tek yerden daraltılıyor — bu bir METİN seçimi değil (bkz. langOf).
  const lang = langOf(language);
  const tr = lang === 'tr';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  /* Tablette içerik 600pt'lik şeride sıkışmasın — üç kademeli genişlik. */
  const contentW = useContentMaxWidth();
  const { scrollY, onScroll } = useCollapsibleHeader();
  const { show: showToast } = useToastStore();

  const tasks = useActiveTasks();
  const dailyFocusMinutes = useFocusStore(s => s.dailyFocusMinutes);
  const dailyGoalMinutes = useFocusStore(s => s.dailyGoalMinutes);
  const taskFocusMinutes = useFocusStore(s => s.taskFocusMinutes);
  const setCurrentTask = useFocusStore(s => s.setCurrentTask);

  /** Yerleştirilmeyi bekleyen iş (saatsizler bölümünden seçildi). */
  const [placingId, setPlacingId] = useState<number | null>(null);
  /** Üstüne dokunulan iş — eylem menüsü onun için açılır. */
  const [menuTask, setMenuTask] = useState<Task | null>(null);

  const now = new Date();
  const today = useMemo(() => tasks.filter(task => {
    if (!task.dueDate) return false;
    const due = new Date(task.dueDate);
    return !isNaN(due.getTime()) && isSameDay(due, now);
  }), [tasks]);

  const timed = today.filter(task => hourOf(task.dueTime) != null);
  const untimed = today.filter(task => hourOf(task.dueTime) == null && !task.isCompleted);
  const unfinished = today.filter(task => !task.isCompleted);
  const doneCount = today.length - unfinished.length;

  /*
    EKSENİN PENCERESİ İÇERİKTEN DOĞAR: sabit 08–22 yazmak, sabah 6'daki işi ekranın
    dışında bırakır. Varsayılan pencere yalnız BAŞLANGIÇ; işler dışına taşıyorsa
    pencere genişler. "Şimdi" de her zaman pencerenin içinde kalır.
  */
  const [startHour, endHour] = useMemo(() => {
    const hours = timed.map(task => hourOf(task.dueTime)!).filter(h => h != null);
    const min = Math.min(DAY_START_HOUR, now.getHours(), ...(hours.length ? hours : [DAY_START_HOUR]));
    const max = Math.max(DAY_END_HOUR, now.getHours(), ...(hours.length ? hours : [DAY_END_HOUR]));
    return [Math.max(0, min), Math.min(23, max)];
  }, [timed, now]);

  const hours = useMemo(
    () => Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i),
    [startHour, endHour],
  );

  const place = (hour: number) => {
    if (placingId == null) return;
    haptic.commit();
    setTaskDue(placingId, { dueTime: timeAtHour(hour) });
    setPlacingId(null);
  };

  const moveToTomorrow = (ids: number[]) => {
    if (ids.length === 0) return;
    haptic.commit();
    const tomorrow = localDateISO(1);
    ids.forEach(id => setTaskDue(id, { dueDate: tomorrow }));
    showToast(d.movedToast, 'success');
  };

  const drop = (id: number) => {
    /*
      DÜŞÜRMEK SİLMEK DEĞİL: görev arşive gider. Günü kapatırken verilen karar hızlı
      verilir; hızlı verilen kararın geri dönüşü olmalı.
    */
    archiveTask(id);
    showToast(d.droppedToast, 'success');
  };

  /*
    ── TEK JEST KURALI ─────────────────────────────────────────────────────────
    DOKUN  = işi eline al, sonra bir saate dokunarak yerleştir/taşı
    BASILI TUT = o işin menüsü (tamamla, odaklan, saati kaldır, yarına al)

    Önce tutarsızdı: saatsiz işte dokunuş "eline al", zaman eksenindeki işte dokunuş
    "menü" demekti. Aynı jest iki yerde iki farklı şey yapınca kullanıcı her seferinde
    ne olacağını denemek zorunda kalıyor. Kural artık ikisinde de aynı ve tek cümleyle
    anlatılabiliyor; ekranın üstündeki ipucu satırı da bunu söylüyor.

    Basılı tutma iOS'un bağlam menüsü jesti: eşiği biraz düşürüldü (320ms) ve
    TİTREŞİMLE karşılanıyor — geri bildirimsiz uzun basma "açılmadı mı?" hissi verir
    ve kullanıcı parmağını tutmaya devam eder.
  */
  const openMenu = (task: Task) => {
    haptic.surface();
    setMenuTask(task);
  };

  /** Dokunuş: işi eline al / bırak. Aynı işe tekrar dokunmak vazgeçmektir. */
  const pickUp = (task: Task) => {
    haptic.select();
    setPlacingId(prev => (prev === task.id ? null : task.id));
  };

  const focusOn = (task: Task) => {
    setCurrentTask(getLocalizedTaskTitle(task, tr), task.id);
    router.push('/focus');
  };

  const menuItems: PeekItem[] = menuTask ? [
    ...(menuTask.isCompleted ? [] : [{
      label: d.actionComplete,
      icon: <Check size={ICON.sm} color={theme.success} />,
      onPress: () => { haptic.success(); completeTask(menuTask.id); },
    }]),
    {
      label: d.actionFocus,
      icon: <Sparkles size={ICON.sm} color={theme.primary} />,
      onPress: () => focusOn(menuTask),
    },
    {
      label: hourOf(menuTask.dueTime) == null ? d.actionTime : d.actionClearTime,
      icon: <Clock3 size={ICON.sm} color={theme.onSurfaceVariant} />,
      onPress: () => {
        if (hourOf(menuTask.dueTime) == null) setPlacingId(menuTask.id);
        else setTaskDue(menuTask.id, { dueTime: null });
      },
    },
    {
      label: d.actionTomorrow,
      icon: <SunMoon size={ICON.sm} color={theme.onSurfaceVariant} />,
      onPress: () => moveToTomorrow([menuTask.id]),
    },
  ] : [];

  const TaskChip = ({ task }: { task: Task }) => {
    const minutes = taskFocusMinutes?.[task.id] ?? 0;
    const done = !!task.isCompleted;
    return (
      <Touchable
        onPress={() => pickUp(task)}
        onLongPress={() => openMenu(task)}
        delayLongPress={LONG_PRESS_MS}
        accessibilityRole="button"
        accessibilityLabel={getLocalizedTaskTitle(task, tr)}
        accessibilityHint={d.gestureHint}
        accessibilityState={{ checked: done, selected: placingId === task.id }}
        style={[
          styles.chip,
          {
            backgroundColor: isDark ? theme.surfaceContainer : theme.surfaceContainerLow,
            borderColor: placingId === task.id ? theme.primary : theme.outlineVariant,
            borderWidth: placingId === task.id ? B.medium : B.thin,
          },
        ]}
      >
        <View style={[styles.dot, { backgroundColor: done ? theme.success : theme.primary }]} />
        <Text
          numberOfLines={1}
          style={[
            styles.chipText,
            { color: done ? theme.onSurfaceMuted : theme.onSurface, textDecorationLine: done ? 'line-through' : 'none' },
          ]}
        >
          {getLocalizedTaskTitle(task, tr)}
        </Text>
        {minutes > 0 && (
          <Text style={[styles.chipMinutes, { color: theme.onSurfaceMuted }]}>{minutes}dk</Text>
        )}
      </Touchable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <DottedBackground color={theme.onBackground} opacity={isDark ? 0.05 : 0.08} size={24} dotSize={1} />

      <ScreenHeader
        onBack={() => router.back()}
        title={d.title}
        subtitle={now.toLocaleDateString(DATE_LOCALE[lang], { day: 'numeric', month: 'long', weekday: 'long' })}
        scrollY={scrollY}
      />

      {/*
        KAP `Animated.ScrollView` OLMAK ZORUNDA.

        ÇÖKME: düz `ScrollView` ile açılışta "Object is not a function" ile patlıyordu.
        `useCollapsibleHeader` kaydırma bağlayıcısını YEREL SÜRÜCÜDE kuruyor
        (useNativeDriver: true) ve RN bunu ancak `Animated.createAnimatedComponent` ile
        sarılmış bir bileşene bağlayabiliyor; düz bir ScrollView gelen değeri sıradan bir
        fonksiyon sanıp çağırıyor. Aynı hook'u kullanan diğer ekranlar da Animated kap
        kullanıyor (bkz. settings/cockpit/modlar) — tek istisna Görevler ekranı ve orada
        sürücü bilinçli olarak kapatılmış (Reanimated listesi).
      */}
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: topBarSpace(insets.top) + S.md,
          paddingBottom: insets.bottom + S.xxl,
          paddingHorizontal: S.lg,
          width: '100%',
          maxWidth: contentW,
          alignSelf: 'center',
          gap: S.lg,
        }}
      >
        {/* ── Günün tek satırlık özeti ────────────────────────────────────── */}
        <BentoCard index={0} style={{ padding: S.md, flexDirection: 'row', alignItems: 'center', gap: S.md }}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.summaryValue, { color: theme.onSurface }]}>
              {doneCount}/{today.length}
            </Text>
            <Text style={[styles.summaryLabel, { color: theme.onSurfaceVariant }]}>{d.summaryTasks}</Text>
          </View>
          <View style={{ width: HAIRLINE, alignSelf: 'stretch', backgroundColor: theme.outlineVariant }} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.summaryValue, { color: theme.onSurface }]}>
              {dailyFocusMinutes}
              {dailyGoalMinutes > 0 && (
                <Text style={[styles.summaryLabel, { color: theme.onSurfaceMuted }]}>
                  {` / ${dailyGoalMinutes} ${d.goal}`}
                </Text>
              )}
            </Text>
            <Text style={[styles.summaryLabel, { color: theme.onSurfaceVariant }]}>{d.summaryFocus}</Text>
          </View>
        </BentoCard>

        {/*
          TAŞIMA ŞERİDİ — bölümden bağımsız.

          İpucu önce yalnız "saati yok" bölümünün içindeydi; zaman eksenindeki bir işi
          eline alan kullanıcı hiçbir açıklama görmüyor, ekranda ne olduğunu anlamıyordu.
          Şerit artık hangi işi aldıysan onu söylüyor ve vazgeçme yolu hep görünür.
        */}
        {placingId != null && (
          <View style={[styles.placingBar, { backgroundColor: theme.primary + '14', borderColor: theme.primary + '40' }]}>
            <Text numberOfLines={1} style={{ flex: 1, color: theme.onSurface, fontSize: F.caption + 1, fontWeight: '700' }}>
              {d.placingHint}
            </Text>
            <Touchable
              onPress={() => setPlacingId(null)}
              accessibilityRole="button"
              accessibilityLabel={d.cancelPlacing}
              style={{ paddingHorizontal: S.sm, paddingVertical: S.xs }}
            >
              <Text style={{ color: theme.primary, fontSize: F.caption, fontWeight: '700' }}>{d.cancelPlacing}</Text>
            </Touchable>
          </View>
        )}

        {/* ── Saati olmayanlar: güne yerleştirilmeyi bekleyenler ──────────── */}
        {untimed.length > 0 && (
          <View style={{ gap: S.sm }}>
            <Text style={[styles.sectionTitle, { color: theme.onSurface }]}>{d.unplannedTitle}</Text>
            <Text style={[styles.sectionHint, { color: theme.onSurfaceMuted }]}>{d.gestureHint}</Text>
            <View style={{ gap: S.xs }}>
              {untimed.map(task => (
                <Touchable
                  key={task.id}
                  onPress={() => pickUp(task)}
                  onLongPress={() => openMenu(task)}
                  delayLongPress={LONG_PRESS_MS}
                  accessibilityRole="button"
                  accessibilityLabel={getLocalizedTaskTitle(task, tr)}
                  accessibilityHint={d.gestureHint}
                  accessibilityState={{ selected: placingId === task.id }}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isDark ? theme.surfaceContainer : theme.surfaceContainerLow,
                      borderColor: placingId === task.id ? theme.primary : theme.outlineVariant,
                      borderWidth: placingId === task.id ? B.medium : B.thin,
                    },
                  ]}
                >
                  <View style={[styles.dot, { backgroundColor: theme.primary }]} />
                  <Text numberOfLines={1} style={[styles.chipText, { color: theme.onSurface }]}>
                    {getLocalizedTaskTitle(task, tr)}
                  </Text>
                </Touchable>
              ))}
            </View>
          </View>
        )}

        {/* ── Saat ekseni ─────────────────────────────────────────────────── */}
        <View style={{ gap: 0 }}>
          {hours.map(hour => {
            const items = timed.filter(task => hourOf(task.dueTime) === hour);
            const isNow = hour === now.getHours();
            const placing = placingId != null;
            return (
              <Touchable
                key={hour}
                disabled={!placing}
                onPress={() => place(hour)}
                accessibilityRole={placing ? 'button' : 'none'}
                accessibilityLabel={placing ? `${String(hour).padStart(2, '0')}:00` : undefined}
                style={[
                  styles.hourRow,
                  {
                    borderTopColor: isNow ? theme.primary : theme.outlineVariant,
                    borderTopWidth: isNow ? B.medium : HAIRLINE,
                    backgroundColor: placing ? theme.primary + '08' : 'transparent',
                  },
                ]}
              >
                <View style={styles.hourLabel}>
                  <Text style={[styles.hourText, { color: isNow ? theme.primary : theme.onSurfaceMuted }]}>
                    {String(hour).padStart(2, '0')}
                  </Text>
                  {isNow && (
                    <Text style={[styles.nowText, { color: theme.primary }]}>{d.now}</Text>
                  )}
                </View>
                <View style={styles.hourLane}>
                  {items.map(task => <TaskChip key={task.id} task={task} />)}
                </View>
              </Touchable>
            );
          })}
        </View>

        {/* ── Günü kapat ──────────────────────────────────────────────────── */}
        {today.length === 0 ? (
          <BentoCard index={1} style={{ padding: S.lg, gap: S.xs }}>
            <Text style={[styles.sectionTitle, { color: theme.onSurface }]}>{d.empty}</Text>
            <Text style={[styles.sectionHint, { color: theme.onSurfaceVariant }]}>{d.emptyHint}</Text>
          </BentoCard>
        ) : unfinished.length === 0 ? (
          <BentoCard index={1} style={{ padding: S.lg, gap: S.xs }}>
            <Text style={[styles.sectionTitle, { color: theme.success }]}>{d.closedTitle}</Text>
            <Text style={[styles.sectionHint, { color: theme.onSurfaceVariant }]}>{d.closedHint}</Text>
          </BentoCard>
        ) : (
          <BentoCard index={1} style={{ padding: S.md, gap: S.smd }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
              <Text style={[styles.sectionTitle, { color: theme.onSurface, flex: 1 }]}>{d.closeTitle}</Text>
              <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '700' }}>
                {unfinished.length} {d.closeCount}
              </Text>
            </View>

            {/*
              GÜNÜ KAPATMAK İKİ DOKUNUŞ. Bitmeyen işin tek çıkışı "gecikmiş" rozeti
              olarak birikmek olmamalı: ya yarına alınır ya düşürülür. Karar bir kere
              veriliyor ve liste temizleniyor.
            */}
            <Touchable
              onPress={() => moveToTomorrow(unfinished.map(task => task.id))}
              accessibilityRole="button"
              accessibilityLabel={d.moveAllTomorrow}
              style={[styles.primaryBtn, { backgroundColor: theme.primary }]}
            >
              <Text style={{ color: theme.onPrimary, fontWeight: '700', fontSize: F.body }}>{d.moveAllTomorrow}</Text>
            </Touchable>

            <View style={{ gap: S.xs }}>
              {unfinished.map(task => (
                <View key={task.id} style={styles.closeRow}>
                  <Text numberOfLines={1} style={[styles.chipText, { color: theme.onSurface, flex: 1 }]}>
                    {getLocalizedTaskTitle(task, tr)}
                  </Text>
                  <Touchable
                    onPress={() => moveToTomorrow([task.id])}
                    accessibilityRole="button"
                    accessibilityLabel={`${getLocalizedTaskTitle(task, tr)} — ${d.moveTomorrow}`}
                    style={styles.closeAction}
                  >
                    <Text style={{ color: theme.primary, fontSize: F.caption, fontWeight: '700' }}>{d.moveTomorrow}</Text>
                  </Touchable>
                  <Touchable
                    onPress={() => drop(task.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`${getLocalizedTaskTitle(task, tr)} — ${d.drop}`}
                    style={styles.closeAction}
                  >
                    <Text style={{ color: theme.onSurfaceMuted, fontSize: F.caption, fontWeight: '700' }}>{d.drop}</Text>
                  </Touchable>
                </View>
              ))}
            </View>
          </BentoCard>
        )}
      </Animated.ScrollView>

      <PeekMenu
        visible={menuTask != null}
        onClose={() => setMenuTask(null)}
        title={menuTask ? getLocalizedTaskTitle(menuTask, tr) : undefined}
        items={menuItems}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  summaryValue: { fontSize: F.title, fontWeight: '700', letterSpacing: -0.5 },
  summaryLabel: { fontSize: F.caption, fontWeight: '600' },
  sectionTitle: { fontSize: F.body, fontWeight: '700' },
  sectionHint: { fontSize: F.caption, fontWeight: '500', lineHeight: 16 },
  hourRow: { flexDirection: 'row', alignItems: 'flex-start', gap: S.smd, paddingTop: S.sm, paddingBottom: S.sm, minHeight: 52 },
  hourLabel: { width: 44, alignItems: 'flex-start' },
  hourText: { fontSize: F.caption, fontWeight: '700', letterSpacing: 0.5 },
  nowText: { fontSize: 10, fontWeight: '700', marginTop: S.xxs },
  hourLane: { flex: 1, gap: S.xs },
  chip: { flexDirection: 'row', alignItems: 'center', gap: S.sm, borderRadius: R.md, paddingHorizontal: S.smd, paddingVertical: S.sm },
  chipText: { fontSize: F.body, fontWeight: '600', flex: 1 },
  chipMinutes: { fontSize: F.caption, fontWeight: '700' },
  dot: { width: 6, height: 6, borderRadius: R.full },
  placingBar: { flexDirection: 'row', alignItems: 'center', gap: S.sm, borderRadius: R.md, borderWidth: B.thin, paddingVertical: S.sm, paddingHorizontal: S.smd },
  primaryBtn: { paddingVertical: S.md, borderRadius: R.md, alignItems: 'center' },
  closeRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  closeAction: { paddingHorizontal: S.sm, paddingVertical: S.xs },
});
