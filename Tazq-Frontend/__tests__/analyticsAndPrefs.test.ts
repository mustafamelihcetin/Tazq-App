import { track } from '../utils/analytics';
import { usePrefsStore } from '../store/usePrefsStore';

describe('analytics.track', () => {
  it('does not throw for a basic event', () => {
    expect(() => track('focus_completed', { minutes: 25, pomodoro: true })).not.toThrow();
  });

  it('does not throw when props omitted', () => {
    expect(() => track('onboarding_completed')).not.toThrow();
  });
});

describe('usePrefsStore — product layers (Faz 1)', () => {
  beforeEach(() => {
    usePrefsStore.setState({ uiMode: 'pro', featureFlags: {}, onboardingCompleted: false, firstWinAt: null });
  });

  it('defaults to pro mode (mevcut kullanıcı deneyimi korunur)', () => {
    expect(usePrefsStore.getState().uiMode).toBe('pro');
  });

  it('toggles uiMode', () => {
    usePrefsStore.getState().setUiMode('lite');
    expect(usePrefsStore.getState().uiMode).toBe('lite');
  });

  it('sets feature flags immutably', () => {
    usePrefsStore.getState().setFeatureFlag('coach', true);
    expect(usePrefsStore.getState().featureFlags.coach).toBe(true);
    usePrefsStore.getState().setFeatureFlag('social', false);
    expect(usePrefsStore.getState().featureFlags).toEqual({ coach: true, social: false });
  });

  it('markFirstWin stamps once and is idempotent', () => {
    usePrefsStore.getState().markFirstWin();
    const first = usePrefsStore.getState().firstWinAt;
    expect(first).toBeTruthy();
    usePrefsStore.getState().markFirstWin();
    expect(usePrefsStore.getState().firstWinAt).toBe(first); // değişmez
  });

  it('setOnboardingCompleted works', () => {
    usePrefsStore.getState().setOnboardingCompleted(true);
    expect(usePrefsStore.getState().onboardingCompleted).toBe(true);
  });
});
