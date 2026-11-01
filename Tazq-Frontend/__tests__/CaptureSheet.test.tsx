import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CaptureSheet } from '@/features/onboarding/components/CaptureSheet';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { useNetworkStore } from '@/shared/store/useNetworkStore';
import { useTaskStore } from '@/features/tasks/store/useTaskStore';
import { useHabitStore } from '@/features/habits/store/useHabitStore';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';

/**
 * "AKLINDAKİLERİ YAZ" EKRANI (C2–C4) — kullanıcının gördüğü akış uçtan uca:
 * yaz → canlı çipler → Devam → "Şunları anladım" (tür değiştir, çıkar) → Planıma ekle.
 */
const METRICS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const Sheet = (p: { onDone: jest.Mock }) => (
  <SafeAreaProvider initialMetrics={METRICS}><CaptureSheet visible onDone={p.onDone} /></SafeAreaProvider>
);

describe('CaptureSheet', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    useLanguageStore.setState({ language: 'tr' } as never);
    useNetworkStore.setState({ isOnline: false } as never);
    useTaskStore.setState({ tasks: [] } as never);
    useHabitStore.setState({ habits: [] } as never);
    usePrefsStore.getState().resetUserData();
  });
  afterEach(() => jest.useRealTimers());

  it('örnek cümleye dokununca alan dolar ve canlı çipler çıkar', () => {
    const ui = render(<Sheet onDone={jest.fn()} />);
    fireEvent.press(ui.getByLabelText('Örnek: faturayı öde, annemi ara, haftada 3 gün spor'));
    act(() => { jest.advanceTimersByTime(300); });
    expect(ui.getByText('Faturayı öde')).toBeTruthy();
    expect(ui.getByText('Annemi ara')).toBeTruthy();
    expect(ui.getByText('Spor')).toBeTruthy();
    expect(ui.getByLabelText('Devam (3)')).toBeTruthy();
  });

  it('önizlemede tür değişir, madde çıkarılır, eklenen sayı onDone\'a gider', async () => {
    const onDone = jest.fn();
    const ui = render(<Sheet onDone={onDone} />);
    fireEvent.changeText(ui.getByLabelText('Aklında ne var?'), 'yarın kitap oku, markete git');
    act(() => { jest.advanceTimersByTime(300); });
    fireEvent.press(ui.getByLabelText('Devam (2)'));
    expect(ui.getByText('Şunları anladım')).toBeTruthy();

    fireEvent.press(ui.getByLabelText('Kitap oku: Görev. Türünü değiştir'));
    expect(ui.getByLabelText('Kitap oku: Alışkanlık. Türünü değiştir')).toBeTruthy();
    fireEvent.press(ui.getByLabelText('Markete git maddesini çıkar'));

    jest.useRealTimers();
    fireEvent.press(ui.getByLabelText('Planıma ekle (1)'));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith({ tasks: 0, habits: 1 }));
    expect(useHabitStore.getState().habits.map(h => h.name)).toEqual(['Kitap oku']);
    expect(usePrefsStore.getState().firstCapture).toMatchObject({ result: 'wrote', items: 1, habits: 1 });
  });

  it('mod önerisi zorlamaz; dokununca kabul edilir ve tarihiyle açılır', async () => {
    const onDone = jest.fn();
    const ui = render(<Sheet onDone={onDone} />);
    fireEvent.changeText(ui.getByLabelText('Aklında ne var?'), 'sınavım 12 aralıkta, her gün matematik çalış');
    act(() => { jest.advanceTimersByTime(300); });
    fireEvent.press(ui.getByLabelText('Devam (1)'));
    fireEvent.press(ui.getByRole('switch'));
    jest.useRealTimers();
    fireEvent.press(ui.getByLabelText('Planıma ekle (1)'));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(usePrefsStore.getState().seasonal.examMode).toBe(true);
    expect(usePrefsStore.getState().seasonal.examDate).toMatch(/-12-12$/);
  });

  it('hızlı yazan beklemez: sayım gelmeden de Devam açık ve son yazılanla ayrıştırır', () => {
    const ui = render(<Sheet onDone={jest.fn()} />);
    fireEvent.changeText(ui.getByLabelText('Aklında ne var?'), 'markete git');
    fireEvent.press(ui.getByLabelText('Devam'));
    expect(ui.getByText('Şunları anladım')).toBeTruthy();
  });

  it('Atla: hiçbir şey eklenmez, ölçüm "skipped"', async () => {
    const onDone = jest.fn();
    const ui = render(<Sheet onDone={onDone} />);
    jest.useRealTimers();
    fireEvent.press(ui.getByLabelText('Atla'));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith({ tasks: 0, habits: 0 }));
    expect(usePrefsStore.getState().firstCapture).toMatchObject({ result: 'skipped' });
  });
});

