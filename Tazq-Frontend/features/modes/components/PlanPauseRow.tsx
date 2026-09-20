import React from 'react';
import { View, Text } from 'react-native';
import { PauseCircle, PlayCircle } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { CustomAlert as Alert } from '@/shared/components/CustomAlert';
import { S, F, R, B, ICON } from '@/shared/constants/tokens';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { PAUSE_CHOICES } from '@/features/modes/utils/planPause';
import type { PlanLifecycle } from '@/features/modes/hooks/usePlanLifecycle';

/**
 * ARA VERME VE KAT EDİLEN YOL — yedi modun ORTAK satırı.
 *
 * ── NEDEN AYRI BİR DOSYA ───────────────────────────────────────────────────
 * Bu iki parça önce `ModePlanSummary`nin içinde yazılmıştı; oysa o bileşeni yalnız
 * DÖRT kart kullanıyor (sınav, tez, mülakat, spor). Tasarruf, bırakma ve Ramazan'ın
 * kendi düzenleri var ve ara verme onlarda da gerekli: ara vermek bir "sınav modu
 * özelliği" değil, hayatın araya girmesine verilen cevap. İçeride kalsaydı ya üç mod
 * ara veremeyecek ya da aynı satır üç kez kopyalanacaktı.
 *
 * Metinler tek yerde: "3 gün ara verildi" cümlesinin modlara göre değişmesi için bir
 * sebep yok ve kopyalar zamanla ayrışır.
 */

const COPY = {
  tr: {
    arc: (elapsed: number, effort: number) => `${elapsed} gündür sürüyor · ${effort} gününde çalıştın`,
    arcFirstDay: 'Bugün başladın',
    pause: 'Ara ver',
    pauseTitle: 'Plana ara ver',
    pauseBody: 'Bugünün plan işleri kalkar, serilerin korunur. Süre bitince plan kendiliğinden devam eder.',
    pauseChoice: (d: number) => (d === 1 ? 'Bugünlük' : `${d} gün`),
    cancel: 'Vazgeç',
    pauseToast: (d: number) => (d === 1 ? 'Plana bugünlük ara verildi' : `Plana ${d} gün ara verildi`),
    undo: 'Geri al',
    paused: (d: number) => (d === 1 ? 'Ara verildi · bugün' : `Ara verildi · ${d} gün kaldı`),
    resume: 'Devam et',
    resumeToast: 'Plan devam ediyor',
  },
  en: {
    arc: (elapsed: number, effort: number) => `${elapsed} days in · worked on ${effort}`,
    arcFirstDay: 'Started today',
    pause: 'Pause',
    pauseTitle: 'Pause this plan',
    pauseBody: "Today's plan work is cleared and your streaks stay safe. The plan resumes on its own.",
    pauseChoice: (d: number) => (d === 1 ? 'Just today' : `${d} days`),
    cancel: 'Cancel',
    pauseToast: (d: number) => (d === 1 ? 'Plan paused for today' : `Plan paused for ${d} days`),
    undo: 'Undo',
    paused: (d: number) => (d === 1 ? 'Paused · today' : `Paused · ${d} days left`),
    resume: 'Resume',
    resumeToast: 'Plan resumed',
  },
};

export const planPauseCopy = COPY;

interface Common {
  /** Dil BAYRAK olarak taşınır: çağrı yerinde metin seçen bir dallanma kalmasın. */
  tr: boolean;
  accent: string;
  accentText: string;
  lifecycle: PlanLifecycle;
}

/** Duraklı hâl: ne kadar kaldığını söyler ve erken dönüşün kapısını açar. */
export const PlanPausedBanner: React.FC<Common> = ({ tr, accent, accentText, lifecycle }) => {
  const { theme } = useAppTheme();
  const c = tr ? COPY.tr : COPY.en;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
      <PauseCircle size={ICON.sm} color={theme.onSurfaceVariant} />
      <Text numberOfLines={1} style={{ flex: 1, color: theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '600' }}>
        {c.paused(lifecycle.pauseDaysLeft)}
      </Text>
      <Touchable
        onPress={() => lifecycle.resume({ toast: c.resumeToast })}
        style={{ flexDirection: 'row', alignItems: 'center', gap: S.xxs, paddingHorizontal: S.smd, paddingVertical: S.xs, borderRadius: R.full, borderWidth: B.thin, borderColor: accent + '55' }}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={c.resume}
      >
        <PlayCircle size={ICON.xs} color={accentText} />
        <Text style={{ color: accentText, fontSize: F.caption, fontWeight: '700' }}>{c.resume}</Text>
      </Touchable>
    </View>
  );
};

/**
 * Yürüyen hâl: kat edilen yol + "Ara ver".
 *
 * Yol bilinmiyorsa (başlangıcı damgalanmamış eski plan) uydurma sayı yazılmaz; satır
 * yalnız "Ara ver" düğmesini taşır — ara verme hakkı planın yaşına bağlı değildir.
 */
export const PlanArcRow: React.FC<Common> = ({ tr, lifecycle }) => {
  const { theme } = useAppTheme();
  const c = tr ? COPY.tr : COPY.en;
  const arc = lifecycle.arc;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
      <Text numberOfLines={1} style={{ flex: 1, color: theme.onSurfaceMuted, fontSize: F.caption }}>
        {arc ? (arc.elapsedDays <= 1 ? c.arcFirstDay : c.arc(arc.elapsedDays, arc.effortDays)) : ''}
      </Text>
      <Touchable
        onPress={() => {
          Alert.alert(c.pauseTitle, c.pauseBody, [
            ...PAUSE_CHOICES.map(d => ({
              text: c.pauseChoice(d),
              onPress: () => lifecycle.pause(d, { toast: c.pauseToast, undo: c.undo }),
            })),
            { text: c.cancel, style: 'cancel' as const },
          ]);
        }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={c.pauseTitle}
        accessibilityHint={c.pauseBody}
      >
        <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '600' }}>{c.pause}</Text>
      </Touchable>
    </View>
  );
};

/**
 * İkisini birden: kendi düzeni olan kartlar (tasarruf, bırakma, Ramazan) tek satır ekler.
 *
 * Plan kurulmamışken hiç çizilmez — ara verilecek bir şey yokken "Ara ver" göstermek,
 * olmayan bir duruma düğme koymaktır.
 */
export const PlanLifecycleRow: React.FC<Common & { hasPlan: boolean }> = (props) => {
  if (!props.hasPlan) return null;
  return props.lifecycle.isPaused ? <PlanPausedBanner {...props} /> : <PlanArcRow {...props} />;
};
