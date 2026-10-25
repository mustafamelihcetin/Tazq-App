/**
 * KİMLİK DOĞRULAMA SONRASI EVE DÖNÜŞ — tek yol.
 *
 * Giriş/kayıt ekranı çoğu zaman ana sayfanın ÜSTÜNE açılıyor (misafir → profil → kayıt).
 * ana sayfaya `replace` ile dönmek o ekranı YENİ bir ana sayfayla değiştiriyordu; eskisi altta
 * kalıyor, yığında iki ana sayfa oluşuyordu. Görünen yenisi arka planda kurulduğu için
 * giriş animasyonları çalışmıyordu (selamlama görünmez, sekme vurgusu yok) ve geri tuşu
 * ikinci ana sayfayı açıyordu (cihazda görüldü, 2026-10-25; bkz. authNavigation.test.ts).
 *
 * `dismissTo('/')`: yığında ana sayfa varsa ONA geri döner; yoksa (uygulama doğrudan
 * giriş ekranıyla açıldıysa) ana sayfayı açar.
 */
export function goHome(router: { dismissTo: (href: '/') => void }): void {
  router.dismissTo('/');
}

/**
 * Kimlik doğrulama sonrası — aynı yol. Ayarlar, odak, tanıtım gibi ana sayfanın ÜSTÜNE
 * açılan her ekranın "eve dön"ü de `goHome` kullanır (ayarlardaki "turları yeniden göster"
 * aynı çift ana sayfayı üretiyordu; cihazda görüldü).
 */
export const goHomeAfterAuth = goHome;
