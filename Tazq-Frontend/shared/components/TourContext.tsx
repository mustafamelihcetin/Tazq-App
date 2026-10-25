import React, {
  createContext,
  useContext,
  useRef,
  useState,
  useCallback,
  useEffect,
} from 'react';
import { View, ViewProps } from 'react-native';

export type TourRect = { x: number; y: number; width: number; height: number };
/**
 * Vurgulamanın ŞEKLİ — hedefin kendisi bildirir. Delik görünen öğeye birebir oturmalı:
 * kartta pay 0 ve köşe kartın köşesi (eşmerkezli); küçük ikonda pay + tam yuvarlak.
 */
export type TourShape = { radius: number; pad: number; corners: 'all' | 'top' | 'bottom' };

interface TourContextValue {
  register: (id: string, measure: () => void, node?: React.RefObject<View | null>, shape?: TourShape) => void;
  unregister: (id: string) => void;
  setRect: (id: string, rect: TourRect) => void;
  rects: Record<string, TourRect>;
  measureAll: () => void;
  /** Tek hedefi DOĞRUDAN ölçer (state gecikmesi yok) + şeklini verir; yoksa null. */
  measureTarget: (id: string) => Promise<(TourRect & TourShape) | null>;
  /** Hedefi bir kaydırma görünümünde görünür alana getirir (bkz. scrollTargetIntoView). */
  scrollTargetIntoView: (id: string, scroll: ScrollLike | null | undefined, topOffset: number) => Promise<void>;
}

/** ScrollView ya da Animated.ScrollView ref'i — yalnız kullandığımız yöntemler. */
export type ScrollLike = {
  scrollTo: (o: { x?: number; y?: number; animated?: boolean }) => void;
  getInnerViewRef?: () => unknown;
  getInnerViewNode?: () => unknown;
};

const TourContext = createContext<TourContextValue | null>(null);

export const TourProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // id → measure fn kaydı (render'ı tetiklemeden tutmak için ref)
  const measurers = useRef<Map<string, () => void>>(new Map());
  const [rects, setRects] = useState<Record<string, TourRect>>({});

  const nodes = useRef<Map<string, React.RefObject<View | null>>>(new Map());
  const shapes = useRef<Map<string, TourShape>>(new Map());

  const register = useCallback((id: string, measure: () => void, node?: React.RefObject<View | null>, shape?: TourShape) => {
    measurers.current.set(id, measure);
    if (node) nodes.current.set(id, node);
    if (shape) shapes.current.set(id, shape);
  }, []);

  const measureTarget = useCallback((id: string) => {
    return new Promise<(TourRect & TourShape) | null>((resolve) => {
      const node = nodes.current.get(id)?.current;
      if (!node) { resolve(null); return; }
      try {
        node.measureInWindow((x, y, width, height) => {
          const ok = width > 0 && height > 0 && Number.isFinite(x) && Number.isFinite(y);
          resolve(ok ? { x, y, width, height, ...(shapes.current.get(id) ?? { radius: 0, pad: 0, corners: 'all' as const }) } : null);
        });
      } catch { resolve(null); }
    });
  }, []);

  const unregister = useCallback((id: string) => {
    measurers.current.delete(id);
    nodes.current.delete(id);
    shapes.current.delete(id);
  }, []);

  /*
    GENEL KAYDIRMA — sayfalardaki elle yazılmış "adım 2 → y: 380" kodunun yerine.
    Hedefin kaydırma İÇERİĞİNE göre konumu `measureLayout` ile ölçülür ve görünüm,
    hedef üst banttan `topOffset` aşağıda duracak şekilde kaydırılır. Hedef bu
    görünümün içinde değilse (sabit başlık, sekme düğmesi) ölçüm başarısız olur ve
    hiçbir şey kaydırılmaz — doğru davranış.
  */
  const scrollTargetIntoView = useCallback((id: string, scroll: ScrollLike | null | undefined, topOffset: number) => {
    return new Promise<void>((resolve) => {
      const node = nodes.current.get(id)?.current as unknown as {
        measureLayout?: (rel: unknown, ok: (x: number, y: number) => void, fail: () => void) => void;
      } | null;
      const inner = scroll?.getInnerViewRef?.() ?? scroll?.getInnerViewNode?.();
      if (!scroll || !node?.measureLayout || !inner) { resolve(); return; }
      try {
        node.measureLayout(
          inner,
          (_x, y) => { scroll.scrollTo({ y: Math.max(0, y - topOffset), animated: true }); resolve(); },
          () => resolve(),
        );
      } catch { resolve(); }
    });
  }, []);

  const setRect = useCallback((id: string, rect: TourRect) => {
    setRects((prev) => {
      const p = prev[id];
      // Aynı ölçüm → gereksiz re-render'ı engelle
      if (p && p.x === rect.x && p.y === rect.y && p.width === rect.width && p.height === rect.height) {
        return prev;
      }
      return { ...prev, [id]: rect };
    });
  }, []);

  const measureAll = useCallback(() => {
    measurers.current.forEach((m) => {
      try {
        m();
      } catch {
        /* ölçüm sırasında unmount olmuş target — yok say */
      }
    });
  }, []);

  return (
    <TourContext.Provider value={{ register, unregister, setRect, rects, measureAll, measureTarget, scrollTargetIntoView }}>
      {children}
    </TourContext.Provider>
  );
};

