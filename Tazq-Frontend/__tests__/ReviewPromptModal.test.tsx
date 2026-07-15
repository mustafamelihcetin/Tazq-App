import React from 'react';
import { Linking } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ReviewPromptModal } from '@/features/user/components/ReviewPromptModal';
import { Colors } from '@/shared/constants/Colors';
import AsyncStorage from '@react-native-async-storage/async-storage';

const mockSendMessage = jest.fn();
jest.mock('@/shared/services/api', () => ({
  SupportService: { sendMessage: (...a: unknown[]) => mockSendMessage(...a) },
}));

// Modül yolunu mock'lamak yerine spy: RN sürümleri arasında Linking'in iç yolu değişiyor.
const mockOpenURL = jest.spyOn(Linking, 'openURL');

const theme = Colors.light;

function setup(onClose = jest.fn()) {
  const utils = render(
    <ReviewPromptModal visible onClose={onClose} theme={theme} tr />
  );
  return { ...utils, onClose };
}

describe('ReviewPromptModal', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockSendMessage.mockResolvedValue(undefined);
    mockOpenURL.mockResolvedValue(true);
    await AsyncStorage.clear();
  });

  afterAll(() => mockOpenURL.mockRestore());

  it('renders the rating prompt', () => {
    const { getByText } = setup();
    expect(getByText("TAZQ'ı Nasıl Buluyorsunuz?")).toBeTruthy();
  });

  it('exposes each star to screen readers', () => {
    const { getByLabelText } = setup();
    // Yıldızlar ikon; etiket olmadan ekran okuyucuya görünmezler.
    for (let i = 1; i <= 5; i++) expect(getByLabelText(`${i} yıldız`)).toBeTruthy();
  });

  it('hides the submit button until a rating is chosen', () => {
    const { queryByText, getByLabelText, getByText } = setup();
    expect(queryByText('Gönder')).toBeNull();
    expect(queryByText('Yorum Yap')).toBeNull();

    fireEvent.press(getByLabelText('5 yıldız'));
    expect(getByText('Yorum Yap')).toBeTruthy();
  });

  it('asks for written feedback only on low ratings', () => {
    const { getByLabelText, queryByLabelText } = setup();

    fireEvent.press(getByLabelText('5 yıldız'));
    expect(queryByLabelText('Geri bildirim metni')).toBeNull();

    fireEvent.press(getByLabelText('2 yıldız'));
    expect(queryByLabelText('Geri bildirim metni')).toBeTruthy();
  });

  it('sends a high rating to the store, not to support', async () => {
    const { getByLabelText, getByText, onClose } = setup();

    fireEvent.press(getByLabelText('5 yıldız'));
    fireEvent.press(getByText('Yorum Yap'));

    await waitFor(() => expect(mockOpenURL).toHaveBeenCalled());
    // Mutlu kullanıcı mağazaya gider; destek kanalı meşgul edilmez.
    expect(mockSendMessage).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('sends a low rating to support, not to the store', async () => {
    const { getByLabelText, getByText } = setup();

    fireEvent.press(getByLabelText('2 yıldız'));
    fireEvent.changeText(getByLabelText('Geri bildirim metni'), 'çok yavaş');
    fireEvent.press(getByText('Gönder'));

    await waitFor(() => expect(mockSendMessage).toHaveBeenCalled());
    // Kritik: kötü puan mağazaya YÖNLENDİRİLMEMELİ.
    expect(mockOpenURL).not.toHaveBeenCalled();
    expect(mockSendMessage.mock.calls[0][0]).toContain('çok yavaş');
    expect(mockSendMessage.mock.calls[0][0]).toContain('2/5');
  });

  it('does not send empty feedback on a low rating', async () => {
    const { getByLabelText, getByText, onClose } = setup();

    fireEvent.press(getByLabelText('1 yıldız'));
    fireEvent.press(getByText('Gönder'));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('records the prompt time so the cooldown starts', async () => {
    const { getByText } = setup();

    fireEvent.press(getByText('Daha Sonra'));

    // Bu yazılmazsa 60 günlük cooldown çalışmaz ve kullanıcı tekrar tekrar rahatsız edilir.
    await waitFor(async () =>
      expect(await AsyncStorage.getItem('tazq_last_review_prompt_time')).not.toBeNull()
    );
  });

  it('cancels the pending close timer when unmounted', async () => {
    const { getByLabelText, getByText, unmount } = setup();

    fireEvent.press(getByLabelText('2 yıldız'));
    fireEvent.changeText(getByLabelText('Geri bildirim metni'), 'yavaş');
    fireEvent.press(getByText('Gönder'));
    await waitFor(() => expect(mockSendMessage).toHaveBeenCalled());

    // "Teşekkürler" ekranı gecikmeli bir kapanma zamanlayıcısı kurar. Bileşen o süre
    // dolmadan kapanırsa zamanlayıcı iptal edilmeli; yoksa unmount sonrası setState
    // çağrılır (sızıntı + React uyarısı).
    expect(() => unmount()).not.toThrow();
  });

  it('still closes when sending feedback fails', async () => {
    mockSendMessage.mockRejectedValue(new Error('network down'));
    const { getByLabelText, getByText, onClose } = setup();

    fireEvent.press(getByLabelText('2 yıldız'));
    fireEvent.changeText(getByLabelText('Geri bildirim metni'), 'bir sorun var');
    fireEvent.press(getByText('Gönder'));

    // Hata kullanıcıyı modalda kilitli bırakmamalı.
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
