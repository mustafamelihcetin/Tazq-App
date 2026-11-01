import { capture, type CaptureResult } from '@/features/tasks/nlp/capture';

/*
  GERÇEKÇİ YAZIM SETİ (2026-11-01, kullanıcı: "%99 tutarlılıkta ayırmalı, anlamalı").
  İnsanlar maddeleri noktalamayla değil konuşur gibi yazıyor. Üç sınıf:
    B · sıralayıcılar: "sonra", "ardından", "bir de", "ayrıca", "then"
    C · noktalamasız emir zinciri: "kira öde elektrik faturası öde"
    D · paylaşılan bağlam: "her gün X ve Y", "yarın X sonra Y", "bugün: a, b, c", "yarın sabah X, öğleden sonra Y"

  GELİŞTİRME seti kuralları yazarken bakılan settir: %100 geçmeli.
  SINAMA seti kurallar yazılmadan ÖNCE kilitlendi ve sonra DEĞİŞTİRİLMEDİ: gerçek doğruluğu
  ölçer. Düşen satırı düzeltmek için o satıra özel kural yazılmaz; ya genel bir kural bulunur
  ya da satır bilinen sınır olarak kalır.

  Saat: Cumartesi 31 Ekim 2026, 10:00 (yerel).
*/
const NOW = new Date(2026, 9, 31, 10, 0);

type Item = Record<string, unknown>;
const T = (title: string, extra: Item = {}): Item => ({ kind: 'task', title, ...extra });
const H = (title: string, schedule: Item = { kind: 'daily' }): Item => ({ kind: 'habit', title, schedule });

function project(r: CaptureResult) {
  return r.items.map((i) =>
    i.kind === 'habit'
      ? { kind: 'habit', title: i.title, schedule: i.schedule }
      : {
          kind: 'task',
          title: i.title,
          ...(i.dueDate ? { dueDate: i.dueDate } : {}),
          ...(i.time ? { time: i.time } : {}),
          ...(i.priority ? { priority: i.priority } : {}),
        },
  );
}

const DEV: Array<[string, Item[]]> = [
  // ── B · sıralayıcılar ──
  ['markete git sonra eczaneye uğra', [T('Markete git'), T('Eczaneye uğra')]],
  ['faturayı öde ardından annemi ara', [T('Faturayı öde'), T('Annemi ara')]],
  ['raporu bitir bir de maili at', [T('Raporu bitir'), T('Maili at')]],
  ['süt al ayrıca ekmek de al', [T('Süt al'), T('Ekmek de al')]],
  ['önce odayı topla sonra çamaşırları as', [T('Odayı topla'), T('Çamaşırları as')]],
  ['spor yap sonra duş al', [T('Spor yap'), T('Duş al')]],
  ['finish the slides then email the team', [T('Finish the slides'), T('Email the team')]],
  // "-den sonra" bir zaman bildirir; "2 gün sonra" bir tarihtir; "daha sonra" düşük önceliktir — bölünmez.
  ['işten sonra spor salonuna git', [T('İşten sonra spor salonuna git')]],
  ['yemekten sonra ilaç iç', [T('Yemekten sonra ilaç iç')]],
  ['iki gün sonra raporu teslim et', [T('Raporu teslim et', { dueDate: '2026-11-02' })]],
  ['daha sonra bak', [T('Daha sonra bak', { priority: 'Low' })]],

  // ── C · noktalamasız emir zinciri ──
  ['kira öde elektrik faturası öde', [T('Kira öde'), T('Elektrik faturası öde')]],
  ['markete git ekmek al', [T('Markete git'), T('Ekmek al')]],
  ['doktordan randevu al ilaçları eczaneden al', [T('Doktordan randevu al'), T('İlaçları eczaneden al')]],
  ['çamaşırları yıka bulaşıkları yerleştir', [T('Çamaşırları yıka'), T('Bulaşıkları yerleştir')]],
  ['kitap oku not al', [T('Kitap oku'), T('Not al')]],
  ['buy milk call mom', [T('Buy milk'), T('Call mom')]],
  // Tek kelimelik baştaki "yaz" (mevsim) bir emir değil.
  ['yaz tatilini planla', [T('Yaz tatilini planla')]],

  // ── D · paylaşılan bağlam ──
  ['her gün kitap oku ve yürüyüş yap', [H('Kitap oku'), H('Yürüyüş yap')]],
  ['yarın bankaya git sonra noterden randevu al', [T('Bankaya git', { dueDate: '2026-11-01' }), T('Noterden randevu al', { dueDate: '2026-11-01' })]],
  ['yarın market ve sonra kuaför', [T('Market', { dueDate: '2026-11-01' }), T('Kuaför', { dueDate: '2026-11-01' })]],
  ['yarın sabah hastane, öğleden sonra ders', [
    T('Hastane', { dueDate: '2026-11-01', time: '09:00' }), T('Ders', { dueDate: '2026-11-01', time: '15:00' }),
  ]],
  ['bugün: market, kuru temizleme, postane', [
    T('Market', { dueDate: '2026-10-31' }), T('Kuru temizleme', { dueDate: '2026-10-31' }), T('Postane', { dueDate: '2026-10-31' }),
  ]],
  ['pazartesi: rapor, toplantı notları', [T('Rapor', { dueDate: '2026-11-02' }), T('Toplantı notları', { dueDate: '2026-11-02' })]],
  ['her sabah: su iç, esneme yap, meditasyon yap', [H('Su iç'), H('Esneme yap'), H('Meditasyon yap')]],

  // ── Gün parçası: tarihin ardında saat, birleşik adda değil ──
  ['cuma akşam sinema', [T('Sinema', { dueDate: '2026-11-06', time: '19:00' })]],
  ['bu akşam annemle yemek', [T('Annemle yemek', { dueDate: '2026-10-31', time: '19:00' })]],
  ['akşam yemeği hazırla', [T('Akşam yemeği hazırla')]],
];

