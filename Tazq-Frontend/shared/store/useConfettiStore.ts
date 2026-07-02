import { create } from 'zustand';

export type ConfettiSound = 'success' | 'habit' | 'day_cleared' | 'freeze' | 'levelup';

interface ConfettiState {
  visible: boolean;
  title: string;
  subtitle: string;
  intensity: 'low' | 'medium' | 'high';
  sound: ConfettiSound | null;
  trigger: (
    title?: string,
    subtitle?: string,
    intensity?: 'low' | 'medium' | 'high',
    sound?: ConfettiSound
  ) => void;
  hide: () => void;
}

export const useConfettiStore = create<ConfettiState>((set) => ({
  visible: false,
  title: '',
  subtitle: '',
  intensity: 'medium',
  sound: null,
  trigger: (title, subtitle, intensity, sound) => {
    set({
      visible: true,
      title: title || '',
      subtitle: subtitle || '',
      intensity: intensity || 'medium',
      sound: sound || null,
    });
  },
  hide: () => set({ visible: false, title: '', subtitle: '', intensity: 'medium', sound: null }),
}));
