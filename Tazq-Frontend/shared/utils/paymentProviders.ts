import type { LucideIcon } from 'lucide-react-native';
import { Flame, Zap, Droplet, Smartphone, Wifi, Tv, Music2, Youtube, ShoppingBag, Dumbbell, GraduationCap, ShieldCheck, Cloud, Palette, Notebook, Sparkles, Bot, Gamepad2, Lock, Headphones } from 'lucide-react-native';
import { PaymentProviderColors } from '@/shared/constants/Colors';

/**
 * Bilinen fatura/abonelik sağlayıcıları — yazarken ikon ÖNERİSİ için (bkz. odemeler.tsx
 * "Ne için" alanı, ExamCard'daki `PresetEditor` ile AYNI öneri deseni).
 *
 * GERÇEK MARKA LOGOSU KULLANILMIYOR — bilinçli karar (kullanıcıyla konuşuldu: marka
 * izni net değilse kullanılmaz). `lucide-react-native` bir GENEL ikon seti (Feather
 * tabanlı), gerçek marka logoları içermiyor (Youtube hariç — o zaten lucide'de var,
 * kendi ikon seti olarak). Sahte/yanlış bir logo göstermek ("Turkcell" yazınca generic
 * bir telefon ikonunu Turkcell'in kendi logosu gibi sunmak) kullanıcıyı yanıltır ve
 * marka izni sorunu doğurur. Bunun yerine KAVRAM ikonu + sağlayıcıya özgü ayırt edici
 * renk kullanılıyor (ör. İGDAŞ → alev ikonu + turuncu, Turkcell → telefon ikonu + sarı)
 * — "hangi TÜRden ödeme bu" sorusunu dürüstçe cevaplıyor, marka iddiası taşımıyor.
 *
 * Renkler `PaymentProviderColors`'tan (shared/constants/Colors.ts) geliyor, burada
 * ham hex YOK — bkz. __tests__/paletteDiscipline.test.ts.
 */
export interface PaymentProvider {
  id: string;
  name: string;
  /**
   * İngilizce görünen ad — SADECE marka olmayan, çevrilmesi gereken GENEL kategori
   * adları için (ör. "Sigorta" → "Insurance"). Marka adları (Netflix, İGDAŞ, AT&T…)
   * birer özel isimdir, hangi dilde olursa olsun AYNI yazılır — onlarda bu alan yok.
   * Eskiden tek `name` vardı: İngilizce arayüzde bir kategori önerisi seçince başlık
   * alanına TÜRKÇE metin ("Spor Salonu") yazılıyordu — yurt dışı kullanıcı için
   * yanlış dildeydi (bkz. odemeler.tsx'teki seçim mantığı, `providerDisplayName`).
   */
  nameEn?: string;
  aliases: string[];
  icon: LucideIcon;
  color: string;
}

/** Seçim/eşleşme sırasında dile uygun adı döndürür (bkz. `nameEn` notu). */
export function providerDisplayName(p: PaymentProvider, language: 'tr' | 'en'): string {
  return language === 'en' && p.nameEn ? p.nameEn : p.name;
}

const C = PaymentProviderColors;

