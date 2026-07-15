/**
 * Yutulan hatalar için tek giriş noktası.
 *
 * Neden: kod tabanında ~97 adet `catch {}` vardı. Boş catch iki şeyi birden yapar:
 * hatayı bastırır VE onu görünmez kılar. Sonuç, kullanıcının "bildirim gelmiyor"
 * dediği ama elimizde hiçbir iz olmadığı durumdur — Sentry yatırımı da boşa gider.
 *
 * Neden hepsi `captureException` değil: her yutulan hatayı issue'ya çevirmek alarm
 * gürültüsü üretir ve gerçek sinyali gömer. Varsayılan davranış breadcrumb bırakmaktır:
 * maliyeti sıfır, alarm üretmez, ama gerçek bir çökme olduğunda öncesindeki iz görünür.
 * Yalnızca sessiz kalması kullanıcıyı gerçekten etkileyen hatalar `capture: true` alır.
 *
 * Kullanım:
 *   try { ... } catch (e) { swallow('notifications.scheduleMorningBrief', e); }
 *   try { ... } catch (e) { swallow('prefs.hydrateFromCloud', e, { capture: true }); }
 *
 * BİLEREK KAPSAM DIŞI: Haptics çağrıları (`Haptics.impactAsync(...).catch(() => {})`)
 * ve `Notifications.cancelScheduledNotificationAsync(...)` gibi yüksek frekanslı,
 * sonucu kullanıcı için görünmez olan işler hâlâ sessizce yutulur. Bunlara breadcrumb
 * eklemek Sentry'nin 50'lik breadcrumb tamponunu doldurup gerçek izleri kuyruktan
 * atardı — yani hata ayıklamayı iyileştirmek yerine kötüleştirirdi.
 */

import { addBreadcrumb, captureError } from './sentry';

type SwallowOptions = {
  /** Sessiz kalması kullanıcıyı etkileyen hatalar için: Sentry'de issue açar. */
  capture?: boolean;
};

export function swallow(context: string, error: unknown, opts?: SwallowOptions): void {
  const message = error instanceof Error ? error.message : String(error);

  try {
    addBreadcrumb(`${context}: ${message}`, 'swallowed');
    if (opts?.capture) {
      captureError(error instanceof Error ? error : new Error(`${context}: ${message}`), {
        'swallow.context': context,
      });
    }
  } catch {
    // Raporlamanın kendisi çökerse çağıranı düşürmeyiz — burası bilerek sessizdir.
  }

  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.warn(`[swallowed] ${context}:`, error);
  }
}
