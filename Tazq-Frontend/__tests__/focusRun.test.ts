import { useFocusStore, runTotals } from '@/features/focus/store/useFocusStore';
import { worldFor } from '@/features/focus/utils/focusScenes';

const s = () => useFocusStore.getState();
const reset = () => useFocusStore.setState({
  isActive: false, seconds: 1500, totalSeconds: 1500, pausedSeconds: null, expectedFinishAt: null, lastActiveAt: null,
  sessionId: null, sessionKind: 'focus', committedSessionId: null, finishedAt: null, pomodoroMode: false, pomodoroPhase: 'work',
  pomodoroRound: 1, pomodoroCycleDone: false, run: null, currentTask: '', currentTaskId: null,
} as never);
const world = () => worldFor(s());

describe('koşu: dünya uzatmada ve turlarda birikir', () => {
  beforeEach(reset);

  it('tamamlanan seans uzatılınca dünya geri gitmez, parçalar sürer, görev korunur', () => {
    useFocusStore.setState({ seconds: 0, totalSeconds: 1500, currentTask: 'Tez', currentTaskId: 7 } as never);
    expect(world()).toMatchObject({ growth: 1, lights: 5 });
    s().extendSession(5);
    expect(s().isActive).toBe(true);
    expect(s().totalSeconds).toBe(300);
    expect(s().currentTaskId).toBe(7);
    expect(world()).toMatchObject({ active: true, growth: 1, lights: 5 });
    useFocusStore.setState({ seconds: 0 } as never);
    expect(world()?.lights).toBe(6);
  });

  it('erken bitirilip uzatılan seansta dünya kaldığı yerden sürer', () => {
    useFocusStore.setState({ seconds: 900, totalSeconds: 1500 } as never); // 10 dk
    s().extendSession(5);
    expect(world()?.growth).toBeCloseTo(0.4);
    useFocusStore.setState({ seconds: 0 } as never);
    expect(world()?.growth).toBeCloseTo(0.6);
  });

  it('uzatma yeni kayıt açar: aynı seans iki kez kilitlenmez', () => {
    useFocusStore.setState({ seconds: 0, sessionId: 'a', committedSessionId: 'a' } as never);
    s().extendSession(5);
    expect(s().sessionId).not.toBe('a');
    expect(s().claimCommit()).toBe(true);
  });

  it('Pomodoro: 2. turda dünya kaldığı yerden başlar, mola dünyaya dokunmaz', () => {
    useFocusStore.setState({ pomodoroMode: true, seconds: 0, totalSeconds: 1500 } as never);
    s().nextPomodoroPhase();
    expect(s().pomodoroPhase).toBe('break');
    expect(world()).toBeNull();
    s().nextPomodoroPhase();
    s().setDuration(25);
    expect(world()).toMatchObject({ active: true, lights: 5 });
    expect(world()?.growth).toBeCloseTo(0.25);
    useFocusStore.setState({ seconds: 750 } as never);
    expect(world()?.growth).toBeCloseTo(0.375);
  });

  it('Pomodoro: uzun moladan sonra 1. tura dönülür ve koşu biter', () => {
    useFocusStore.setState({ pomodoroMode: true, pomodoroRound: 4, seconds: 0, totalSeconds: 1500, run: { doneSeconds: 4500, plannedSeconds: 6000 } } as never);
    s().nextPomodoroPhase();
    expect(s().pomodoroCycleDone).toBe(true);
    expect(s().run?.doneSeconds).toBe(6000);
    s().nextPomodoroPhase();
    expect(s().pomodoroRound).toBe(1);
    expect(s().pomodoroCycleDone).toBe(false);
    expect(s().run).toBeNull();
  });

  it('standart seansın molası dünyayı sıfırlamaz', () => {
    useFocusStore.setState({ seconds: 0, totalSeconds: 1500 } as never);
    s().startBreak(5);
    expect(world()).toBeNull();
  });

  it('kullanıcı süre seçince ve sıfırlayınca koşu biter', () => {
    useFocusStore.setState({ run: { doneSeconds: 600, plannedSeconds: 1500 } } as never);
    s().setDuration(30);
    expect(s().run).toBeNull();
    useFocusStore.setState({ run: { doneSeconds: 600, plannedSeconds: 1500 } } as never);
    s().reset();
    expect(s().run).toBeNull();
  });

  it('eski kayıtta run alanı yoksa güvenli çalışır', () => {
    useFocusStore.setState({ run: undefined, seconds: 750 } as never);
    expect(world()?.growth).toBeCloseTo(0.5);
    s().extendSession(5);
    expect(s().run?.doneSeconds).toBe(750);
  });

  it('özet koşunun toplamını gösterir', () => {
    useFocusStore.setState({ totalSeconds: 300, run: { doneSeconds: 1500, plannedSeconds: 1500 } } as never);
    expect(runTotals(5)).toEqual({ minutes: 30, plannedMinutes: 25 });
    useFocusStore.setState({ totalSeconds: 1500, run: null } as never);
    expect(runTotals(10)).toEqual({ minutes: 10, plannedMinutes: 25 });
  });
});
