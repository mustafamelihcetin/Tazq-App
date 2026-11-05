import { useCallback, useEffect, useRef, useState } from 'react';

/*
  DOKUNULMAYINCA DİNLENME (2026-11-06). Zen'de ekran açık kalır; telefonu bırakıp giden ya da uyuyakalan kişinin pili boşuna gitmesin.
  Sayaç ve kayıt etkilenmez; bu yalnız görüntüdür. Kullanıcıyı denetlemez, bir şey sormaz.
  İlk dokunuş yalnız ışığı geri getirir, altındaki düğmeye basmaz.
*/
export const IDLE_DIM_MS = 10 * 60 * 1000;

export function useIdleDim(enabled: boolean): { dimmed: boolean; onTouch: () => boolean } {
  const [dimmed, setDimmed] = useState(false);
  const dimmedRef = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const arm = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      dimmedRef.current = true;
      setDimmed(true);
    }, IDLE_DIM_MS);
  }, []);

  useEffect(() => {
    if (enabled) arm();
    else if (timer.current) clearTimeout(timer.current);
    dimmedRef.current = false;
    setDimmed(false);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [enabled, arm]);

  /** Her dokunuşta çağrılır. Dönüş true ise dokunuş yutulur: ekran kararmıştı, yalnız uyandırdı. */
  const onTouch = useCallback(() => {
    if (!enabled) return false;
    const was = dimmedRef.current;
    if (was) {
      dimmedRef.current = false;
      setDimmed(false);
    }
    arm();
    return was;
  }, [enabled, arm]);

  return { dimmed, onTouch };
}
