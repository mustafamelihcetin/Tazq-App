import { useConfettiStore } from '@/shared/store/useConfettiStore';
import { useFocusStore } from '@/features/focus';
import { usePrefsStore } from '@/features/modes';

/**
 * KUTLAMA KARARI — tek yerde: ne kutlanır, ne kadar puan verilir, kim susturulur.
 *
 * Karar ana ekranda ÜÇ ayrı yere kopyalanmıştı (ilk görev · günün son görevi ·
 * günün son alışkanlığı) ve üçü de aynı üç adımı elle tekrarlıyordu: konfetiyi
 * tetikle, odak puanı ekle, bazen `markFirstWin` yaz. Kopyalar zaten ayrışmaya
 * başlamıştı — Sade mod kapısı eklenirken üç yere ayrı ayrı yazmak gerekti.
 *
 * ── SADE MOD SÖZLEŞMESİ ───────────────────────────────────────────────────────
 * Sade modda KUTLAMA yok ama VERİ yazımı sürüyor. Ayrım önemli: mod bir GÖRÜNÜM
 * tercihidir. Puanı ve "ilk başarı" damgasını atlarsak, Sade moddan çıkan kullanıcının
 * geçmişi eksik olur ve ayar sessizce veri budamış olur — kullanıcının istediği
 * "gürültü istemiyorum"du, "ilerlememi silin" değil.
 */

export type CelebrationKind = 'first-win' | 'day-cleared' | 'habits-cleared';

type CelebrateArgs = {
  kind: CelebrationKind;
  /** Sade mod: kutlama gösterilmez, puan yine işlenir. */
  isLite: boolean;
  tr: boolean;
};

/** Her kutlamanın metni ve puan değeri — tek tablo, üç dağınık blok yerine. */
const SPEC: Record<CelebrationKind, {
  points: number;
  variant: 'levelup' | 'day_cleared';
  intensity: 'high' | 'medium';
  title: { tr: string; en: string };
  body: { tr: string; en: string };
}> = {
  'first-win': {
    points: 10,
    variant: 'levelup',
    intensity: 'high',
    title: { tr: 'İlk Başarı!', en: 'First Victory!' },
    body: {
      tr: 'Tebrikler, TAZQ\'daki ilk görevini tamamladın!',
      en: 'Congratulations on completing your first task on TAZQ!',
    },
  },
  'day-cleared': {
    points: 25,
    variant: 'day_cleared',
    intensity: 'high',
    title: { tr: 'Günü Temizledin!', en: 'Day Cleared!' },
    body: {
      tr: 'Bugünün tüm görevlerini başarıyla tamamladın!',
      en: 'You completed all of today\'s tasks successfully!',
    },
  },
  'habits-cleared': {
    points: 20,
    variant: 'day_cleared',
    intensity: 'medium',
    title: { tr: 'Alışkanlıklar Tamam!', en: 'All Habits Done!' },
    body: {
      tr: 'Bugünkü tüm alışkanlık hedeflerini tamamladın. Harika istikrar!',
      en: 'You completed all habit targets for today. Great consistency!',
    },
  },
};

/**
 * Kutlamayı uygular: Sade modda yalnız puanı işler, aksi hâlde konfetiyi de açar.
 * `first-win` ayrıca "ilk başarı" damgasını yazar — bu damga kutlamadan bağımsızdır.
 */
export function celebrate({ kind, isLite, tr }: CelebrateArgs): void {
  const spec = SPEC[kind];

  if (!isLite) {
    useConfettiStore.getState().trigger(
      tr ? spec.title.tr : spec.title.en,
      tr ? spec.body.tr : spec.body.en,
      spec.intensity,
      spec.variant,
    );
  }

  if (kind === 'first-win') usePrefsStore.getState().markFirstWin();
  useFocusStore.getState().addFocusPoints(spec.points);
}
