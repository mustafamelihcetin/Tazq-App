import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import { InboxSheet } from '@/features/dashboard/components/InboxSheet';
import { buildInbox, type InboxItem } from '@/features/dashboard/utils/inboxItems';
import { INBOX_COPY } from '@/features/dashboard/utils/inboxCopy';
import { ProgressCard } from '@/features/user/components/ProgressCard';
import { useInboxStore } from '@/shared/store/useInboxStore';
import { Colors } from '@/shared/constants/Colors';
import { UNDO_WINDOW_MS } from '@/shared/utils/deferredCommit';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@shopify/react-native-skia', () => ({
  Canvas: 'Canvas', Path: 'Path', Group: 'Group', BlurMask: 'BlurMask',
  Skia: { Path: { Make: () => ({ moveTo() {}, quadTo() {}, close() {} }) } },
}));

const hidden = { includeHiddenElements: true };
const payment: InboxItem = { id: 'p', kind: 'payment', rank: 1, title: 'Kira', sub: '2 gün gecikti', tone: 'error', ref: 3, amount: '12.000 ₺' };
const badge: InboxItem = { id: 'b', kind: 'badge', rank: 4, title: 'Yedi gün', sub: 'Yeni başarım' };
const sheet = (props: Partial<React.ComponentProps<typeof InboxSheet>> = {}) => (
  <InboxSheet visible onClose={() => {}} items={[payment, badge]} zenCard={null} somedayCard={null} onItem={() => {}} onDismiss={() => {}} theme={(Colors as unknown as { dark: never }).dark} language="tr" {...props} />
);

describe('gelen kutusu', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('sabit cümle yerine durumu söyler', () => {
    const ui = render(sheet({ items: [payment, { ...payment, id: 'p2', ref: 4 }, badge] }));
    expect(ui.getByText('2 ödeme bekliyor · 1 bildirim', hidden)).toBeTruthy();
    expect(ui.queryByText(/söylemek istedikleri/, hidden)).toBeNull();
  });

  it('ödeme satırı tutarı gösterir', () => {
    expect(render(sheet()).getByText('12.000 ₺', hidden)).toBeTruthy();
  });

  it('Temizle yalnız bilgi kalemlerini kaldırır: gecikmiş ödeme silinmez', () => {
    const onDismiss = jest.fn();
    fireEvent.press(render(sheet({ onDismiss })).getByLabelText('Temizle', hidden));
    expect(onDismiss).toHaveBeenCalledWith(['b']);
  });

  it('yalnız ödeme varken Temizle yok', () => {
    expect(render(sheet({ items: [payment] })).queryByLabelText('Temizle', hidden)).toBeNull();
  });

  it('tek kaldırma geri alınabilir, süre bitince satır gider', () => {
    const onDismiss = jest.fn();
    const onRestore = jest.fn();
    const ui = render(sheet({ onDismiss, onRestore }));
    fireEvent.press(ui.getByLabelText('Kaldır: Kira', hidden));
    expect(onDismiss).toHaveBeenCalledWith(['p']);
    ui.rerender(sheet({ onDismiss, onRestore, items: [badge] }));
    expect(ui.getByText('Kira kaldırıldı', hidden)).toBeTruthy();
    fireEvent.press(ui.getByLabelText('Geri al: Kira', hidden));
    expect(onRestore).toHaveBeenCalledWith(['p']);

    fireEvent.press(ui.getByLabelText('Kaldır: Yedi gün', hidden));
    act(() => { jest.advanceTimersByTime(UNDO_WINDOW_MS); });
    expect(ui.queryByText('Yedi gün kaldırıldı', hidden)).toBeNull();
  });

  it('açılışta yeni olan işaretli kalır', () => {
    const ui = render(sheet({ fresh: ['p'] }));
    expect(ui.getAllByTestId('inbox-fresh', hidden)).toHaveLength(1);
    expect(ui.getByLabelText(/Kira.*yeni/, hidden)).toBeTruthy();
  });

  it('kaldırma geri alımı deposunda çalışır', () => {
    useInboxStore.setState({ dismissed: [] });
    useInboxStore.getState().dismiss(['a', 'b']);
    useInboxStore.getState().undismiss(['a']);
    expect(useInboxStore.getState().dismissed).toEqual(['b']);
  });

  it('veri: ödeme tutarla gelir, biçim olmadan da çalışır', () => {
    const input = {
      now: new Date(2026, 10, 6, 9), dayKey: '2026-11-06', zen: { visible: false, overload: false }, someday: { visible: false, count: 0 },
      payments: [{ id: 1, title: 'Kira', amount: 100, dueDay: 7, recurrence: 'Monthly' }] as never, support: [], unlockedAt: {}, achievementTitle: () => null, tomorrowCount: 0, copy: INBOX_COPY.tr,
    };
    expect(buildInbox({ ...input, money: () => '100 ₺' })[0].amount).toBe('100 ₺');
    expect(buildInbox(input)[0].amount).toBeUndefined();
  });
});

describe('ilerleme kartı', () => {
  const props = {
    lang: 'tr' as const, stats: { focusHours: 12, tasks: 40, bestStreak: 9, currentStreak: 3 }, statsState: 'ok' as const, onRetry: () => {},
    medals: [], earnedCount: 0, totalMedals: 14, onShowcase: () => {}, renderMedal: () => null, shields: 2, points: 40, onShield: () => {},
  };

  it('güncel seri ve en iyisi birlikte', () => {
    const ui = render(<ProgressCard {...props} />);
    expect(ui.getByText('gün seri · en iyi 9', hidden)).toBeTruthy();
  });

  it('kimlik kartın başında', () => {
    expect(render(<ProgressCard {...props} identity={<Text>Melih</Text>} />).getByText('Melih', hidden)).toBeTruthy();
  });

  it('kalkan varken eylem açık yazılır ve çalışır', () => {
    const onShield = jest.fn();
    const ui = render(<ProgressCard {...props} onShield={onShield} />);
    expect(ui.getByText('Kullan', hidden)).toBeTruthy();
    fireEvent.press(ui.getByLabelText(/Seri kalkanı/, hidden));
    expect(onShield).toHaveBeenCalled();
  });

  it('kalkan yokken dokunulmaz, hata da vermez', () => {
    const onShield = jest.fn();
    const ui = render(<ProgressCard {...props} shields={0} onShield={onShield} />);
    expect(ui.queryByText('Kullan', hidden)).toBeNull();
    fireEvent.press(ui.getByLabelText(/Seri kalkanı/, hidden));
    expect(onShield).not.toHaveBeenCalled();
  });

  it('yüklenemezse ne olduğunu söyler', () => {
    const onRetry = jest.fn();
    fireEvent.press(render(<ProgressCard {...props} statsState="error" onRetry={onRetry} />).getByLabelText('Yüklenemedi, tekrar dene', hidden));
    expect(onRetry).toHaveBeenCalled();
  });
});
