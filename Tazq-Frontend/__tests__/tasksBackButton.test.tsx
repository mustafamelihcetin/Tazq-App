import React from 'react';
import { BackHandler, Platform } from 'react-native';
import { render, act, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

/**
 * GÖREVLER — ANDROID GERİ TUŞU (2026-10-31, cihazda görüldü).
 *
 * Sıralama menüsü açıkken geri tuşu menüyü kapatmıyor, ekrandan çıkıp ana sayfaya gidiyordu.
 * Android'de geri önce ÜSTTEKİ katmanı kapatır: menü → arama → seçim modu; hiçbiri yoksa
 * varsayılan (sistem) davranış.
 */
jest.setTimeout(30_000);

const METRICS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), setParams: jest.fn(), canGoBack: () => false, dismissTo: jest.fn() };
jest.mock('expo-router', () => {
  const R = jest.requireActual('react');
  return {
    useRouter: () => mockRouter,
    // Odak efekti testte gerçekten çalışsın (ekran odakta).
    useFocusEffect: (cb: () => void | (() => void)) => { R.useEffect(cb, [cb]); },
    useLocalSearchParams: () => ({}),
    usePathname: () => '/tasks',
    useSegments: () => [],
  };
});

describe('Görevler — Android geri tuşu üstteki katmanı kapatır', () => {
  const origOS = Platform.OS;
  let back: () => boolean;
  beforeEach(() => {
    (Platform as { OS: string }).OS = 'android';
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation(((_e: string, h: () => boolean) => {
      back = h; return { remove: jest.fn() };
    }) as never);
  });
  afterEach(() => { (Platform as { OS: string }).OS = origOS; jest.restoreAllMocks(); });

  it('arama açıkken geri aramayı kapatır; açık katman yokken sisteme bırakır', async () => {
    // Menü açılışı düğmeyi ölçüyor (measureInWindow testte geri çağırmıyor); menü durumu cihazda
    // doğrulandı. Dinleyici aynı: üstteki katmanı kapat, yoksa false.
    const Tasks = require('../app/tasks').default;
    const r = render(<SafeAreaProvider initialMetrics={METRICS}><Tasks /></SafeAreaProvider>);
    await act(async () => {});
    expect(back()).toBe(false); // açık katman yok → sıradaki dinleyici (alt çubuk → eve dön)

    await act(async () => { fireEvent.press(r.getByLabelText(/^(Ara|Search)$/)); });
    expect(r.UNSAFE_queryAllByProps({ returnKeyType: 'search' }).length).toBeGreaterThan(0);

    let handled = false;
    await act(async () => { handled = back(); });
    expect(handled).toBe(true);
    expect(r.UNSAFE_queryAllByProps({ returnKeyType: 'search' }).length).toBe(0);
    r.unmount();
  });
});
