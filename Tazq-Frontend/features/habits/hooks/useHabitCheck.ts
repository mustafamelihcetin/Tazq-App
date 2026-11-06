import { useEffect, useState } from 'react';

interface CheckItem {
  target?: number;
  count?: number;
  isCompleted?: boolean;
  isSkipped?: boolean;
}

/**
 * Halkanın dokunuş mantığı: yerel durumla hemen dolar, asıl kayıt bir sonraki karede yapılır (ana sayfa baştan çizilmeden önce).
 * Miktarlıda adım adım ilerler, hedefte başa döner. Halka ve kutu aynı kuralı paylaşır.
 */
export function useHabitCheck(item: CheckItem, onPress: () => void) {
  const target = item.target ?? 1;
  const [optCount, setOptCount] = useState<number | null>(null);
  const [optDone, setOptDone] = useState<boolean | null>(null);
  useEffect(() => { setOptCount(null); setOptDone(null); }, [item.isCompleted, item.count]);
  const isCompleted = optDone ?? !!item.isCompleted;
  const count = optCount ?? item.count ?? (item.isCompleted ? target : 0);
  const isSkipped = !!item.isSkipped;
  const ratio = isSkipped ? 0 : isCompleted ? 1 : Math.min(1, count / target);

  const [burst, setBurst] = useState(0);
  const press = () => {
    if (target > 1) {
      const next = count >= target ? 0 : count + 1;
      if (next >= target) setBurst(b => b + 1);
      setOptCount(next);
      setOptDone(next >= target);
    } else {
      if (!item.isCompleted) setBurst(b => b + 1);
      setOptDone(!item.isCompleted);
    }
    requestAnimationFrame(() => onPress());
  };

  return { target, isCompleted, count, isSkipped, ratio, burst, press };
}
