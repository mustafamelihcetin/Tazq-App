import React from 'react';
import fs from 'fs';
import path from 'path';
import { render, fireEvent } from '@testing-library/react-native';
import { ModeTodayCard } from '@/features/modes/components/ModeTodayCard';
import { homePaymentAlert } from '@/features/payments/utils/homeAlert';
import { scheduleCommit, __resetCommitsForTests } from '@/shared/utils/deferredCommit';
import { useTaskStore } from '@/features/tasks/store/useTaskStore';
import { usePaymentsStore, type Payment } from '@/features/payments/store/usePaymentsStore';

const mode = (key: string, label: string) => ({ key, label, emoji: 'book', color: '#123456', textColor: '#123456', todayDone: 1, todayTotal: 2, openTotal: 1, taskTotal: 2, days: 10 });
let mockEntries: ReturnType<typeof mode>[] = [];
let mockRoute = { goalCount: 0, total: 0, done: 0, complete: false, current: null as null | { title: string } };

jest.mock('@/features/modes/hooks/useActiveModeSummary', () => ({
  useActiveModeSummary: () => ({ entries: mockEntries, activeCount: mockEntries.length }),
}));
jest.mock('@/features/modes/hooks/useDayRoute', () => ({ useDayRoute: () => mockRoute }));
jest.mock('@/shared/components/TourContext', () => ({ TourTarget: ({ children }: { children: React.ReactNode }) => children }));

const panel = () => render(<ModeTodayCard bare onOpen={() => {}} />);
const hidden = { includeHiddenElements: true };

describe('ana sayfanın tek özet satırı', () => {
  beforeEach(() => {
    mockEntries = [];
    mockRoute = { goalCount: 0, total: 0, done: 0, complete: false, current: null };
  });

  it('mod yoksa hiçbir şey çizilmez', () => {
    expect(panel().toJSON()).toBeNull();
  });

  it('tek hedefte mod satırı ve düz ayraç', () => {
    mockEntries = [mode('sinav', 'YKS')];
    mockRoute = { ...mockRoute, goalCount: 1, total: 3 };
    const ui = panel();
    expect(ui.getByText('YKS', hidden)).toBeTruthy();
    expect(ui.queryByText(/Sıradaki|Next/, hidden)).toBeNull();
    expect(ui.queryByTestId('route-progress', hidden)).toBeNull();
  });

  it('birden çok hedefte sıradaki adım, modlar destede kalır', () => {
    mockEntries = [mode('sinav', 'YKS'), mode('spor', 'Koşu')];
    mockRoute = { goalCount: 2, total: 4, done: 2, complete: false, current: { title: 'Birikim tutarını belirle' } };
    const ui = panel();
    expect(ui.getByText(/Birikim tutarını belirle/, hidden)).toBeTruthy();
    expect(ui.getByText(/\/4/, hidden)).toBeTruthy();
    expect(ui.getByTestId('route-progress', hidden).children).toHaveLength(4);
    // Mod satırları kaydırınca erişilebilir: rota onları gizlemez.
    fireEvent(ui.getByLabelText(/^2 /, hidden), 'layout', { nativeEvent: { layout: { width: 300 } } });
    expect(ui.getByText('YKS', hidden)).toBeTruthy();
    expect(ui.getByText('Koşu', hidden)).toBeTruthy();
  });

  it('rota bitince tamam yazar', () => {
    mockEntries = [mode('sinav', 'YKS'), mode('spor', 'Koşu')];
    mockRoute = { goalCount: 2, total: 2, done: 2, complete: true, current: null };
    expect(panel().getByText(/Bugünün rotası tamam|route is done/, hidden)).toBeTruthy();
  });

  it('çok adımda parçalar tek çizgiye iner', () => {
    mockEntries = [mode('sinav', 'YKS')];
    mockRoute = { goalCount: 2, total: 14, done: 3, complete: false, current: { title: 'x' } };
    expect(panel().getByTestId('route-progress', hidden).children).toHaveLength(1);
  });

  it('panel içinde kart zemini yok', () => {
    const src = fs.readFileSync(path.join(__dirname, '../features/modes/components/RouteBanner.tsx'), 'utf8');
    expect(src).not.toMatch(/surfaceContainer|surfaceCard/);
  });
});

describe('ana sayfa ödeme uyarısı', () => {
  const NOW = new Date(2026, 10, 6, 9);
  const pay = (over: Partial<Payment>) => ({ id: 1, title: 'Kira', amount: 100, dueDay: 20, recurrence: 'Monthly', ...over } as Payment);

  it('yaklaşan ödeme ana sayfada yok, gelen kutusunda kalır', () => {
    expect(homePaymentAlert([pay({ dueDay: 8 })], NOW)).toBeNull();
  });
  it('bugün son gün görünür', () => {
    expect(homePaymentAlert([pay({ dueDay: 6 })], NOW)).toMatchObject({ overdue: false });
  });
  it('gecikmiş varken yalnız gecikmişleri sayar', () => {
    const alert = homePaymentAlert([pay({ id: 1, dueDay: 6 }), pay({ id: 2, dueDay: 2 })], NOW);
    expect(alert?.overdue).toBe(true);
    expect(alert?.payments.map(p => p.id)).toEqual([2]);
  });
  it('ödenmiş dönem uyarı vermez', () => {
    expect(homePaymentAlert([pay({ dueDay: 6, lastPaidCycleKey: '2026-11' })], NOW)).toBeNull();
  });
});

describe('geri alma süresinde sunucu tazelemesi', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    __resetCommitsForTests();
  });
  afterEach(() => {
    __resetCommitsForTests();
    jest.useRealTimers();
  });

  it('bitirilen görev tazelemeyle açık hale dönmez; süre bitince sunucu söz sahibi', () => {
    const local = { id: 7, title: 'Rapor', isCompleted: true, completedAt: '2026-11-06T09:00:00Z', tags: [] } as never;
    const server = { id: 7, title: 'Rapor', isCompleted: false, tags: [] } as never;
    useTaskStore.setState({ tasks: [local] } as never);
    scheduleCommit('task:7', () => {});
    useTaskStore.getState().setTasks([server]);
    expect(useTaskStore.getState().tasks[0].isCompleted).toBe(true);
    __resetCommitsForTests();
    useTaskStore.getState().setTasks([server]);
    expect(useTaskStore.getState().tasks[0].isCompleted).toBe(false);
  });

  it('silinen ödeme tazelemeyle geri gelmez', () => {
    const p = { id: 3, title: 'Kira', amount: 1, dueDay: 5, recurrence: 'Monthly' } as Payment;
    usePaymentsStore.setState({ payments: [] });
    scheduleCommit('payment:3', () => {});
    usePaymentsStore.getState().setPayments([p]);
    expect(usePaymentsStore.getState().payments).toHaveLength(0);
    __resetCommitsForTests();
    usePaymentsStore.getState().setPayments([p]);
    expect(usePaymentsStore.getState().payments).toHaveLength(1);
  });
});