export const useTour = () => {
  const ctx = useContext(TourContext);
  return {
    measureAll: ctx?.measureAll ?? (() => {}),
    rects: ctx?.rects ?? {},
    scrollTargetIntoView: ctx?.scrollTargetIntoView ?? (async () => {}),
    measureTarget: ctx?.measureTarget ?? (async () => null),
  };
};

interface TourTargetProps extends ViewProps {
  id: string;
  children: React.ReactNode;
  /** Vurgulama köşesi — sarılan öğenin KENDİ köşesi (kart: R.md). Varsayılan 0. */
  spotRadius?: number;
  /** Vurgulama payı — kartta 0 (kenara birebir), küçük ikonda nefes payı. Varsayılan 0. */
  spotPad?: number;
  /** Bölüm bir kartın üst/alt yarısıysa yalnız o köşeler yuvarlanır (kartın içine kesik açmasın). */
  spotCorners?: 'all' | 'top' | 'bottom';
  /** false → sarmalayıcı EKLENMEZ, çocuklar olduğu gibi çizilir (ör. listenin yalnız ilk satırı hedef). */
  enabled?: boolean;
}

export const TourTarget: React.FC<TourTargetProps> = ({ id, children, style, onLayout, spotRadius = 0, spotPad = 0, spotCorners = 'all', enabled = true, ...props }) => {
  const ctx = useContext(TourContext);
  const ref = useRef<View>(null);

  const measure = useCallback(() => {
    const node = ref.current;
    if (!node || !ctx) return;
    // measureInWindow → pencereye göre mutlak ekran koordinatı (overlay tam ekran olduğu için birebir eşleşir)
    node.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0 && Number.isFinite(x) && Number.isFinite(y)) {
        ctx.setRect(id, { x, y, width, height });
      }
    });
  }, [id, ctx]);

  useEffect(() => {
    if (!ctx || !enabled) return;
    ctx.register(id, measure, ref, { radius: spotRadius, pad: spotPad, corners: spotCorners });
    return () => ctx.unregister(id);
  }, [id, measure, ctx, spotRadius, spotPad, spotCorners, enabled]);

  if (!enabled) return <>{children}</>;

  return (
    <View
      ref={ref}
      collapsable={false} // Android'de measure çalışması için şart
      style={style}
      onLayout={(e) => {
        measure();
        onLayout?.(e);
      }}
      {...props}
    >
      {children}
    </View>
  );
};
