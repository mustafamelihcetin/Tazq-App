import { create } from 'zustand';

type ToastType = 'error' | 'success' | 'info';
export type ToastPlacement = 'top' | 'bottom';

interface ToastState {
  message: string;
  type: ToastType;
  placement: ToastPlacement;
  visible: boolean;
  actionLabel?: string;
  onAction?: () => void;
  show: (message: string, type?: ToastType, action?: { label: string; onAction: () => void }, placement?: ToastPlacement) => void;
  hide: () => void;
}

let hideTimer: ReturnType<typeof setTimeout> | null = null;

export const useToastStore = create<ToastState>((set) => ({
  message: '',
  type: 'info',
  placement: 'top',
  visible: false,
  actionLabel: undefined,
  onAction: undefined,
  show: (message, type = 'info', action, placement = 'top') => {
    if (hideTimer) clearTimeout(hideTimer);
    set({ message, type, placement, visible: true, actionLabel: action?.label, onAction: action?.onAction });
    hideTimer = setTimeout(() => set({ visible: false, actionLabel: undefined, onAction: undefined }), 4000);
  },
  hide: () => {
    if (hideTimer) clearTimeout(hideTimer);
    set({ visible: false, actionLabel: undefined, onAction: undefined });
  },
}));
