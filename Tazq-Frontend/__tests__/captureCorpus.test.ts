import { capture, CAPTURE_MAX_ITEMS, type CaptureResult } from '@/features/tasks/nlp/capture';

/*
  "AKLINDAKİLERİ YAZ" ALTIN SETİ — çoklu ayrıştırıcının (capture.ts) tam sonucu.

  Hedef %100: her satır, çıkan maddelerin TAMAMINI (tür, başlık, tarih, saat, sıklık)
  ve mod sinyallerini birebir kıyaslar. Eksik ya da fazla bir madde satırı kırar.

  İlk 8 satır eski plan çıkarıcısının (shared/utils/planExtractor.ts) ölçülen hatalarıdır:
  kelime içinde arama ("okula" → okuma alışkanlığı), gün listesini parçalama, başlıkta
  kalan tarih kelimesi. Bu satırlar silinmez.

  Saat: Cumartesi 31 Ekim 2026, 10:00 (yerel).
*/
const NOW = new Date(2026, 9, 31, 10, 0);

type Row = [string, Array<Record<string, unknown>>, Array<Record<string, unknown>>?];

const daily = { kind: 'daily' };
const days = (...d: number[]) => ({ kind: 'days', days: d });
const weekly = (times: number) => ({ kind: 'weekly', times });

function project(r: CaptureResult) {
  return {
    items: r.items.map((i) =>
      i.kind === 'habit'
        ? { kind: 'habit', title: i.title, schedule: i.schedule }
        : {
            kind: 'task',
            title: i.title,
            ...(i.dueDate ? { dueDate: i.dueDate } : {}),
            ...(i.time ? { time: i.time } : {}),
            ...(i.priority ? { priority: i.priority } : {}),
            ...(i.recurrence ? { recurrence: i.recurrence } : {}),
          },
    ),
    modes: r.modes.map((m) => ({ mode: m.mode, ...(m.date ? { date: m.date } : {}) })),
  };
}

