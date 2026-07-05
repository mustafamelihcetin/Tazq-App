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

interface TourContextValue {
  register: (id: string, measure: () => void) => void;
  unregister: (id: string) => void;
  setRect: (id: string, rect: TourRect) => void;
  rects: Record<string, TourRect>;
  measureAll: () => void;
}

const TourContext = createContext<TourContextValue | null>(null);

export const TourProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // id → measure fn kaydı (render'ı tetiklemeden tutmak için ref)
  const measurers = useRef<Map<string, () => void>>(new Map());
  const [rects, setRects] = useState<Record<string, TourRect>>({});

  const register = useCallback((id: string, measure: () => void) => {
    measurers.current.set(id, measure);
  }, []);

  const unregister = useCallback((id: string) => {
    measurers.current.delete(id);
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
    <TourContext.Provider value={{ register, unregister, setRect, rects, measureAll }}>
      {children}
    </TourContext.Provider>
  );
};

export const useTour = () => {
  const ctx = useContext(TourContext);
  return {
    measureAll: ctx?.measureAll ?? (() => {}),
    rects: ctx?.rects ?? {},
  };
};

interface TourTargetProps extends ViewProps {
  id: string;
  children: React.ReactNode;
}

export const TourTarget: React.FC<TourTargetProps> = ({ id, children, style, onLayout, ...props }) => {
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
    if (!ctx) return;
    ctx.register(id, measure);
    return () => ctx.unregister(id);
  }, [id, measure, ctx]);

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
