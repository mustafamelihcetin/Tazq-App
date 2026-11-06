import fs from 'fs';
import path from 'path';
import { amountField, parseAmount } from '@/features/payments/utils/money';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

describe('yazılan tutar', () => {
  it('Türkçe binlik: on iki bin 12 olmaz', () => {
    expect(parseAmount('12.000')).toBe(12000);
    expect(parseAmount('1.234.567')).toBe(1234567);
    expect(parseAmount('12.000,50')).toBe(12000.5);
  });
  it('İngilizce biçim', () => {
    expect(parseAmount('12,000')).toBe(12000);
    expect(parseAmount('12,000.50')).toBe(12000.5);
  });
  it('ondalık', () => {
    expect(parseAmount('12,5')).toBe(12.5);
    expect(parseAmount('12.50')).toBe(12.5);
    expect(parseAmount('799,99')).toBe(799.99);
  });
  it('düz sayı, boş, çöp', () => {
    expect(parseAmount('12000')).toBe(12000);
    expect(parseAmount('')).toBe(0);
    expect(parseAmount('abc')).toBe(0);
    expect(parseAmount('12 000 ₺')).toBe(12000);
  });
  it('düzenleme alanı geri okunur', () => {
    expect(parseAmount(amountField(12000, 'tr-TR'))).toBe(12000);
    expect(parseAmount(amountField(799.99, 'tr-TR'))).toBe(799.99);
    expect(parseAmount(amountField(12000.5, 'en-US'))).toBe(12000.5);
  });
});

describe('ödeme formu ve satırı', () => {
  const form = read('features/payments/components/PaymentForm.tsx');
  const row = read('features/payments/components/PaymentRow.tsx');
  it('şablon tek yerde: ayrı Tür bölümü yok', () => {
    expect(form).toContain('const suggestions = useMemo');
    expect(read('features/payments/components/PaymentAppearance.tsx')).not.toContain('PAYMENT_KINDS');
  });
  it('satır düzenler, ödendi yalnız halkadan', () => {
    expect(row).toContain('onPress={onEdit}');
    expect(row).toContain('onPress={onToggle}');
    expect(row.indexOf('onPress={onEdit}')).toBeLessThan(row.indexOf('onPress={onToggle}'));
  });
  it('satırdan geri alınca ödenen toplamı tazelenir', () => {
    expect(read('app/odemeler.tsx')).toContain('unmarkPaymentPaidAction(v.p.id).finally(loadHistory)');
  });
});
