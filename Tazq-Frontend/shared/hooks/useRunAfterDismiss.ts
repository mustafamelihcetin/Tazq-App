import { useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';

/**
 * MODAL KAPANDIKTAN SONRA ÇALIŞTIR.
 *
 * ── ÖLÇÜLEN SORUN ─────────────────────────────────────────────────────────────
 * Bir modaldaki eylem ikinci bir modal açıyorsa (palet → triage), iOS kapanmakta olan
 * modalın üstüne yenisini açmayı SESSİZCE reddedebilir: kullanıcı düğmeye basar, hiçbir
 * şey olmaz. `onClose(); setTimeout(action, 50)` bunu şansa bırakıyordu.
 *
 * Eylem artık modal GERÇEKTEN kapandıktan sonra çalışıyor:
 *  · iOS: Modal'ın `onDismiss`i (yalnız iOS'ta var ve modal bağlı kalmalı —
 *    `if (!visible) return null` onu da keser).
 *  · Android: o olay yok; kapanış anında çalışır (Android iki modalı sorunsuz yığar).
 *  · Güvenlik: iOS'ta onDismiss bir sebeple gelmezse süreli yedek.
 * Eylem EN FAZLA BİR KEZ çalışır.
 *
 * Kullanım: `const { schedule, onDismiss } = useRunAfterDismiss(visible);`
 * eylemde `schedule(fn); onClose();`, modalda `onDismiss={onDismiss}`.
 */
const FALLBACK_MS = 450;

export function useRunAfterDismiss(visible: boolean) {
  const pendingRef = useRef<(() => void) | null>(null);
  const fallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    if (fallbackRef.current) { clearTimeout(fallbackRef.current); fallbackRef.current = null; }
    const run = pendingRef.current;
    pendingRef.current = null;
    run?.();
  }, []);

  useEffect(() => {
    if (visible || !pendingRef.current) return;
    if (Platform.OS !== 'ios') { flush(); return; }
    fallbackRef.current = setTimeout(flush, FALLBACK_MS);
  }, [visible, flush]);

  useEffect(() => () => { if (fallbackRef.current) clearTimeout(fallbackRef.current); }, []);

  const schedule = useCallback((action: () => void) => { pendingRef.current = action; }, []);

  return { schedule, onDismiss: flush };
}
