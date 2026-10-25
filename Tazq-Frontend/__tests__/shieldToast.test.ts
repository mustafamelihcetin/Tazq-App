import { useTaskStore } from '@/features/tasks/store/useTaskStore';
import { useMomentumStore } from '@/features/user/store/useMomentumStore';
import { useToastStore } from '@/shared/store/useToastStore';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';

/**
 * Roket baloncuğunun yerine (2026-10-25): her tamamlamada bildirim YOK; yalnız anlamlı an —
 * 5 görevde bir kalkan kazanıldığında kısa bir bildirim. Eskiden bu ödül sessizce
 * veriliyordu ve kullanıcı ne kazandığını hiç bilmiyordu.
 */
const seed = (n: number) =>
  useTaskStore.setState({ tasks: Array.from({ length: n }, (_, i) => ({ id: i + 1, title: `G${i + 1}`, isCompleted: false, priority: 'Medium', tags: [] })) as never });

describe('kalkan bildirimi', () => {
  beforeEach(() => {
    useToastStore.setState({ visible: false, message: '' } as never);
    useMomentumStore.setState({ shieldCharges: 0, tasksCompletedForNextCharge: 0 });
    usePrefsStore.setState({ uiMode: 'pro' } as never);
  });

  it('ilk 4 tamamlamada bildirim YOK', () => {
    seed(5);
    for (let i = 1; i <= 4; i++) useTaskStore.getState().toggleTaskCompletion(i);
    expect(useToastStore.getState().visible).toBe(false);
  });

  it('5. tamamlamada kalkan bildirimi + ilerleme (1/3)', () => {
    seed(5);
    for (let i = 1; i <= 5; i++) useTaskStore.getState().toggleTaskCompletion(i);
    const st = useToastStore.getState();
    expect(st.visible).toBe(true);
    expect(st.message).toMatch(/1\/3/);
    expect(st.progress).toBeCloseTo(1 / 3, 5);
  });

  it('Sade modda bildirim yok', () => {
    usePrefsStore.setState({ uiMode: 'lite' } as never);
    seed(5);
    for (let i = 1; i <= 5; i++) useTaskStore.getState().toggleTaskCompletion(i);
    expect(useToastStore.getState().visible).toBe(false);
  });

  it('hızlı art arda tamamlama momentumdan DÜŞÜLMEZ (ignoreMomentum yazılmaz)', () => {
    seed(3);
    for (let i = 1; i <= 3; i++) useTaskStore.getState().toggleTaskCompletion(i);
    expect(useTaskStore.getState().tasks.every((t) => !t.ignoreMomentum)).toBe(true);
  });
});
