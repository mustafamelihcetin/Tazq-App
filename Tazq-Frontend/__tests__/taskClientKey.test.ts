import fs from 'fs';
import path from 'path';
import { newTaskKey, nextInstanceKey } from '@/features/tasks/utils/clientKey';

/**
 * AYNI GÖREV İKİ KEZ OLUŞMAZ — istemci tarafı.
 *
 * Canlı veride aynı görevin ardışık numaralı ikizleri bulundu. Elle eklenen görevler
 * anahtarsız gidiyordu: zaman aşımı "ağ yok" sayılıp görev kuyruğa da konuyor, sunucu
 * ilkini zaten oluşturmuş olduğu için kuyruk ikincisini oluşturuyordu. Sunucu aynı
 * anahtarlı ikinci isteği reddediyor (bkz. Tazq-Backend.Tests/RecurrenceIdempotencyTests);
 * bu test, istemcinin anahtarı GERÇEKTEN gönderdiğini sabitler.
 */
const ROOT = path.join(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('anahtar', () => {
  it('her görev için farklı ve sunucu sınırına (64) sığar', () => {
    const keys = new Set(Array.from({ length: 500 }, newTaskKey));
    expect(keys.size).toBe(500);
    for (const k of keys) expect(k.length).toBeLessThanOrEqual(64);
  });

  it('sonraki örneğin anahtarı DETERMİNİSTİK — tamamla/geri al/tamamla aynı örneği üretmez', () => {
    expect(nextInstanceKey(42, '2026-09-27')).toBe(nextInstanceKey(42, '2026-09-27T00:00:00Z'));
    expect(nextInstanceKey(42, '2026-09-27')).not.toBe(nextInstanceKey(42, '2026-10-27'));
  });
});

describe('görev oluşturan her yol anahtar taşır', () => {
  it('görev formu: anahtar BİR KEZ üretilir ve hem ilk istekte hem hata yolunda aynıdır', () => {
    const src = read('app/tasks.tsx');
    expect((src.match(/newTaskKey\(\)/g) ?? []).length).toBe(1);
    expect((src.match(/\.\.\.createKey,/g) ?? []).length).toBe(2);
  });

  it('başlıktan gelen tekrarın sonraki örneği deterministik anahtarla', () => {
    expect(read('app/tasks.tsx')).toContain('clientKey: nextInstanceKey(task.id, base.dueDate)');
  });

  it('hızlı ekleme ve palet', () => {
    expect(read('app/index.tsx')).toContain('clientKey: newTaskKey(),');
  });
});
