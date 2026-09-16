import {
  parseIntervalFromTitle, addInterval, buildNextIntervalInstance, wantsReminder, normalizeTitle,
} from '@/features/tasks/utils/recurrenceInterval';

/**
 * BAŞLIKTAN TEKRAR ARALIĞI — "iki günde bir su iç".
 *
 * ── NEDEN BU TEST VAR ─────────────────────────────────────────────────────────
 * Ayrıştırıcı 2500 satırlık ekranın içine gömülüydü ve test edilemiyordu. İçinde
 * Türkçeye özgü bir kusur yaşıyordu: `toLowerCase()` 'İ' harfini 'i' değil,
 * 'i' + birleşen nokta (U+0307) yapıyor. Yani "İki günde bir" başlığı desendeki düz
 * 'iki' ile HİÇ eşleşmiyor, cümle başını büyük harfle yazan kullanıcının tekrarlayan
 * görevi bir daha üretilmiyordu.
 *
 * Bu, kullanıcının nasıl YAZDIĞINA bağlı bir hata: küçük harfle yazanda çalışıyor,
 * büyük harfle yazanda çalışmıyor. Kullanıcıya "bazen çalışıyor" diye görünür ve tam
 * da bu yüzden bildirilmesi en zor hatalardandır.
 */

describe('Türkçe büyük harf tuzağı', () => {
  it("'İ' ile başlayan kalıp da tanınıyor", () => {
    /*
      Kusurun ta kendisi. Aşağıdaki iki başlık kullanıcı için AYNI şeydir; eskiden
      yalnız ikincisi çalışıyordu.
    */
    expect(parseIntervalFromTitle('İki günde bir su iç')).toEqual({ count: 2, unit: 'day' });
    expect(parseIntervalFromTitle('iki günde bir su iç')).toEqual({ count: 2, unit: 'day' });
  });

  it("düz `toLowerCase()` bu işi yapamaz — regresyon kapısı", () => {
    // Belge niteliğinde: 'İ'.toLowerCase() iki kod birimi üretir, 'iki' ile eşleşmez.
    expect('İ'.toLowerCase()).not.toBe('i');
    expect('İki'.toLowerCase().startsWith('iki')).toBe(false);
    // Yardımcı doğru sonucu veriyor.
    expect(normalizeTitle('İki')).toBe('iki');
  });

  it('tamamı büyük yazılmış başlık da tanınıyor', () => {
    expect(parseIntervalFromTitle('ÜÇ HAFTADA BİR RAPOR')).toEqual({ count: 3, unit: 'week' });
  });

  it("İngilizce başlıklar Türkçe yerelden ZARAR GÖRMÜYOR", () => {
    // Türkçe yerel 'I' → 'ı' yapar; anahtar kelimelerin hiçbirinde 'I' geçmiyor.
    expect(parseIntervalFromTitle('Every 3 days: Check Inbox')).toEqual({ count: 3, unit: 'day' });
    expect(parseIntervalFromTitle('EVERY TWO WEEKS — INVOICES')).toEqual({ count: 2, unit: 'week' });
  });
});

describe('aralık okuma', () => {
  it('Türkçe sayı sözcükleri', () => {
    expect(parseIntervalFromTitle('her beş günde bir')).toEqual({ count: 5, unit: 'day' });
    expect(parseIntervalFromTitle('altı ayda bir kontrol')).toEqual({ count: 6, unit: 'month' });
    expect(parseIntervalFromTitle('dört haftada bir')).toEqual({ count: 4, unit: 'week' });
  });

  it('rakamlar', () => {
    expect(parseIntervalFromTitle('her 10 günde bir')).toEqual({ count: 10, unit: 'day' });
    expect(parseIntervalFromTitle('every 2 months')).toEqual({ count: 2, unit: 'month' });
  });

  it('"gün aşırı" iki güne karşılık geliyor', () => {
    expect(parseIntervalFromTitle('gün aşırı koş')).toEqual({ count: 2, unit: 'day' });
    expect(parseIntervalFromTitle('Run every other day')).toEqual({ count: 2, unit: 'day' });
  });

  it('kalıp yoksa null — her görev tekrarlıyor sanılmasın', () => {
    expect(parseIntervalFromTitle('Raporu bitir')).toBeNull();
    expect(parseIntervalFromTitle('')).toBeNull();
    expect(parseIntervalFromTitle(null)).toBeNull();
    expect(parseIntervalFromTitle(undefined)).toBeNull();
  });

  it('saçma aralıklar sınırlanıyor — takvim taşmasın', () => {
    // "her 99999 günde bir" gerçek bir niyet değil; 365 güne çekiliyor.
    expect(parseIntervalFromTitle('her 99999 günde bir')).toEqual({ count: 365, unit: 'day' });
    expect(parseIntervalFromTitle('her 0 günde bir')).toEqual({ count: 1, unit: 'day' });
  });
});

