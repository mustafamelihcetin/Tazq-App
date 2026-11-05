import { useFocusStore, focusClock, OPEN_MAX_MINUTES, BREAK_BUDGET_MAX_SECONDS, OPEN_WORLD_SECONDS } from '@/features/focus/store/useFocusStore';
import { commitFocusSession, focusAlarmSpec, __resetFocusAlarmForTests } from '@/features/focus/session';
import { worldFor } from '@/features/focus/utils/focusScenes';
import { advance, snapMinutes, DIAL_MAX, DIAL_OPEN, DIAL_OPEN_POS } from '@/features/focus/components/DurationDial';

jest.mock('@/shared/services/api', () => ({ FocusService: { saveSession: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('@/shared/utils/notifications', () => ({ scheduleFocusAlert: jest.fn(), cancelFocusAlert: jest.fn(), FOCUS_END_ID: 'e', FOCUS_STRICT_ID: 's' }));
jest.mock('@/features/habits/utils/autoMark', () => ({ autoMarkHabits: jest.fn(), focusQualifies: () => false }));

const s = () => useFocusStore.getState();
const MIN = 60_000;
let NOW = new Date(2026, 10, 6, 10).getTime();
beforeAll(() => { jest.spyOn(Date, 'now').mockImplementation(() => NOW); });
afterAll(() => { (Date.now as jest.Mock).mockRestore?.(); });
beforeEach(() => {
  NOW = new Date(2026, 10, 6, 10).getTime();
  __resetFocusAlarmForTests();
  useFocusStore.setState({
    isActive: false, seconds: 1500, totalSeconds: 1500, pausedSeconds: null, expectedFinishAt: null, lastActiveAt: null, sessionId: null,
    sessionKind: 'focus', committedSessionId: null, finishedAt: null, pomodoroMode: false, pomodoroPhase: 'work', run: null, openSession: false,
    breakBudgetSeconds: 0, breakBudgetDate: '', breakFromBudget: false, currentTask: '', currentTaskId: null, sessionNotes: [], taskLastMinutes: {},
  } as never);
});

describe('serbest süre', () => {
  it('yukarı sayar: saat aynı saat, ekran geçen süreyi gösterir', () => {
    s().setOpenDuration();
    expect(s().openSession).toBe(true);
    s().setIsActive(true);
    NOW += 10 * MIN;
    s().tick();
    expect(focusClock(s())).toBe(600);
  });

  it('duraklatınca geçen süre durur, sürünce kaldığı yerden devam eder', () => {
    s().setOpenDuration();
    s().setIsActive(true);
    NOW += 10 * MIN;
    s().setIsActive(false);
    NOW += 30 * MIN;
    s().setIsActive(true);
    NOW += MIN;
    s().tick();
    expect(focusClock(s())).toBe(660);
  });

  it('uygulama kapanıp açılınca sürer', () => {
    s().setOpenDuration();
    s().setIsActive(true);
    NOW += 20 * MIN;
    s().rehydrateTimer();
    expect(focusClock(s())).toBe(1200);
    expect(s().isActive).toBe(true);
  });

  it('4 saatte kendiliğinden biter: unutulan seans sonsuza gitmez', () => {
    s().setOpenDuration();
    s().setIsActive(true);
    NOW += OPEN_MAX_MINUTES * MIN + 5000;
    s().tick();
    expect(s().seconds).toBe(0);
    expect(s().isActive).toBe(false);
  });

  it('süre dolumu bildirimi kurulmaz, molada kurulur', () => {
    s().setOpenDuration();
    s().setIsActive(true);
    expect(focusAlarmSpec(s(), 'tr', false)).toBeNull();
    s().startBreak(5);
    expect(focusAlarmSpec(s(), 'tr', false)?.fireAt).toBe(NOW + 5 * MIN);
    expect(focusClock(s())).toBe(300);
  });

  it('dünya 60 dakikada tamamlanır, boşta sahne tam görünür', () => {
    s().setOpenDuration();
    expect(worldFor(s())).toMatchObject({ active: false, growth: 1 });
    s().setIsActive(true);
    NOW += 30 * MIN;
    s().tick();
    expect(worldFor(s())?.growth).toBeCloseTo(0.5);
    expect(s().run?.plannedSeconds).toBe(OPEN_WORLD_SECONDS);
  });

  it('kayıt bir kez gider, görevin son süresi 240 yazılmaz', () => {
    s().setCurrentTask('Tez', 7);
    s().setOpenDuration();
    s().setIsActive(true);
    expect(s().taskLastMinutes[7]).toBeUndefined();
    expect(commitFocusSession(30, true)).toBe('saved');
    expect(commitFocusSession(30, true)).toBe('duplicate');
  });

  it('süre seçilince serbest biter, sıfırlayınca serbest kalır', () => {
    s().setOpenDuration();
    s().reset();
    expect(s().openSession).toBe(true);
    expect(s().run?.plannedSeconds).toBe(OPEN_WORLD_SECONDS);
    s().setDuration(25);
    expect(s().openSession).toBe(false);
    expect(s().run).toBeNull();
  });
});

describe('mola bütçesi', () => {
  it('odak süresinin beşte biri birikir, seanslar arasında kalır, 30 dk ile sınırlı', () => {
    s().accrueBreakBudget(1800);
    expect(s().breakBudgetSeconds).toBe(360);
    s().accrueBreakBudget(1800);
    expect(s().breakBudgetSeconds).toBe(720);
    s().accrueBreakBudget(100 * 60 * 60);
    expect(s().breakBudgetSeconds).toBe(BREAK_BUDGET_MAX_SECONDS);
  });

  it('gün değişince sıfırlanır', () => {
    useFocusStore.setState({ breakBudgetSeconds: 600, breakBudgetDate: '2020-01-01' } as never);
    s().accrueBreakBudget(300);
    expect(s().breakBudgetSeconds).toBe(60);
  });

  it('molada azalır, erken dönülürse artan bütçede kalır', () => {
    s().accrueBreakBudget(3000); // 10 dk
    s().startBudgetBreak(10);
    expect(s().breakBudgetSeconds).toBe(0);
    NOW += 4 * MIN;
    s().tick();
    s().refundBreak();
    expect(s().breakBudgetSeconds).toBe(360);
    expect(s().breakFromBudget).toBe(false);
  });

  it('bütçe olmadan da mola alınabilir: engellemeyiz', () => {
    s().startBudgetBreak(5);
    expect(s().isActive).toBe(true);
    expect(s().breakBudgetSeconds).toBe(0);
  });
});

describe('kadranda serbest durak', () => {
  const rad = (m: number) => (m / DIAL_MAX) * Math.PI * 2;
  it('120 dolduktan sonra parmak ilerlemeye devam ederse Serbest', () => {
    expect(snapMinutes(DIAL_MAX, false)).toBe(DIAL_MAX);
    expect(snapMinutes(DIAL_MAX + 1, false)).toBe(DIAL_MAX);
    expect(snapMinutes(DIAL_OPEN_POS, false)).toBe(DIAL_OPEN);
  });
  it('geri çevirince süreye döner', () => {
    expect(advance(DIAL_OPEN_POS, rad(40), rad(30), DIAL_OPEN_POS)).toBeCloseTo(DIAL_OPEN_POS - 10);
    expect(advance(119, rad(10), rad(30))).toBe(DIAL_MAX);
    expect(advance(119, rad(10), rad(30), DIAL_OPEN_POS)).toBe(DIAL_OPEN_POS);
  });
});

describe('seans notları', () => {
  it('boş not kaydedilmez, not kalıcı listeye girer ve silinebilir', () => {
    expect(s().addSessionNote('   ')).toBe(false);
    expect(s().addSessionNote(' Faturayı öde ')).toBe(true);
    expect(s().sessionNotes.map((n) => n.text)).toEqual(['Faturayı öde']);
    s().reset();
    expect(s().sessionNotes).toHaveLength(1);
    s().removeSessionNote(s().sessionNotes[0].id);
    expect(s().sessionNotes).toHaveLength(0);
  });

  it('not sayısı ve uzunluğu sınırlı', () => {
    s().addSessionNote('x'.repeat(900));
    expect(s().sessionNotes[0].text).toHaveLength(600);
    for (let i = 0; i < 40; i++) s().addSessionNote(`n${i}`);
    expect(s().sessionNotes.length).toBeLessThanOrEqual(30);
  });
});
