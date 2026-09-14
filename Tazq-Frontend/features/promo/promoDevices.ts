/*
  TANITIM ÇERÇEVELERİNİN CİHAZ TABLOSU.

  ── NEDEN DÖRT CİHAZ ──────────────────────────────────────────────────────────
  Her iki mağaza da ayrı görsel seti istiyor ve bunlar birbirinin kopyası olamaz:
  App Store'da iPhone ve iPad, Play'de telefon ve tablet. Üstelik uygulama dört
  yerde de farklı duruyor — sekme çubuğu iOS'ta yüzen cam kapsül, Android'de dibe
  yapışık opak çubuk; tablette ise içerik MAX_W'de (600pt) ortalı bir sütuna
  sıkışıyor ve iki yanda zemin görünüyor. "Aynı görseli her yere koy" demek,
  üçünde birden yanlış bir vaatte bulunmak demek.

  ── SAYILAR NEREDEN GELİYOR ───────────────────────────────────────────────────
  Gerçek referans cihazların MANTIKSAL ölçüleri (piksel değil, pt/dp) ve kendi
  güvenli alanları. Uydurulmuş bir "ortalama telefon" yok: ölçek referansı gerçek
  cihaz olmazsa korunan oran, var olmayan bir cihazın oranı olur — bu bir kez
  yaşandı ve mock'taki her şey 1.68 kat büyük çizildi.

  Kamera kesiti yalnız iPhone'da görünür. iPad Pro ve Pixel Tablet kameralarını
  UZUN kenara taşıdı (yatay kullanım için); dikey çerçevede kesit üst kenarda
  değil, sol kenarın ortasında kalır — yani üstte gösterilecek bir şey yok.
*/

export type PromoPlatform = 'ios' | 'android';

export type PromoDevice = {
  /** Hangi platformun arayüz dili çizilecek. */
  platform: PromoPlatform;
  /** Mantıksal ekran ölçüsü (pt / dp). Ölçeğin referansı budur. */
  w: number;
  h: number;
  /** Ekran köşesinin yarıçapı. */
  radius: number;
  /** Üst güvenli alan (durum çubuğu / ada). */
  topInset: number;
  /** Alt güvenli alan (ana ekran göstergesi / jest şeridi). */
  bottomInset: number;
  /** Dynamic Island var mı — saat ve göstergeler adanın iki yanına hizalanır. */
  island: boolean;
  /** İçerik MAX_W sütununa sıkışıyor mu (yani ekran 600pt'den geniş mi). */
  wide: boolean;
  /** Düğmede görünen ad. */
  label: string;
};

export type PromoDeviceId = 'iphone' | 'ipad' | 'pixel' | 'pixelTablet';

export const PROMO_DEVICES: Record<PromoDeviceId, PromoDevice> = {
  // iPhone 16 Pro
  iphone: { platform: 'ios', w: 393, h: 852, radius: 55, topInset: 59, bottomInset: 34, island: true, wide: false, label: 'iPhone' },
  // iPad Pro 13" — App Store'un istediği tablet boyutu
  ipad: { platform: 'ios', w: 1032, h: 1376, radius: 18, topInset: 24, bottomInset: 20, island: false, wide: true, label: 'iPad' },
  // Pixel 8
  pixel: { platform: 'android', w: 412, h: 915, radius: 34, topInset: 28, bottomInset: 24, island: false, wide: false, label: 'Pixel' },
  // Pixel Tablet
  pixelTablet: { platform: 'android', w: 800, h: 1280, radius: 25, topInset: 24, bottomInset: 24, island: false, wide: true, label: 'Pixel Tablet' },
};

/** Cihaz düğmesinin sırası: önce iki iOS, sonra iki Android. */
export const PROMO_DEVICE_ORDER: PromoDeviceId[] = ['iphone', 'ipad', 'pixel', 'pixelTablet'];
