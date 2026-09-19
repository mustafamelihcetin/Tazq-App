import React from 'react';
import fs from 'fs';
import path from 'path';
import { render as rtlRender, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionSummary } from '@/features/focus/components/SessionSummary';
import { orderForFocus } from '@/features/focus/components/FocusTaskPicker';
import type { Task } from '@/features/tasks/store/useTaskStore';

/**
 * ODAK EKRANI — kullanıcının gördüğü ve dokunduğu kısım.
 *
 * Seans bittiğinde bağ hiçbir sonuca bağlanmıyordu (görev açık kalıyordu), günlük
 * hedef bu ekranda hiç görünmüyordu ve "biraz daha" demenin yolu yoktu.
 */

const METRICS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const render = (ui: React.ReactElement) => rtlRender(<SafeAreaProvider initialMetrics={METRICS}>{ui}</SafeAreaProvider>);
const T = {
  summaryGreatWork: 'Harika İş!', summaryGoodStart: 'İyi Başlangıç!', summaryMinFocused: 'dk odaklandın',
  summaryBackHome: 'Ana Sayfa', summaryNewSession: 'Yeni seans', summaryCoachCompleted: 'Süper.',
  summaryCoachGoodStart: 'Her dakika sayar.', summaryBreakSuggestion: '5 dk mola',
};
const props = {
  visible: true, minutes: 25, completed: true, taskTitle: null as string | null,
  dailyMinutes: 50, dailyGoal: 120, breakMinutes: 5, showBreak: true,
  language: 'tr' as const, t: T,
  onClose: jest.fn(), onStartBreak: jest.fn(), onExtend: jest.fn(),
  onNewSession: jest.fn(), onHome: jest.fn(), onCompleteTask: jest.fn(),
};

describe('seans özeti — seansın SONUCU', () => {
  beforeEach(() => jest.clearAllMocks());

  it('bağlı görev varsa "bitti mi?" diye SORAR ve tamamlar', () => {
    const onCompleteTask = jest.fn();
    const { getByText, getByLabelText, queryByText } = render(
      <SessionSummary {...props} taskTitle="Rapor yaz" onCompleteTask={onCompleteTask} />,
    );
    expect(getByText('“Rapor yaz” bitti mi?')).toBeTruthy();
    fireEvent.press(getByLabelText('Tamamlandı'));
    expect(onCompleteTask).toHaveBeenCalledTimes(1);
    // Soru yerini sonuca bırakır — aynı soru iki kez sorulmaz
    expect(queryByText('“Rapor yaz” bitti mi?')).toBeNull();
    expect(getByText('✓ Görev tamamlandı')).toBeTruthy();
  });

  it('"devam edecek" görevi TAMAMLAMAZ', () => {
    const onCompleteTask = jest.fn();
    const { getByLabelText } = render(
      <SessionSummary {...props} taskTitle="Rapor yaz" onCompleteTask={onCompleteTask} />,
    );
    fireEvent.press(getByLabelText('Devam edecek'));
    expect(onCompleteTask).not.toHaveBeenCalled();
  });

  it('bağsız seansta soru YOK', () => {
    const { queryByText } = render(<SessionSummary {...props} taskTitle={null} />);
    expect(queryByText(/bitti mi\?/)).toBeNull();
  });

  it('günlük hedef gösterilir; hedefe ulaşınca kutlanır', () => {
    const { getByText } = render(<SessionSummary {...props} dailyMinutes={50} dailyGoal={120} />);
    expect(getByText('50 / 120 dk')).toBeTruthy();
    const full = render(<SessionSummary {...props} dailyMinutes={130} dailyGoal={120} />);
    expect(full.getByText('Günlük hedefin tamam ✦')).toBeTruthy();
  });

  it('"+5 dk" ve mola düğmeleri çalışır; mola yalnız tamamlanan seansta', () => {
    const onExtend = jest.fn();
    const onStartBreak = jest.fn();
    const { getByLabelText } = render(<SessionSummary {...props} onExtend={onExtend} onStartBreak={onStartBreak} />);
    fireEvent.press(getByLabelText('+5 dk devam'));
    fireEvent.press(getByLabelText('5 dk Mola Başlat'));
    expect(onExtend).toHaveBeenCalledTimes(1);
    expect(onStartBreak).toHaveBeenCalledTimes(1);

    const early = render(<SessionSummary {...props} completed={false} showBreak={false} />);
    expect(early.queryByLabelText('5 dk Mola Başlat')).toBeNull();
  });

  it('yeni seansın özeti öncekinin yanıtlarını taşımaz', () => {
    const { getByLabelText, rerender, getByText } = render(<SessionSummary {...props} taskTitle="Rapor yaz" />);
    fireEvent.press(getByLabelText('Tamamlandı'));
    expect(getByText('✓ Görev tamamlandı')).toBeTruthy();
    rerender(<SafeAreaProvider initialMetrics={METRICS}><SessionSummary {...props} visible={false} taskTitle="Fatura öde" /></SafeAreaProvider>);
    rerender(<SafeAreaProvider initialMetrics={METRICS}><SessionSummary {...props} visible taskTitle="Fatura öde" /></SafeAreaProvider>);
    expect(getByText('“Fatura öde” bitti mi?')).toBeTruthy();
  });
});

