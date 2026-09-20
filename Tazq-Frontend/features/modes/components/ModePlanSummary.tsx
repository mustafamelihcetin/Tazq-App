import React from 'react';
import { View, Text } from 'react-native';
import { MotiView } from 'moti';
import { Calendar, CheckCircle2 } from 'lucide-react-native';
import { ProgressRail } from '@/shared/components/ProgressRail';
import { S, F, ICON } from '@/shared/constants/tokens';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { PlanArcRow, PlanPausedBanner } from '@/features/modes/components/PlanPauseRow';
import type { PlanLifecycle } from '@/features/modes/hooks/usePlanLifecycle';

/**
 * YAŞAYAN PLANIN ÖZETİ — kurulan plan artık bir FORM değil, bir DURUM.
 *
 * ── ÖLÇÜLEN SORUN ──────────────────────────────────────────────────────────
 * Aynı özet DÖRT kartta ayrı ayrı yazılmıştı (sınav, tez, mülakat, spor) ve şimdiden
 * ayrışmıştı: üçünde sayı 40pt/600, sporda F.hero/700; "gün kaldı" metni dört kez
 * kopyalanmış, geçmiş tarih durumu her kartta başka cümleyle anlatılıyordu. Kullanıcı
 * için sonuç, aynı işi yapan dört farklı görünüm demekti — prestij tutarlılıktan doğar.
 *
 * ── HER İHTİMAL BURADA KARŞILANIR ──────────────────────────────────────────
 *  · tarih YOK          → "Süresiz hedef" (sayı yerine), geri sayım gösterilmez
 *  · tarih GEÇMİŞ       → hata renginde tek satır + (varsa) kapatma çağrısı
 *  · hedef BUGÜN        → "bugün" (0 yazmak yanlış okunur: "kalmadı" değil, "bugün")
 *  · bugün planlı iş yok → ilerleme çubuğu GİZLENİR ("0/0" gürültüsü olmaz)
 *  · uzun hedef adı     → tek satır, taşma kırpılır
 *  · büyük yazı ayarı   → sayı kendini küçültür (adjustsFontSizeToFit)
 *
 * Ekran okuyucu için parçalar TEK cümle olarak duyurulur; yoksa "12", "GÜN", "Bugün",
 * "2/3", "%67" diye altı kopuk parça okunurdu.
 */

type Lang = 'tr' | 'en';

const COPY = {
  tr: {
    days: 'GÜN',
    today: 'bugün',
    todayUpper: 'BUGÜN',
    openEnded: 'Süresiz hedef',
    todayLabel: 'Bugün',
    passed: 'Tarih geçti',
    nothingToday: 'Bugün planlı iş yok',
    allDone: 'Bugünlük tamam',
    a11y: (name: string, when: string, prog: string) => `${name}. ${when}. ${prog}`,
    daysLeft: (n: number) => `${n} gün kaldı`,
    progress: (d: number, t: number) => `bugün ${d} / ${t} tamamlandı`,
  },
  en: {
    days: 'DAYS',
    today: 'today',
    todayUpper: 'TODAY',
    openEnded: 'Open-ended goal',
    todayLabel: 'Today',
    passed: 'Date passed',
    nothingToday: 'Nothing planned today',
    allDone: 'Done for today',
    a11y: (name: string, when: string, prog: string) => `${name}. ${when}. ${prog}`,
    daysLeft: (n: number) => `${n} days left`,
    progress: (d: number, t: number) => `today ${d} of ${t} done`,
  },
};

export interface ModePlanSummaryProps {
  language: Lang;
  accent: string;
  /** Metin için kontrast güvenli ton (AA) — sayı dışındaki vurgular bunu kullanır. */
  accentText: string;
  /** Hedefin adı — ekran okuyucu cümlesinde geçer. */
  goalName: string;
  /** Kalan gün. Tarih yoksa null. Bugünse 0. */
  daysLeft: number | null;
  /** Tarih geçti mi? */
  past: boolean;
  /** Okunabilir tarih ("12 Haziran 2026"). Tarih yoksa boş. */
  dateLabel: string;
  todayDone: number;
  todayTotal: number;
  /** Tarih geçtiyse gösterilecek kapatma çağrısı (kartın kendi akışı). */
  pastAction?: React.ReactNode;
  /**
   * MODA ÖZGÜ İLERLEME — verilirse bugünkü görev çubuğunun YERİNE geçer.
   *
   * Her modun ilerlemesi "bugün kaç görev" değil: spor modunda ölçü kilodaki yol ya da
   * haftalık antrenman günü olabiliyor. Ortak kabuk (geri sayım + tarih) korunur, ölçü
   * karta bırakılır — yoksa bu bileşen ya spor modunu yoksayar ya da onun özel
   * ölçüsünü silerdi.
   */
  progress?: React.ReactNode;
  /**
   * YAŞAM DÖNGÜSÜ — ara verme ve kat edilen yol (bkz. usePlanLifecycle).
   *
   * İsteğe bağlı: henüz bağlanmamış bir kart verilmediğinde eski davranışını sürdürür,
   * yarım bir arayüz göstermez.
   */
  lifecycle?: PlanLifecycle;
}

