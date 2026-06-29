import { useEffect } from 'react';
import { pushDepth, popDepth } from '../constants/uiDepth';

/**
 * useUiDepth — bir sheet/modal görünür olduğunda arka ekranı "geriye iter"
 * (iOS PageSheet derinliği). `active` true olunca push, false/unmount'ta pop.
 * Sheet bileşeninde: useUiDepth(visible) çağırman yeterli.
 */
export function useUiDepth(active: boolean) {
  useEffect(() => {
    if (!active) return;
    pushDepth();
    return () => popDepth();
  }, [active]);
}