describe('görev seçici — sıralama', () => {
  const task = (id: number, dueDate: string | null, extra: Partial<Task> = {}) =>
    ({ id, title: `g${id}`, isCompleted: false, tags: [], dueDate, ...extra } as unknown as Task);

  it('gecikmiş ve bugün önce, tarihsizler en sonda', () => {
    const list = orderForFocus(
      [task(2, null), task(3, '2026-09-18T00:00:00Z'), task(4, '2026-09-20T00:00:00Z')],
      '2026-09-20',
    );
    expect(list.map((x) => x.id)).toEqual([3, 4, 2]);
  });

  it('İLERİ TARİHLİ iş bugünün odak konusu değil', () => {
    /*
      "Ayın 27'sinde banka ödemesi" listede çıkıyordu; o gün gelince bir dakikada
      yapılacak bir iş için bugün 25 dakika odaklanmanın karşılığı yok.
    */
    const list = orderForFocus([task(1, '2026-09-27T00:00:00Z'), task(2, null)], '2026-09-20');
    expect(list.map((x) => x.id)).toEqual([2]);
  });

  it('hatırlatıcı/etkinlik/not kayıtları listelenmez — onlar iş değil', () => {
    const list = orderForFocus(
      [task(1, null, { tags: ['hatırlatıcı'] }), task(2, null, { tags: ['etkinlik'] }), task(3, null)],
      '2026-09-20',
    );
    expect(list.map((x) => x.id)).toEqual([3]);
  });

  it('tamamlanan ve rafa kaldırılan görevler listelenmez', () => {
    const list = orderForFocus(
      [task(1, null, { isCompleted: true }), task(2, null, { tags: ['someday'] }), task(3, null)],
      '2026-09-20',
    );
    expect(list.map((x) => x.id)).toEqual([3]);
  });
});

/** Ekranın davranışı: store ve bildirim tarafı focusSession.test.ts'te ölçülüyor. */
describe('odak ekranı kuralları', () => {
  const read = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
  const FOCUS = read('app/focus.tsx');
  const LAYOUT = read('app/_layout.tsx');
  const INDEX = read('app/index.tsx');

  it('seans sürerken ekran AÇIK kalır; katı modda tercih dinlenmez', () => {
    // Ekran kendiliğinden kararıp kilitleniyordu; katı modda bu "ayrıldın" sayılıyordu.
    expect(FOCUS).toContain('const keepScreenOn = isActive && (focusKeepAwake || strictMode);');
    expect(FOCUS).toContain('activateKeepAwakeAsync(KEEP_AWAKE_TAG)');
    expect(FOCUS).toContain('deactivateKeepAwake(KEEP_AWAKE_TAG)');
  });

  it('seansı bitirmek İKİ dokunuş ister', () => {
    expect(FOCUS).toContain('onPress={onEndPress}');
    expect(FOCUS).toMatch(/if \(!confirmEnd\) \{[\s\S]{0,200}setConfirmEnd\(true\)/);
  });

  it('katı mod PUAN KESMİYOR — ceza kaldırıldı', () => {
    expect(FOCUS).not.toMatch(/focusPoints: Math\.max\(0, pts - 10\)/);
    expect(FOCUS).not.toContain('10 Focus puanı kesildi');
  });

  it('bitiş alarmı ve tek kayıt kökten (layout) yönetiliyor', () => {
    expect(LAYOUT).toContain('syncFocusAlarm()');
    expect(LAYOUT).toContain('finalizeDueSession()');
    expect(LAYOUT).toContain('onAppBackground()');
    expect(LAYOUT).toContain('onAppForeground()');
    // Eski, iki kez düşen hesap geri gelmemeli
    expect(LAYOUT).not.toContain('const overshoot = elapsed - seconds;');
  });

  it('hızlı odak seansı store yolundan başlar — bitiş anı kurulur', () => {
    expect(INDEX).not.toMatch(/setState\(\{ totalSeconds: secs, seconds: secs, isActive: true/);
    expect(INDEX).toContain("useFocusStore.getState().setIsActive(true)");
  });

  it('pomodoro molası bitince TUR İLERLER — döngü molada çakılı kalmaz', () => {
    // Mola ayrı bir seans türü olunca pomodoro molası da "mola" dalına düşüyor;
    // faz ilerletilmezse sıradaki çalışma turu hiç başlamaz.
    expect(FOCUS).toMatch(/if \(isPomo && phase === 'break'\) nextPomodoroPhase\(\);/);
  });

  it('görev seçici ekrana bağlı', () => {
    expect(FOCUS).toContain('<FocusTaskPicker');
    expect(FOCUS).toContain('setCurrentTask(title, taskId)');
  });
});
