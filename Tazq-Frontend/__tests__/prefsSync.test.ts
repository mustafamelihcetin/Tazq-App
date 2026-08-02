import fs from 'fs';
import path from 'path';

/**
 * TERCİH EŞİTLEMESİ — "başarısız denemeyi başarı sayma" hatası.
 *
 * Bu, taramada çıkan bir DESENİN üçüncü örneği: geçici bir başarısızlığın kesin sonuç gibi
 * ele alınması. Diğer ikisi oturum yenilemede (ağ hatası → çıkış) ve çevrimdışı kuyrukta
 * (işlenmemiş op → kuyruktan silme) çıkmıştı.
 *
 * Burada: "bekleyen değişiklik" bayrağı istek GÖNDERİLMEDEN ÖNCE temizleniyordu ve
 * `syncToCloud` hatayı içeride yuttuğu için başarısızlık hiç fark edilmiyordu. Sunucu
 * 500/429 dönse bile değişiklik gönderilmiş sayılıyor, buluttaki kopya bir sonraki tercih
 * değişikliğine kadar bayat kalıyordu.
 *
 * Faturası yeni cihazda kesiliyor: orada yerel veri olmadığı için bulut kazanır
 * (bkz. usePrefsStore → LOCAL-OTORİTER PLAN KORUMASI) ve kullanıcı eski ayarlarını geri alır.
 */
const SYNC = fs.readFileSync(
  path.resolve(__dirname, '../shared/hooks/usePrefsSync.ts'),
  'utf8',
);
const STORE = fs.readFileSync(
  path.resolve(__dirname, '../features/modes/store/usePrefsStore.ts'),
  'utf8',
);

describe('syncToCloud sonucu bildiriyor', () => {
  it('sözleşme boolean — "denendi" ile "başarıldı" ayrı', () => {
    expect(STORE).toMatch(/syncToCloud: \(\) => Promise<boolean>;/);
  });

  it('başarıda true, hatada false', () => {
    expect(STORE).toMatch(/await AuthService\.updateProfile\(\{ preferences: JSON\.stringify\(snapshot\) \}\);\s*\n\s*return true;/);
    expect(STORE).toMatch(/swallow\('prefsStore\.syncToCloud', err\);\s*\n\s*return false;/);
  });
});

describe('bekleyen değişiklik bayrağı', () => {
  it('yalnız BAŞARIDA temizleniyor', () => {
    const matches = SYNC.match(/syncToCloud\(\)\.then\(\(ok\) => \{ if \(ok\) dirty\.current = false; \}\)/g) ?? [];
    // İki çağrı noktası var: debounce zamanlayıcısı ve online/login geçişi.
    expect(matches.length).toBe(2);
  });

  it('istekten ÖNCE koşulsuz temizleme kalmadı', () => {
    // Kırılan satır tam olarak buydu.
    expect(SYNC).not.toMatch(/dirty\.current = false;\s*\n\s*usePrefsStore\.getState\(\)\.syncToCloud\(\);/);
  });

  it('çevrimdışı/çıkışta bayrak korunuyor — geçişte flush edilsin', () => {
    // Erken dönüş bayrağa DOKUNMAMALI, yoksa çevrimdışıyken yapılan değişiklik
    // tekrar çevrimiçi olunca hiç gönderilmez.
    expect(SYNC).toMatch(/if \(!logged \|\| !online\) return;/);
    expect(SYNC).toMatch(/if \(isLoggedIn && isOnline && dirty\.current\)/);
  });
});
