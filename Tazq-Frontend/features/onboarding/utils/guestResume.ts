/**
 * YARIM KALAN MİSAFİRLİK (2026-11-01, kullanıcı: "hesapsız giriş yapılıyorsa her girişinde profilini oluştur
 * gelmesin; onu doldurmadan kapatıyorsa tekrar loginden devam etmeli").
 *
 * "Hesapsız göz at" misafirliği başlatır ve hoş geldini (profil) BEKLEMEYE alır; ikisi de diske yazılı.
 * Profili doldurmadan uygulamayı kapatan kişi her açılışta yine o ekrana düşüyordu. Kural: soğuk açılışta
 * misafir hoş geldini bitirmemişse misafirlik bırakılır, giriş ekranından başlanır. Yalnız açılışta, bir
 * kez uygulanır — aynı oturumda "göz at"a yeni basan kişi etkilenmez. Misafir verisi bu noktada boştur:
 * görev/alışkanlık girişi ("Aklındakileri yaz") hoş geldinden SONRA gelir.
 */
export function shouldAbandonGuest(p: { isGuest: boolean; isLoggedIn: boolean; welcomeStatus: string }): boolean {
  return p.isGuest && !p.isLoggedIn && p.welcomeStatus === 'pending';
}
