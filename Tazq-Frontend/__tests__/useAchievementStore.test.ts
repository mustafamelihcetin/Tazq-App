import { useAchievementStore, Achievement } from '../store/useAchievementStore';

const A: Achievement = { id: 'streak_3', emoji: '🔥', titleTr: '', titleEn: '', subtitleTr: '', subtitleEn: '' };
const B: Achievement = { id: 'streak_7', emoji: '⚡', titleTr: '', titleEn: '', subtitleTr: '', subtitleEn: '' };

function reset() {
  useAchievementStore.setState({ unlocked: [], baselined: false, pending: null, queue: [], _hasHydrated: true });
}

describe('useAchievementStore', () => {
  beforeEach(reset);

  it('trigger celebrates a brand-new achievement', () => {
    useAchievementStore.getState().trigger(A);
    const s = useAchievementStore.getState();
    expect(s.unlocked).toContain('streak_3');
    expect(s.pending?.id).toBe('streak_3');
  });

  it('trigger is idempotent — no re-celebration once unlocked', () => {
    const st = useAchievementStore.getState();
    st.trigger(A);
    useAchievementStore.getState().clearPending();
    useAchievementStore.getState().trigger(A); // ikinci kez
    expect(useAchievementStore.getState().pending).toBeNull();
  });

  it('baseline silently locks already-earned tiers WITHOUT celebrating', () => {
    const st = useAchievementStore.getState();
    st.baseline(['streak_3', 'streak_7']); // ilk gözlemde zaten hak edilmiş
    let s = useAchievementStore.getState();
    expect(s.baselined).toBe(true);
    expect(s.unlocked).toEqual(expect.arrayContaining(['streak_3', 'streak_7']));
    expect(s.pending).toBeNull(); // konfeti YOK

    // Baseline ile kilitlenen eşik artık kutlanmaz (durum değil, geçiş kutlanır)
    useAchievementStore.getState().trigger(A);
    expect(useAchievementStore.getState().pending).toBeNull();
  });

  it('baseline runs only once', () => {
    const st = useAchievementStore.getState();
    st.baseline(['streak_3']);
    useAchievementStore.getState().baseline(['streak_7']); // ikinci çağrı no-op
    expect(useAchievementStore.getState().unlocked).not.toContain('streak_7');
  });

  it('celebrates a genuinely NEW tier after baseline', () => {
    const st = useAchievementStore.getState();
    st.baseline(['streak_3']); // başlangıçta 3 günlük seri vardı
    useAchievementStore.getState().trigger(B); // sonradan 7'ye çıktı
    expect(useAchievementStore.getState().pending?.id).toBe('streak_7');
  });

  it('queues multiple concurrent unlocks and dequeues on clear', () => {
    const st = useAchievementStore.getState();
    st.trigger(A);
    useAchievementStore.getState().trigger(B); // pending doluyken sıraya
    expect(useAchievementStore.getState().pending?.id).toBe('streak_3');
    expect(useAchievementStore.getState().queue.map(q => q.id)).toEqual(['streak_7']);
    useAchievementStore.getState().clearPending();
    expect(useAchievementStore.getState().pending?.id).toBe('streak_7');
    useAchievementStore.getState().clearPending();
    expect(useAchievementStore.getState().pending).toBeNull();
  });

  it('applyCloud unions unlocked and ORs baselined', () => {
    const st = useAchievementStore.getState();
    st.trigger(A);
    useAchievementStore.getState().clearPending();
    useAchievementStore.getState().applyCloud({ unlocked: ['streak_7', 'momentum_50'], baselined: true });
    const s = useAchievementStore.getState();
    expect(s.unlocked).toEqual(expect.arrayContaining(['streak_3', 'streak_7', 'momentum_50']));
    expect(s.baselined).toBe(true);
  });
});
