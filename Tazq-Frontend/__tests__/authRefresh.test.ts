import fs from 'fs';
import path from 'path';

/**
 * OTURUM YENİLEME — "geçici ağ hatası kullanıcıyı çıkışa zorluyor" hatasının testi.
 *
 * ── ZİNCİR ──────────────────────────────────────────────────────────────────────
 * JWT 60 dakikada doluyor. Süresi dolmuş bir token'la yapılan istek 401 alıyor, araya
 * giren katman sessizce yenilemeye çalışıyor. Yenileme fonksiyonu ise HER hatada `null`
 * dönüyordu ve çağıran taraf null'ı "oturum bitti" sayıp `logout()` çağırıyordu.
 *
 * `logout()` masum bir işlem değil: `clearLocalUserData()` ile görevleri, alışkanlıkları,
 * kilo geçmişini ve BEKLEYEN ÇEVRİMDIŞI KUYRUĞU siliyor. Yani tam yenileme anında
 * sunucunun 500 dönmesi, isteğin zaman aşımına uğraması ya da hız sınırına (429) takılmak,
 * kullanıcının henüz gönderilmemiş değişikliklerini KALICI olarak yok ediyordu.
 *
 * ── AYRIM ───────────────────────────────────────────────────────────────────────
 * "Sunucuya ulaşamadım" ile "sunucu bu token'ı reddetti" aynı şey değil. Yalnız ikincisi
 * oturumun bittiğine kanıttır. Birincisinde doğru davranış: oturumu koru, isteği reddet,
 * bir sonraki denemede tekrar dene.
 *
 * Kaynak üzerinden doğrulanıyor: araya giren katman axios örneğine bağlı ve modül
 * yüklenirken kuruluyor; asıl korunması gereken şey ise bu üç durumlu ayrımın kendisi.
 */
const SRC = fs.readFileSync(
  path.resolve(__dirname, '../shared/services/api.ts'),
  'utf8',
);

describe('yenileme sonucu üç durumlu', () => {
  it('ok / invalid / transient ayrımı tanımlı', () => {
    expect(SRC).toMatch(/status: 'ok'; token: string/);
    expect(SRC).toMatch(/status: 'invalid'/);
    expect(SRC).toMatch(/status: 'transient'/);
  });

  it('yalnız 401/403 oturumu bitirir', () => {
    // Sunucunun AÇIK reddi. Başka hiçbir durum "token geçersiz" anlamına gelmez.
    expect(SRC).toMatch(/if \(status === 401 \|\| status === 403\) return \{ status: 'invalid' \}/);
  });

  it('diğer tüm hatalar geçici sayılır', () => {
    // Ağ kopması, zaman aşımı, 5xx, 429 — hepsi buraya düşer.
    expect(SRC).toMatch(/return \{ status: 'transient' \}/);
  });
});

describe('geçici hatada oturum korunur', () => {
  it('transient sonucunda logout ÇAĞRILMADAN istek reddedilir', () => {
    // Kritik satır: çıkış yoluna düşmeden erken dönüş.
    expect(SRC).toMatch(/if \(result\.status === 'transient'\) \{[\s\S]{0,1200}?return Promise\.reject\(error\);/);
  });

  it('çıkış yalnız açık reddin ardından', () => {
    // `logout()` çağrısı, transient dalının ALTINDA kalmalı; üstüne çıkarsa hata geri gelir.
    const transientAt = SRC.indexOf("result.status === 'transient'");
    const logoutAt = SRC.indexOf('useAuthStore.getState().logout()');
    expect(transientAt).toBeGreaterThan(-1);
    expect(logoutAt).toBeGreaterThan(transientAt);
  });

  it('başarılı yenilemede istek yeni token ile tekrarlanır', () => {
    expect(SRC).toMatch(/if \(result\.status === 'ok'\)/);
    expect(SRC).toMatch(/Bearer \$\{result\.token\}/);
  });
});

describe('korunan oturumu üst katman kapatamaz', () => {
  /*
    Hata yine 401 olarak yukarı çıkıyor ve bazı çağıranlar "401 → çıkış" kuralını KENDİ
    uyguluyor (açılıştaki oturum eşitlemesi böyle). İşaret olmasaydı, araya giren katmanda
    korunan oturum bir üst katmanda kapatılır ve düzeltme hiçbir işe yaramazdı.
  */
  it('geçici hata işaretleniyor', () => {
    expect(SRC).toMatch(/__authTransient\?: boolean \}\)\.__authTransient = true;/);
  });

  it('açılış eşitlemesi işarete saygı gösteriyor', () => {
    const layout = fs.readFileSync(path.resolve(__dirname, '../app/_layout.tsx'), 'utf8');
    expect(layout).toMatch(/__authTransient\?: boolean \}\)\?\.__authTransient === true/);
    expect(layout).toMatch(/httpStatusOf\(error\) === 401 && !transient/);
  });
});

describe('yenileme döngüsü koruması', () => {
  it('eşzamanlı 401ler tek yenileme isteğini paylaşır', () => {
    // Dedup olmasa her 401 ayrı bir yenileme başlatır ve hız sınırına takılırdı —
    // ki bu, düzeltilen hatanın tam da tetikleyicisiydi.
    expect(SRC).toMatch(/if \(refreshPromise\) return refreshPromise;/);
    expect(SRC).toMatch(/refreshPromise = null;/);
  });

  it('yenileme isteğinin kendisi GERÇEK yolu kontrol ediyor', () => {
    // Kontrol var olmayan bir yolu ('/refresh-session') arıyordu, yani hiçbir şey
    // korumuyordu. Gerçek uç: /api/users/refresh
    expect(SRC).toMatch(/url\.includes\('\/api\/users\/refresh'\)/);
    // Eski yol artık KONTROL olarak kullanılmıyor (yorumda anılması serbest).
    expect(SRC).not.toMatch(/url\.includes\('\/refresh-session'\)/);
  });
});
