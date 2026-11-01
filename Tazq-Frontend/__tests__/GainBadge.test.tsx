import React from 'react';
import { render, act } from '@testing-library/react-native';
import { GainBadge } from '@/shared/components/GainBadge';
import { resetSeen } from '@/shared/utils/seenValues';

let mockReduce = false;
jest.mock('@/shared/hooks/useReduceMotion', () => ({ useReduceMotion: () => mockReduce }));

/**
 * "+1" (B2, 2026-10-31) — bir iş bitince ait olduğu yerde kısa bir işaret: yaptığın bir yere gitti.
 * Animasyon dili: bilgi taşır, bir kez oynar, durur; "hareketi azalt"ta hiç çizilmez.
 */
describe('GainBadge', () => {
  beforeEach(() => { resetSeen(); mockReduce = false; jest.useFakeTimers(); });
  afterEach(() => jest.useRealTimers());

  it('ilk çizimde yok; sayı artınca "+1" belirir ve bir süre sonra kaybolur', () => {
    const ui = render(<GainBadge seenKey="m" value={0} color="#000" />);
    expect(ui.queryByText('+1', { includeHiddenElements: true })).toBeNull();
    ui.rerender(<GainBadge seenKey="m" value={1} color="#000" />);
    expect(ui.getByText('+1', { includeHiddenElements: true })).toBeTruthy();
    act(() => { jest.advanceTimersByTime(2000); });
    expect(ui.queryByText('+1', { includeHiddenElements: true })).toBeNull();
  });

  it('azalınca (geri alma) işaret yok', () => {
    const ui = render(<GainBadge seenKey="m" value={2} color="#000" />);
    ui.rerender(<GainBadge seenKey="m" value={1} color="#000" />);
    expect(ui.queryByText(/^\+/, { includeHiddenElements: true })).toBeNull();
  });

  it('başka sekmede biten işler dönüşte bir kez gösterilir', () => {
    render(<GainBadge seenKey="m" value={1} color="#000" />).unmount();
    const ui = render(<GainBadge seenKey="m" value={3} color="#000" />);
    expect(ui.getByText('+2', { includeHiddenElements: true })).toBeTruthy();
  });

  it('hareketi azalt açıkken çizilmez', () => {
    mockReduce = true;
    const ui = render(<GainBadge seenKey="m" value={0} color="#000" />);
    ui.rerender(<GainBadge seenKey="m" value={1} color="#000" />);
    expect(ui.queryByText('+1', { includeHiddenElements: true })).toBeNull();
  });
});

it('ana sayfadaki mod satırı modun bugününden "+1" gösterir (tek motor: modeToday)', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'features/modes/components/ModeTodayCard.tsx'), 'utf8');
  expect(src).toContain('<GainBadge seenKey={`modeToday:${mode.key}`} value={mode.todayDone}');
});
