/**
 * Madde 3 — mod görevinin iki dilli yükü (description = {"tr","en",...}) düzenleme
 * formunda HAM JSON olarak "Notlar" alanına düşüyordu. Kullanıcı bir harf değiştirse
 * JSON bozuluyor, başlık artık iki dilde çevrilemiyor ve motor görevi tanımıyordu.
 * Kural: yük kilitli, kaydederken OLDUĞU GİBİ korunur; güvenli alanlar serbest.
 */
import { isModeContentTask, protectModeContent } from '@/features/tasks/utils/modeTaskEdit';

const payload = JSON.stringify({ tr: 'Su iç', en: 'Drink water', descTr: '2 bardak', descEn: '2 glasses' });
const modeTask = { title: 'Su iç', description: payload };

describe('mod görevi düzenleme koruması', () => {
  it('iki dilli yük taşıyan görev mod içeriğidir', () => {
    expect(isModeContentTask(modeTask)).toBe(true);
    expect(isModeContentTask({ title: 'Süt al', description: 'market' })).toBe(false);
    expect(isModeContentTask({ title: 'x', description: null })).toBe(false);
    expect(isModeContentTask(null)).toBe(false);
  });

  it('kaydederken başlık ve yük OLDUĞU GİBİ korunur — formda ne yazarsa yazsın', () => {
    const out = protectModeContent(modeTask, { title: 'Drink water', description: '2 glasses (bozuk' });
    expect(out.title).toBe('Su iç');
    expect(out.description).toBe(payload);
    expect(() => JSON.parse(out.description)).not.toThrow();
  });

  it('normal görevde formdaki değer geçer', () => {
    const out = protectModeContent({ title: 'Süt al', description: '' }, { title: 'Süt al 2L', description: ' not ' });
    expect(out).toEqual({ title: 'Süt al 2L', description: 'not' });
  });

  it('yeni görev (task yok) formdaki değeri alır', () => {
    expect(protectModeContent(null, { title: 'A', description: 'b' })).toEqual({ title: 'A', description: 'b' });
  });
});
