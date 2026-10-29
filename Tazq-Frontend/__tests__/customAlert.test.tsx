/**
 * Sistem uyarı penceresi YOK (kullanıcı kararı 2026-10-29): Android'in teal AlertDialog'u
 * uygulamadan kopuk ve çirkin görünüyordu. Uyarı artık native Modal değil, en üstteki
 * yuvaya (AlertHost) çizilen bir örtü — modal içinden açıldığında da görünür, iç içe
 * native modal donması da olmaz.
 */
import React from 'react';
import { Modal, Text } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import fs from 'fs';
import path from 'path';
import { CustomAlert, AlertHost } from '@/shared/components/CustomAlert';

jest.mock('@/shared/utils/haptics', () => ({ haptic: { select: jest.fn(), commit: jest.fn(), surface: jest.fn() } }));

describe('CustomAlert', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  it('başlık, mesaj ve düğmeler; düğme işini yapıp kapanır', () => {
    const onDelete = jest.fn();
    const { getByText, queryByText } = render(<AlertHost />);
    act(() => CustomAlert.alert('Silinsin mi?', 'Geri alınamaz.', [{ text: 'Vazgeç', style: 'cancel' }, { text: 'Sil', style: 'destructive', onPress: onDelete }]));
    getByText('Silinsin mi?');
    getByText('Geri alınamaz.');
    act(() => { fireEvent.press(getByText('Sil')); });
    act(() => { jest.runAllTimers(); });
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(queryByText('Silinsin mi?')).toBeNull();
  });

  it('düğme verilmezse tek "Tamam"', () => {
    const { getByText } = render(<AlertHost />);
    act(() => CustomAlert.alert('Kaydedildi'));
    getByText(/Tamam|OK/);
  });

  it('modal içinden açılan uyarı MODALIN İÇİNDEKİ yuvada görünür (iOS\'ta görünmüyordu)', () => {
    const { getAllByTestId } = render(
      <>
        <AlertHost testID="root-host" />
        <Modal visible><Text>sheet</Text><AlertHost testID="sheet-host" /></Modal>
      </>,
    );
    act(() => CustomAlert.alert('İç uyarı'));
    expect(getAllByTestId('alert-card-sheet-host')).toHaveLength(1);
  });
});

describe('koruma: sistem Alert yok', () => {
  const ROOT = path.resolve(__dirname, '..');
  const walk = (d: string): string[] => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap(e =>
    e.name === 'node_modules' ? [] : e.isDirectory() ? walk(`${d}/${e.name}`) : /\.tsx?$/.test(e.name) ? [`${d}/${e.name}`] : []);
  const files = ['app', 'features', 'shared'].flatMap(walk);

  it('hiçbir dosya react-native Alert\'ini içe aktarmaz', () => {
    const offenders = files.filter(f => /import\s*\{[^}]*\bAlert\b[^}]*\}\s*from\s*'react-native'/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
    expect(offenders).toEqual([]);
  });
});
