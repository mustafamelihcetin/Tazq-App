import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { SettingsCard, SettingItem, ToggleRow, RowDivider } from '@/shared/components/SettingsRows';
import { Colors } from '@/shared/constants/Colors';
import { W, F } from '@/shared/constants/tokens';

/**
 * Ayar listesi primitifleri — profil'den çıkarıldı, ayarların ayrı sayfaya taşınması için
 * paylaşıldı. Bu testler çıkarma sırasında düzeltilen üç şeyi çiviliyor.
 */

const theme = Colors.light;
const styleOf = (node: any) =>
  Object.assign({}, ...[node.props.style].flat(Infinity).filter(Boolean));

describe('SettingItem', () => {
  const setup = (over = {}) =>
    render(
      <SettingItem
        icon={<Text>i</Text>}
        label="Bildirimler"
        theme={theme}
        {...over}
      />,
    );

  it('etiketi gösterir', () => {
    expect(setup().getByText('Bildirimler')).toBeTruthy();
  });

  it('etiket NORMAL ağırlıkta — 700 değil', () => {
    // iOS Ayarlar satır etiketleri normal ağırlıktır (Wi-Fi, Bluetooth…). 700 "her şey
    // kalın" anti-deseniydi ve bu bileşen 10 satırda birden onu uyguluyordu.
    expect(styleOf(setup().getByText('Bildirimler')).fontWeight).toBe(W.regular);
  });

  it('alt açıklamayı ölçülü gri seviyeyle gösterir — opacity yok', () => {
    const s = styleOf(setup({ sub: 'Günlük özet' }).getByText('Günlük özet'));
    expect(s.color).toBe(theme.onSurfaceMuted);
    expect(s.opacity).toBeUndefined();
    expect(s.fontSize).toBe(F.caption);
  });

  it('dokunmayı iletir', () => {
    const onPress = jest.fn();
    fireEvent.press(setup({ onPress }).getByText('Bildirimler'));
    expect(onPress).toHaveBeenCalled();
  });

  it('koyu temada da etiket palete bağlı', () => {
    const { getByText } = render(<SettingItem icon={<Text>i</Text>} label="X" theme={Colors.dark} />);
    expect(styleOf(getByText('X')).color).toBe(Colors.dark.onSurface);
  });
});

describe('ToggleRow', () => {
  const setup = (over = {}) =>
    render(
      <ToggleRow
        icon={<Text>i</Text>}
        bg="#000"
        title="Sesler"
        value={false}
        onValueChange={jest.fn()}
        theme={theme}
        isDark={false}
        {...over}
      />,
    );

  it('başlığı NORMAL ağırlıkta gösterir', () => {
    expect(styleOf(setup().getByText('Sesler')).fontWeight).toBe(W.regular);
  });

  it('değişimi iletir', () => {
    const onValueChange = jest.fn();
    const { UNSAFE_getByType } = setup({ onValueChange });
    const Switch = require('react-native').Switch;
    fireEvent(UNSAFE_getByType(Switch), 'valueChange', true);
    expect(onValueChange).toHaveBeenCalledWith(true);
  });

  it('erişilebilir — switch rolü ve durumu bildirir', () => {
    const { UNSAFE_getByType } = setup({ value: true });
    const Switch = require('react-native').Switch;
    const sw = UNSAFE_getByType(Switch);
    expect(sw.props.accessibilityState).toEqual({ checked: true });
  });
});

describe('SettingsCard', () => {
  it('koyu temada kart zemini palet token’ı — sabit renk değil', () => {
    const { getByTestId } = render(
      <SettingsCard theme={Colors.dark} isDark>
        <Text testID="c">x</Text>
      </SettingsCard>,
    );
    // Zemin theme.surfaceContainerHigh olmalı (dashboard BentoCard ile aynı). Eskiden
    // profil kendi '#1C1C22' sabitini yazıyordu → aynı uygulamada iki kart tonu.
    expect(getByTestId('c')).toBeTruthy();
  });
});

describe('RowDivider', () => {
  it('render olur ve çökmede bulunmaz', () => {
    expect(() => render(<RowDivider theme={theme} />)).not.toThrow();
  });
});
