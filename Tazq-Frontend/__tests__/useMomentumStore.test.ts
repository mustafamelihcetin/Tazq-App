import { useMomentumStore } from '@/features/user/store/useMomentumStore';

describe('useMomentumStore', () => {
  beforeEach(() => {
    // Reset state before each test
    useMomentumStore.setState({
      history: [],
      momentumShieldActive: false,
      shieldCharges: 2,
    });
  });

  it('records score normally when shield is inactive', () => {
    const store = useMomentumStore.getState();
    store.recordScore(50);
    
    const updated = useMomentumStore.getState();
    expect(updated.history.length).toBe(1);
    expect(updated.history[0].score).toBe(50);
  });

  it('toggles momentum shield active state', () => {
    const store = useMomentumStore.getState();
    expect(store.momentumShieldActive).toBe(false);

    store.toggleMomentumShield();
    expect(useMomentumStore.getState().momentumShieldActive).toBe(true);

    useMomentumStore.getState().toggleMomentumShield();
    expect(useMomentumStore.getState().momentumShieldActive).toBe(false);
  });

  it('freezes/locks score to at least 75 when shield is active', () => {
    // Pre-populate history with a high active score
    useMomentumStore.setState({
      history: [{ date: '2026-07-02', score: 85 }],
      momentumShieldActive: true,
    });

    const store = useMomentumStore.getState();
    // Try to record a lower score of 30 (typical decay)
    store.recordScore(30);

    const updated = useMomentumStore.getState();
    // Score should be locked at the previous high score (85) instead of decaying to 30
    const todayScore = updated.history.find(h => h.date === new Date().toISOString().split('T')[0] || h.score >= 0);
    expect(todayScore?.score).toBe(85);
  });

  it('locks score to 75 minimum when shield is active and no active history exists', () => {
    useMomentumStore.setState({
      history: [],
      momentumShieldActive: true,
    });

    const store = useMomentumStore.getState();
    store.recordScore(20);

    const updated = useMomentumStore.getState();
    const todayScore = updated.history[0];
    expect(todayScore.score).toBe(75);
  });

  it('accumulates shield charges and caps at 3', () => {
    useMomentumStore.setState({
      shieldCharges: 1,
      tasksCompletedForNextCharge: 0,
      focusMinutesForNextCharge: 0,
    });

    // Complete 5 tasks to get a charge
    for (let i = 0; i < 5; i++) {
      useMomentumStore.getState().addCompletedTask();
    }
    expect(useMomentumStore.getState().shieldCharges).toBe(2);

    // Focus 60 minutes to get another charge
    useMomentumStore.getState().addFocusMinutes(60);
    expect(useMomentumStore.getState().shieldCharges).toBe(3);

    // Further completions shouldn't exceed 3
    useMomentumStore.getState().addFocusMinutes(60);
    expect(useMomentumStore.getState().shieldCharges).toBe(3);
  });

  it('heats and overheats momentum rocket engine on consecutive completions', () => {
    useMomentumStore.setState({
      engineHeat: 0,
      isOverheated: false,
      lastHeatUpdateTime: Date.now(),
    });

    // Each task adds 35 heat
    useMomentumStore.getState().addCompletedTask();
    expect(useMomentumStore.getState().engineHeat).toBeCloseTo(35, 0);

    useMomentumStore.getState().addCompletedTask();
    expect(useMomentumStore.getState().engineHeat).toBeCloseTo(70, 0);

    useMomentumStore.getState().addCompletedTask();
    expect(useMomentumStore.getState().engineHeat).toBe(100);
    expect(useMomentumStore.getState().isOverheated).toBe(true);
  });
});
