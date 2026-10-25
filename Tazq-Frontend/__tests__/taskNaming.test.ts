import { translations } from '@/shared/constants/i18n';

/**
 * ADLANDIRMA (2026-10-25): görev formu "Yeni Hedef" diyordu, ürünün geri kalanı "görev".
 * Karar: iş birimi GÖREV; "hedef" yalnız Modlar'daki uzun vadeli hedeflere (Kilo/Birikim
 * hedefi) ait — iki kavram çakışmasın. İngilizcede askerî ton ("Terminate Objective",
 * "Active Mission") yerine sade "Task".
 */
describe('görev adlandırması', () => {
  it('TR: görev eylemleri "görev" der', () => {
    const t = translations.tr as Record<string, unknown>;
    expect([t.addTask, t.editTask, t.deleteTask, t.newTask, t.tasks]).toEqual(['Yeni Görev', 'Görevi Düzenle', 'Görevi Sil', 'Görev Ekle', 'GÖREVLER']);
  });

  it('EN: askerî ton yok', () => {
    const flat = JSON.stringify(translations.en);
    expect(flat).not.toMatch(/Objective|Mission|Terminate/);
  });
});
