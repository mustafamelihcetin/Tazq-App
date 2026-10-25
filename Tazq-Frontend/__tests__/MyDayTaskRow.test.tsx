import React from 'react';
import { render } from '@testing-library/react-native';
import { MyDayTaskRow } from '@/features/dashboard/components/MyDayTaskRow';
import { Colors } from '@/shared/constants/Colors';

/**
 * Cihazda görüldü (2026-10-25): turdaki örnek görevlerin satırları BAŞLIKSIZ çiziliyordu.
 * Örnek görev `original: {}` taşıyor; satır başlığı `item.original || item`'dan okuyordu —
 * boş nesne "doğru" sayıldığı için başlık boş nesneden okunup boş kalıyordu.
 */
const theme = Colors.light;
const base = {
  isLast: false,
  theme,
  isDark: false,
  tr: true,
  onPress: jest.fn(),
  priorityColor: () => theme.priorityMedium,
  prefs: {},
};

describe('MyDayTaskRow başlığı', () => {
  it('örnek görev (original boş) kendi başlığını gösterir', () => {
    const { getByText } = render(
      <MyDayTaskRow {...base} item={{ type: 'task', id: 'mock-task-1', title: 'Haftalık Raporu Hazırla', priority: 'High', isCompleted: false, original: {} } as any} />,
    );
    expect(getByText('Haftalık Raporu Hazırla')).toBeTruthy();
  });

  it('gerçek görevde başlık original\'dan gelir', () => {
    const { getByText } = render(
      <MyDayTaskRow {...base} item={{ type: 'task', id: 7, title: 'eski', priority: 'Low', isCompleted: false, original: { id: 7, title: 'Sunumu bitir' } } as any} />,
    );
    expect(getByText('Sunumu bitir')).toBeTruthy();
  });
});
