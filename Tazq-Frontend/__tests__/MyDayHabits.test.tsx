import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { MyDayHabits } from '@/features/dashboard/components/MyDayHabits';
import { Colors } from '@/shared/constants/Colors';
import { F, MIN_TOUCH } from '@/shared/constants/tokens';

/**
 * Alışkanlık şeridi — index.tsx'ten çıkarılan beşinci bölüm.
 *
 * Bileşen DAVRANIŞI bilmiyor: basınca ses çalmak, hepsi bitince konfeti patlatmak ve
 * odak puanı eklemek çağıranın işi (index.tsx). Burası yalnızca "basıldı" der.
 * Bu ayrım sayesinde test etmek için beş store'u mock'lamak gerekmiyor.
 */

const theme = Colors.light;

const habit = (id: number, over: object = {}) => ({
  id,
  name: `Alışkanlık ${id}`,
  nameTr: `Alışkanlık ${id}`,
  isCompleted: false,
  color: '#3B82F6',
  ...over,
});

const setup = (over: Partial<React.ComponentProps<typeof MyDayHabits>> = {}) =>
  render(
    <MyDayHabits
      habits={[habit(1), habit(2)]}
      onToggle={jest.fn()}
      onSkip={jest.fn()}
      onAddHabit={jest.fn()}
      theme={theme}
      isDark={false}
      tr
      {...over}
    />,
  );

const styleOf = (node: any) =>
  Object.assign({}, ...[node.props.style].flat(Infinity).filter(Boolean));

describe('MyDayHabits', () => {
  it('bölüm başlığını ve ipucunu gösterir', () => {
    const { getByText } = setup();
    expect(getByText('BUGÜNKÜ ALIŞKANLIKLARIM')).toBeTruthy();
    expect(getByText('Alışkanlığı tamamlamak için bas, mola için basılı tut')).toBeTruthy();
  });

  it('ekleme kısayolunu HER ZAMAN gösterir — dolu da olsa', () => {
    // Şerit doluyken de eklenebilmeli; kısayol yalnızca boşken görünseydi
    // ikinci alışkanlığı eklemenin yolu kalmazdı.
    expect(setup().getByTestId('add-habit')).toBeTruthy();
    expect(setup({ habits: [] }).getByTestId('add-habit')).toBeTruthy();
  });

  it('boş durum rehberini YALNIZCA hiç alışkanlık yokken gösterir', () => {
    expect(setup({ habits: [] }).getByText(/Günlük alışkanlıklarını belirle/)).toBeTruthy();
    expect(setup().queryByText(/Günlük alışkanlıklarını belirle/)).toBeNull();
  });

  it('ekleme dokunuşunu iletir', () => {
    const onAddHabit = jest.fn();
    fireEvent.press(setup({ onAddHabit }).getByTestId('add-habit'));
    expect(onAddHabit).toHaveBeenCalled();
  });

  it('etiketler okunabilir puntoda — 9.5pt değil', () => {
    // "Ekle" ve rehber metni 9.5pt yazılıydı: okunabilirliğin alt sınırı 11.
    // Yani ikisi de görünmüyordu.
    const { getByText } = setup({ habits: [] });
    expect(styleOf(getByText('Ekle')).fontSize).toBe(F.caption);
    expect(styleOf(getByText(/Günlük alışkanlıklarını belirle/)).fontSize).toBe(F.caption);
  });

  it('ekleme ikonu opacity ile değil, seviyeyle soluk', () => {
    // `Plus ... opacity: 0.6` yazılıydı. Ölçülmüş rengi kullanım yerinde kısmak,
    // metinde olduğu gibi ikonda da ölçüyü çöpe atar.
    const { getByText } = setup();
    expect(styleOf(getByText('Ekle')).color).toBe(theme.onSurfaceMuted);
    expect(styleOf(getByText('Ekle')).opacity).toBeUndefined();
  });

  it('ekleme yuvası dokunma sınırını geçer', () => {
    expect(styleOf(setup().getByTestId('add-habit')).minHeight).toBeGreaterThanOrEqual(MIN_TOUCH);
  });

  it('renkleri palete bağlı — koyu temada da', () => {
    const { getByText } = setup({ theme: Colors.dark, isDark: true });
    expect(styleOf(getByText('Ekle')).color).toBe(Colors.dark.onSurfaceMuted);
  });

  it('İngilizcede etiketler çevrilir', () => {
    const { getByText } = setup({ tr: false, habits: [] });
    expect(getByText('MY DAILY HABITS')).toBeTruthy();
    expect(getByText('Add')).toBeTruthy();
  });

  it('hiç alışkanlık yokken de çökmez', () => {
    expect(() => setup({ habits: [] })).not.toThrow();
  });
});
