import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type OfflineOp =
  | { type: 'toggle-task'; id: number; isCompleted: boolean; completedAt: string | null }
  | { type: 'delete-task'; id: number }
  | { type: 'reorder-tasks'; ids: number[] }
  | { type: 'update-task'; id: number; payload: Record<string, any> }
  | { type: 'create-task'; tempId: number; payload: Record<string, any> }
  /*
    ODAK SEANSI — çevrimdışıyken KAYBOLUYORDU.

    Kuyruk yalnız görev işlemlerini tanıyordu; odak seansı doğrudan sunucuya
    yazılmaya çalışılıyor, başarısız olunca hata yutuluyordu. Yani uçakta yapılan
    50 dakikalık bir seans yerel sayaçta görünüyor ama sunucuya hiç ulaşmıyordu:
    haftalık grafikten, toplam odak saatinden (başarımları tetikliyor) ve ivme
    skorundan düşüyordu. Uygulamanın geri kalanı baştan sona çevrimdışı-önce
    çalışırken burası tek istisnaydı.

    `occurredAt` kuyrukta TUTULUYOR ama şu an sunucuya GÖNDERİLMİYOR: `/api/focus/save`
    bir tarih alanı kabul etmiyor ve seansı aldığı ana damgalıyor. Yani eşitleme gece
    yarısını geçerse seans ertesi güne yazılır. Bu bilinen ve kabul edilmiş bir
    eksiklik — hiç kaydedilmemesinden iyidir. Alan burada duruyor ki sunucu tarafı
    `occurredAt`i kabul ettiğinde veri zaten elimizde olsun.
  */
  | { type: 'focus-session'; taskName: string; minutes: number; completed: boolean; occurredAt: string };

interface OfflineQueueState {
  ops: OfflineOp[];
  enqueue: (op: OfflineOp) => void;
  dequeue: (count: number) => void;
  clear: () => void;
}

export const useOfflineQueue = create<OfflineQueueState>()(
  persist(
    (set, get) => ({
      ops: [],
      enqueue: (op) => set({ ops: [...get().ops, op] }),
      dequeue: (count) => set({ ops: get().ops.slice(count) }),
      clear: () => set({ ops: [] }),
    }),
    {
      name: 'tazq-offline-queue',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
