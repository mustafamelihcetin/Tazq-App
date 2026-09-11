import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import { swallow } from '@/shared/utils/swallow';

/**
 * "ŞEFFAFLIĞI AZALT" SİSTEM TERCİHİ.
 *
 * ── NEDEN GEREKLİ ─────────────────────────────────────────────────────────────
 * Uygulama 17 yerde bulanık/cam yüzey çiziyor ama bu tercihi HİÇ okumuyordu. Tercihi
 * açan kullanıcı — genellikle görme güçlüğü, baş dönmesi ya da okuma zorluğu yaşayan
 * biri — sistemin her yerinde opak yüzeyler görüyor, TAZQ'da görmüyordu. Reduce Motion
 * için aynı desen odak ekranında zaten kurulu; şeffaflık atlanmıştı.
 *
 * iOS 27 bunu daha da önemli hâle getirdi: sistem genelinde kademeli bir cam yoğunluk
 * kaydırıcısı geldi ve kendi cam yüzeyini çizen uygulamaların bu tercihi ELLE
 * onurlandırması gerekiyor. Sistemin çizdiği yüzeyler otomatik uyar; bizimkiler uymaz.
 *
 * ── PLATFORM ──────────────────────────────────────────────────────────────────
 * `isReduceTransparencyEnabled` yalnız iOS'ta anlamlı; Android'de böyle bir sistem
 * tercihi yok (Android'in karşılığı "animasyonları kaldır", o da Reduce Motion).
 * Android'de her zaman `false` döner — yani Android'in bugünkü davranışı DEĞİŞMEZ.
 *
 * Okunamazsa `false`: şüphede kalınca mevcut görünümü koru. Sessizce cam yüzeyleri
 * opaklaştırmak, tercihi açmamış kullanıcıya bozuk bir arayüz göstermek olurdu.
 */
export function useReduceTransparency(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    let mounted = true;

    AccessibilityInfo.isReduceTransparencyEnabled?.()
      .then((v) => { if (mounted) setReduced(!!v); })
      .catch((e) => swallow('useReduceTransparency.read', e));

    const sub = AccessibilityInfo.addEventListener('reduceTransparencyChanged', (v) => setReduced(!!v));
    return () => {
      mounted = false;
      try { sub?.remove?.(); } catch (e) { swallow('useReduceTransparency.unsubscribe', e); }
    };
  }, []);

  return reduced;
}
