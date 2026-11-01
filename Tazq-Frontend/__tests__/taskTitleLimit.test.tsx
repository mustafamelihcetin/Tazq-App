import React from 'react';
import fs from 'fs';
import path from 'path';
import { render } from '@testing-library/react-native';
import { clampTitle, CAPTURE_LIMITS } from '@/features/tasks/nlp/capture';
import { TASK_LIMITS } from '@/features/tasks/limits';
import { FieldLimitNote } from '@/features/tasks/components/FieldLimitNote';

/*
  GÖREV METİN SINIRLARI TEK YERDE (2026-11-01). Görev formu başlığa 150 karaktere izin veriyordu,
  sunucu 100'ün üstünü reddediyor: uzun başlık kaydedilemiyordu. Not formda 500, sunucuda sınırsızdı.
  Kullanıcı: "ideal karakter sayısına kadar izin verilmeli, detayı aşağı girsin; onun da sınırı olacak".
*/
const ROOT = path.resolve(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const validator = fs.readFileSync(path.join(ROOT, '..', 'Tazq-Backend', 'Validators', 'TaskRequestDtoValidator.cs'), 'utf8');

describe('görev metin sınırları', () => {
  it('başlık: sunucunun sınırı, formun ve ayrıştırıcının tek sabiti', () => {
    const m = /RuleFor\(x => x\.Title\)[\s\S]*?MaximumLength\((\d+)\)/.exec(validator);
    expect(Number(m?.[1])).toBe(TASK_LIMITS.title);
    expect(CAPTURE_LIMITS.taskTitle).toBe(TASK_LIMITS.title);
  });

  it('not: sunucuda da sınır var ve kullanıcı notunun sınırından geniş (mod yükü aynı alanda)', () => {
    const m = /RuleFor\(x => x\.Description\)[\s\S]*?MaximumLength\((\d+)\)/.exec(validator);
    expect(Number(m?.[1])).toBeGreaterThanOrEqual(TASK_LIMITS.description);
  });

  it('form iki alanda da aynı sabitleri kullanır; kayıtta sesle yazılan da kısaltılır, mod yükü korunur', () => {
    const form = read('features/tasks/components/TaskFormModal.tsx');
    // Alan değerden kısa olamaz (bkz. fitMaxLength — iPhone çökmesi); yeni yazım yine TASK_LIMITS'te kesilir.
    expect(form).toContain('maxLength={fitMaxLength(TASK_LIMITS.title, form.title)}');
    expect(form).toContain('maxLength={fitMaxLength(TASK_LIMITS.description, form.description)}');
    expect(form).not.toMatch(/maxLength=\{(150|500)\}/);
    expect(form).toMatch(/const title = isModeContentTask\(task\) \? kept\.title : clampTitle\([\s\S]*TASK_LIMITS\.title\)/);
    expect(form).toContain('description: isModeContentTask(task) ? kept.description : kept.description.slice(0, TASK_LIMITS.description)');
  });

  it('kısaltma kelime sınırından, sınırın altında ve sonda boşluk bırakmadan', () => {
    const long = 'yöneticiye gönderilecek proje raporunun bütün bölümlerini tek tek gözden geçir ve eksik kaynakları tamamla lütfen';
    const t = clampTitle(long, TASK_LIMITS.title);
    expect(t.length).toBeLessThanOrEqual(100);
    expect(long.startsWith(t)).toBe(true);
    expect(t.endsWith(' ')).toBe(false);
    // Son kelime silinmez (eski bozuk ifade harf aralığıyla son kelimeyi yiyordu).
    expect(t.split(' ').length).toBeGreaterThan(10);
  });
});

describe('sınır notu (FieldLimitNote)', () => {
  const props = { description: '', language: 'tr', color: '#666', warn: '#B45309' };

  it('kısa başlıkta görünmez', () => {
    const v = render(<FieldLimitNote {...props} title={'a'.repeat(40)} />);
    expect(v.toJSON()).toBeNull();
  });

  it('başlık uzayınca sayaç ve ayrıntının yeri söylenir — sınıra çarpmadan önce', () => {
    const v = render(<FieldLimitNote {...props} title={'a'.repeat(TASK_LIMITS.titleHint)} />);
    expect(v.getByText(`${TASK_LIMITS.titleHint}/${TASK_LIMITS.title} · Ayrıntıları notlara yazabilirsin`)).toBeTruthy();
  });

  it('not sınıra yaklaşınca not sayacı', () => {
    const v = render(<FieldLimitNote {...props} title="kısa" description={'b'.repeat(950)} />);
    expect(v.getByText(`950/${TASK_LIMITS.description}`)).toBeTruthy();
  });
});
