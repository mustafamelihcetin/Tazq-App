import { create } from 'zustand';

type ToastType = 'error' | 'success' | 'info';

interface ToastState {
  message: string;
  type: ToastType;
  visible: boolean;
  actionLabel?: string;
  onAction?: () => void;
  show: (message: string, type?: ToastType, action?: { label: string; onAction: () => void }) => void;
  hide: () => void;
}

let hideTimer: ReturnType<typeof setTimeout> | null = null;

export const useToastStore = create<ToastState>((set) => ({
  message: '',
  type: 'info',
  visible: false,
  actionLabel: undefined,
  onAction: undefined,
  show: (message, type = 'info', action) => {
    if (hideTimer) clearTimeout(hideTimer);
    set({ message, type, visible: true, actionLabel: action?.label, onAction: action?.onAction });
    hideTimer = setTimeout(() => set({ visible: false, actionLabel: undefined, onAction: undefined }), 4000);
  },
  hide: () => {
    if (hideTimer) clearTimeout(hideTimer);
    set({ visible: false, actionLabel: undefined, onAction: undefined });
  },
}));
