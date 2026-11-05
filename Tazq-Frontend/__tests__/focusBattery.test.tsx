import { renderHook, act } from '@testing-library/react-native';
import fs from 'fs';
import path from 'path';
import { useIdleDim, IDLE_DIM_MS } from '@/features/focus/hooks/useIdleDim';
import { sparseProgress, SPARSE_STEP_SEC } from '@/features/focus/utils/focusScenes';
import { useFocusStore } from '@/features/focus/store/useFocusStore';

describe('dokunulmayınca dinlenme', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('süre dolmadan kararmaz, dolunca kararır', () => {
    const { result } = renderHook(() => useIdleDim(true));
    act(() => { jest.advanceTimersByTime(IDLE_DIM_MS - 1); });
    expect(result.current.dimmed).toBe(false);
    act(() => { jest.advanceTimersByTime(1); });
    expect(result.current.dimmed).toBe(true);
  });

  it('dokunuş sayacı başa alır', () => {
    const { result } = renderHook(() => useIdleDim(true));
    act(() => { jest.advanceTimersByTime(IDLE_DIM_MS - 1000); });
    let swallowed = true;
    act(() => { swallowed = result.current.onTouch(); });
    expect(swallowed).toBe(false);
    act(() => { jest.advanceTimersByTime(IDLE_DIM_MS - 1000); });
    expect(result.current.dimmed).toBe(false);
  });

  it('kararmışken ilk dokunuş yalnız uyandırır, düğmeye geçmez', () => {
    const { result } = renderHook(() => useIdleDim(true));
    act(() => { jest.advanceTimersByTime(IDLE_DIM_MS); });
    let swallowed = false;
    act(() => { swallowed = result.current.onTouch(); });
    expect(swallowed).toBe(true);
    expect(result.current.dimmed).toBe(false);
    act(() => { swallowed = result.current.onTouch(); });
    expect(swallowed).toBe(false);
  });

  it('Zen kapanınca karartı kalkar, kapalıyken hiç kararmaz', () => {
    const { result, rerender } = renderHook(({ on }: { on: boolean }) => useIdleDim(on), { initialProps: { on: true } });
    act(() => { jest.advanceTimersByTime(IDLE_DIM_MS); });
    expect(result.current.dimmed).toBe(true);
    rerender({ on: false });
    expect(result.current.dimmed).toBe(false);
    act(() => { jest.advanceTimersByTime(IDLE_DIM_MS * 2); });
    expect(result.current.dimmed).toBe(false);
  });
});

describe('Zen seyrek sayaç', () => {
  it('görünürken saniyede bir, Zen\'de adımlı', () => {
    expect(sparseProgress(1500, 1499, false)).toBeCloseTo(1 / 1500);
    expect(sparseProgress(1500, 1499, true)).toBe(0);
    expect(sparseProgress(1500, 1500 - SPARSE_STEP_SEC, true)).toBeCloseTo(SPARSE_STEP_SEC / 1500);
    expect(sparseProgress(1500, 1500 - SPARSE_STEP_SEC - 1, true)).toBeCloseTo(SPARSE_STEP_SEC / 1500);
    expect(sparseProgress(0, 0, true)).toBe(0);
  });

  it('Zen\'de sayaç ve halka saniyelik abone olmaz', () => {
    const src = fs.readFileSync(path.join(__dirname, '../app/focus.tsx'), 'utf8');
    expect(fs.readFileSync(path.join(__dirname, '../features/focus/components/FocusClock.tsx'), 'utf8')).toContain('hidden ? -1 : focusClock(s)');
    expect(src).toMatch(/<ProgressDriver[^>]*sparse=\{zenMode && isActive\}/);
    expect(src).toMatch(/<CountdownText[\s\S]{0,80}hidden=\{zenMode && isActive\}/);
  });
});

describe('cihaz saati geri alınırsa', () => {
  it('kalan süre seans süresini aşmaz', () => {
    const now = Date.now();
    useFocusStore.setState({ isActive: true, seconds: 600, totalSeconds: 1500, expectedFinishAt: now + 99_999_000, sessionKind: 'focus', pomodoroPhase: 'work' } as never);
    useFocusStore.getState().tick();
    expect(useFocusStore.getState().seconds).toBe(1500);
  });
});
