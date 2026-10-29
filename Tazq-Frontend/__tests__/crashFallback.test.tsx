/**
 * Madde 10 — hata güvenliği. Kullanıcı ham hata görmez, verinin güvende olduğunu
 * okur ve her durumda ana sayfaya güvenli dönebilir.
 */
import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { RouteErrorBoundary } from '@/shared/components/CrashFallback';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { reportRenderCrash } from '@/shared/utils/reportCrash';

const mockDismissTo = jest.fn();
let mockPath = '/tasks';
jest.mock('expo-router', () => ({
  router: { dismissTo: (...a: unknown[]) => mockDismissTo(...a) },
  usePathname: () => mockPath,
}));
jest.mock('@/shared/utils/reportCrash', () => ({ reportRenderCrash: jest.fn() }));
jest.mock('moti', () => {
  const { View } = require('react-native');
  return { MotiView: View };
});

const err = new Error('Rendered fewer hooks than expected');

beforeEach(() => {
  jest.clearAllMocks();
  mockPath = '/tasks';
  useLanguageStore.getState().setLanguage('tr');
});

describe('RouteErrorBoundary', () => {
  it('sakin metin + veri güvencesi; ham hata yalnız geliştirmede', () => {
    const { getByText } = render(<RouteErrorBoundary error={err} retry={jest.fn()} />);
    getByText('Küçük bir aksilik oldu');
    getByText(/Verilerin güvende/);
  });

  it('dil İngilizceyse İngilizce — iki dil iç içe değil', () => {
    useLanguageStore.getState().setLanguage('en');
    const { getByText, queryByText } = render(<RouteErrorBoundary error={err} retry={jest.fn()} />);
    getByText('A small hiccup');
    expect(queryByText('Küçük bir aksilik oldu')).toBeNull();
  });

  it('"Ana sayfaya dön" başka ekrandan ana sayfaya götürür', () => {
    const retry = jest.fn();
    const { getByLabelText } = render(<RouteErrorBoundary error={err} retry={retry} />);
    fireEvent.press(getByLabelText('Ana sayfaya dön'));
    expect(mockDismissTo).toHaveBeenCalledWith('/');
    expect(retry).not.toHaveBeenCalled();
  });

  it('çöken ekran ana sayfanın kendisiyse döngüye girmez, yeniden dener', () => {
    mockPath = '/';
    const retry = jest.fn();
    const { getByLabelText } = render(<RouteErrorBoundary error={err} retry={retry} />);
    fireEvent.press(getByLabelText('Ana sayfaya dön'));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(mockDismissTo).not.toHaveBeenCalled();
  });

  it('çökme bir kez raporlanır (yeniden çizimde tekrar değil)', () => {
    const { rerender } = render(<RouteErrorBoundary error={err} retry={jest.fn()} />);
    rerender(<RouteErrorBoundary error={err} retry={jest.fn()} />);
    expect(reportRenderCrash).toHaveBeenCalledTimes(1);
  });
});

describe('kök ErrorBoundary', () => {
  const Boom = () => { throw err; };

  it('yakalar, raporlar ve aynı yedek ekranı gösterir', () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const { getByText } = render(<ErrorBoundary><Boom /></ErrorBoundary>);
    getByText('Küçük bir aksilik oldu');
    expect(reportRenderCrash).toHaveBeenCalledTimes(1);
  });

  it('"Tekrar dene" çocukları yeniden kurar', () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    let fail = true;
    const Flaky = () => { if (fail) throw err; return <Text>iyi</Text>; };
    const { getByLabelText, getByText } = render(<ErrorBoundary><Flaky /></ErrorBoundary>);
    fail = false;
    fireEvent.press(getByLabelText('Tekrar dene'));
    getByText('iyi');
  });
});