export const PAYMENT_PROVIDERS: PaymentProvider[] = [
  // Doğalgaz
  { id: 'igdas', name: 'İGDAŞ', aliases: ['igdas', 'İgdaş'], icon: Flame, color: C.igdas },
  { id: 'baskentgaz', name: 'Başkentgaz', aliases: ['baskentgaz', 'başkentgaz'], icon: Flame, color: C.baskentgaz },
  { id: 'kayserigaz', name: 'Kayserigaz', aliases: ['kayserigaz'], icon: Flame, color: C.kayserigaz },
  { id: 'bursagaz', name: 'Bursagaz', aliases: ['bursagaz'], icon: Flame, color: C.bursagaz },
  { id: 'izgaz', name: 'İzgaz', aliases: ['izgaz'], icon: Flame, color: C.izgaz },
  // Elektrik
  { id: 'bedas', name: 'BEDAŞ', aliases: ['bedas'], icon: Zap, color: C.bedas },
  { id: 'ayedas', name: 'AYEDAŞ', aliases: ['ayedas'], icon: Zap, color: C.ayedas },
  { id: 'ck-bogazici', name: 'CK Boğaziçi', aliases: ['ck bogazici', 'ck boğaziçi', 'bogazici elektrik', 'boğaziçi elektrik'], icon: Zap, color: C.ckBogazici },
  { id: 'enerjisa', name: 'Enerjisa', aliases: ['enerjisa'], icon: Zap, color: C.enerjisa },
  { id: 'baskent-edas', name: 'Başkent EDAŞ', aliases: ['baskent edas', 'başkent edaş'], icon: Zap, color: C.baskentEdas },
  { id: 'akdeniz-elektrik', name: 'Akdeniz Elektrik', aliases: ['akdeniz elektrik'], icon: Zap, color: C.akdenizElektrik },
  { id: 'osmangazi-elektrik', name: 'Osmangazi Elektrik', aliases: ['osmangazi elektrik', 'osmangazi'], icon: Zap, color: C.osmangazi },
  // Su
  { id: 'iski', name: 'İSKİ', aliases: ['iski'], icon: Droplet, color: C.iski },
  { id: 'aski', name: 'ASKİ', aliases: ['aski'], icon: Droplet, color: C.aski },
  { id: 'buski', name: 'BUSKİ', aliases: ['buski'], icon: Droplet, color: C.buski },
  { id: 'izsu', name: 'İZSU', aliases: ['izsu'], icon: Droplet, color: C.izsu },
  // Mobil hat
  { id: 'turkcell', name: 'Turkcell', aliases: ['turkcell'], icon: Smartphone, color: C.turkcell },
  { id: 'vodafone', name: 'Vodafone', aliases: ['vodafone'], icon: Smartphone, color: C.vodafone },
  { id: 'turk-telekom', name: 'Türk Telekom', aliases: ['turk telekom', 'türk telekom', 'ttmobil'], icon: Smartphone, color: C.turkTelekom },
  // İnternet
  { id: 'turknet', name: 'Türknet', aliases: ['turknet', 'türknet'], icon: Wifi, color: C.turknet },
  { id: 'superonline', name: 'Superonline', aliases: ['superonline'], icon: Wifi, color: C.superonline },
  { id: 'ttnet', name: 'TTNET', aliases: ['ttnet'], icon: Wifi, color: C.ttnet },
  { id: 'millenicom', name: 'Millenicom', aliases: ['millenicom'], icon: Wifi, color: C.millenicom },
  { id: 'vodafone-net', name: 'Vodafone Net', aliases: ['vodafone net'], icon: Wifi, color: C.vodafoneNet },
  // Video/TV aboneliği
  { id: 'netflix', name: 'Netflix', aliases: ['netflix'], icon: Tv, color: C.netflix },
  { id: 'disney-plus', name: 'Disney+', aliases: ['disney+', 'disney plus', 'disney'], icon: Tv, color: C.disneyPlus },
  { id: 'exxen', name: 'Exxen', aliases: ['exxen'], icon: Tv, color: C.exxen },
  { id: 'blutv', name: 'BluTV', aliases: ['blutv', 'blu tv'], icon: Tv, color: C.blutv },
  { id: 'amazon-prime', name: 'Amazon Prime', aliases: ['amazon prime', 'prime video'], icon: ShoppingBag, color: C.amazonPrime },
  { id: 'youtube-premium', name: 'YouTube Premium', aliases: ['youtube premium', 'youtube'], icon: Youtube, color: C.youtubePremium },
  { id: 'bein-connect', name: 'beIN Connect', aliases: ['bein connect', 'bein sports'], icon: Tv, color: C.beinConnect },
  { id: 'digiturk', name: 'Digiturk', aliases: ['digiturk'], icon: Tv, color: C.digiturk },
  { id: 'gain', name: 'Gain', aliases: ['gain'], icon: Tv, color: C.gain },
  { id: 'mubi', name: 'MUBI', aliases: ['mubi'], icon: Tv, color: C.mubi },
  { id: 'tabii', name: 'Tabii', aliases: ['tabii'], icon: Tv, color: C.tabii },
  { id: 'tivibu', name: 'Tivibu', aliases: ['tivibu'], icon: Tv, color: C.tivibu },
  { id: 's-sport', name: 'S Sport', aliases: ['s sport', 's sport plus'], icon: Tv, color: C.sSport },
  { id: 'd-smart', name: 'D-Smart', aliases: ['d-smart', 'd smart', 'dsmart'], icon: Tv, color: C.dSmart },
  { id: 'puhutv', name: 'puhutv', aliases: ['puhutv', 'puhu tv'], icon: Tv, color: C.puhutv },
  // Müzik aboneliği
  { id: 'spotify', name: 'Spotify', aliases: ['spotify'], icon: Music2, color: C.spotify },
  { id: 'apple-music', name: 'Apple Music', aliases: ['apple music'], icon: Music2, color: C.appleMusic },
  { id: 'youtube-music', name: 'YouTube Music', aliases: ['youtube music'], icon: Music2, color: C.youtubeMusic },
  { id: 'fizy', name: 'Fizy', aliases: ['fizy'], icon: Music2, color: C.fizy },
  // Bulut & üretkenlik abonelikleri
  { id: 'icloud', name: 'iCloud+', aliases: ['icloud', 'icloud+'], icon: Cloud, color: C.icloud },
  { id: 'google-one', name: 'Google One', aliases: ['google one'], icon: Cloud, color: C.googleOne },
  { id: 'microsoft-365', name: 'Microsoft 365', aliases: ['microsoft 365', 'office 365'], icon: Notebook, color: C.microsoft365 },
  { id: 'adobe-cc', name: 'Adobe Creative Cloud', aliases: ['adobe creative cloud', 'adobe cc', 'adobe'], icon: Palette, color: C.adobeCc },
  { id: 'dropbox', name: 'Dropbox', aliases: ['dropbox'], icon: Cloud, color: C.dropbox },
  { id: 'canva', name: 'Canva Pro', aliases: ['canva', 'canva pro'], icon: Palette, color: C.canva },
  { id: 'notion', name: 'Notion', aliases: ['notion'], icon: Notebook, color: C.notion },
  // Yapay zeka abonelikleri
  { id: 'chatgpt-plus', name: 'ChatGPT Plus', aliases: ['chatgpt plus', 'chatgpt', 'openai'], icon: Sparkles, color: C.chatgptPlus },
  { id: 'claude-pro', name: 'Claude Pro', aliases: ['claude pro', 'claude', 'anthropic'], icon: Bot, color: C.claudePro },
  { id: 'gemini-advanced', name: 'Gemini Advanced', aliases: ['gemini advanced', 'gemini', 'google ai pro'], icon: Sparkles, color: C.geminiAdvanced },
  { id: 'perplexity-pro', name: 'Perplexity Pro', aliases: ['perplexity pro', 'perplexity'], icon: Sparkles, color: C.perplexityPro },
  { id: 'github-copilot', name: 'GitHub Copilot', aliases: ['github copilot', 'copilot'], icon: Bot, color: C.githubCopilot },
  { id: 'midjourney', name: 'Midjourney', aliases: ['midjourney'], icon: Sparkles, color: C.midjourney },
  // VPN / gizlilik abonelikleri
  { id: 'nordvpn', name: 'NordVPN', aliases: ['nordvpn', 'nord vpn'], icon: Lock, color: C.nordvpn },
  { id: 'expressvpn', name: 'ExpressVPN', aliases: ['expressvpn', 'express vpn'], icon: Lock, color: C.expressvpn },
  // Sesli kitap / podcast aboneliği
  { id: 'audible', name: 'Audible', aliases: ['audible'], icon: Headphones, color: C.audible },
  { id: 'storytel', name: 'Storytel', aliases: ['storytel'], icon: Headphones, color: C.storytel },
  // Eğitim platformları (kurumsal/online)
  { id: 'coursera', name: 'Coursera', aliases: ['coursera'], icon: GraduationCap, color: C.coursera },
  { id: 'linkedin-learning', name: 'LinkedIn Learning', aliases: ['linkedin learning'], icon: GraduationCap, color: C.linkedinLearning },
  // Bulut depolama
  { id: 'mega', name: 'MEGA', aliases: ['mega'], icon: Cloud, color: C.mega },
  { id: 'pcloud', name: 'pCloud', aliases: ['pcloud'], icon: Cloud, color: C.pcloud },
  // Yayın hizmeti
  { id: 'hbo-max', name: 'HBO Max', aliases: ['hbo max', 'max'], icon: Tv, color: C.hboMax },
  // Mobil hat
  { id: 'pttcell', name: 'Pttcell', aliases: ['pttcell'], icon: Smartphone, color: C.pttcell },
  // Spor salonu zinciri
  { id: 'sportive', name: 'Sportive', aliases: ['sportive'], icon: Dumbbell, color: C.sportive },
  // Sigorta şirketleri
  { id: 'allianz', name: 'Allianz Sigorta', aliases: ['allianz', 'allianz sigorta'], icon: ShieldCheck, color: C.allianz },
  { id: 'axa-sigorta', name: 'AXA Sigorta', aliases: ['axa', 'axa sigorta'], icon: ShieldCheck, color: C.axaSigorta },
  { id: 'turkiye-sigorta', name: 'Türkiye Sigorta', aliases: ['turkiye sigorta', 'türkiye sigorta'], icon: ShieldCheck, color: C.turkiyeSigorta },
  // Oyun abonelikleri
  { id: 'playstation-plus', name: 'PlayStation Plus', aliases: ['playstation plus', 'ps plus', 'ps+'], icon: Gamepad2, color: C.playstationPlus },
  { id: 'xbox-game-pass', name: 'Xbox Game Pass', aliases: ['xbox game pass', 'game pass'], icon: Gamepad2, color: C.xboxGamePass },
  { id: 'nintendo-online', name: 'Nintendo Switch Online', aliases: ['nintendo switch online', 'nintendo online'], icon: Gamepad2, color: C.nintendoOnline },
  { id: 'steam', name: 'Steam', aliases: ['steam'], icon: Gamepad2, color: C.steam },
  // Alışveriş aboneliği
  { id: 'trendyol-premium', name: 'Trendyol Premium', aliases: ['trendyol premium', 'trendyol'], icon: ShoppingBag, color: C.trendyolPremium },
  { id: 'hepsiburada-premium', name: 'Hepsiburada Premium', aliases: ['hepsiburada premium', 'hepsiburada'], icon: ShoppingBag, color: C.hepsiburadaPremium },
  // Spor/eğitim/sigorta — yaygın diğer abonelik türleri
  { id: 'gym', name: 'Spor Salonu', nameEn: 'Gym', aliases: ['spor salonu', 'gym', 'fitness', 'macfit'], icon: Dumbbell, color: C.gym },
  { id: 'education', name: 'Eğitim/Kurs', nameEn: 'Education', aliases: ['kurs', 'egitim', 'eğitim', 'course', 'education', 'class', 'online course'], icon: GraduationCap, color: C.education },
  { id: 'udemy', name: 'Udemy', aliases: ['udemy'], icon: GraduationCap, color: C.udemy },
  { id: 'insurance', name: 'Sigorta', nameEn: 'Insurance', aliases: ['sigorta', 'insurance'], icon: ShieldCheck, color: C.insurance },

  /*
    MARKA-BAĞIMSIZ GENEL KATEGORİLER — Türkiye dışında 190+ ülkenin yerel elektrik/
    gaz/su/operatör/internet sağlayıcısını tek tek listelemek mümkün değil (yukarıdaki
    İGDAŞ/BEDAŞ/İSKİ gibi TR'ye özel kayıtlar yurt dışında hiçbir şeye karşılık gelmiyor).
    Kullanıcı kendi yerel sağlayıcısının adını yazdığında marka eşleşmese bile en azından
    DOĞRU TÜRDE bir ikon+renk alsın — bu yüzden jenerik "elektrik/gaz/su/operatör/internet"
    kategorileri de öneriliyor (gym/education/insurance ile AYNI, zaten var olan desen).
  */
  { id: 'electric-generic', name: 'Elektrik', nameEn: 'Electric Company', aliases: ['elektrik', 'electric', 'electricity', 'power bill'], icon: Zap, color: C.electricGeneric },
  { id: 'gas-generic', name: 'Doğalgaz', nameEn: 'Gas Company', aliases: ['doğalgaz', 'dogalgaz', 'gas', 'natural gas'], icon: Flame, color: C.gasGeneric },
  { id: 'water-generic', name: 'Su', nameEn: 'Water Company', aliases: ['su', 'water', 'water bill'], icon: Droplet, color: C.waterGeneric },
  { id: 'mobile-generic', name: 'Mobil Hat', nameEn: 'Mobile Carrier', aliases: ['mobil hat', 'cep telefonu hattı', 'mobile', 'carrier', 'phone bill'], icon: Smartphone, color: C.mobileGeneric },
  { id: 'internet-generic', name: 'İnternet', nameEn: 'Internet Provider', aliases: ['internet', 'broadband', 'wifi bill'], icon: Wifi, color: C.internetGeneric },

  // Uluslararası mobil operatörler (ABD/İngiltere) — Vodafone/Turkcell gibi küresel
  // markalar yukarıda zaten var, burada sadece onlarla aynı ülkelerde olmayanlar.
  { id: 'att', name: 'AT&T', aliases: ['at&t', 'att'], icon: Smartphone, color: C.att },
  { id: 'verizon', name: 'Verizon', aliases: ['verizon'], icon: Smartphone, color: C.verizon },
  { id: 't-mobile', name: 'T-Mobile', aliases: ['t-mobile', 'tmobile'], icon: Smartphone, color: C.tMobile },
  { id: 'ee', name: 'EE', aliases: ['ee mobile', 'ee'], icon: Smartphone, color: C.ee },
  { id: 'o2', name: 'O2', aliases: ['o2'], icon: Smartphone, color: C.o2 },
  { id: 'three', name: 'Three', aliases: ['three mobile', 'three'], icon: Smartphone, color: C.three },
  // Uluslararası internet/kablo sağlayıcıları (ABD/İngiltere)
  { id: 'comcast-xfinity', name: 'Comcast Xfinity', aliases: ['comcast', 'xfinity', 'comcast xfinity'], icon: Wifi, color: C.comcastXfinity },
  { id: 'spectrum', name: 'Spectrum', aliases: ['spectrum'], icon: Wifi, color: C.spectrum },
  { id: 'cox', name: 'Cox', aliases: ['cox', 'cox communications'], icon: Wifi, color: C.cox },
  { id: 'bt', name: 'BT', aliases: ['bt broadband', 'british telecom', 'bt'], icon: Wifi, color: C.bt },
  { id: 'sky', name: 'Sky', aliases: ['sky broadband', 'sky'], icon: Wifi, color: C.sky },
  { id: 'virgin-media', name: 'Virgin Media', aliases: ['virgin media', 'virgin'], icon: Wifi, color: C.virginMedia },
  // Uluslararası enerji sağlayıcıları (İngiltere)
  { id: 'british-gas', name: 'British Gas', aliases: ['british gas'], icon: Flame, color: C.britishGas },
  { id: 'eon', name: 'E.ON', aliases: ['e.on', 'eon'], icon: Zap, color: C.eon },
  { id: 'edf-energy', name: 'EDF Energy', aliases: ['edf energy', 'edf'], icon: Zap, color: C.edfEnergy },
  { id: 'octopus-energy', name: 'Octopus Energy', aliases: ['octopus energy', 'octopus'], icon: Zap, color: C.octopusEnergy },
  // Uluslararası sigorta şirketleri (ABD/İngiltere)
  { id: 'geico', name: 'GEICO', aliases: ['geico'], icon: ShieldCheck, color: C.geico },
  { id: 'state-farm', name: 'State Farm', aliases: ['state farm'], icon: ShieldCheck, color: C.stateFarm },
  { id: 'allstate', name: 'Allstate', aliases: ['allstate'], icon: ShieldCheck, color: C.allstate },
  { id: 'progressive', name: 'Progressive', aliases: ['progressive'], icon: ShieldCheck, color: C.progressive },
  { id: 'direct-line', name: 'Direct Line', aliases: ['direct line'], icon: ShieldCheck, color: C.directLine },
  { id: 'aviva', name: 'Aviva', aliases: ['aviva'], icon: ShieldCheck, color: C.aviva },
];

