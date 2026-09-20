import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { Sparkles } from 'lucide-react-native';
import { ProgressRail } from '@/shared/components/ProgressRail';
import { S, F, R, B, ICON } from '@/shared/constants/tokens';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { renderModeEmojiIcon } from '@/features/modes/utils/modeIcons';
import { ModeDeck } from '@/features/modes/components/ModeDeck';

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
    inviteBody: 'Sınav, tez, mülakat ya da spor — birini aç, hazır plan otomatik olarak Haftalık Merkez ve görevlerine düşsün.',
    inviteRows: [
      { q: 'Bir tarihe yetişmen mi gerekiyor?', pick: 'Sınav ya da Tez' },
      { q: 'Bedeninle ilgili bir hedefin mi var?', pick: 'Spor & Fiziksel' },
      { q: 'Bir şeyi bırakmak mı istiyorsun?', pick: 'Bırakma' },
    ],
    inviteNote: 'Tek seferde bir hedefle başlamanı öneririz — sonra ekleyebilirsin.',
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
    inviteBody: 'Exam, thesis, interview or fitness — turn one on and a ready plan flows into your Weekly Hub and tasks automatically.',
    inviteRows: [
      { q: 'Racing a deadline?', pick: 'Exam or Thesis' },
      { q: 'A goal for your body?', pick: 'Fitness & Health' },
      { q: 'Trying to quit something?', pick: 'Quit Habit' },
    ],
    inviteNote: 'We suggest starting with one goal — you can add more later.',
  },
};

/** Destede bir sayfa: tarihi gelmemiş, planı uygulanmış tek hedef. */
export interface StatusGoal {
  days: number;
  label: string;
  color: string;
  textColor: string;
  emoji: string;
}

export interface ModeStatusCardProps {
  language: Lang;
  /** Tarihe göre SIRALI hedefler (en yakın önce). Boşsa "tarihli hedefin yok" hâli. */
  goals: StatusGoal[];
  activeCount: number;
  greeting: { text: string; icon: React.ReactNode };
  todayDone: number;
  todayTotal: number;
  motivation?: string | null;
  /** Hiç tarihli hedef yokken kullanılan nötr vurgu. */
  fallbackColor: string;
  fallbackTextColor: string;
}

export const ModeStatusCard: React.FC<ModeStatusCardProps> = ({
  language, goals, activeCount, greeting, todayDone, todayTotal, motivation, fallbackColor, fallbackTextColor,
}) => {
  const { theme, isDark } = useAppTheme();
  const c = COPY[language];
  const nearest = goals[0] ?? null;

  if (activeCount === 0) {
    return (
      <MotiView
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ type: 'timing', duration: 250 }}
        style={[styles.card, { backgroundColor: theme.surfaceCard, borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)', padding: S.md }]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
          <Sparkles size={ICON.md} color={theme.primary} />
          <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.body }}>{c.inviteTitle}</Text>
        </View>
        <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '500', marginTop: S.sm, lineHeight: 18 }}>{c.inviteBody}</Text>

        <View style={{ marginTop: S.md, gap: S.sm }}>
          {c.inviteRows.map((row) => (
            <View key={row.pick} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
              <View style={{ width: 5, height: 5, borderRadius: R.full, backgroundColor: theme.primary }} />
              <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, flex: 1 }} numberOfLines={1}>{row.q}</Text>
              <Text style={{ color: theme.primary, fontSize: F.caption, fontWeight: '700' }} numberOfLines={1}>{row.pick}</Text>
            </View>
          ))}
          <Text style={{ color: theme.onSurfaceMuted, fontSize: F.caption, marginTop: S.xxs }}>{c.inviteNote}</Text>
        </View>
      </MotiView>
    );
  }

  return (
    <MotiView
      from={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ type: 'timing', duration: 250 }}
      style={[styles.card, {
        backgroundColor: nearest ? (isDark ? nearest.color + '1A' : nearest.color + '12') : theme.surfaceCard,
        borderColor: nearest ? nearest.color + (isDark ? '40' : '30') : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)'),
        padding: S.md,
      }]}
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
        c.a11yToday(todayDone, todayTotal),
      ].join('. ')}
    >
      {/* üst satır: selam + aktif mod çipi */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
          {greeting.icon}
          <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.body }}>{greeting.text}</Text>
        </View>
        <View style={{ backgroundColor: (nearest?.color ?? fallbackColor) + (isDark ? '26' : '1A'), paddingHorizontal: S.sm, paddingVertical: S.xs, borderRadius: R.full }}>
          <Text style={{ color: nearest?.textColor ?? fallbackTextColor, fontSize: F.caption, fontWeight: '700' }}>{activeCount} {c.modes}</Text>
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
                <View style={{ width: 46, height: 46, borderRadius: R.lg, backgroundColor: g.color + (isDark ? '26' : '18'), alignItems: 'center', justifyContent: 'center' }}>
                  {renderModeEmojiIcon(g.emoji, 24, g.color)}
                </View>
                <MotiView
                  from={{ opacity: 0, translateY: 6 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'timing', duration: 320 }}
                  style={{ alignItems: 'center', minWidth: 56 }}
                >
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.6}
                    style={{ color: g.color, fontWeight: '700', fontSize: F.hero, lineHeight: F.hero + 2, letterSpacing: -1 }}
                  >
                    {g.days}
                  </Text>
                  <Text style={{ color: g.textColor, fontWeight: '700', fontSize: F.caption, letterSpacing: 1, opacity: 0.75 }}>
                    {c.unit(g.days)}
                  </Text>
                </MotiView>
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

      {/* Bugünün planı — kartlardakiyle AYNI çubuk; hepsi tamamsa kutlanır. */}
      <View style={{ marginTop: S.md, gap: S.xs }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '600' }}>{c.todayLabel}</Text>
          <Text style={{ color: todayTotal > 0 && todayDone >= todayTotal ? theme.success : theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '700' }}>
            {c.todayValue(todayDone, todayTotal)}
          </Text>
        </View>
        {todayTotal > 0 && (
          <ProgressRail
            variant="segments"
            value={todayDone}
            total={todayTotal}
            color={todayDone >= todayTotal ? theme.success : (nearest?.color ?? fallbackColor)}
          />
        )}
      </View>

      {motivation ? (
        <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '500', marginTop: S.md, lineHeight: 17 }}>{motivation}</Text>
      ) : null}
    </MotiView>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: B.thin,
    borderRadius: R.lg,
    overflow: 'hidden',
  },
});
