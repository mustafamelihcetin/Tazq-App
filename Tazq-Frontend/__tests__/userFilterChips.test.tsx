import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { UserFilterChips } from '@/features/admin/components/UserFilterChips';

/** Kullanıcı filtreleri: her çip kendi sayısını taşır; seçili çipe tekrar dokunmak "Tümü"ne döner. */
describe('UserFilterChips', () => {
  it('sayılar çipte; seçim değişir, seçiliye dokunmak Tümü', () => {
    const onChange = jest.fn();
    const r = render(<UserFilterChips value="banned" counts={{ active: 12, banned: 2, unverified: 5 }} total={2} onChange={onChange} lang="tr" />);
    expect(r.getByLabelText('Aktif · 7 gün, 12')).toBeTruthy();
    expect(r.getByLabelText('Banlı, 2')).toBeTruthy();
    fireEvent.press(r.getByLabelText('Doğrulanmamış, 5'));
    expect(onChange).toHaveBeenLastCalledWith('unverified');
    fireEvent.press(r.getByLabelText('Banlı, 2'));
    expect(onChange).toHaveBeenLastCalledWith('all');
  });
});