describe('tarih ilerletme', () => {
  const base = new Date(2026, 8, 15); // 15 Eylül 2026

  it('gün · hafta · ay', () => {
    expect(addInterval(base, { count: 3, unit: 'day' }).getDate()).toBe(18);
    expect(addInterval(base, { count: 2, unit: 'week' }).getDate()).toBe(29);
    expect(addInterval(base, { count: 1, unit: 'month' }).getMonth()).toBe(9);
  });

  it('verilen tarihi DEĞİŞTİRMİYOR', () => {
    // Çağıran aynı tarihi başka bir hesapta kullanabiliyor; sessizce kaydırmak
    // bulunması zor bir hata üretir.
    const d = new Date(2026, 8, 15);
    addInterval(d, { count: 10, unit: 'day' });
    expect(d.getDate()).toBe(15);
  });

  it('ay ve yıl sınırını geçiyor', () => {
    expect(addInterval(new Date(2026, 11, 28), { count: 1, unit: 'week' }).getFullYear()).toBe(2027);
  });
});

describe('sonraki örnek', () => {
  const now = new Date(2026, 8, 15);

  it('alanlar taşınıyor, işaretler sıfırlanıyor', () => {
    const next = buildNextIntervalInstance({
      title: 'İki günde bir su iç',
      description: 'not',
      dueTime: '2026-09-15T09:00:00',
      priority: 'High',
      tags: ['health', 'hatırlatıcı'],
      subtasks: [{ text: 'bardak doldur' }],
    }, now)!;

    expect(next.title).toBe('İki günde bir su iç');
    expect(next.dueDate.startsWith('2026-09-17')).toBe(true);
    expect(next.priority).toBe('High');
    expect(next.tags).toEqual(['health', 'hatırlatıcı']);
    expect(next.subtasks).toEqual([{ text: 'bardak doldur', done: false }]);
    expect(next.isCompleted).toBe(false);
  });

  it('tekrar alanı None — zincir BAŞLIKTAN sürüyor', () => {
    /*
      İki mekanizma aynı anda çalışsaydı (başlık + tekrar alanı) her tamamlamada İKİ
      görev üretilirdi.
    */
    expect(buildNextIntervalInstance({ title: 'her 3 günde bir' }, now)!.recurrence).toBe('None');
  });

  it('bozuk öncelik güvenli değere düşüyor', () => {
    expect(buildNextIntervalInstance({ title: 'gün aşırı koş', priority: 'Urgent' }, now)!.priority).toBe('Medium');
    expect(buildNextIntervalInstance({ title: 'gün aşırı koş' }, now)!.priority).toBe('Medium');
  });

  it('kalıp yoksa örnek üretilmiyor', () => {
    expect(buildNextIntervalInstance({ title: 'Raporu bitir' }, now)).toBeNull();
  });
});

describe('hatırlatıcı bayrağı', () => {
  it('etiketten okunuyor — formun sözleşmesi bu', () => {
    /*
      Üretilen yeni örneğin BİLDİRİMİ hiç kurulmuyordu: etiketler kopyalanıyor ama
      zamanlama yapılmıyordu. Tamamlanan görevin bildirimi ise iptal ediliyor. Sonuç:
      hatırlatıcılı tekrarlayan görev BİR KEZ hatırlatıp sessizleşiyordu.
    */
    expect(wantsReminder(['hatırlatıcı'])).toBe(true);
    expect(wantsReminder(['reminder'])).toBe(true);
    expect(wantsReminder(['health'])).toBe(false);
    expect(wantsReminder(null)).toBe(false);
    expect(wantsReminder(undefined)).toBe(false);
  });
});
