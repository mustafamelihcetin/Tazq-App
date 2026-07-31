import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, AppState } from 'react-native';
import { MotiView } from 'moti';
import { Footprints } from 'lucide-react-native';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { S, F, R, B, W, ICON, METRIC, LH, trackingFor } from '@/shared/constants/tokens';
import { Touchable } from '@/shared/components/Touchable';
import { AppIcon } from '@/shared/components/AppIcon';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { ActivityHealth } from '@/shared/services/activityHealth';
import { stepSummary } from '@/shared/utils/stepInsight';
import { swallow } from '@/shared/utils/swallow';
import type { DayActivity } from '@/shared/utils/activityMatch';

/**
 * SPOR MODUNDA GÜNLÜK ADIM SATIRI.
 *
 * Spor hedefi kurulmuş bir kullanıcı için günün hareketi, plandaki görevler kadar
 * anlamlı bir bilgi — üstelik telefon zaten biliyor. Kartın içinde durması önemli:
 * ayrı bir ekrana koysaydık kimse bakmazdı, ana panele koysaydık spor modu açık
 * olmayan herkes için gürültü olurdu.
 *
 * ── ANTRENÖRLÜK YOK ─────────────────────────────────────────────────────────────
 * Kalori, tempo, "şu kadar daha at" yok (bkz. stepInsight.ts). Sayı, mesafe ve tek
 * sıcak kelime. Kullanıcı sayıya bakınca ne yapacağını zaten biliyor.
 *
 * ── ÜÇ DURUM ────────────────────────────────────────────────────────────────────
 *  • Bağlı + veri var → sayı görünür.
 *  • Hiç sorulmamış ('unset') → tek satırlık sessiz davet. Yeni bir özellik ancak
 *    görülebilirse kullanılır; ayarlarda saklı kalan şey yok sayılır.
 *  • Kullanıcı 'no' demiş → HİÇBİR ŞEY. Reddedilen bir izni her açılışta tekrar
 *    önermek, hayırı duymamaktır.
 */

interface Props {
  /** Spor modu kartının vurgu rengi — satır kartın kimliğine ait kalsın. */
  accent: string;
  tr: boolean;
}

export const DailyStepsRow: React.FC<Props> = ({ accent, tr }) => {
  const { theme } = useAppTheme();
  const optIn = usePrefsStore((s) => s.activityHealthOptIn);
  const setOptIn = usePrefsStore((s) => s.setActivityHealthOptIn);
  const [activity, setActivity] = useState<DayActivity | null>(null);
  const busyRef = useRef(false);

  const load = useCallback(async () => {
    if (busyRef.current) return;
    if (optIn !== 'yes' || !ActivityHealth.isSupported()) return;
    busyRef.current = true;
    try {
      setActivity(await ActivityHealth.getTodayActivity());
    } catch (e) {
      swallow('DailyStepsRow.load', e);
    } finally {
      busyRef.current = false;
    }
  }, [optIn]);

  useEffect(() => {
    load();
    // Öne çıkışta tazele: kullanıcı yürüyüşten döndüğünde sayı eski kalmasın.
    const sub = AppState.addEventListener('change', (s: string) => { if (s === 'active') load(); });
    return () => sub.remove();
  }, [load]);

  const connect = async () => {
    const ok = await ActivityHealth.requestAuthorization();
    setOptIn(ok ? 'yes' : 'no');
    if (ok) load();
  };

  // Reddedilmiş izin bir daha önerilmez.
  if (optIn === 'no' || !ActivityHealth.isSupported()) return null;

  if (optIn !== 'yes') {
    return (
      <Touchable
        onPress={connect}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={tr ? 'Adım sayımı bağla' : 'Connect step tracking'}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: S.sm,
          borderRadius: R.md,
          borderWidth: B.thin,
          borderStyle: 'dashed',
          borderColor: theme.outline,
          paddingHorizontal: S.md,
          paddingVertical: S.smd,
        }}
      >
        <AppIcon Icon={Footprints} color={theme.onSurfaceVariant} size={24} radius={R.sm} iconSize={ICON.sm} />
        <Text style={{ flex: 1, color: theme.onSurfaceVariant, fontSize: F.caption, fontWeight: W.semibold }}>
          {tr ? 'Adımlarını buraya getir' : 'Bring your steps here'}
        </Text>
        <Text style={{ color: accent, fontSize: F.caption, fontWeight: W.bold }}>{tr ? 'Bağla' : 'Connect'}</Text>
      </Touchable>
    );
  }

  // Bağlı ama veri henüz okunmadı → satırı hiç çizme. Boş bir kutu göstermek,
  // "verin yok" gibi okunur; halbuki yalnızca henüz gelmemiştir.
  if (!activity) return null;

  const sum = stepSummary(activity.steps, activity.distanceMeters, tr ? 'tr' : 'en');

  return (
    <MotiView
      from={{ opacity: 0, translateY: 4 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 320 }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: S.md,
        borderRadius: R.md,
        borderWidth: B.thin,
        borderColor: accent + '30',
        backgroundColor: accent + '08',
        paddingHorizontal: S.md,
        paddingVertical: S.smd,
      }}
    >
      <AppIcon Icon={Footprints} color={accent} size={24} radius={R.sm} iconSize={ICON.sm} />
      <View style={{ flex: 1 }}>
        {/*
          Sayı İKİNCİL ölçekte (METRIC.sm): bu satır kartın kahramanı değil, hedefin
          yanında duran bir bağlam. Daha büyük yazsaydık spor hedefinin kendisini ezerdi.
        */}
        <Text
          style={{
            color: theme.onSurface,
            fontSize: METRIC.sm,
            fontWeight: W.bold,
            letterSpacing: trackingFor(METRIC.sm),
            lineHeight: METRIC.sm * LH.tight,
            includeFontPadding: false,
          }}
        >
          {sum.steps}
        </Text>
        <Text style={{ color: theme.onSurfaceMuted, fontSize: F.caption, fontWeight: W.medium, marginTop: S.xxs }}>
          {sum.distance ? `${sum.distance} · ${sum.note}` : sum.note}
        </Text>
      </View>
    </MotiView>
  );
};

DailyStepsRow.displayName = 'DailyStepsRow';