/*
  TÜRKÇE I/İ PROBLEMİ: `toLocaleLowerCase('tr')` "I"yı "ı"ya çevirir (doğru Türkçe
  davranış) ama burada her İKİSİNİ de ASCII 'i'ye eşlemek istiyoruz ki "IGDAS" ve
  "İGDAŞ" aynı anahtara düşsün. Bu yüzden İ/I/ı ÖNCE 'i'ye sabitleniyor, SONRA
  locale'den bağımsız `toLowerCase()` çalışıyor — sıra önemli (önce locale'e
  bırakılsaydı "I" sessizce "ı"ya düşer, replace'ler artık büyük harfi bulamazdı).
*/
function norm(s: string): string {
  return s
    .replace(/İ/g, 'i').replace(/I/g, 'i').replace(/ı/g, 'i')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .trim();
}

/** Tam/alias eşleşmesi — kayıtlı bir ödemenin satırında ikon göstermek için. */
export function matchProvider(input: string): PaymentProvider | null {
  const key = norm(input);
  if (!key) return null;
  for (const p of PAYMENT_PROVIDERS) {
    if (norm(p.name) === key || (p.nameEn && norm(p.nameEn) === key) || p.aliases.some(a => norm(a) === key)) return p;
  }
  return null;
}

/**
 * Yazarken kısmi eşleşme — öneri listesi için, ALAKA SIRASINA göre (en fazla `limit`
 * sonuç). Eskiden tek kriter "içeriyor mu" idi — bu, "net" yazınca "İnternet" gibi
 * İÇİNDE geçen ama kullanıcının kastetmediği bir eşleşmeyi "Netflix" (başında geçen,
 * asıl kastedilen) ile AYNI öncelikte gösterebiliyordu. Artık üç seviye var:
 * tam eşleşme > BAŞINDA geçme (prefix) > herhangi bir yerde geçme — "daha akıllı
 * tahmin" tam olarak bu sıralama.
 */
export function searchProviders(input: string, limit = 4): PaymentProvider[] {
  const key = norm(input);
  if (!key || key.length < 2) return [];
  const scoreOf = (p: PaymentProvider): number => {
    const tokens = [p.name, ...(p.nameEn ? [p.nameEn] : []), ...p.aliases].map(norm);
    if (tokens.some(t => t === key)) return 3;
    if (tokens.some(t => t.startsWith(key))) return 2;
    if (tokens.some(t => t.includes(key))) return 1;
    return 0;
  };
  return PAYMENT_PROVIDERS
    .map(p => ({ p, score: scoreOf(p) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => x.p);
}
