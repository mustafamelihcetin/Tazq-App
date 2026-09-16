import { swapInFullOrder, moveWithinVisible } from '@/features/tasks/utils/reorder';

/**
 * ELLE SIRALAMA — süzgeç açıkken liste kendiliğinden karışmasın.
 *
 * ── NEDEN BU TEST VAR ─────────────────────────────────────────────────────────
 * Yukarı/aşağı taşıma, sırayı GÖRÜNEN listeden üretip mağazaya yalnız o kimlikleri
 * veriyordu. Mağaza verilen kimliklere 0..n sırası yazıp GERİ KALANLARI eski
 * sıralarıyla bırakıyor. Yani bir süzgeç açıkken iki görevi taşımak, görünmeyen
 * bütün görevlerin sırasıyla çakışan yeni bir numaralandırma üretiyordu.
 *
 * Kullanıcı açısından: süzgeci kaldırıyor ve listesi karışmış oluyor — üstelik bunu
 * yaptığı hamleyle ilişkilendirmesi imkânsız, çünkü aradan zaman geçmiş olabiliyor.
 * Sessiz, geç fark edilen ve "uygulama verimi bozuyor" hissi veren bir hata.
 */

describe('tam listede yer değiştirme', () => {
  it('yalnız iki öğe yer değiştiriyor', () => {
    expect(swapInFullOrder([1, 2, 3, 4, 5], 2, 4)).toEqual([1, 4, 3, 2, 5]);
  });

  it('komşu olmayan öğeler de takas edilebiliyor', () => {
    // Süzgeç açıkken görünen iki komşu, tam listede uzak olabilir.
    expect(swapInFullOrder([1, 2, 3, 4, 5], 1, 5)).toEqual([5, 2, 3, 4, 1]);
  });

  it('ARADAKİLER yerinde kalıyor', () => {
    /*
      Düzeltmenin özü bu: gizli görevlerin sırası kullanıcının görmediği bir hamle
      yüzünden değişmemeli.
    */
    const out = swapInFullOrder([10, 20, 30, 40, 50], 10, 50);
    expect(out[1]).toBe(20);
    expect(out[2]).toBe(30);
    expect(out[3]).toBe(40);
  });

  it('bilinmeyen kimlikte liste DEĞİŞMİYOR', () => {
    // Eksik veriyle sıralamayı yeniden yazmak, düzeltmeye çalıştığımız karışıklığı
    // üretir. Aynı referans dönüyor ki çağıran "değişmedi"yi anlayabilsin.
    const ids = [1, 2, 3];
    expect(swapInFullOrder(ids, 1, 99)).toBe(ids);
    expect(swapInFullOrder(ids, 99, 1)).toBe(ids);
  });

  it('kendisiyle takas bir işlem değil', () => {
    const ids = [1, 2, 3];
    expect(swapInFullOrder(ids, 2, 2)).toBe(ids);
  });
});

describe('görünen listedeki hamle', () => {
  // Tam liste: 1..6. Süzgeç yalnız tek sayıları gösteriyor.
  const all = [1, 2, 3, 4, 5, 6];
  const visible = [1, 3, 5];

  it('görünen komşuyla yer değiştiriyor, gizliler yerinde kalıyor', () => {
    /*
      Kullanıcı 3'ü yukarı taşıyor. Ekranda üstündeki 1; tam listede aralarında 2 var.
      Doğru sonuç: 1 ile 3 yer değiştirir, 2 kımıldamaz.
    */
    expect(moveWithinVisible(all, visible, 1, 'up')).toEqual([3, 2, 1, 4, 5, 6]);
  });

  it('aşağı taşıma da aynı kuralla', () => {
    expect(moveWithinVisible(all, visible, 1, 'down')).toEqual([1, 2, 5, 4, 3, 6]);
  });

  it('SÜZGEÇSİZ liste bozulmuyor — eski davranış korunuyor', () => {
    expect(moveWithinVisible(all, all, 2, 'up')).toEqual([1, 3, 2, 4, 5, 6]);
    expect(moveWithinVisible(all, all, 0, 'down')).toEqual([2, 1, 3, 4, 5, 6]);
  });

  it('uçlarda hamle YOK — sessizce hiçbir şey yazılmıyor', () => {
    // İlk öğe yukarı, son öğe aşağı gidemez. `null` dönüyor ki çağıran mağazayı
    // ve çevrimdışı kuyruğu boşuna dürtmesin.
    expect(moveWithinVisible(all, visible, 0, 'up')).toBeNull();
    expect(moveWithinVisible(all, visible, 2, 'down')).toBeNull();
  });

  it('geçersiz sıra numarasında çökmüyor', () => {
    expect(moveWithinVisible(all, visible, -1, 'up')).toBeNull();
    expect(moveWithinVisible(all, visible, 99, 'down')).toBeNull();
  });

  it('TAM sıra dönüyor — eksik liste mağazayı karıştırır', () => {
    /*
      Kusurun kökü buydu: mağazaya yalnız görünen kimlikler veriliyordu. Dönen dizi
      her zaman tam listeyi kapsamalı.
    */
    const out = moveWithinVisible(all, visible, 1, 'up')!;
    expect(out).toHaveLength(all.length);
    expect([...out].sort()).toEqual([...all].sort());
  });
});
