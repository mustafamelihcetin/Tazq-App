import React from 'react';
import { View, Text } from 'react-native';
import { ChevronRight, CalendarClock, CheckCircle2 } from 'lucide-react-native';
import { BentoCard } from '@/shared/components/BentoCard';
import { Touchable } from '@/shared/components/Touchable';
import { S, R, F, ICON } from '@/shared/constants/tokens';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { renderModeEmojiIcon } from '@/features/modes/utils/modeIcons';
import { useActiveModeSummary, type ModeSummaryEntry } from '@/features/modes/hooks/useActiveModeSummary';
import { ModeDeck } from '@/features/modes/components/ModeDeck';
import { TourTarget } from '@/shared/components/TourContext';
import { DisplayDivider } from '@/shared/components/DisplayPanel';

/**
 * AKTİF DÖNEMİN BUGÜNÜ — ana ekranın en üstü, mod varken.
 *
 * ── ÖLÇÜLEN SORUN ─────────────────────────────────────────────────────────────
 * Ana ekranda on iki yüzey yarışıyordu: selamlama, ivme skoru, bugün kartı, günüm
 * kartı, sonraki görev, mod bandı, alışkanlık şeridi, görev satırları… Her biri ayrı
 * ayrı iyi tasarlanmıştı ama BİRLİKTE bir hiyerarşi kurmuyorlardı.
 *
 * Uygulamanın en güçlü özelliği — dönemsel plan — kartların arasına sıkışmış küçük bir
 * banda indirgenmişti. Sınava hazırlanan biri için günün sorusu "bugün ne var" değil,
 * "PLANIMDA bugün ne var"dır. Bu kart tam o soruyu cevaplıyor ve mod varken ekranın
 * en üstünde duruyor.
 *
 * ── ÇOKLU HEDEF ───────────────────────────────────────────────────────────────
 * Kart yalnız EN ACİL hedefi gösteriyor, diğerleri için "+2" yazıyordu; o yazı da
 * hiçbir yere götürmüyordu. Üç hedefi olan kullanıcı için kart, kendi hayatının
 * üçte birini anlatıyordu. Artık hedefler arasında parmakla geçiliyor (bkz. ModeDeck);
 * sıra yine en acilden başlar — ekran hiyerarşiyi bozmadan erişimi açar.
 *
 * ── MOD YOKSA HİÇ ÇİZİLMEZ ────────────────────────────────────────────────────
 * Ekran kullanıcının içinde bulunduğu duruma göre değişir: aktif dönemi olmayan biri
 * için bu kart bir boşluk ya da reklam olurdu. `null` döner, ana ekran "bugün"
 * kurgusuyla kalır.
 */

type Copy = ReturnType<typeof useLanguageStore.getState>['t']['modeToday'];

/** Planın bugünkü durumu tek cümlede (kart ve satır aynı metni söyler). */
function statusOf(mode: ModeSummaryEntry, t: Copy): string {
  const done = mode.todayDone;
  const total = mode.todayTotal;
  if (total > 0) return done >= total ? t.allDone : `${done}/${total} ${t.todayPlan}`;
  if (mode.openTotal > 0) return `${mode.openTotal} ${t.openTasks}`;
  return mode.taskTotal > 0 ? t.allDone : t.noTasks;
}

/*
  İNCE SATIR (2026-10-30, kullanıcı: "daha minimalist, yukarı çekme şansımız var mı"): dijital
  panelin içinde plan ~170 pt tutuyordu (ikon kutusu + iki satır başlık + ayrı çubuk). Panelin
  içinde tek satır yeter: simge · ad · bugünkü durum · gün; dokununca Modlar.
*/
function ModeLine({ mode, t, onOpen }: { mode: ModeSummaryEntry; t: Copy; onOpen: () => void }) {
  const { theme } = useAppTheme();
  const status = statusOf(mode, t);
  return (
    <Touchable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`${mode.label} — ${status}`} accessibilityHint={t.open}
      style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, minHeight: 32 }}>
      {renderModeEmojiIcon(mode.emoji, ICON.sm, mode.color)}
      <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: F.body, fontWeight: '700', color: theme.onSurface }}>{mode.label}</Text>
      <Text numberOfLines={1} style={{ flex: 1, fontSize: F.caption, fontWeight: '600', color: theme.onSurfaceVariant }}>
        {`· ${status}`}
      </Text>
      {/* Gün sayısı kesilmez; dar ekranda önce durum metni kısalır. */}
      {mode.days != null && mode.days >= 0 && (
        <Text style={{ fontSize: F.caption, fontWeight: '600', color: theme.onSurfaceMuted }}>{`${mode.days} ${t.daysShort}`}</Text>
      )}
      <ChevronRight size={ICON.sm} color={theme.onSurfaceMuted} />
    </Touchable>
  );
}

