import { buildWeekStrip } from '@/features/dashboard/utils/weekStrip';

/**
 * HAFTALIK ŞERİT — sunucu ne gönderirse göndersin, hafta yedi gündür.
 *
 * ── NEDEN BU TEST VAR ─────────────────────────────────────────────────────────
 * Şerit doğrudan sunucudan gelen diziye bağlıydı ve o dizinin uzunluğu hiçbir yerde
 * garanti edilmiyordu. Kodda iki yol vardı — "dizi boş" ve "dizi dolu" — ama arada
 * bir üçüncü durum daha var: dizi DOLU AMA KISA. O zaman bugünün hücresi hiç yok,
 * cihazda biriken odak dakikası hiçbir yere yazılamıyor ve sessizce kayboluyordu.
 *
 * Kaybolan yalnız bir çubuk değildi: `weeklyMinutes` üzerinden İVME SKORU da eksik
 * hesaplanıyordu. Yani görünmeyen bir hata, görünen bir sayıyı bozuyordu.
 */

const LABELS = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pa'];
const cell = (day: string, minutes: number, tasksCompleted = 0) => ({ day, minutes, tasksCompleted });

describe('şerit her zaman yedi gün', () => {
  it('sunucu HİÇ veri göndermese de yedi hücre var', () => {
    const out = buildWeekStrip({ weeklyFocus: [], dayLabels: LABELS, todayIndex: 2, todayMinutes: 40 });
    expect(out).toHaveLength(7);
    expect(out.map((d) => d.day)).toEqual(LABELS);
    expect(out[2].minutes).toBe(40);
    expect(out.filter((d) => d.minutes > 0)).toHaveLength(1);
  });

  it('null/undefined gelse de çökmüyor', () => {
    expect(buildWeekStrip({ weeklyFocus: null, dayLabels: LABELS, todayIndex: 0, todayMinutes: 0 })).toHaveLength(7);
    expect(buildWeekStrip({ weeklyFocus: undefined, dayLabels: LABELS, todayIndex: 0, todayMinutes: 0 })).toHaveLength(7);
  });

  it('dizi KISA gelirse bugünün dakikası KAYBOLMUYOR', () => {
    /*
      Kusurun ta kendisi: eski kod `weeklyFocus.map(...)` yapıyordu, yani çıktı da
      kısa oluyordu. `todayIndex` dizinin dışında kaldığı için bugünün yerel dakikası
      hiçbir hücreye yazılamıyordu.
    */
    const out = buildWeekStrip({
      weeklyFocus: [cell('Pt', 10), cell('Sa', 20), cell('Ça', 30)],
      dayLabels: LABELS,
      todayIndex: 5,
      todayMinutes: 55,
    });
    expect(out).toHaveLength(7);
    expect(out[5].minutes).toBe(55);
    expect(out[5].day).toBe('Ct');
    expect(out.reduce((s, d) => s + d.minutes, 0)).toBe(10 + 20 + 30 + 55);
  });

  it('dizi FAZLA gelirse şerit yine yedi günde kalıyor', () => {
    const many = Array.from({ length: 12 }, (_, i) => cell(`G${i}`, i));
    const out = buildWeekStrip({ weeklyFocus: many, dayLabels: LABELS, todayIndex: 0, todayMinutes: 0 });
    expect(out).toHaveLength(7);
    expect(out[6].day).toBe('G6');
  });

  it('bugün için BÜYÜK olan kazanır — sunucu geriye çekemez', () => {
    /*
      Sunucu bu seansı henüz görmemiş olabilir (yerel büyüktür) ama görmüşse de sayı
      geri gitmemeli (sunucu büyüktür). İki yön de sınanıyor.
    */
    const week = Array.from({ length: 7 }, (_, i) => cell(LABELS[i], 0));
    week[3] = cell('Pe', 80);
    expect(buildWeekStrip({ weeklyFocus: week, dayLabels: LABELS, todayIndex: 3, todayMinutes: 20 })[3].minutes).toBe(80);
    expect(buildWeekStrip({ weeklyFocus: week, dayLabels: LABELS, todayIndex: 3, todayMinutes: 95 })[3].minutes).toBe(95);
  });

  it('yerel sayaç YALNIZ bugünün hücresine yazılıyor', () => {
    // Öteki günlerde cihazdaki sayacın söyleyeceği bir şey yok.
    const out = buildWeekStrip({ weeklyFocus: [], dayLabels: LABELS, todayIndex: 4, todayMinutes: 70 });
    for (let i = 0; i < 7; i++) expect(out[i].minutes).toBe(i === 4 ? 70 : 0);
  });

  it('eksik alanlar güvenli varsayılana düşüyor', () => {
    // Sunucu bir alanı atlarsa hücre yine tam kurulmalı — `undefined` çizilmemeli.
    const out = buildWeekStrip({
      weeklyFocus: [{ minutes: 15 }, { day: 'Sa' }],
      dayLabels: LABELS,
      todayIndex: 6,
      todayMinutes: 0,
    });
    expect(out[0]).toEqual({ day: 'Pt', minutes: 15, tasksCompleted: 0 });
    expect(out[1]).toEqual({ day: 'Sa', minutes: 0, tasksCompleted: 0 });
  });

  it('etiket listesi eksikse boş dize — undefined çizilmiyor', () => {
    const out = buildWeekStrip({ weeklyFocus: [], dayLabels: ['Pt'], todayIndex: 0, todayMinutes: 0 });
    expect(out[3].day).toBe('');
  });
});
