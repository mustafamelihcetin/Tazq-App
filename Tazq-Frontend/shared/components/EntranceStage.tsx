import React, { useEffect, useRef, useState } from 'react';
import { AppState, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useBootStore } from '@/shared/store/useBootStore';
import { useReduceMotion } from '@/shared/hooks/useReduceMotion';

/**
 * AÇILIŞ SAHNESİ — uygulamaya girildiği an (2026-10-31, kullanıcı: "şekilcilik ve detaycılık
 * çok önemli, user girdiği zaman etkilenmeli").
 *
 * Açılış katmanı (AnimatedSplash) kurulmuş ağacın ÜSTÜNDE duruyor; ana sayfa onun altında
 * çoktan çizilmiş oluyordu. Katman kalkınca sayfa bir anda, donmuş bir resim gibi beliriyordu.
 * Bu sarmalayıcı sayfayı anlamlı parçalar hâlinde SIRAYLA getirir (better-ui "stagger infrequent
 * entrances by 100ms": opaklık + 12 px yükselme, 300 ms ease-out):
 *  · YALNIZ AÇILIŞTA, oturumda bir kez: sayfa açılış katmanı kalkmadan önce mount edildiyse.
 *    Sonradan dönüşte / sekme değişiminde gecikme yok (sık etkileşim anında yanıt verir).
 *  · `enabled={false}` (ör. yardım turu açık): tur hedefleri ölçerken hiçbir şey kaymasın.
 *  · Hareket azaltılmışsa yükselme yok, yalnız opaklık.
 * Bulanıklık (better-ui 4 px) bilerek yok: Android'de gerçek bulanıklık yok, iOS'ta kare başına pahalı.
 */
const STEP = 100;
/*
  EMNİYET: açılış katmanı `onFinish`i yalnız çıkış animasyonu TAMAMLANIRSA çağırıyor; kesilir ya da
  katman hata verirse `splashDone` hiç gelmez. O zaman içerik gizli, skor 0, çiçek boş kalırdı.
  Bu süreden sonra beklemeyi bırakırız. En yavaş açılıştan uzun; açılış hâlâ ekrandaysa içerik
  zaten onun arkasında — zarar yok.
*/
export const ENTRANCE_FALLBACK_MS = 5000;
const DURATION = 300;
const RISE = 12;

export function EntranceStage({ order = 0, enabled = true, style, children }: {
  order?: number; enabled?: boolean; style?: StyleProp<ViewStyle>; children: React.ReactNode;
}) {
  const ready = useEntranceReady();
  const reduce = useReduceMotion();
  // Mount anında açılış hâlâ ekrandaysa giriş OYNAYACAK; değilse sayfa olduğu gibi durur.
  const plays = useRef(!useBootStore.getState().splashDone).current;
  const t = useSharedValue(plays ? 0 : 1);

  useEffect(() => {
    if (!plays || t.value === 1) return;
    // Tur açık ya da uygulama önde değil (kare çizilmiyor): giriş yok, içerik doğrudan görünür.
    if (!enabled || AppState.currentState !== 'active') { t.value = 1; return; }
    if (!ready) return;
    t.value = withDelay(order * STEP, withTiming(1, { duration: DURATION, easing: Easing.out(Easing.cubic) }));
    /*
      GARANTİ: içerik bir animasyonun BİTMESİNE bağlı kalmaz. Animasyon herhangi bir sebeple
      ilerlemezse (UI iş parçacığı takıldı, kare atlandı) süre + pay dolunca doğrudan görünür.
    */
    const guard = setTimeout(() => { t.value = 1; }, order * STEP + DURATION + 400);
    return () => clearTimeout(guard);
  }, [plays, enabled, ready, order, t]);

  const anim = useAnimatedStyle(() => ({
    opacity: t.value,
    transform: [{ translateY: reduce ? 0 : (1 - t.value) * RISE }],
  }));

  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}

/*
  OTURUMDA İLK GÖSTERİM. Ana sayfa sekme geçişinde (router.replace) yeniden kuruluyor; açılış
  animasyonları (çiçek açılışı, 0'dan sayım, üç nefes) her dönüşte baştan oynuyordu. Sık bir
  geçişte bu gürültü (better-ui: sık etkileşim anında yanıt verir). İlk gösterim GİRİŞTİR;
  sonraki gösterimler değeri anında çizer, canlılığı uyanış işareti taşır (bkz. useWakeSignal).
  İşaret efektte konur: StrictMode'un çift başlatıcı çağrısı ilk gösterimi yutmasın.
*/
const shownInSession = new Set<string>();
/** Yalnız testler: her test yeni bir oturum gibi başlasın. */
export function resetSessionForTests(): void { shownInSession.clear(); }
export function useFirstInSession(key: string): boolean {
  const [first] = useState(() => !shownInSession.has(key));
  useEffect(() => { shownInSession.add(key); }, [key]);
  return first;
}

/** Açılış katmanı kalktı mı (ya da emniyet süresi doldu mu) — açılışta oynayan her şey bunu bekler. */
export function useEntranceReady(): boolean {
  const splashDone = useBootStore(s => s.splashDone);
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (splashDone) return;
    const id = setTimeout(() => setTimedOut(true), ENTRANCE_FALLBACK_MS);
    return () => clearTimeout(id);
  }, [splashDone]);
  return splashDone || timedOut;
}
