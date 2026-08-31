import { isGuestSession } from '@/shared/store/useSessionStore';
import { useLanguageStore } from '@/shared/store/useLanguageStore';

/**
 * "KAYDEDİLDİ" MESAJI — sebebine göre doğru cümle.
 *
 * ── ÖLÇÜLEN SORUN ─────────────────────────────────────────────────────────────
 * Bir işlem sunucuya yazılamayıp yerelde kaldığında 11 ayrı yerde aynı cümle elle
 * yazılıydı: "Çevrimdışı kaydedildi" / "Saved offline". Misafir modu gelince bu
 * cümle YANLIŞ oldu — hesapsız kullanıcının interneti var, biz bilerek istek
 * atmıyoruz. Ona "çevrimdışısın" demek, olmayan bir sorunu varmış gibi göstermek.
 *
 * Aynı olayın iki farklı sebebi var ve kullanıcı için ikisi farklı şey demek:
 *   · çevrimdışı → "bağlantı gelince eşitlenecek"
 *   · misafir    → "bu cihazda duruyor" (hesap açınca taşınacak)
 *
 * Tek yerde toplanması, 11 kopyanın zamanla ayrışmasını da bitiriyor.
 */
export function savedLocallyMessage(): string {
  const t = useLanguageStore.getState().t;
  return isGuestSession() ? t.guest.savedLocally : t.savedOffline;
}
