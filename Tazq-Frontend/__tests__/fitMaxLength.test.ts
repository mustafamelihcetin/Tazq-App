import fs from 'fs';
import path from 'path';
import { fitMaxLength } from '@/shared/utils/fitMaxLength';

/*
  iPHONE'DA ÇÖKME (2026-11-01, kullanıcı: "düzenle deyince crash oldu, direkt kapandı"). Görev başlığı
  sınırı 150'den 100'e indi; eski, 100'den uzun başlıklı görev düzenlenince iOS metin alanı kendi
  maxLength'inden uzun bir değerle açıldı ve uygulama kapandı. Kural: kayıtlı veriyi yükleyen hiçbir
  alanın maxLength'i değerden kısa olamaz.
*/
const ROOT = path.resolve(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

describe('fitMaxLength', () => {
  it('kısa değerde sınırın kendisi', () => {
    expect(fitMaxLength(100, 'kısa')).toBe(100);
    expect(fitMaxLength(100, null)).toBe(100);
  });

  it('uzun değerde değerin uzunluğu — eski veri kırpılmaz, alan çökmez', () => {
    expect(fitMaxLength(100, 'a'.repeat(140))).toBe(140);
  });

  it.each([
    ['features/tasks/components/TaskFormModal.tsx', 'fitMaxLength(TASK_LIMITS.title, form.title)'],
    ['features/tasks/components/TaskFormModal.tsx', 'fitMaxLength(TASK_LIMITS.description, form.description)'],
    ['features/habits/components/NewHabitForm.tsx', 'fitMaxLength(40, name)'],
    ['app/profile.tsx', 'fitMaxLength(50, newName)'],
    ['app/profile.tsx', 'fitMaxLength(60, newMotto)'],
    ['features/user/components/ProfileSetupModal.tsx', 'fitMaxLength(30, name)'],
    ['features/modes/components/modes/ExamNameField.tsx', 'fitMaxLength(60, name)'],
  ])('kayıtlı veriyi yükleyen alan korumalı: %s', (file, call) => {
    expect(read(file)).toContain(`maxLength={${call}}`);
  });

  it('açılan görevde başlık iOS’ta yeniden ölçülür (satır sınırı değişince yeniden kurulur)', () => {
    const row = read('features/tasks/components/TaskListItem.tsx');
    expect(row).toMatch(/key=\{isExpanded \? 'open' : 'closed'\}[\s\S]{0,200}numberOfLines=\{isExpanded \? 0 : 1\}/);
  });
});
