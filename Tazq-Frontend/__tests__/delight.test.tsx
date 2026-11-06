import React from 'react';
import { Text } from 'react-native';
import { render, act } from '@testing-library/react-native';
import { useCountingValue } from '@/shared/hooks/useCountingValue';
import { DisplayValue } from '@/shared/components/DisplayPanel';
import { TickCircle } from '@/shared/components/TickCircle';

let mockReduce = false;
jest.mock('@/shared/hooks/useReduceMotion', () => ({ useReduceMotion: () => mockReduce }));

function Count({ value }: { value: number }) {
  return <Text>{String(useCountingValue(value))}</Text>;
}
const hidden = { includeHiddenElements: true };

describe('sayarak değişen tutar', () => {
  let now = 0;
  let frames: FrameRequestCallback[] = [];
  const step = (ms: number) => act(() => {
    now += ms;
    const run = frames;
    frames = [];
    run.forEach((f) => f(now));
  });

  beforeEach(() => {
    mockReduce = false;
    now = 1000;
    frames = [];
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    jest.spyOn(global, 'requestAnimationFrame').mockImplementation((f) => { frames.push(f); return frames.length; });
    jest.spyOn(global, 'cancelAnimationFrame').mockImplementation(() => { frames = []; });
  });
  afterEach(() => jest.restoreAllMocks());

  it('ilk çizimde saymaz', () => {
    expect(render(<Count value={500} />).getByText('500', hidden)).toBeTruthy();
    expect(frames).toHaveLength(0);
  });

  it('eskiden yeniye gider, varınca durur', () => {
    const ui = render(<Count value={1000} />);
    ui.rerender(<Count value={0} />);
    step(100);
    const mid = Number(ui.UNSAFE_getByType(Text).props.children);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1000);
    step(400);
    expect(ui.getByText('0', hidden)).toBeTruthy();
    expect(frames).toHaveLength(0);
  });

  it('Hareketi Azalt açıkken doğrudan yeni değer', () => {
    mockReduce = true;
    const ui = render(<Count value={1000} />);
    ui.rerender(<Count value={200} />);
    expect(ui.getByText('200', hidden)).toBeTruthy();
    expect(frames).toHaveLength(0);
  });
});

describe('dijital değer', () => {
  it('binlik ayraçlı tutar parçalanıp sayılmaz', () => {
    const ui = render(<DisplayValue value="12.000 ₺" />);
    expect(ui.getByText('12.000 ₺', hidden)).toBeTruthy();
  });
  it('kesirli gösterimde baştaki sayı sayılır', () => {
    const ui = render(<DisplayValue value="2/4" />);
    expect(ui.getByText('2', hidden)).toBeTruthy();
  });
});

describe('tik', () => {
  it('işaretsiz ve işaretli çizilir, Hareketi Azalt açıkken de', () => {
    const props = { size: 22, color: '#0a0', ringColor: '#888', tickColor: '#fff' };
    const ui = render(<TickCircle checked={false} {...props} />);
    ui.rerender(<TickCircle checked {...props} />);
    mockReduce = true;
    expect(render(<TickCircle checked {...props} />).toJSON()).toBeTruthy();
  });
});
