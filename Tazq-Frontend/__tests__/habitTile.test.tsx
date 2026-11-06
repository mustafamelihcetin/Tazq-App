import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { MyDayHabits } from '@/features/dashboard/components/MyDayHabits';
import { lastSevenDays } from '@/features/habits/utils/habitSchedule';
import { Colors } from '@/shared/constants/Colors';

jest.mock('@/features/habits/components/HabitLiquid', () => ({ HabitLiquid: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/shared/components/CompletionBurst', () => ({ CompletionBurst: () => null }));

const TODAY = '2026-11-06'; // Cuma
const week = (...offs: number[]) => offs.map((o) => {
  const d = new Date(2026, 10, 6 + o);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
});

describe('son 7 gün izi', () => {
  it('eskiden bugüne; yapıldı, mola, kaçtı ve bugün açık ayrı', () => {
    const marks = lastSevenDays({ completedDates: week(-6, -3), skippedDates: week(-1), createdAt: '2026-01-01T00:00:00' } as never, TODAY);
    expect(marks).toEqual(['done', 'missed', 'missed', 'done', 'missed', 'rest', 'open']);
  });

  it('bugün yapılmadıysa kaçırma sayılmaz', () => {
    expect(lastSevenDays({ completedDates: [] } as never, TODAY)[6]).toBe('open');
    expect(lastSevenDays({ completedDates: [TODAY] } as never, TODAY)[6]).toBe('done');
  });

  it('oluşturulmadan önceki günler kaçırma değil', () => {
    const marks = lastSevenDays({ completedDates: [], createdAt: '2026-11-05T09:00:00' } as never, TODAY);
    expect(marks).toEqual(['off', 'off', 'off', 'off', 'off', 'missed', 'open']);
  });

  it('haftalık planda boş gün kaçırma değil', () => {
    const marks = lastSevenDays({ completedDates: week(-2), schedule: { kind: 'weekly', times: 3 } } as never, TODAY);
    expect(marks.filter((m) => m === 'missed')).toHaveLength(0);
    expect(marks[4]).toBe('done');
  });
});

describe('bugünkü alışkanlık ızgarası', () => {
  const habits = Array.from({ length: 7 }, (_, i) => ({
    id: `h${i}`, title: `Alışkanlık ${i}`, color: '#3B82F6', emoji: '📌', isCompleted: false, isSkipped: false, streak: 0,
    target: 1, count: 0, days: ['done', 'missed', 'off', 'rest', 'done', 'done', 'open'],
  }));
  const setup = (over: object = {}) => {
    const props = { habits, onToggle: jest.fn(), onSkip: jest.fn(), onAddHabit: jest.fn(), theme: Colors.dark, isDark: true, tr: true, ...over };
    return { ui: render(<MyDayHabits {...props} />), props };
  };

  it('hepsi görünür, kaydırma arkasında kalan yok', () => {
    const { ui } = setup();
    habits.forEach((h) => expect(ui.getByText(h.title)).toBeTruthy());
    expect(ui.UNSAFE_queryByType(require('react-native').ScrollView)).toBeNull();
  });

  it('dokununca işaretler, basılı tutunca mola', () => {
    const { ui, props } = setup();
    jest.spyOn(global, 'requestAnimationFrame').mockImplementation((f) => { f(0); return 0; });
    const tile = ui.getAllByRole('button')[0];
    act(() => { fireEvent.press(tile); });
    expect(props.onToggle).toHaveBeenCalledWith(habits[0]);
    fireEvent(tile, 'longPress');
    expect(props.onSkip).toHaveBeenCalledWith(habits[0]);
    jest.restoreAllMocks();
  });

  it('ekran okuyucu izi sözle söyler', () => {
    const { ui } = setup();
    expect(ui.getAllByRole('button')[0].props.accessibilityLabel).toContain('son 7 günün 5 planlı gününde 3 kez');
  });

  it('miktar ve haftalık hedef görünür', () => {
    const { ui } = setup({ habits: [{ ...habits[0], target: 8, count: 3 }, { ...habits[1], weekBadge: '2/3' }] });
    expect(ui.getByText('3/8')).toBeTruthy();
    expect(ui.getByText('2/3')).toBeTruthy();
  });

  it('izi olmayan örnek veride de çizer', () => {
    const { days: _days, ...demo } = habits[0];
    expect(setup({ habits: [demo] }).ui.getByText(demo.title)).toBeTruthy();
  });

  it('geniş ekranda sütun artar, telefonda iki kalır', () => {
    const { ui } = setup();
    const grid = ui.getByTestId('habit-grid');
    const width = () => [ui.getByTestId('habit-grid').children[0]].map((n) => (n as unknown as { props: { style: { width?: string }[] } }).props.style[0].width)[0];
    expect(width()).toBe('50%');
    fireEvent(grid, 'layout', { nativeEvent: { layout: { width: 320 } } });
    expect(width()).toBe('50%');
    fireEvent(grid, 'layout', { nativeEvent: { layout: { width: 700 } } });
    expect(width()).toBe('25%');
  });
});
