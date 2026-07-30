import { compactHabitLabel } from '@/features/habits/components/HabitBubble';

/**
 * BALONCUK ETİKETİ — 78pt'lik yuvaya adın ADI sığar, açıklaması sığmaz.
 *
 * Alışkanlık adlarının bir kısmı iki iş birden yapıyor: ad + koçluk detayı. Yuvayı
 * 62'den 78pt'ye çıkarmak ve etiketi iki satıra almak gerekliydi ama YETMEDİ —
 * parantez içi detay tek başına iki satırı dolduruyor ve ad yine "…" ile kesiliyordu.
 * Yan yana beş kesik kelime sayfayı bitmemiş gösteriyor.
 *
 * Ölçüm: 268 addan 27'si iki satıra sığmıyordu; kırpma sonrası 13.
 * Detay silinmiyor — görev satırında ve alışkanlık detayında tam metin duruyor.
 */
describe('compactHabitLabel', () => {
  it('parantez içi detayı atar', () => {
    expect(compactHabitLabel('Kalori fazlası ile beslen (TDEE + 300-500)'))
      .toBe('Kalori fazlası ile beslen');
    expect(compactHabitLabel('Direnç antrenmanı (programdaki günler)'))
      .toBe('Direnç antrenmanı');
  });

  it('uzun tire ile eklenen açıklamayı atar', () => {
    expect(compactHabitLabel('Kaliteli uyku — kaslar geceleri onarılır')).toBe('Kaliteli uyku');
    expect(compactHabitLabel('Uyku kalitesi – kaslar uyurken büyür')).toBe('Uyku kalitesi');
  });

  it('ikisi birden varsa ilkinde keser', () => {
    expect(compactHabitLabel('Düzenli uyku (7–9 saat) — kas onarımı için kritik'))
      .toBe('Düzenli uyku');
  });

  it('zaten kısa adlara DOKUNMAZ', () => {
    // Adların çoğu böyle: kırpacak bir şey yok, olduğu gibi kalmalı.
    expect(compactHabitLabel('Kavram Haritası Çıkarma')).toBe('Kavram Haritası Çıkarma');
    expect(compactHabitLabel('Su')).toBe('Su');
  });

  it('normal tireli kelimeleri BOZMAZ', () => {
    // Kısa tire ayraç sayılmıyor: yalnız " (" ve boşluklu uzun tire kesiyor.
    expect(compactHabitLabel('E-posta kutusunu sıfırla')).toBe('E-posta kutusunu sıfırla');
    expect(compactHabitLabel('Check-in yap')).toBe('Check-in yap');
    expect(compactHabitLabel('COCA/AWL kelime seti (20/gün)')).toBe('COCA/AWL kelime seti');
  });

  it('kırpma bir adı YOK ETMEZ', () => {
    // Ayraç en baştaysa geriye anlamsız bir parça kalır — o durumda tam ad korunur.
    expect(compactHabitLabel('(TDEE + 300-500) kalori')).toBe('(TDEE + 300-500) kalori');
    expect(compactHabitLabel('— sadece açıklama')).toBe('— sadece açıklama');
  });

  it('boş/tanımsız başlıkta ÇÖKMEZ', () => {
    // Gerçek veride oluyor: çevrimdışı kuyruktaki geçici kayıtlar, eksik çeviri.
    // Eskiden `{item.title}` sessizce boş çiziyordu; kırpma eklenince aynı veri ekranı
    // düşürdü. Bunu mevcut MyDayHabits testleri yakaladı.
    expect(compactHabitLabel(undefined)).toBe('');
    expect(compactHabitLabel(null)).toBe('');
    expect(compactHabitLabel('')).toBe('');
  });

  it('İngilizce adlarda da çalışır — iki dilli yapı korunur', () => {
    expect(compactHabitLabel('Daily protein intake (per meal)')).toBe('Daily protein intake');
    expect(compactHabitLabel('Quality sleep — muscles repair at night')).toBe('Quality sleep');
  });
});
