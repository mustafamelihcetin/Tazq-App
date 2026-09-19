import React from 'react';
import { render as rtlRender, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TriageModal } from '@/features/dashboard/components/TriageModal';
import { TazqZenCard } from '@/features/dashboard/components/TazqZenCard';
import { SomedayNudge } from '@/features/dashboard/components/SomedayNudge';
import { Colors } from '@/shared/constants/Colors';
import type { Task } from '@/features/tasks/store/useTaskStore';
import type { RebalancePlan } from '@/features/tasks/utils/taskBalancer';
import type { AppliedRebalance } from '@/features/tasks/utils/rebalanceActions';

/**
 * TAZQZen YÜZEYLERİ — kullanıcının dokunduğu yer.
 *
 * Önceki triage'da bir satıra değmek, ONAYSIZ olarak günün öteki bütün işlerini
 * taşıyordu; kart ise ne yapacağını söylemeden yapıyordu. İkisi de "yanlışlıkla bir
 * dokunuş, onlarca görevin tarihi" demekti.
 */

const theme = Colors.light;
const METRICS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const render = (ui: React.ReactElement) => rtlRender(<SafeAreaProvider initialMetrics={METRICS}>{ui}</SafeAreaProvider>);
const t = (id: number, title: string) => ({ id, title, isCompleted: false, tags: [] } as unknown as Task);
const emptyPlan: RebalancePlan = { moves: [], scheduled: 0, someday: 0 };

