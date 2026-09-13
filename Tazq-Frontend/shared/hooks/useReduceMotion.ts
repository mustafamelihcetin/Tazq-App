import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { swallow } from '@/shared/utils/swallow';

/**
 * "HAREKETİ AZALT" SİSTEM TERCİHİ.
 *
 * ── NEDEN ─────────────────────────────────────────────────────────────────────
 * Tercihi açan kullanıcı — genellikle vestibüler rahatsızlık, migren ya da baş dönmesi
 * yaşayan biri — hareketin kendisinden rahatsız oluyor. Uygulamada bu tercih iki yerde
 * zaten okunuyordu (odak ekranı, sekme çubuğunun küçülmesi) ama her seferinde ELDE
 * yazılmıştı. Açılış animasyonu ise hiç sormuyordu: tercihi açan kullanıcı uygulamayı
 * her açtığında yükselen, nabız atan bir logo görüyordu.
 *
 * ── İKİ PLATFORM DA GEÇERLİ ───────────────────────────────────────────────────
 * Şeffaflık tercihinin aksine bu ayar Android'de de var ("animasyonları kaldır").
 * O yüzden burada platform kapısı YOK — `useReduceTransparency` ile arasındaki fark
 * bilinçli.
 *
 * Okunamazsa `false`: şüphede kalınca mevcut davranışı koru.
 */
export function useReduceMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => { if (mounted) setReduced(!!v); })
      .catch((e) => swallow('useReduceMotion.read', e));

    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => setReduced(!!v));
    return () => {
      mounted = false;
      try { sub?.remove?.(); } catch (e) { swallow('useReduceMotion.unsubscribe', e); }
    };
  }, []);

  return reduced;
}
