import { useFocusStore } from '../store/useFocusStore';

// Reset store state between tests
beforeEach(() => {
  useFocusStore.setState({
    isActive: false,
    seconds: 1500,
    totalSeconds: 1500,
    currentTask: '',
    lastActiveAt: null,
  });
});

describe('useFocusStore', () => {
  it('setDuration updates seconds and totalSeconds', () => {
    useFocusStore.getState().setDuration(25);
    expect(useFocusStore.getState().seconds).toBe(1500);
    expect(useFocusStore.getState().totalSeconds).toBe(1500);
  });

  it('setDuration for 15 minutes', () => {
    useFocusStore.getState().setDuration(15);
    expect(useFocusStore.getState().seconds).toBe(900);
    expect(useFocusStore.getState().totalSeconds).toBe(900);
  });

  it('tick decrements seconds when active', () => {
    useFocusStore.setState({ isActive: true, seconds: 10 });
    useFocusStore.getState().tick();
    expect(useFocusStore.getState().seconds).toBe(9);
  });

  it('tick does not decrement when inactive', () => {
    useFocusStore.setState({ isActive: false, seconds: 10 });
    useFocusStore.getState().tick();
    expect(useFocusStore.getState().seconds).toBe(10);
  });

  it('tick sets isActive false when seconds reach 0', () => {
    useFocusStore.setState({ isActive: true, seconds: 0 });
    useFocusStore.getState().tick();
    expect(useFocusStore.getState().isActive).toBe(false);
  });

  it('reset restores seconds to totalSeconds', () => {
    useFocusStore.setState({ totalSeconds: 1500, seconds: 300, isActive: true });
    useFocusStore.getState().reset();
    expect(useFocusStore.getState().seconds).toBe(1500);
    expect(useFocusStore.getState().isActive).toBe(false);
  });

  it('setIsActive true records lastActiveAt timestamp', () => {
    const before = Date.now();
    useFocusStore.getState().setIsActive(true);
    const after = Date.now();
    const ts = useFocusStore.getState().lastActiveAt;
    expect(ts).not.toBeNull();
    expect(ts!).toBeGreaterThanOrEqual(before);
    expect(ts!).toBeLessThanOrEqual(after);
  });

  it('setIsActive false clears lastActiveAt', () => {
    useFocusStore.setState({ isActive: true, lastActiveAt: Date.now() });
    useFocusStore.getState().setIsActive(false);
    expect(useFocusStore.getState().lastActiveAt).toBeNull();
  });

  it('rehydrateTimer adjusts seconds for elapsed time', () => {
    const fiveSecondsAgo = Date.now() - 5000;
    useFocusStore.setState({ isActive: true, lastActiveAt: fiveSecondsAgo, seconds: 100 });
    useFocusStore.getState().rehydrateTimer();
    const remaining = useFocusStore.getState().seconds;
    expect(remaining).toBeLessThanOrEqual(95);
    expect(remaining).toBeGreaterThanOrEqual(93); // allow 2s tolerance
  });

  it('rehydrateTimer sets inactive when time fully elapsed', () => {
    const longAgo = Date.now() - 200000;
    useFocusStore.setState({ isActive: true, lastActiveAt: longAgo, seconds: 100 });
    useFocusStore.getState().rehydrateTimer();
    expect(useFocusStore.getState().isActive).toBe(false);
    expect(useFocusStore.getState().seconds).toBe(0);
  });
});