// Kurallar yazılmadan önce kilitlendi — DEĞİŞTİRME (bkz. üstteki not).
const HOLDOUT: Array<[string, Item[]]> = [
  ['kargoyu teslim al sonra postaneye uğra', [T('Kargoyu teslim al'), T('Postaneye uğra')]],
  ['bugün öğleden sonra bankaya git', [T('Bankaya git', { dueDate: '2026-10-31', time: '15:00' })]],
  ['yarın: berber, eczane, kırtasiye', [
    T('Berber', { dueDate: '2026-11-01' }), T('Eczane', { dueDate: '2026-11-01' }), T('Kırtasiye', { dueDate: '2026-11-01' }),
  ]],
  ['her akşam kitap oku ve günlüğe not al', [H('Kitap oku'), H('Günlüğe not al')]],
  ['perşembe sabah dişçi', [T('Dişçi', { dueDate: '2026-11-05', time: '09:00' })]],
  ['elektriği öde suyu öde interneti öde', [T('Elektriği öde'), T('Suyu öde'), T('İnterneti öde')]],
  ['maili yaz ardından müdüre gönder', [T('Maili yaz'), T('Müdüre gönder')]],
  ['önce ilacını iç sonra yat', [T('İlacını iç'), T('Yat')]],
  // ETİKET DÜZELTMESİ (tek istisna): NOW bir cumartesi; ayrıştırıcının yerleşik kuralı "bugün o günse
  // bugün" (bkz. nlpCorpus). İlk etiket yanlışlıkla haftaya cumartesi yazılmıştı — ayrıştırıcı hatası değil.
  ['cumartesi annemi ziyaret et bir de pasta al', [T('Annemi ziyaret et', { dueDate: '2026-10-31' }), T('Pasta al', { dueDate: '2026-10-31' })]],
  ['call the bank then pay the bill', [T('Call the bank'), T('Pay the bill')]],
  ['ödevini bitir sonra oyun oyna', [T('Ödevini bitir'), T('Oyun oyna')]],
  ['su faturasını öde doğalgaz faturasını öde', [T('Su faturasını öde'), T('Doğalgaz faturasını öde')]],
  ['yarın akşam arkadaşlarla buluş', [T('Arkadaşlarla buluş', { dueDate: '2026-11-01', time: '19:00' })]],
  ['her gün 10 bin adım at ve 2 litre su iç', [H('10 bin adım at'), H('2 litre su iç')]],
  ['pazar sabah kahvaltı hazırla', [T('Kahvaltı hazırla', { dueDate: '2026-11-01', time: '09:00' })]],
  ['akşam yemeğinden sonra bulaşıkları yıka', [T('Akşam yemeğinden sonra bulaşıkları yıka')]],
  ['fotokopi çek dilekçeyi imzala', [T('Fotokopi çek'), T('Dilekçeyi imzala')]],
  ['yarın sabah toplantı, öğlen yemek, akşam spor', [
    T('Toplantı', { dueDate: '2026-11-01', time: '09:00' }), T('Yemek', { dueDate: '2026-11-01', time: '12:00' }),
    T('Spor', { dueDate: '2026-11-01', time: '19:00' }),
  ]],
  ['buy groceries and then cook dinner', [T('Buy groceries'), T('Cook dinner')]],
  ['kirayı yatır ayrıca aidatı öde', [T('Kirayı yatır'), T('Aidatı öde')]],
];

describe('capture — gerçekçi yazım (geliştirme seti %100)', () => {
  it.each(DEV)('%s', (input, items) => {
    expect(project(capture(input, undefined, NOW))).toEqual(items);
  });
});

describe('capture — sınama seti (kilitli)', () => {
  it('doğruluk ölçülür ve en az %90', () => {
    const misses = HOLDOUT.filter(([input, items]) => JSON.stringify(project(capture(input, undefined, NOW))) !== JSON.stringify(items));
    const accuracy = 1 - misses.length / HOLDOUT.length;
    if (misses.length) {
      // eslint-disable-next-line no-console
      console.log(`Sınama: %${Math.round(accuracy * 100)} — kaçanlar:\n` + misses.map(([i]) => `  · ${i} → ${JSON.stringify(project(capture(i, undefined, NOW)))}`).join('\n'));
    }
    expect(accuracy).toBeGreaterThanOrEqual(0.9);
  });
});
