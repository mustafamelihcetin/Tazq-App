import React, { useEffect, useState } from 'react';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { useTourRun, type FirstRunPage } from '@/features/onboarding/utils/firstRun';
import { TOUR_STEPS, AUTO_START_PAGES } from '@/features/onboarding/tour/tourSteps';
import { SpotlightTour } from '@/features/onboarding/components/SpotlightTour';
import { TourBeacon } from '@/features/onboarding/components/TourBeacon';
import type { ScrollLike } from '@/shared/components/TourContext';

/*
  ── SAYFA TURU — giriş noktası (2026-10-25 yeniden kuruldu) ──────────────────────
  Eski hâl: her sayfaya ilk girişte tam ekran örtü + SAHTE önizleme (832 satırlık
  TourFeaturePreview), 18 adım, adım başına 25–40 kelime, iki ayrı "Atla". Cihazda
  gece "Günaydın, Deniz · 84" gösteriyordu — kullanıcının ekranıyla çelişiyordu.

  Yeni hâl (driver.js / react-native-copilot / shepherd / react-joyride + HIG/TipKit +
  M3 Rich tooltip): GERÇEK öğe vurgulanır (SpotlightTour), adımlar tek cümle
  (tourSteps). Kullanıcı kararı: ana sayfa kendiliğinden başlar; diğer sayfalarda
  ekranı kapatmayan bir teklif (TourBeacon) çıkar.

  Görünürlük kapısı değişmedi: sayfa `useTourGate` true iken bunu bağlar (bkz. firstRun).
*/

interface Props {
  pageId: FirstRunPage;
  /** Sayfanın kaydırma görünümü — tur hedefi görünür alana kendisi kaydırır. */
  scrollRef?: React.RefObject<ScrollLike | null>;
}

export function HelpTourModal({ pageId, scrollRef }: Props) {
  const setTourCompleted = usePrefsStore((s) => s.setTourCompleted);
  const requested = useTourRun((s) => s.requested === pageId);
  const [started, setStarted] = useState(() => AUTO_START_PAGES.includes(pageId) || requested);

  useEffect(() => {
    if (requested) setStarted(true);
  }, [requested]);

  // Çalışma durumu örnek veriyi açar (bkz. useDemoGate); tur kapanınca/ayrılınca kapanır.
  useEffect(() => {
    if (!started) return;
    useTourRun.getState().setRunning(pageId);
    useTourRun.getState().clearRequest();
    return () => {
      if (useTourRun.getState().running === pageId) useTourRun.getState().setRunning(null);
    };
  }, [started, pageId]);

  const finish = () => {
    useTourRun.getState().setRunning(null);
    setTourCompleted(pageId, true);
  };

  const steps = TOUR_STEPS[pageId] ?? [];
  if (steps.length === 0) return null;
  // Odak tam ekran: sekme çubuğu yok (bkz. BottomNavBar kullanan sayfalar).
  if (!started) return <TourBeacon count={steps.length} aboveTabBar={pageId !== 'focus'} onStart={() => setStarted(true)} onDismiss={finish} />;
  return <SpotlightTour pageId={pageId} scrollRef={scrollRef} onDone={finish} />;
}
