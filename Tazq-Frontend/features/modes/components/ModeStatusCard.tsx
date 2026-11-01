import React from 'react';
import { View, Text } from 'react-native';
import { MotiView } from 'moti';
import { DisplayPanel, DisplayValue } from '@/shared/components/DisplayPanel';
import { ChevronRight, Sparkles, Zap } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { S, F, R, B, ICON, MIN_TOUCH } from '@/shared/constants/tokens';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { renderModeEmojiIcon } from '@/features/modes/utils/modeIcons';
import { ModeDeck } from '@/features/modes/components/ModeDeck';
import { RoadRing } from '@/features/modes/components/RoadRing';
import { useCountdownTick } from '@/features/modes/hooks/useCountdownTick';

/**
 * YAŞAM MODLARI — SAYFANIN DURUM KARTI.
 *
 * ── NEDEN AYRI BİR DOSYA ───────────────────────────────────────────────────
 * Bu kart `app/modlar.tsx`in içinde, ~170 satırlık bir JSX bloğu olarak duruyordu ve
 * dosya 1700 satırı geçmişti. Ekranın kendi işi (hangi modlar açık, hangi plan
 * uygulanmış, tur hedefleri, önizleme yönetimi) ile bu kartın ÇİZİMİ aynı yerde
 * olunca ikisi de okunmaz hâle geliyordu. Kart saf bir sunum: hiçbir şey hesaplamaz,
 * hazır sayıları alır — böylece ekrandan bağımsız okunabilir ve test edilebilir.
 *
 * ── İKİ HÂL ────────────────────────────────────────────────────────────────
 *  · Aktif hedef VARSA: selam + mod sayısı, hedefler arasında kaydırılan geri sayım
 *    destesi (bkz. ModeDeck), bugünün toplam planı ve bir cümle.
 *  · Hiç yoksa: ne olduğunu anlatan ve SEÇMEYE yardım eden davet. Boş durum eskiden
 *    yalnız ne olduğunu anlatıyordu; altı kart ve altı anahtar arasında yeni kullanıcı
 *    kendi başına kalıyordu. Üç somut soru, üç somut cevap.
 */

type Lang = 'tr' | 'en';

const COPY = {
  tr: {
    unit: (d: number) => (d === 0 ? 'BUGÜN' : 'GÜN'),
    nearest: 'en yakın hedefin',
    goalOf: (i: number, n: number) => `${i}. hedefin · ${n} hedef`,
    deck: (n: number) => `${n} hedef — yana kaydırarak geç`,
    openEndedTitle: 'Tarihli hedefin yok',
    openEndedBody: 'Planların sürüyor; bir hedefe tarih vermek geri sayımı başlatır.',
    todayLabel: 'Bugünün planı',
    todayValue: (d: number, t: number) => (t === 0 ? 'bugün planlı iş yok' : d >= t ? `bugünlük tamam · ${d}/${t}` : `${d}/${t}`),
    modes: 'mod',
    activeModes: 'aktif mod',
    a11yNearest: (label: string, days: number) => `en yakın hedef ${label}, ${days === 0 ? 'bugün' : `${days} gün kaldı`}`,
    a11yNoGoal: 'tarihli hedef yok',
    a11yToday: (d: number, t: number) => (t === 0 ? 'bugün planlı iş yok' : `bugün ${d} / ${t} tamamlandı`),
    inviteTitle: 'Bir hedef seç, gerisini bize bırak',
    inviteBody: 'Sınav, tez, mülakat, spor, tasarruf ya da bırakmak istediğin bir alışkanlık — birini aç, hazır plan Bu Hafta ekranına ve görevlerine kendiliğinden düşsün.',
    pendingTitle: (n: number) => `${n} hedef planını bekliyor`,
    pendingBody: 'Aşağıda kurulumu tamamla; plan o an Bu Hafta ekranına ve görevlerine düşer.',
  },
  en: {
    unit: (d: number) => (d === 0 ? 'TODAY' : 'DAYS'),
    nearest: 'your nearest goal',
    goalOf: (i: number, n: number) => `goal ${i} of ${n}`,
    deck: (n: number) => `${n} goals — swipe to switch`,
    openEndedTitle: 'No dated goal',
    openEndedBody: 'Your plans keep running; give a goal a date to start the countdown.',
    todayLabel: "Today's plan",
    todayValue: (d: number, t: number) => (t === 0 ? 'nothing planned today' : d >= t ? `done for today · ${d}/${t}` : `${d}/${t}`),
    modes: 'modes',
    activeModes: 'active modes',
    a11yNearest: (label: string, days: number) => `nearest goal ${label}, ${days === 0 ? 'today' : `${days} days left`}`,
    a11yNoGoal: 'no dated goal',
    a11yToday: (d: number, t: number) => (t === 0 ? 'nothing planned today' : `today ${d} of ${t} done`),
    inviteTitle: 'Pick a goal, leave the rest to us',
    inviteBody: 'Exam, thesis, interview, fitness, savings or a habit to quit — turn one on and a ready plan flows into This Week and your tasks automatically.',
    pendingTitle: (n: number) => (n === 1 ? '1 goal is waiting for its plan' : `${n} goals are waiting for their plan`),
    pendingBody: 'Finish setup below; the plan lands in This Week and your tasks right away.',
  },
};

