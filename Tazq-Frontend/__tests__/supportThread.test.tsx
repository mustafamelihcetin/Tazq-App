import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SupportThread } from '@/shared/components/SupportThread';

/** Destek konuşması: iki taraf aynı görünüm; kapalı konuşmada kimin bitirdiği yazar, yazma kutusu çıkmaz. */
const entries = [
  { fromStaff: false, body: 'Senkron çalışmıyor', at: '2026-10-30T10:00:00Z' },
  { fromStaff: true, body: 'Sürümü güncelle', at: '2026-10-30T11:00:00Z' },
];
const base = { entries, lang: 'tr' as const, draft: '', onDraft: jest.fn(), onSend: jest.fn(), sending: false };

describe('SupportThread', () => {
  it('kullanıcı gözünden: karşı taraf "Tazq Destek", kendisi "Sen"; yazıp gönderir', () => {
    const onSend = jest.fn();
    const r = render(<SupportThread {...base} viewer="user" draft="Güncelledim" onSend={onSend} onClose={jest.fn()} />);
    expect(r.getByText(/^Sen · /)).toBeTruthy();
    expect(r.getByText(/^Tazq Destek · /)).toBeTruthy();
    fireEvent.press(r.getByLabelText('Gönder'));
    expect(onSend).toHaveBeenCalled();
    expect(r.getByText('Konuşmayı bitir')).toBeTruthy();
  });

  it('ekip gözünden: karşı taraf kullanıcının adı', () => {
    const r = render(<SupportThread {...base} viewer="staff" otherName="Ayşe" />);
    expect(r.getByText(/^Ayşe · /)).toBeTruthy();
    expect(r.getByText(/^Ekip · /)).toBeTruthy();
  });

  it('kapalı konuşma: kimin bitirdiği yazar, yazma kutusu ve bitir düğmesi yok', () => {
    const r = render(<SupportThread {...base} viewer="user" closedBy="staff" onClose={jest.fn()} />);
    expect(r.getByText('Destek konuşmayı bitirdi')).toBeTruthy();
    expect(r.queryByLabelText('Yanıt yaz…')).toBeNull();
    expect(r.queryByText('Konuşmayı bitir')).toBeNull();
  });

  it('ekibi beklemeden çok yazınca "yanıtımızı bekle" der', () => {
    const r = render(<SupportThread {...base} viewer="user" canReply={false} />);
    expect(r.getByText(/Yanıtımızı bekle/)).toBeTruthy();
    expect(r.queryByLabelText('Yanıt yaz…')).toBeNull();
  });
});
