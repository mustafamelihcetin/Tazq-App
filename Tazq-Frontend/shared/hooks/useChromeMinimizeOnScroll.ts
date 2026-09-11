import { useEffect, useRef } from 'react';
import { Animated, Platform, AccessibilityInfo } from 'react-native';
import { useChromeStore } from '@/shared/store/useChromeStore';
import { swallow } from '@/shared/utils/swallow';

/**
 * KAYDIRMA YÖNÜNDEN SEKME ÇUBUĞU KÜÇÜLMESİ — iOS 26/27 davranışı.
 *
 * Aşağı kaydırınca çubuk ikon-only hâle iner, yukarı kaydırınca etiketleriyle geri
 * açılır. Apple'ın kendi kuralı bu; iOS 26'da zorunluydu, çok eleştirildi ve iOS 27'de
 * İSTEĞE BAĞLI hâle geldi — biz bilerek açıyoruz.
 *
 * ── EŞİK NEDEN VAR ────────────────────────────────────────────────────────────
 * Ham yön değişimini dinlemek çubuğu titretir: parmağın en ufak oynaması, listenin
 * esneme (bounce) hareketi, hatta klavyenin açılması yön değiştirir. `THRESHOLD`
 * kadar gerçek hareket birikmeden durum değişmiyor.
 *
 * ── TEPEDE HER ZAMAN AÇIK ─────────────────────────────────────────────────────
 * Sayfanın başındayken çubuk daima tam hâlinde. Kullanıcı listenin tepesine döndüğünde
 * gezinmeyi eksik bulmamalı.
 *
 * ── HAREKETİ AZALT: HİÇ KÜÇÜLMEZ ──────────────────────────────────────────────
 * Küçülmenin tek gerekçesi zarif bir geçiş. Animasyonsuz bir çubuk iki boy arasında
 * ZIPLAR — bu, özelliğin amacının tam tersi. Tercih açıkken çubuk sabit kalıyor.
 *
 * ── ANDROID: DEĞİŞMEZ ─────────────────────────────────────────────────────────
 * Material'ın gezinme çubuğu kaydırmayla küçülmez ve Android'de çubuk zaten opak,
 * dibe yapışık (bkz. tokens). Bu davranış oraya taşınırsa platformun diline yabancı
 * bir hareket olur.
 */

/** Durum değişmeden önce birikmesi gereken gerçek hareket. */
const THRESHOLD = 24;
/** Bu noktanın üstünde çubuk daima tam hâlinde. */
const TOP_ZONE = 16;

export function useChromeMinimizeOnScroll(scrollY: Animated.Value | null | undefined) {
  const setMinimized = useChromeStore((s) => s.setMinimized);
  const lastY = useRef(0);
  const accum = useRef(0);
  const reduceMotion = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => { if (mounted) reduceMotion.current = !!v; })
      .catch((e) => swallow('useChromeMinimizeOnScroll.reduceMotion', e));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => { reduceMotion.current = !!v; });
    return () => {
      mounted = false;
      try { sub?.remove?.(); } catch (e) { swallow('useChromeMinimizeOnScroll.unsubscribe', e); }
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'ios' || !scrollY) return;

    const id = scrollY.addListener(({ value }) => {
      if (reduceMotion.current) return;

      // Tepe bölgesi: koşulsuz açık. Aşağıdaki birikimi de sıfırla ki kullanıcı
      // tepeden aşağı indiğinde eşik baştan saysın.
      if (value <= TOP_ZONE) {
        accum.current = 0;
        lastY.current = value;
        setMinimized(false);
        return;
      }

      const delta = value - lastY.current;
      lastY.current = value;

      // Yön değiştiyse birikimi sıfırla — eski yöndeki mesafe yeni yöne sayılmaz.
      if ((delta > 0 && accum.current < 0) || (delta < 0 && accum.current > 0)) accum.current = 0;
      accum.current += delta;

      if (accum.current > THRESHOLD) {
        accum.current = 0;
        setMinimized(true);
      } else if (accum.current < -THRESHOLD) {
        accum.current = 0;
        setMinimized(false);
      }
    });

    return () => {
      scrollY.removeListener(id);
      // Ekrandan çıkarken çubuğu açık bırak: bir sonraki ekran küçülmüş bir
      // çubukla açılmamalı — o ekran henüz kaydırılmadı.
      setMinimized(false);
    };
  }, [scrollY, setMinimized]);
}
