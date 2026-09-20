import React from 'react';
import { useFocusEffect } from 'expo-router';
import { CustomAlert as Alert } from '@/shared/components/CustomAlert';
import { datePassed } from '@/features/modes/utils/modeCompletion';
import { closeModeWithUndo } from '@/features/modes/utils/modeUndo';
import type { PlanMode } from '@/features/modes/store/usePrefsStore';

/**
 * HEDEF TARİHİ GEÇTİ — "nasıl geçti?" ritüeli.
 *
 * ── ÖLÇÜLEN SORUN ───────────────────────────────────────────────────────────
 * Yalnız SINAV modu bittiğini biliyordu. Tez, mülakat ve spor hedeflerinde tarih
 * geçtiğinde kart kırmızı "Tarih geçti" yazıyor, plan motoru görev üretmeyi kesiyor —
 * ama kimse bir şey sormuyordu. Alışkanlıklar her sabah gelmeye devam ediyor, mod
 * "Aktif Hedeflerim" başlığı altında duruyordu. Yani tezini teslim eden kullanıcı
 * aylarca hayalet bir modla yaşıyordu ve onu kapatmayı kendi keşfetmek zorundaydı.
 *
 * ── NEDEN TEK KANCA ─────────────────────────────────────────────────────────
 * Aynı akış dört kartta ayrı ayrı yazılsaydı, bugünkü durumun aynısı olurdu: biri
 * yazılır, öteki unutulur. Modların uygula/kapat yolları zaten kart kart kopyalanmış
 * durumda ve bu tutarsızlıklar tam oradan doğuyor.
 *
 * ── KURALLAR ────────────────────────────────────────────────────────────────
 *  · Yalnız plan UYGULANMIŞ ve tarih GEÇMİŞSE sorar (gün sonuna kadar bekler).
 *  · Bir kez sorar (`shown` bayrağı), ekranın her açılışında değil.
 *  · Cevap ne olursa olsun mod kapanır ve temizlenir — ama `closeModeWithUndo`
 *    sayesinde "Geri al" tostu çıkar: yanlışlıkla kapanan plan geri gelir.
 *  · Kullanıcı uyarıyı kapatırsa (iptal) mod OLDUĞU GİBİ kalır; ısrar edilmez.
 */
export interface ModeCompletionReviewInput {
  /** Mod açık VE planı uygulanmış mı? */
  enabled: boolean;
  /** Hedef tarih (ISO). Yoksa ritüel çalışmaz. */
  dateStr: string | null | undefined;
  /** Daha önce soruldu mu? */
  shown: boolean;
  setShown: (v: boolean) => void;
  /** Geri alma kaydı için mod anahtarı. */
  planMode: PlanMode;
  /** Modu kapatan + temizleyen işlev (kartın kendi `closePlan`i). */
  closePlan: () => void;
  copy: {
    title: string;        // "Tez teslimi tamamlandı!"
    question: string;     // "Nasıl geçti?"
    answers: string[];    // üç kısa cevap
    cancel: string;       // "Şimdi değil"
    toast: string;        // "Tez modu kapatıldı"
    undo: string;         // "Geri al"
  };
}

export function useModeCompletionReview(input: ModeCompletionReviewInput): void {
  const { enabled, dateStr, shown, setShown, planMode, closePlan, copy } = input;

  /*
    YENİ TARİH → RİTÜEL YENİDEN KURULUR.
    Bayrak bir kez true olduğunda sonsuza dek öyle kalsaydı, aynı modu yeni bir hedefle
    (ikinci tez teslimi, ikinci mülakat) kuran kullanıcıya bir daha hiç sorulmazdı.
    Tarih ileri bir güne alındığı an bayrak düşer.
  */
  React.useEffect(() => {
    if (shown && dateStr && !datePassed(dateStr)) setShown(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateStr]);

  useFocusEffect(
    React.useCallback(() => {
      if (!enabled || shown || !datePassed(dateStr)) return;
      const close = () => closeModeWithUndo(planMode, closePlan, copy.toast, copy.undo);
      // Gecikme: ekran geçişi bitmeden açılan uyarı iOS'ta bazen hiç görünmüyor.
      const timer = setTimeout(() => {
        /*
          "SORULDU" İŞARETİ UYARIYLA BİRLİKTE YAZILIR.
          Bayrak bekleme başlamadan yazılsaydı, kullanıcı bu 400 ms içinde sayfadan
          çıktığında uyarı hiç görünmeden "soruldu" sayılır ve bir daha hiç sorulmazdı.
        */
        setShown(true);
        Alert.alert(copy.title, copy.question, [
          ...copy.answers.map((text) => ({ text, onPress: close })),
          { text: copy.cancel, style: 'cancel' as const },
        ]);
      }, 400);
      return () => clearTimeout(timer);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, dateStr, shown]),
  );
}