export const ModePlanSummary: React.FC<ModePlanSummaryProps> = ({
  language, accent, accentText, goalName, daysLeft, past, dateLabel, todayDone, todayTotal, pastAction, progress, lifecycle,
}) => {
  const { theme } = useAppTheme();
  const c = COPY[language];
  const pct = todayTotal > 0 ? Math.round((todayDone / todayTotal) * 100) : 0;
  const complete = todayTotal > 0 && todayDone >= todayTotal;

  const whenText = past
    ? c.passed
    : daysLeft == null
      ? c.openEnded
      : daysLeft === 0
        ? c.today
        : c.daysLeft(daysLeft);
  const progText = todayTotal > 0 ? c.progress(todayDone, todayTotal) : c.nothingToday;

  if (past) {
    return (
      <View accessible accessibilityLabel={c.a11y(goalName, whenText, progText)} style={{ gap: S.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
          <Calendar size={ICON.sm} color={theme.error} />
          <Text numberOfLines={1} style={{ flex: 1, color: theme.error, fontWeight: '600', fontSize: F.caption }}>
            {c.passed}{dateLabel ? ` · ${dateLabel}` : ''}
          </Text>
        </View>
        {pastAction}
      </View>
    );
  }

  return (
    <View
      accessible
      accessibilityLabel={c.a11y(goalName, whenText, progText)}
      style={{ flexDirection: 'row', alignItems: 'flex-start', gap: S.lg }}
    >
      {/* Geri sayım — ekranın tek kahraman sayısı. Yumuşak giriş: sayı "belirir". */}
      <MotiView
        from={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'timing', duration: 320 }}
        style={{ alignItems: 'center', minWidth: 52 }}
      >
        {daysLeft == null ? (
          <Text style={{ color: accentText, fontWeight: '700', fontSize: F.title, letterSpacing: -0.5 }}>—</Text>
        ) : (
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            style={{ color: accent, fontWeight: '700', fontSize: F.hero, lineHeight: F.hero + 2, letterSpacing: -1 }}
          >
            {daysLeft}
          </Text>
        )}
        <Text style={{ color: accentText, fontSize: F.caption, fontWeight: '700', opacity: 0.75, letterSpacing: 1 }}>
          {daysLeft == null ? '' : daysLeft === 0 ? c.todayUpper : c.days}
        </Text>
      </MotiView>

      <View style={{ flex: 1, minWidth: 0, paddingTop: S.xxs }}>
        {dateLabel ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs }}>
            <Calendar size={ICON.sm} color={theme.onSurfaceVariant} />
            <Text numberOfLines={1} style={{ flex: 1, color: theme.onSurfaceVariant, fontSize: F.caption }}>{dateLabel}</Text>
          </View>
        ) : (
          <Text numberOfLines={1} style={{ color: theme.onSurfaceVariant, fontSize: F.caption }}>{c.openEnded}</Text>
        )}

        {/*
          DURAKLI PLAN BUGÜNÜN İŞİNİ GÖSTERMEZ — çünkü bugün iş yok.
          Geri sayım yine de duruyor: hedefin tarihi ara verince ertelenmiyor, bunu
          saklamak kullanıcıyı yanıltmak olurdu.
        */}
        {lifecycle?.isPaused ? (
          <View style={{ marginTop: S.sm }}>
            <PlanPausedBanner tr={language === 'tr'} accent={accent} accentText={accentText} lifecycle={lifecycle} />
          </View>
        ) : progress ? (
          <View style={{ marginTop: S.sm }}>{progress}</View>
        ) : todayTotal > 0 ? (
          <View style={{ marginTop: S.sm, gap: S.xs }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '600' }}>{c.todayLabel}</Text>
              {complete ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xxs }}>
                  <CheckCircle2 size={ICON.xs} color={theme.success} />
                  <Text style={{ color: theme.success, fontSize: F.caption, fontWeight: '700' }}>{c.allDone}</Text>
                </View>
              ) : (
                <Text style={{ color: accentText, fontSize: F.caption, fontWeight: '600' }}>{todayDone}/{todayTotal} · {pct}%</Text>
              )}
            </View>
            <ProgressRail variant="segments" value={todayDone} total={todayTotal} color={complete ? theme.success : accent} />
          </View>
        ) : (
          // "0/0" yazmak yerine sessizlik: bugün bu moddan bir şey beklenmiyor.
          <Text style={{ marginTop: S.sm, color: theme.onSurfaceMuted, fontSize: F.caption }}>{c.nothingToday}</Text>
        )}

        {/*
          KAT EDİLEN YOL + ARA VERME.

          Geri sayım tek başına yalnız baskı üretiyordu: 25. gündeki kullanıcı ne kadar
          AZ vakti kaldığını görüyor, 25 gündür ne yaptığını görmüyordu. Ölçü "kaç gün
          çalıştın" — günlük görevler emekliye ayrıldığı için sayılamayan tek şey görev
          sayısıydı; alışkanlık günleri ise kalıcı (bkz. planArc).
        */}
        {lifecycle && !lifecycle.isPaused ? (
          <View style={{ marginTop: S.sm }}>
            <PlanArcRow tr={language === 'tr'} accent={accent} accentText={accentText} lifecycle={lifecycle} />
          </View>
        ) : null}
      </View>
    </View>
  );
};