describe('CaptureSheet — deneme kipi (geliştirici galerisi)', () => {
  beforeEach(() => {
    useLanguageStore.setState({ language: 'tr' } as never);
    useNetworkStore.setState({ isOnline: false } as never);
    useTaskStore.setState({ tasks: [] } as never);
    useHabitStore.setState({ habits: [] } as never);
    usePrefsStore.getState().resetUserData();
  });

  it('Planıma ekle hiçbir şey kaydetmez, ölçüme dokunmaz; yine de sayıları bildirir', async () => {
    const onDone = jest.fn();
    const ui = render(<SafeAreaProvider initialMetrics={METRICS}><CaptureSheet visible demo onDone={onDone} /></SafeAreaProvider>);
    fireEvent.changeText(ui.getByLabelText('Aklında ne var?'), 'markete git, her sabah koşu');
    fireEvent.press(ui.getByLabelText('Devam'));
    fireEvent.press(ui.getByLabelText('Planıma ekle (2)'));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith({ tasks: 1, habits: 1 }));
    expect(useTaskStore.getState().tasks).toHaveLength(0);
    expect(useHabitStore.getState().habits).toHaveLength(0);
    expect(usePrefsStore.getState().firstCapture).toBeNull();
  });

  it('galeride bir düğmeyle açılır', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'app/dev-gallery.tsx'), 'utf8');
    expect(src).toContain('<CaptureSheet visible={capture} demo');
  });
});

describe('CaptureSheet — sınırlar ekranda söylenir', () => {
  beforeEach(() => {
    useLanguageStore.setState({ language: 'tr' } as never);
    useHabitStore.setState({ habits: [] } as never);
    usePrefsStore.getState().resetUserData();
  });
  const sheet = () => render(<SafeAreaProvider initialMetrics={METRICS}><CaptureSheet visible demo onDone={jest.fn()} /></SafeAreaProvider>);

  it('yazı alanı 600 karakterde durur; sayaç 480\'den sonra görünür', () => {
    const ui = sheet();
    const input = ui.getByLabelText('Aklında ne var?');
    expect(input.props.maxLength).toBe(600);
    expect(ui.queryByText(/\/600$/)).toBeNull();
    fireEvent.changeText(input, 'a'.repeat(500));
    expect(ui.getByText('500/600')).toBeTruthy();
  });

  it('12\'den fazla madde: kaç tanesinin alınmadığı söylenir', () => {
    const ui = sheet();
    fireEvent.changeText(ui.getByLabelText('Aklında ne var?'), Array.from({ length: 14 }, (_, i) => `iş ${i + 1} yap`).join(', '));
    fireEvent.press(ui.getByLabelText('Devam'));
    expect(ui.getByText('İlk 12 madde alındı; kalan 2 maddeyi sonra ekleyebilirsin.')).toBeTruthy();
  });

  it('alışkanlık yeri dolunca hangilerinin görev olarak ekleneceği söylenir', () => {
    useHabitStore.setState({ habits: Array.from({ length: 6 }, (_, i) => ({ id: `h${i}`, name: `h${i}`, emoji: '✨', color: '#000', completedDates: [], createdAt: '' })) } as never);
    const ui = sheet();
    fireEvent.changeText(ui.getByLabelText('Aklında ne var?'), 'her gün koşu, her gün kitap oku, her gün su iç');
    fireEvent.press(ui.getByLabelText('Devam'));
    expect(ui.getByText('Alışkanlık sınırı 7: 2 madde görev olarak eklenecek.')).toBeTruthy();
  });

  it('önizlemede başlık alanı türün sınırında durur (görev 100, alışkanlık 40)', () => {
    const ui = sheet();
    fireEvent.changeText(ui.getByLabelText('Aklında ne var?'), 'markete git, her sabah koşu');
    fireEvent.press(ui.getByLabelText('Devam'));
    expect(ui.getByLabelText('Görev').props.maxLength).toBe(100);
    expect(ui.getByLabelText('Alışkanlık').props.maxLength).toBe(40);
  });
});

/**
 * ÖRNEKLERİN AMACI ÖĞRETMEK (2026-11-01, kullanıcı: "13 aralıkta indiren için 365 gün sonraya mı kuracak?").
 * Örnek bir şablon değil, "böyle yazarsan anlarım" gösterimidir: dokununca alan dolar, çipler doğar,
 * kullanıcı kalıbı kendi işleriyle tekrarlar. Bu yüzden her gün GEÇERLİ olmalı: sabit tarih yok
 * (yarın, haftada 3, 3 hafta sonra), ve her örnek motorun gerçekten anladığı maddeler üretir.
 */
describe('örnekler her gün geçerli', () => {
  const { capture: parse } = require('@/features/tasks/nlp/capture');
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'features/onboarding/components/CaptureSheet.tsx'), 'utf8');
  const examples = (lang: 'tr' | 'en'): string[] => {
    const block = src.slice(src.indexOf(`${lang}: {`), src.indexOf('locale:', src.indexOf(`${lang}: {`)));
    return JSON.parse(block.match(/examples: (\[[^\]]+\])/)[1].replace(/'/g, '"'));
  };

  it.each(['tr', 'en'] as const)('%s: sabit tarih (ay adı, gün/ay) yok', (lang) => {
    for (const ex of examples(lang)) {
      expect(ex).not.toMatch(/ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık|january|february|march|april|june|july|august|september|october|november|december|\d{1,2}[./]\d{1,2}/i);
    }
  });

  it.each(['tr', 'en'] as const)('%s: her örnek anlaşılır maddeler üretir; mod örneği tarihini göreli bulur', (lang) => {
    const now = new Date(2026, 11, 13, 10, 0); // 13 Aralık — sabit "12 aralık" burada 365 gün sonrası olurdu
    const results = examples(lang).map((ex) => parse(ex, lang, now));
    for (const r of results) expect(r.items.length).toBeGreaterThan(0);
    const mode = results.flatMap((r) => r.modes).find((m) => m.mode === 'exam');
    expect(mode?.date).toBe('2027-01-03'); // 3 hafta sonra
  });
});
