import { create } from 'zustand';

interface ConfettiState {
  visible: boolean;
  trigger: () => void;
  hide: () => void;
}

export const useConfettiStore = create<ConfettiState>((set) => ({
  visible: false,
  trigger: () => {
    set({ visible: true });
  },
  hide: () => set({ visible: false }),
}));
