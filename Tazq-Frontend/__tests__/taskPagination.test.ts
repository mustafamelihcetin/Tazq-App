import fs from 'fs';
import path from 'path';

/**
 * GÖREV SAYFALAMA — "eski görevlerim kayboldu" hatasının testi.
 *
 * ── ZİNCİR ──────────────────────────────────────────────────────────────────────
 * `getTasks` yalnız İLK sayfayı çekiyordu (`pageSize: 200`), oysa sunucu kullanıcı başına
 * 5000 göreve izin veriyor. Dönen liste `setTasks` ile yerel listenin YERİNE geçtiği için
 * 200'ü aşan kullanıcıda geri kalan görevler uygulamadan tümüyle kayboluyordu: sunucuda
 * duruyor, ekranda yok.
 *
 * Günlük plan motoru her gün görev üretiyor ve tamamlanan görevler saklanıyor; yani sınır
 * birkaç ayda doluyor. Hatanın en kötü yanı buydu — uygulamayı en çok kullananı vuruyordu
 * ve sessizdi, hiçbir hata mesajı yoktu.
 *
 * Kaynak üzerinden doğrulanıyor: `api.ts` gerçek bir axios örneği kuruyor ve modül
 * yüklenirken araya giren katmanları bağlıyor; korunması gereken şey ise tek bir değişmez —
 * SAYFALAR SONUNA KADAR ÇEKİLİR.
 */
const SRC = fs.readFileSync(
  path.resolve(__dirname, '../shared/services/api.ts'),
  'utf8',
);

describe('getTasks tüm sayfaları çeker', () => {
  it('sayfa döngüsü var — tek istek varsayımı kalmadı', () => {
    expect(SRC).toMatch(/for \(let page = 1; page <= MAX_PAGES; page\+\+\)/);
    expect(SRC).toMatch(/params: \{ page, pageSize: PAGE_SIZE \}/);
  });

  it('üst sınır sunucudaki kullanıcı başına sınırı karşılıyor', () => {
    // 25 × 200 = 5000 = MaxTotalTasksPerUser. Küçük olursa aynı hata geri gelir,
    // yalnız daha yüksek bir eşikte.
    expect(SRC).toMatch(/const PAGE_SIZE = 200;/);
    expect(SRC).toMatch(/const MAX_PAGES = 25;/);
  });

  it('son sayfada durur — boşuna istek atmaz', () => {
    // İki çıkış koşulu: eksik dolu sayfa ya da totalPages'e ulaşmak.
    expect(SRC).toMatch(/if \(items\.length < PAGE_SIZE \|\| page >= totalPages\) break;/);
  });

  it('beklenmedik yanıt biçiminde sessizce boş liste dönmez', () => {
    // `items` dizi değilse veriyi olduğu gibi geçir; boş dizi döndürmek, kullanıcının
    // tüm görevlerini silinmiş göstermek olurdu (setTasks yerel listeyi değiştiriyor).
    expect(SRC).toMatch(/if \(!Array\.isArray\(items\)\) return page === 1 \? items : all;/);
  });

  it('eski/sayfasız yanıt biçimi hâlâ destekleniyor', () => {
    expect(SRC).toMatch(/data\?\.items \?\? data/);
  });
});
