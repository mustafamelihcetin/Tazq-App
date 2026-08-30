/**
 * HESAP SİLME — SESSİZ BAŞARISIZLIK YASAK.
 *
 * ÖLÇÜLEN SORUN: `AuthService.deleteAccount` sonucu yutuyordu ve çağıran da ikinci kez
 * yutuyordu; ardından ne olursa olsun `logout()` + `/login` çalışıyordu. Çevrimdışı bir
 * kullanıcı "SİL" yazıp onaylıyor, login ekranında buluyor kendini, hesabının gittiğini
 * sanıyordu — hesap sunucuda duruyordu. Geri alınamaz bir işlemin sonucu, onu yapan
 * kişiden saklanamaz.
 *
 * Bu testler kaynak metni denetler: davranışın kendisi UI'da (settings.tsx), ama
 * geri sızmanın yolu tek tek masum görünen üç karardan geçiyor — servis yutsun,
 * çağıran yutsun, çıkış koşulsuz olsun. Üçü de burada kapalı.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** Yorumları at — "ölü kopya yok" iddiası KODA bakmalı, yorumdaki referansa değil. */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !l.trim().startsWith('//')).join('\n');

describe('AuthService.deleteAccount', () => {
  const api = read('shared/services/api.ts');
  const block = api.slice(api.indexOf('deleteAccount:'), api.indexOf('deleteAccount:') + 400);

  it('hatayı YUTMAZ — çağırana fırlatır', () => {
    expect(block).not.toContain('swallow');
    expect(block).not.toMatch(/catch/);
  });

  it('silme isteğini gerçekten atar', () => {
    expect(block).toContain("api.delete('/api/users/me')");
  });
});

describe('DeleteAccountModal — silme akışı', () => {
  const src = read('features/user/components/DeleteAccountModal.tsx');
  const fn = src.slice(src.indexOf('const performDelete'), src.indexOf('const performDelete') + 1200);

  it('başarısızlıkta ERKEN ÇIKAR — onDeleted çalışmaz', () => {
    const catchIdx = fn.indexOf('catch');
    const returnIdx = fn.indexOf('return;', catchIdx);
    const doneIdx = fn.indexOf('onDeleted()');
    expect(catchIdx).toBeGreaterThan(-1);
    expect(returnIdx).toBeGreaterThan(catchIdx);
    // erken return, onDeleted'tan ÖNCE gelmeli
    expect(returnIdx).toBeLessThan(doneIdx);
  });

  it('başarısızlıkta kullanıcıya sebep gösterir', () => {
    expect(fn).toContain('setError(errorTextFor(e))');
  });

  it('404 (zaten silinmiş) başarı sayılır', () => {
    expect(fn).toContain('httpStatusOf(e) !== 404');
  });

  it("hata Sentry'ye kaydedilir — sessizce kaybolmaz", () => {
    expect(fn).toContain('{ capture: true }');
  });

  it('silme KUYRUĞA ALINMAZ — sonucu kullanıcı anında bilmeli', () => {
    expect(src).not.toContain('useOfflineQueue');
    expect(src).not.toContain('enqueue');
  });

  it('hata metni modalda gösteriliyor', () => {
    expect(src).toContain('{error && (');
    expect(src).toContain('accessibilityRole="alert"');
  });

  it('modal her kapanışta durumu temizler', () => {
    const dismiss = src.slice(src.indexOf('const dismiss'), src.indexOf('const dismiss') + 250);
    expect(dismiss).toContain('setError(null)');
    expect(dismiss).toContain("setConfirmText('')");
  });

  it('üç hata durumu AYRI cümleyle anlatılır (ağ / oturum / sunucu)', () => {
    const helper = src.slice(src.indexOf('const errorTextFor'), src.indexOf('const errorTextFor') + 1600);
    expect(helper).toContain('isNetworkError(e)');
    expect(helper).toMatch(/status === 401/);
    // Hepsi "hesabın silinmedi"yi açıkça söylemeli — belirsizlik bırakılmaz
    expect((helper.match(/SİLİNMEDİ/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect((helper.match(/NOT deleted/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });
});

describe('settings.tsx — modalı bağlar, mantığı taşımaz', () => {
  const src = stripComments(read('app/settings.tsx'));

  it('bileşeni kullanır', () => {
    expect(src).toContain('<DeleteAccountModal');
  });

  it('çıkışı YALNIZ onDeleted üzerinden yapar', () => {
    const usage = src.slice(src.indexOf('<DeleteAccountModal'), src.indexOf('<DeleteAccountModal') + 600);
    expect(usage).toContain('onDeleted={');
    expect(usage).toMatch(/onDeleted=\{[^}]*logout\(\)/);
  });

  it('silme mantığının kopyası burada kalmadı', () => {
    expect(src).not.toContain('AuthService.deleteAccount');
    expect(src).not.toContain('deleteConfirmText');
    expect(src).not.toContain('DELETE_WORD');
  });
});

describe('profile.tsx — ölü ikiz kaldırıldı', () => {
  const src = stripComments(read('app/profile.tsx'));

  it('hesap silme akışının ölü kopyası yok', () => {
    expect(src).not.toContain('performDeleteAccount');
    expect(src).not.toContain('deleteConfirmText');
    expect(src).not.toContain('DELETE_WORD');
  });

  it('şifre değiştirmenin ölü kopyası yok', () => {
    expect(src).not.toContain('performChangePassword');
    expect(src).not.toContain('setPwModalVisible');
  });

  it('AuthService.deleteAccount artık burada çağrılmıyor', () => {
    expect(src).not.toContain('AuthService.deleteAccount');
  });
});