const ROWS: Row[] = [
  // ── Eski çıkarıcının hataları ──
  ['okula git', [{ kind: 'task', title: 'Okula git' }]],
  ['dilekçe yaz', [{ kind: 'task', title: 'Dilekçe yaz' }]],
  ['pazartesi, çarşamba ve cuma spor', [{ kind: 'habit', title: 'Spor', schedule: days(0, 2, 4) }]],
  ['yarın sunumu bitir', [{ kind: 'task', title: 'Sunumu bitir', dueDate: '2026-11-01' }]],
  ['kitap okuma ve not alma', [{ kind: 'task', title: 'Kitap okuma' }, { kind: 'task', title: 'Not alma' }]],
  ['annemi ara', [{ kind: 'task', title: 'Annemi ara' }]],
  ['araba muayenesi', [{ kind: 'task', title: 'Araba muayenesi' }]],
  ['araba ve ev temizliği', [{ kind: 'task', title: 'Araba ve ev temizliği' }]],

  // ── Alışkanlık: yalnız açık tekrar kanıtıyla ──
  ['her gün 20 sayfa kitap oku', [{ kind: 'habit', title: '20 sayfa kitap oku', schedule: daily }]],
  ['her sabah koşu', [{ kind: 'habit', title: 'Koşu', schedule: daily }]],
  ['haftada 3 kez yüzme', [{ kind: 'habit', title: 'Yüzme', schedule: weekly(3) }]],
  ['her cuma çöpleri çıkar', [{ kind: 'habit', title: 'Çöpleri çıkar', schedule: days(4) }]],
  ['salı ve perşembe günleri gitar', [{ kind: 'habit', title: 'Gitar', schedule: days(1, 3) }]],
  ['cumaları halı saha', [{ kind: 'habit', title: 'Halı saha', schedule: days(4) }]],
  ['gün aşırı esneme', [{ kind: 'habit', title: 'Esneme', schedule: weekly(3) }]],
  ['düzenli su iç', [{ kind: 'habit', title: 'Su iç', schedule: daily }]],
  ['her hafta ev temizliği', [{ kind: 'habit', title: 'Ev temizliği', schedule: weekly(1) }]],
  ['spor', [{ kind: 'task', title: 'Spor' }]],

  // ── Görev: tarih, saat, öncelik, aylık tekrar ──
  ["her ayın 15'i kirayı öde", [{ kind: 'task', title: 'Kirayı öde', dueDate: '2026-11-15', recurrence: 'Monthly' }]],
  ['cuma 15:00 dişçi randevusu', [{ kind: 'task', title: 'Dişçi randevusu', dueDate: '2026-11-06', time: '15:00' }]],
  ["yarın, saat 3'te toplantı", [{ kind: 'task', title: 'Toplantı', dueDate: '2026-11-01', time: '15:00' }]],
  ['acil: vergi beyannamesi', [{ kind: 'task', title: 'Vergi beyannamesi', priority: 'High' }]],
  ['12.50 TL borcu öde', [{ kind: 'task', title: '12.50 TL borcu öde' }]],
  ['pazara git', [{ kind: 'task', title: 'Pazara git' }]],
  // Türkçede "on" sayı, "at" fiil: İngilizce edat gibi kesilmez.
  ['on sayfa oku her gün', [{ kind: 'habit', title: 'On sayfa oku', schedule: daily }]],
  ['çöpü at yarın', [{ kind: 'task', title: 'Çöpü at', dueDate: '2026-11-01' }]],

  // ── Bölme ──
  ['fatura öde. markete git. kargo gönder', [
    { kind: 'task', title: 'Fatura öde' }, { kind: 'task', title: 'Markete git' }, { kind: 'task', title: 'Kargo gönder' },
  ]],
  ['- süt al\n- ekmek al\n- su faturasını öde', [
    { kind: 'task', title: 'Süt al' }, { kind: 'task', title: 'Ekmek al' }, { kind: 'task', title: 'Su faturasını öde' },
  ]],
  ['süt al, süt al', [{ kind: 'task', title: 'Süt al' }]],
  // Noktalamasız: ikinci TARİH yeni bir işin başıdır (kullanıcı cihazda yazdı, 2026-11-01).
  ['yarın temizlik yapılacak öbür gün toplantı var', [
    { kind: 'task', title: 'Temizlik yapılacak', dueDate: '2026-11-01' }, { kind: 'task', title: 'Toplantı var', dueDate: '2026-11-02' },
  ]],
  ['bugün market yarın dişçi', [{ kind: 'task', title: 'Market', dueDate: '2026-10-31' }, { kind: 'task', title: 'Dişçi', dueDate: '2026-11-01' }]],
  ['pazartesi rapor cuma sunum', [{ kind: 'task', title: 'Rapor', dueDate: '2026-11-02' }, { kind: 'task', title: 'Sunum', dueDate: '2026-11-06' }]],
  ['pazartesi ve cuma spor', [{ kind: 'habit', title: 'Spor', schedule: days(0, 4) }]],

  // ── A · Türkçe karaktersiz yazım (telefonda çok yaygın): eşleşmede tamamlanır, başlık yazıldığı gibi ──
  ['yarin disci randevusu', [{ kind: 'task', title: 'Disci randevusu', dueDate: '2026-11-01' }]],
  ['carsamba toplanti var', [{ kind: 'task', title: 'Toplanti var', dueDate: '2026-11-04' }]],
  ['her gun 20 dk kitap oku', [{ kind: 'habit', title: '20 dk kitap oku', schedule: daily }]],
  ['bugun aksam 8de sinema', [{ kind: 'task', title: 'Sinema', dueDate: '2026-10-31', time: '20:00' }]],
  ['12 aralikta sinav', [], [{ mode: 'exam', date: '2026-12-12' }]],
  ['1) rapor yaz\n2) maili gönder', [{ kind: 'task', title: 'Rapor yaz' }, { kind: 'task', title: 'Maili gönder' }]],
  ['', []],
  ['  ,  ;  ', []],

  // ── Mod sinyali: durum cümlesi madde olmaz, tarihi moda gider ──
  ['KPSS sınavına çalışıyorum', [], [{ mode: 'exam' }]],
  ['sınavım 12 aralıkta', [], [{ mode: 'exam', date: '2026-12-12' }]],
  ['iş görüşmem var pazartesi', [], [{ mode: 'mulakat', date: '2026-11-02' }]],
  ['5 kilo vermek istiyorum', [], [{ mode: 'spor' }]],
  ['sigarayı bırakmak istiyorum', [], [{ mode: 'birakma' }]],
  ['tezimi bitirmem lazım', [{ kind: 'task', title: 'Tezimi bitirmem lazım' }], [{ mode: 'tez' }]],
  ['yarın sınav başvurusunu yap', [{ kind: 'task', title: 'Sınav başvurusunu yap', dueDate: '2026-11-01' }], [{ mode: 'exam' }]],
  ['ev için para biriktir', [{ kind: 'task', title: 'Ev için para biriktir' }], [{ mode: 'tasarruf' }]],
  ['tezgahı sil', [{ kind: 'task', title: 'Tezgahı sil' }]],
  ['Sınavım 12 aralıkta, her gün 2 saat matematik çalış, yarın kitapçıdan deneme al', [
    { kind: 'habit', title: '2 saat matematik çalış', schedule: daily },
    { kind: 'task', title: 'Kitapçıdan deneme al', dueDate: '2026-11-01' },
  ], [{ mode: 'exam', date: '2026-12-12' }]],

  // ── English ──
  ['finish the report tomorrow', [{ kind: 'task', title: 'Finish the report', dueDate: '2026-11-01' }]],
  ['run every morning', [{ kind: 'habit', title: 'Run', schedule: daily }]],
  ['call mom and pay rent', [{ kind: 'task', title: 'Call mom' }, { kind: 'task', title: 'Pay rent' }]],
  ['gym on monday, wednesday and friday', [{ kind: 'habit', title: 'Gym', schedule: days(0, 2, 4) }]],
  ['read 10 pages daily', [{ kind: 'habit', title: 'Read 10 pages', schedule: daily }]],
  ['swimming 3 times a week', [{ kind: 'habit', title: 'Swimming', schedule: weekly(3) }]],
  ['buy milk. pick up kids at 5pm', [{ kind: 'task', title: 'Buy milk' }, { kind: 'task', title: 'Pick up kids', time: '17:00' }]],
  ['I have an exam on december 12', [], [{ mode: 'exam', date: '2026-12-12' }]],
  ['job interview next monday', [], [{ mode: 'mulakat', date: '2026-11-02' }]],
  ['lose 5 kg', [], [{ mode: 'spor' }]],
  ['quit smoking', [], [{ mode: 'birakma' }]],
];