describe('triage', () => {
  const tasks = [t(1, 'Rapor'), t(2, 'Fatura'), t(3, 'Market')];
  const preview = jest.fn((): RebalancePlan => ({
    moves: [{ task: t(8, 'x'), to: '2026-09-21' }, { task: t(9, 'y'), to: '2026-09-22' }],
    scheduled: 2, someday: 0,
  }));

  it('satıra dokunmak HİÇBİR ŞEY yapmaz — yalnız seçer ve sonucu önizler', () => {
    const onConfirm = jest.fn();
    const { getByLabelText, getByText } = render(
      <TriageModal visible onClose={jest.fn()} tasks={tasks} preview={preview} onConfirm={onConfirm} fixedCount={1} theme={theme} tr />,
    );
    // Seçim yokken onay kapalı
    fireEvent.press(getByLabelText('Günü sadeleştir'));
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.press(getByLabelText('Fatura'));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(preview).toHaveBeenCalledWith([2]);
    // Basmadan ÖNCE ne olacağı söyleniyor — plan görevleri de
    expect(getByText(/2 görev önümüzdeki günlere yayılır\. Saatli, tekrarlayan ve plan görevlerin \(1\) bugün yerinde kalır\./)).toBeTruthy();

    fireEvent.press(getByLabelText('Günü sadeleştir'));
    expect(onConfirm).toHaveBeenCalledWith([2]);
  });

  it('seçim onay kutusu olarak okunur — ekran okuyucu hangisinin seçili olduğunu duyar', () => {
    const { getByLabelText } = render(
      <TriageModal visible onClose={jest.fn()} tasks={tasks} preview={preview} onConfirm={jest.fn()} fixedCount={0} theme={theme} tr />,
    );
    fireEvent.press(getByLabelText('Rapor'));
    expect(getByLabelText('Rapor').props.accessibilityState).toMatchObject({ checked: true });
    expect(getByLabelText('Market').props.accessibilityState).toMatchObject({ checked: false });
  });

  it('en fazla 3 seçilir — dördüncü satır pasifleşir, seçim bozulmaz', () => {
    const many = [t(1, 'A'), t(2, 'B'), t(3, 'C'), t(4, 'D'), t(5, 'E')];
    const onConfirm = jest.fn();
    const { getByLabelText } = render(
      <TriageModal visible onClose={jest.fn()} tasks={many} preview={preview} onConfirm={onConfirm} fixedCount={0} theme={theme} tr />,
    );
    ['A', 'B', 'C'].forEach((l) => fireEvent.press(getByLabelText(l)));
    expect(getByLabelText('D').props.accessibilityState).toMatchObject({ checked: false, disabled: true });
    fireEvent.press(getByLabelText('D'));
    // Birini bırakınca yer açılır
    fireEvent.press(getByLabelText('B'));
    fireEvent.press(getByLabelText('D'));
    fireEvent.press(getByLabelText('Günü sadeleştir'));
    expect(onConfirm).toHaveBeenCalledWith([1, 3, 4]);
  });

  it('bugünün HEPSİ seçildiyse taşınacak iş yok — onay kapalı ve bunu söyler', () => {
    const two = [t(1, 'A'), t(2, 'B')];
    const nothing = jest.fn((): RebalancePlan => ({ moves: [], scheduled: 0, someday: 0 }));
    const onConfirm = jest.fn();
    const { getByLabelText, getByText } = render(
      <TriageModal visible onClose={jest.fn()} tasks={two} preview={nothing} onConfirm={onConfirm} fixedCount={0} theme={theme} tr />,
    );
    fireEvent.press(getByLabelText('A'));
    fireEvent.press(getByLabelText('B'));
    expect(getByText(/taşınacak bir şey kalmadı/)).toBeTruthy();
    fireEvent.press(getByLabelText('Günü sadeleştir'));
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('Zen kartı', () => {
  const planWith = (scheduled: number, someday: number): RebalancePlan => ({
    moves: Array.from({ length: scheduled + someday }, (_, i) => ({ task: t(i + 1, `g${i}`), to: i < scheduled ? '2026-09-21' : null })),
    scheduled, someday,
  });
  const applied = (moved: number): AppliedRebalance => ({ moved, scheduled: moved, someday: 0, failed: 0, undo: jest.fn(async () => {}) });

  it('basmadan ÖNCE ne olacağını söyler', () => {
    const { getByText } = render(
      <TazqZenCard visible plan={planWith(3, 2)} overdueTotal={6} onRebalance={jest.fn()} onDismiss={jest.fn()} theme={theme} tr />,
    );
    expect(getByText(/5 görevin birikti\. Dengelersen 3 tanesi önümüzdeki günlere yayılır, 2 tanesi Belki Bir Gün'e alınır/)).toBeTruthy();
    // Gecikmiş 6, taşınabilir 5 → 1 sabit görev dürüstçe söyleniyor
    expect(getByText(/Saatli, tekrarlayan ve plan görevlerine \(1\) dokunulmaz/)).toBeTruthy();
  });

  it('bir şey taşındıysa "geri al" sunar ve geri alma tutamacını çağırır', async () => {
    const result = applied(3);
    const { getByLabelText } = render(
      <TazqZenCard visible plan={planWith(3, 0)} overdueTotal={3} onRebalance={async () => result} onDismiss={jest.fn()} theme={theme} tr />,
    );
    fireEvent.press(getByLabelText('Dengele'));
    await waitFor(() => getByLabelText('Geri al'));
    fireEvent.press(getByLabelText('Geri al'));
    await waitFor(() => expect(result.undo).toHaveBeenCalledTimes(1));
  });

  it('HİÇBİR şey taşınmadıysa "denge sağlandı" demez', async () => {
    const { getByLabelText, queryByText } = render(
      <TazqZenCard visible plan={planWith(3, 0)} overdueTotal={3} onRebalance={async () => applied(0)} onDismiss={jest.fn()} theme={theme} tr />,
    );
    fireEvent.press(getByLabelText('Dengele'));
    await waitFor(() => getByLabelText('Dengele'));
    expect(queryByText(/Denge sağlandı/)).toBeNull();
  });

  it('taşınacak bir şey yoksa kart hiç çizilmez', () => {
    const { queryByLabelText, queryByText } = render(
      <TazqZenCard visible plan={emptyPlan} overdueTotal={2} onRebalance={jest.fn()} onDismiss={jest.fn()} theme={theme} tr />,
    );
    expect(queryByLabelText('Dengele')).toBeNull();
    expect(queryByText('TAZQ ZEN')).toBeNull();
  });
});

describe('raf hatırlatması', () => {
  it('rafta iş varken sayıyı söyler; iki düğme de kendi işini yapar', () => {
    const onOpen = jest.fn(); const onLater = jest.fn();
    const { getByText, getByLabelText } = render(
      <SomedayNudge visible count={4} onOpen={onOpen} onLater={onLater} theme={theme} tr />,
    );
    expect(getByText('Rafta 4 iş bekliyor')).toBeTruthy();
    fireEvent.press(getByLabelText('Göz at'));
    fireEvent.press(getByLabelText('Sonra'));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onLater).toHaveBeenCalledTimes(1);
  });

  it('raf boşsa ya da zamanı değilse hiç çizilmez', () => {
    const r1 = render(<SomedayNudge visible count={0} onOpen={jest.fn()} onLater={jest.fn()} theme={theme} tr />);
    expect(r1.queryByLabelText('Göz at')).toBeNull();
    const r2 = render(<SomedayNudge visible={false} count={3} onOpen={jest.fn()} onLater={jest.fn()} theme={theme} tr />);
    expect(r2.queryByLabelText('Göz at')).toBeNull();
  });
});

describe('taşan gün kartı', () => {
  it('birikim yokken bugünün yükünü söyler ve triage\'ı açar', () => {
    const onOpen = jest.fn(); const onDismiss = jest.fn();
    const { getByText, getByLabelText } = render(
      <TazqZenCard visible={false} plan={emptyPlan} overdueTotal={0} onRebalance={jest.fn()} onDismiss={onDismiss}
        overload={{ count: 8, onOpen }} theme={theme} tr />,
    );
    expect(getByText('Bugün 8 işin var')).toBeTruthy();
    fireEvent.press(getByLabelText('Sadeleştir'));
    fireEvent.press(getByLabelText('Ben hallederim'));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('birikim kartı varsa ÖNCE o gösterilir — iki Zen kartı aynı anda çıkmaz', () => {
    const plan: RebalancePlan = { moves: [{ task: t(1, 'a'), to: '2026-09-21' }], scheduled: 1, someday: 0 };
    const { queryByLabelText } = render(
      <TazqZenCard visible plan={plan} overdueTotal={1} onRebalance={jest.fn()} onDismiss={jest.fn()}
        overload={{ count: 8, onOpen: jest.fn() }} theme={theme} tr />,
    );
    expect(queryByLabelText('Dengele')).toBeTruthy();
    expect(queryByLabelText('Sadeleştir')).toBeNull();
  });
});
