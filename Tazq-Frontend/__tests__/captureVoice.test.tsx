import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CaptureSheet } from '@/features/onboarding/components/CaptureSheet';
import { useLanguageStore } from '@/shared/store/useLanguageStore';

const mockStart = jest.fn();
const mockStop = jest.fn(() => Promise.resolve());
jest.mock('@/shared/utils/voice', () => ({ __esModule: true, default: { start: (...a: unknown[]) => mockStart(...a), stop: () => mockStop() } }));

/**
 * SESLE YAZ (2026-11-01, kullanıcı: "görev eklemedeki gibi sesli de girebilsin"). Görev formuyla AYNI
 * servis (VoiceService) ve aynı sözleşme: dinlerken söylenen alana yazılır (alan sınırında kesilir),
 * izin yoksa uyarı modalın ÜSTÜNDE görünür (AlertHost), ekran kapanınca/adım değişince dinleme durur.
 */
const METRICS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const Sheet = ({ visible = true }: { visible?: boolean }) => (
  <SafeAreaProvider initialMetrics={METRICS}><CaptureSheet visible={visible} demo onDone={jest.fn()} /></SafeAreaProvider>
);

describe('Aklında ne var — sesle yaz', () => {
  beforeEach(() => { useLanguageStore.setState({ language: 'tr' } as never); mockStart.mockReset(); mockStop.mockClear(); });

  it('mikrofona basınca dinler; söylenen alana yazılır', async () => {
    mockStart.mockImplementation(async (o: { onResults: (r: string[]) => void }) => o.onResults(['yarın market, her sabah koşu']));
    const ui = render(<Sheet />);
    fireEvent.press(ui.getByLabelText('Sesle yaz'));
    await waitFor(() => expect(ui.getByLabelText('Aklında ne var?').props.value).toBe('yarın market, her sabah koşu'));
    expect(mockStart).toHaveBeenCalledWith(expect.objectContaining({ language: 'tr-TR' }));
  });

  it('dinlerken düğme "durdur" olur ve ikinci basış durdurur', async () => {
    mockStart.mockImplementation(async () => {});
    const ui = render(<Sheet />);
    fireEvent.press(ui.getByLabelText('Sesle yaz'));
    await waitFor(() => expect(ui.getByLabelText('Dinlemeyi durdur')).toBeTruthy());
    fireEvent.press(ui.getByLabelText('Dinlemeyi durdur'));
    await waitFor(() => expect(mockStop).toHaveBeenCalled());
  });

  it('söylenen alan sınırında (600) kesilir', async () => {
    mockStart.mockImplementation(async (o: { onResults: (r: string[]) => void }) => o.onResults(['a'.repeat(700)]));
    const ui = render(<Sheet />);
    fireEvent.press(ui.getByLabelText('Sesle yaz'));
    await waitFor(() => expect(ui.getByLabelText('Aklında ne var?').props.value).toHaveLength(600));
  });

  it('izin yoksa uyarı gösterilir', async () => {
    mockStart.mockImplementation(async (o: { onError: (e: Error) => void }) => o.onError(new Error('permission-denied')));
    const ui = render(<Sheet />);
    fireEvent.press(ui.getByLabelText('Sesle yaz'));
    await waitFor(() => expect(ui.getByText('Mikrofon izni gerekli')).toBeTruthy());
  });

  it('ekran kapanınca dinleme durur', async () => {
    mockStart.mockImplementation(async () => {});
    const ui = render(<Sheet />);
    fireEvent.press(ui.getByLabelText('Sesle yaz'));
    await waitFor(() => expect(ui.getByLabelText('Dinlemeyi durdur')).toBeTruthy());
    mockStop.mockClear();
    ui.rerender(<Sheet visible={false} />);
    await waitFor(() => expect(mockStop).toHaveBeenCalled());
  });
});
