import { create } from 'zustand';

export interface LayoutBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface TourState {
  coords: Record<string, LayoutBounds>;
  targets: Record<string, any>;
  registerTarget: (id: string, ref: any) => void;
  unregisterTarget: (id: string) => void;
  measureTarget: (id: string) => Promise<LayoutBounds | null>;
  measureAll: () => Promise<Record<string, LayoutBounds>>;
}

export const useTourStore = create<TourState>((set, get) => ({
  coords: {},
  targets: {},
  registerTarget: (id, ref) => {
    set((state) => {
      // Do not duplicate target registration if ref is unchanged
      if (state.targets[id] === ref) return state;
      return {
        targets: { ...state.targets, [id]: ref }
      };
    });
  },
  unregisterTarget: (id) => {
    set((state) => {
      const nextTargets = { ...state.targets };
      const nextCoords = { ...state.coords };
      delete nextTargets[id];
      delete nextCoords[id];
      return { targets: nextTargets, coords: nextCoords };
    });
  },
  measureTarget: async (id) => {
    const ref = get().targets[id];
    if (!ref || !ref.current) return null;
    return new Promise((resolve) => {
      try {
        ref.current.measureInWindow((x: number, y: number, w: number, h: number) => {
          if (
            typeof x === 'number' && Number.isFinite(x) &&
            typeof y === 'number' && Number.isFinite(y) &&
            typeof w === 'number' && Number.isFinite(w) && w > 0 &&
            typeof h === 'number' && Number.isFinite(h) && h > 0
          ) {
            const bounds = { x, y, w, h };
            set((state) => {
              const current = state.coords[id];
              if (
                current &&
                current.x === x &&
                current.y === y &&
                current.w === w &&
                current.h === h
              ) {
                return state; // Deduplicate equal coordinates updates
              }
              return {
                coords: { ...state.coords, [id]: bounds }
              };
            });
            resolve(bounds);
          } else {
            resolve(null);
          }
        });
      } catch (err) {
        console.warn(`[useTourStore] Failed to measure target "${id}":`, err);
        resolve(null);
      }
    });
  },
  measureAll: async () => {
    const ids = Object.keys(get().targets);
    const results: Record<string, LayoutBounds> = {};
    await Promise.all(
      ids.map(async (id) => {
        const bounds = await get().measureTarget(id);
        if (bounds) {
          results[id] = bounds;
        }
      })
    );
    return results;
  }
}));