/** Destede bir sayfa: tarihi gelmemiş, planı uygulanmış tek hedef. */
export interface StatusGoal {
  days: number;
  label: string;
  color: string;
  textColor: string;
  emoji: string;
  /** Kalıcı kimlik (geri sayımın son görülen değeri buna bağlanır). */
  id: string;
  /** Yolun geçen payı 0..1 (bkz. roadProgress); başlangıç bilinmiyorsa null. */
  progress: number | null;
}

/*
  Destede bir hedefin ikonu + geri sayımı. Kancalar (halka, akan sayı) hedef başına;
  map içinde çağrılamayacakları için ayrı bileşen.
*/
function GoalCountdown({ g, unit, isDark }: { g: StatusGoal; unit: string; isDark: boolean }) {
  const tick = useCountdownTick(g.id, g.days);
  return (
    <>
      <RoadRing size={54} progress={g.progress} color={g.color} id={g.id}>
        <View style={{ width: 42, height: 42, borderRadius: R.full, backgroundColor: g.color + (isDark ? '26' : '18'), alignItems: 'center', justifyContent: 'center' }}>
          {renderModeEmojiIcon(g.emoji, 22, g.color)}
        </View>
      </RoadRing>
      <MotiView
        from={{ opacity: 0, translateY: 6 }}
        animate={{ opacity: tick.ready ? 1 : 0, translateY: tick.ready ? 0 : 6 }}
        transition={{ type: 'timing', duration: 320 }}
        style={{ alignItems: 'center', minWidth: 56 }}
      >
        {tick.ready && (
          <DisplayValue value={String(g.days)} from={tick.from} duration={tick.from != null ? 1400 : 450} color={g.color} style={{ fontSize: F.hero, lineHeight: F.hero + 2, letterSpacing: -1 }} />
        )}
        <Text style={{ color: g.textColor, fontWeight: '700', fontSize: F.caption, letterSpacing: 1, opacity: 0.75 }}>
          {unit}
        </Text>
      </MotiView>
    </>
  );
}

export interface ModeStatusCardProps {
  language: Lang;
  /** Tarihe göre SIRALI hedefler (en yakın önce). Boşsa "tarihli hedefin yok" hâli. */
  goals: StatusGoal[];
  activeCount: number;
  /** Açılmış ama planı uygulanmamış mod sayısı; aktif hedef yokken davet yerine bunu söyler. */
  pendingCount?: number;
  greeting: { text: string; icon: React.ReactNode };
  todayDone: number;
  todayTotal: number;
  motivation?: string | null;
  /** Hiç tarihli hedef yokken kullanılan nötr vurgu. */
  fallbackColor: string;
  fallbackTextColor: string;
  /** Bugünün planı satırı → Ana sayfa (Bugün'ün sahibi). */
  onOpenToday: () => void;
}