describe('capture — altın set', () => {
  it('en az 40 satır', () => {
    expect(ROWS.length).toBeGreaterThanOrEqual(40);
  });

  // Eksik sütun it.each'te `done` sanılır (proje tuzağı) — her satır üç sütuna tamamlanır.
  it.each(ROWS.map(([input, items, modes]) => [input, items, modes ?? []] as const))('%s', (input, items, modes) => {
    expect(project(capture(input, undefined, NOW))).toEqual({ items, modes });
  });
});

describe('capture — sınırlar', () => {
  it('en fazla CAPTURE_MAX_ITEMS madde', () => {
    const text = Array.from({ length: 20 }, (_, i) => `iş ${i + 1} yap`).join(', ');
    expect(capture(text, undefined, NOW).items).toHaveLength(CAPTURE_MAX_ITEMS);
  });

  it('her maddede kaynak parça ve kanıt var', () => {
    const [h] = capture('her sabah koşu', undefined, NOW).items;
    expect(h.source).toBe('her sabah koşu');
    expect(h.evidence).toContain('her sabah');
  });

  it('alışkanlığa simge önerilir', () => {
    const [h] = capture('her sabah koşu', undefined, NOW).items;
    expect(h.kind === 'habit' && h.emoji).toBe('🏃');
  });

  it('aynı mod iki kez gelmez; tarih ilk bulunandan', () => {
    const r = capture('KPSS sınavına çalışıyorum. sınavım 12 aralıkta', undefined, NOW);
    expect(r.modes).toEqual([{ mode: 'exam', date: '2026-12-12', evidence: expect.any(String) }]);
  });
});

describe('capture — seçenekler', () => {
  it('statements:false → durum cümlesi de madde olur, sinyal yine raporlanır', () => {
    const r = capture('5 kilo vermek istiyorum', 'tr', NOW, { statements: false });
    expect(r.items.map((i) => i.title)).toEqual(['5 kilo vermek istiyorum']);
    expect(r.modes.map((m) => m.mode)).toEqual(['spor']);
  });
});

/**
 * SINIRLAR (2026-11-01, kullanıcı: "mantıklı bir sınır olsun, ucu açık kalmasın"). Tek yerde
 * (CAPTURE_LIMITS) ve hiçbiri SESSİZ değil: aşılan sınır kullanıcıya söylenir.
 */
describe('capture — sınırlar tek yerde', () => {
  const { CAPTURE_LIMITS } = require('@/features/tasks/nlp/capture');

  it('değerler: 600 karakter, 12 madde, görev başlığı 100 (sunucu), alışkanlık adı 40 (form)', () => {
    expect(CAPTURE_LIMITS).toEqual({ inputChars: 600, items: 12, taskTitle: 100, habitTitle: 40 });
  });

  it('12\'den fazla madde: ilk 12 alınır, düşen sayı bildirilir', () => {
    const text = Array.from({ length: 15 }, (_, i) => `iş ${i + 1} yap`).join(', ');
    const r = capture(text, undefined, NOW);
    expect(r.items).toHaveLength(12);
    expect(r.dropped).toBe(3);
  });

  it('uzun görev başlığı kelime sınırından 100\'e kısalır', () => {
    const long = 'proje raporunun bütün bölümlerini tek tek gözden geçirip eksik kaynakları tamamla ve yöneticiye gönderilecek son halini hazırla';
    const [t] = capture(long, 'tr', NOW).items;
    expect(t.title.length).toBeLessThanOrEqual(100);
    expect(long.toLocaleLowerCase('tr').startsWith(t.title.toLocaleLowerCase('tr'))).toBe(true);
    expect(t.title.endsWith(' ')).toBe(false);
  });

  it('uzun alışkanlık adı 40\'a kısalır', () => {
    const [h] = capture('her gün sabah kalkınca on beş dakika boyunca nefes egzersizi ve esneme yap', 'tr', NOW).items;
    expect(h.kind).toBe('habit');
    expect(h.title.length).toBeLessThanOrEqual(40);
  });

  it('yazı alanının ötesi okunmaz (savunma)', () => {
    const r = capture(`${'a'.repeat(700)}, süt al`, 'tr', NOW);
    expect(r.items.some(i => i.title === 'Süt al')).toBe(false);
  });
});