function ModePage({ mode, t, onOpen }: { mode: ModeSummaryEntry; t: Copy; onOpen: () => void }) {
  const { theme } = useAppTheme();
  const done = mode.todayDone;
  const total = mode.todayTotal;
  const allDone = total > 0 && done >= total;

  /*
    BUGÜNE KURULMUŞ GÖREV YOKSA SUSMUYORUZ.

    Planın görevleri ileri tarihlere de kurulabiliyor (öncelik düştükçe gün uzuyor).
    O durumda "bugün plan görevin yok" demek teknik olarak doğru ama kullanıcıya YANLIŞ
    geliyordu: Görevler ekranında duran görevleri görüp ana ekranın onları saymadığını
    sanıyordu. Artık bugün yoksa planın AÇIK görev sayısı söyleniyor.
  */
  const progress = total > 0
    ? Math.min(1, done / total)
    : mode.taskTotal > 0
      ? Math.min(1, (mode.taskTotal - mode.openTotal) / mode.taskTotal)
      : 0;

  const statusText =
    total > 0
      ? (allDone ? t.allDone : `${done}/${total} ${t.todayPlan}`)
      : mode.openTotal > 0
        ? `${mode.openTotal} ${t.openTasks}`
        : mode.taskTotal > 0
          ? t.allDone
          : t.noTasks;

  return (
    <Touchable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${mode.label} — ${statusText}`}
      accessibilityHint={t.open}
      style={{ gap: S.smd }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.smd }}>
        <View style={{ width: 40, height: 40, borderRadius: R.md, backgroundColor: mode.color + '22', alignItems: 'center', justifyContent: 'center' }}>
          {renderModeEmojiIcon(mode.emoji, ICON.md, mode.color)}
        </View>

        <View style={{ flex: 1 }}>
          {/* Geri sayım üst satırda: başlık satırını paylaştığında hedefin adı "DenemePr…"ye
              kırpılıyordu (2026-10-30, cihazda). Ad artık kartın tüm genişliğini kullanır. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
            <Text style={{ flexShrink: 1, fontSize: F.caption, fontWeight: '700', color: mode.textColor, letterSpacing: 0.4 }} numberOfLines={1}>
              {t.eyebrow}
            </Text>
            {/* Geri sayım: hedefi soyut bir tarih olmaktan çıkaran tek sayı. */}
            {mode.days != null && mode.days >= 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xxs, backgroundColor: mode.color + '18', borderRadius: R.full, paddingHorizontal: S.sm, paddingVertical: S.xxs }}>
                <CalendarClock size={ICON.xs} color={mode.textColor} />
                <Text style={{ fontSize: F.caption, fontWeight: '700', color: mode.textColor }}>
                  {mode.days} {t.daysLeft}
                </Text>
              </View>
            )}
          </View>
          <Text style={{ fontSize: F.subhead, fontWeight: '700', color: theme.onSurface, letterSpacing: -0.3 }} numberOfLines={1}>
            {mode.label}
          </Text>
        </View>

        <ChevronRight size={ICON.sm} color={theme.onSurfaceVariant} />
      </View>

      <View style={{ gap: S.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs }}>
          {allDone && <CheckCircle2 size={ICON.xs} color={theme.success} />}
          <Text style={{ fontSize: F.caption + 1, fontWeight: '600', color: allDone ? theme.success : theme.onSurfaceVariant, flex: 1 }} numberOfLines={1}>
            {statusText}
          </Text>
        </View>

        {/* Çubuk yalnız plan görevi VARKEN: boş bir ilerleme çubuğu bilgi taşımaz. */}
        {(total > 0 || mode.taskTotal > 0) && (
          <View style={{ height: 6, borderRadius: R.xs, backgroundColor: theme.surfaceContainerHighest, overflow: 'hidden' }}>
            <View style={{ width: `${progress * 100}%`, height: '100%', borderRadius: R.xs, backgroundColor: allDone ? theme.success : mode.color }} />
          </View>
        )}
      </View>
    </Touchable>
  );
}

/**
 * `bare`: dijital panelin (TodayRings `topSlot`) İÇİNDE satır olarak — kendi kartı yok,
 * altına kendi ayracını çizer (mod yoksa ne satır ne ayraç kalır).
 */
export function ModeTodayCard({ onOpen, bare }: { onOpen: () => void; bare?: boolean }) {
  const t = useLanguageStore(s => s.t).modeToday;
  const { entries, activeCount } = useActiveModeSummary();

  if (activeCount === 0) return null;
  const deck = (
    <ModeDeck
      pages={entries.map(e => <ModePage key={e.key} mode={e} t={t} onOpen={onOpen} />)}
      dotColors={entries.map(e => e.color)}
      a11yLabel={`${activeCount} ${t.eyebrow}`}
    />
  );
  if (bare) {
    const lines = (
      <ModeDeck
        pages={entries.map(e => <ModeLine key={e.key} mode={e} t={t} onOpen={onOpen} />)}
        dotColors={entries.map(e => e.color)}
        a11yLabel={`${activeCount} ${t.eyebrow}`}
      />
    );
    return (
      <>
        <TourTarget id="activePlan" spotRadius={R.md}>{lines}</TourTarget>
        <DisplayDivider />
      </>
    );
  }

  return (
    // Kenar boşluğu tur hedefinin DIŞINDA: delik kartın kenarına birebir oturur.
    <TourTarget id="activePlan" spotRadius={R.md} style={{ marginHorizontal: S.lg, marginBottom: S.lg }}>
    <BentoCard index={0} style={{ padding: S.md, gap: S.smd }}>
      {deck}
    </BentoCard>
    </TourTarget>
  );
}