export const ModeStatusCard: React.FC<ModeStatusCardProps> = ({
  language, goals, activeCount, pendingCount = 0, greeting, todayDone, todayTotal, motivation, fallbackColor, fallbackTextColor, onOpenToday,
}) => {
  const { theme, isDark } = useAppTheme();
  const c = COPY[language];
  const nearest = goals[0] ?? null;

  // Mod açık, kurulum yarım: "Bir hedef seç" demek yanlış — kullanıcı zaten seçti.
  if (activeCount === 0 && pendingCount > 0) {
    return (
      <DisplayPanel padding={S.md}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
          <Zap size={ICON.md} color={theme.warning} />
          <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.body }}>{c.pendingTitle(pendingCount)}</Text>
        </View>
        <Text style={{ color: theme.onSurfaceVariant, fontSize: F.footnote, marginTop: S.xs, lineHeight: 18 }}>{c.pendingBody}</Text>
      </DisplayPanel>
    );
  }

  if (activeCount === 0) {
    return (
      <DisplayPanel padding={S.md}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
          <Sparkles size={ICON.md} color={theme.primary} />
          <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.body }}>{c.inviteTitle}</Text>
        </View>
        <Text style={{ color: theme.onSurfaceVariant, fontSize: F.footnote, marginTop: S.xs, lineHeight: 18 }}>{c.inviteBody}</Text>
        {/*
          "Sınav ya da Tez / Spor / Bırakma" yönlendirme satırları KALDIRILDI: hemen altındaki
          keşif listesini tekrar ediyordu ve mavi metinleri tıklanabilir görünüp
          dokunulamıyordu ("renk = anlam" kuralı — mavi yalnız etkileşim söyler).
        */}
      </DisplayPanel>
    );
  }

  return (
    // DİJİTAL PANEL (2026-10-30, uygulama geneli dil): kart çerçevesi diğer kartlarla aynı aile;
    // gün sayısı ve bugünün planı sabit genişlikli rakam, gün değişince SAYARAK akar.
    // Yüzey diğer kartlarla AYNI; mod rengi yalnız anlam taşıyan yerde (sayı, ikon).
    <DisplayPanel padding={S.md}>
    <View
      /*
        Bileşik kart: ekran okuyucu bunu 6-8 kopuk parça olarak okuyordu (selamlama,
        "3 mod", emoji, sayı, "gün kaldı", noktalar, "2/5"…). Tek bir anlamlı cümle.
      */
      accessible
      accessibilityRole="summary"
      accessibilityLabel={[
        greeting.text,
        `${activeCount} ${c.activeModes}`,
        nearest ? c.a11yNearest(nearest.label, nearest.days) : c.a11yNoGoal,
      ].join('. ')}
    >
      {/* üst satır: selam + aktif mod çipi */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
          {greeting.icon}
          <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.body }}>{greeting.text}</Text>
        </View>
        {/* Sayı bir DURUM, kimlik değil — nötr hap (eskiden en yakın modun rengindeydi). */}
        <View style={{ backgroundColor: theme.surfaceField, paddingHorizontal: S.sm, paddingVertical: S.xs, borderRadius: R.full }}>
          <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '700' }}>{activeCount} {c.modes}</Text>
        </View>
      </View>

      {/*
        KAHRAMAN SATIRI — tek büyük sayı, tek satır bağlam.

        Eskiden aynı satırda altı şey yarışıyordu: ikon kutusu, hedef adı, geri sayım,
        "gün kaldı" etiketi, altı nokta ve oran yazısı. Hepsi birbirine yakın
        puntolardaydı, yani hiçbiri öne çıkmıyordu. Artık göz önce SAYIYA düşüyor.

        Birden çok hedef varsa kart yalnız birini göstermez — aralarında kaydırılır
        (bkz. ModeDeck); tek hedefte deste hiç çizilmez.
      */}
      {goals.length > 0 ? (
        <View style={{ marginTop: S.md }}>
          <ModeDeck
            dotColors={goals.map(g => g.color)}
            a11yLabel={c.deck(goals.length)}
            pages={goals.map((g, gi) => (
              <View key={`${g.label}-${gi}`} style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
                <GoalCountdown g={g} unit={c.unit(g.days)} isDark={isDark} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.body }}>{g.label}</Text>
                  <Text numberOfLines={1} style={{ color: theme.onSurfaceVariant, fontSize: F.caption, marginTop: S.xxs }}>
                    {gi === 0 ? c.nearest : c.goalOf(gi + 1, goals.length)}
                  </Text>
                </View>
              </View>
            ))}
          />
        </View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: S.md, gap: S.md }}>
          <View style={{ width: 46, height: 46, borderRadius: R.lg, backgroundColor: fallbackColor + (isDark ? '26' : '18'), alignItems: 'center', justifyContent: 'center' }}>
            {renderModeEmojiIcon('📅', 24, fallbackColor)}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.body }}>{c.openEndedTitle}</Text>
            <Text numberOfLines={2} style={{ color: theme.onSurfaceVariant, fontSize: F.caption, marginTop: S.xxs }}>{c.openEndedBody}</Text>
          </View>
        </View>
      )}

      {motivation ? (
        <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '500', marginTop: S.md, lineHeight: 17 }}>{motivation}</Text>
      ) : null}
    </View>

    {/*
      BUGÜNÜN PLANI — TEK SATIR BAĞLANTI (2026-10-31, yeniden düzenleme A3 · K-1).
      Eskiden burada ana sayfadaki ModeTodayCard'ın aynısı bir ilerleme çubuğu vardı: aynı soru
      iki ekranda. Bugün'ün sahibi Ana sayfa; burada yalnız durum + oraya götüren satır kalır.
      Özet görünümün DIŞINDA: `accessible` kabın içindeki dokunulabilir öğe odak alamaz.
    */}
    <Touchable
      onPress={onOpenToday}
      accessibilityRole="link"
      accessibilityLabel={c.a11yToday(todayDone, todayTotal)}
      style={{ marginTop: S.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: MIN_TOUCH }}
    >
      <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '600' }}>{c.todayLabel}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xxs }}>
        <DisplayValue seenKey="goals.today" value={c.todayValue(todayDone, todayTotal)} color={todayTotal > 0 && todayDone >= todayTotal ? theme.success : theme.onSurfaceVariant} style={{ fontSize: F.footnote }} />
        <ChevronRight size={ICON.sm} color={theme.onSurfaceVariant} />
      </View>
    </Touchable>
    </DisplayPanel>
  );
};
