import { useMomentumStore } from '@/features/user/store/useMomentumStore';

describe('useMomentumStore', () => {
  beforeEach(() => {
    // Reset state before each test
    useMomentumStore.setState({
      history: [],
      momentumShieldActive: false,
      shieldCharges: 2,
      consecutiveFastCompletions: 0,
      isBatchConfirming: false,
      engineHeat: 0,
      isOverheated: false,
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

  it('heats momentum rocket engine normally when completions are spaced out', () => {
    const now = Date.now();
    useMomentumStore.setState({
      engineHeat: 0,
      isOverheated: false,
      lastHeatUpdateTime: now,
      consecutiveFastCompletions: 0,
      isBatchConfirming: false,
    });

    // 1st completion (Perfect Sync)
    useMomentumStore.getState().addCompletedTask();
    expect(useMomentumStore.getState().engineHeat).toBeCloseTo(25, 0);
    expect(useMomentumStore.getState().isBatchConfirming).toBe(false);

    // Mock 20 seconds passing
    useMomentumStore.setState({
      lastHeatUpdateTime: now - 20000,
    });

    // 2nd completion (Spaced out >= 15s)
    useMomentumStore.getState().addCompletedTask();
    // Decay: 25 - 20 = 5. Heat addition: 45. Total: 50.
    expect(useMomentumStore.getState().engineHeat).toBeCloseTo(50, 0);
    expect(useMomentumStore.getState().isBatchConfirming).toBe(false);
  });

  it('triggers batch confirmation and suspends heat on rapid consecutive completions', () => {
    const now = Date.now();
    useMomentumStore.setState({
      engineHeat: 0,
      isOverheated: false,
      lastHeatUpdateTime: now,
      consecutiveFastCompletions: 0,
      isBatchConfirming: false,
    });

    // 1st completion
    useMomentumStore.getState().addCompletedTask();
    expect(useMomentumStore.getState().engineHeat).toBe(25);
    expect(useMomentumStore.getState().consecutiveFastCompletions).toBe(1);
    expect(useMomentumStore.getState().isBatchConfirming).toBe(false);

    // 2nd completion (rapid consecutive completion, elapsedSecs is ~0 < 15)
    useMomentumStore.getState().addCompletedTask();
    expect(useMomentumStore.getState().engineHeat).toBeCloseTo(25, 0); // unchanged
    expect(useMomentumStore.getState().consecutiveFastCompletions).toBe(2);
    expect(useMomentumStore.getState().isBatchConfirming).toBe(true);

    // 3rd completion
    useMomentumStore.getState().addCompletedTask();
    expect(useMomentumStore.getState().engineHeat).toBeCloseTo(25, 0); // unchanged
    expect(useMomentumStore.getState().isBatchConfirming).toBe(true);
    expect(useMomentumStore.getState().isOverheated).toBe(false); // does not overheat
  });
});
