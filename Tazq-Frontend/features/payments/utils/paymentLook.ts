import type { LucideIcon } from 'lucide-react-native';
import { Home, Building2, Landmark, CreditCard, ShieldCheck, GraduationCap, Zap, Droplet, Flame, Wifi, Smartphone, Tv, Repeat, Car, Fuel, Dumbbell, HeartPulse, Baby, PawPrint, ShoppingBag, Receipt, Plane, Gift, Coins, Wallet } from 'lucide-react-native';
import { PaymentPalette } from '@/shared/constants/Colors';
import { matchProvider } from '@/shared/utils/paymentProviders';
import type { Payment } from '@/features/payments/store/usePaymentsStore';

/*
  ÖDEME GÖRÜNÜMÜ (2026-11-05, kullanıcı: "icon ve renk seçilebilmeli, her türlü ödeme düşünülmeli"). Öncelik: kullanıcı
  seçimi → başlıktan tanınan sağlayıcı → nötr cüzdan. Sunucuya yalnız anahtar gider, ikon nesnesi değil.
*/
export const PAYMENT_ICONS: Record<string, LucideIcon> = {
  home: Home, building: Building2, bank: Landmark, card: CreditCard, shield: ShieldCheck, school: GraduationCap,
  power: Zap, water: Droplet, gas: Flame, wifi: Wifi, phone: Smartphone, tv: Tv, sub: Repeat, car: Car, fuel: Fuel,
  gym: Dumbbell, health: HeartPulse, baby: Baby, pet: PawPrint, shop: ShoppingBag, tax: Receipt, travel: Plane,
  gift: Gift, saving: Coins, wallet: Wallet,
};

const P = PaymentPalette;
/** Hazır türler: dokununca başlık (boşsa), ikon ve renk birlikte gelir. */
export const PAYMENT_KINDS: { id: string; tr: string; en: string; icon: string; color: string }[] = [
  { id: 'rent', tr: 'Kira', en: 'Rent', icon: 'home', color: P[0] },
  { id: 'dues', tr: 'Aidat', en: 'Building fees', icon: 'building', color: P[9] },
  { id: 'loan', tr: 'Kredi', en: 'Loan', icon: 'bank', color: P[8] },
  { id: 'card', tr: 'Kredi kartı', en: 'Credit card', icon: 'card', color: P[6] },
  { id: 'insurance', tr: 'Sigorta', en: 'Insurance', icon: 'shield', color: P[2] },
  { id: 'school', tr: 'Okul', en: 'School', icon: 'school', color: P[1] },
  { id: 'tax', tr: 'Vergi', en: 'Tax', icon: 'tax', color: P[4] },
  { id: 'power', tr: 'Elektrik', en: 'Electricity', icon: 'power', color: P[4] },
  { id: 'water', tr: 'Su', en: 'Water', icon: 'water', color: P[1] },
  { id: 'gas', tr: 'Doğalgaz', en: 'Gas', icon: 'gas', color: P[5] },
  { id: 'net', tr: 'İnternet', en: 'Internet', icon: 'wifi', color: P[0] },
  { id: 'phone', tr: 'Telefon', en: 'Phone', icon: 'phone', color: P[8] },
  { id: 'sub', tr: 'Abonelik', en: 'Subscription', icon: 'sub', color: P[7] },
  { id: 'car', tr: 'Araç', en: 'Car', icon: 'car', color: P[9] },
  { id: 'gym', tr: 'Spor', en: 'Gym', icon: 'gym', color: P[3] },
  { id: 'health', tr: 'Sağlık', en: 'Health', icon: 'health', color: P[6] },
];

export const REMINDER_OPTIONS = [-1, 0, 1, 3, 7] as const;
export const DEFAULT_REMINDER_DAYS = 3;
export const reminderDaysOf = (p: Pick<Payment, 'reminderDays'>): number => p.reminderDays ?? DEFAULT_REMINDER_DAYS;

/** Yazılan ad hazır türlerden biriyse onun görünümü: "Kira" gri cüzdan kalmasın. */
const KIND_WORDS: Record<string, string[]> = {
  rent: ['kira', 'rent'], dues: ['aidat', 'site aidatı', 'building fees'], loan: ['kredi', 'taksit', 'loan', 'konut kredisi', 'ihtiyaç kredisi'], card: ['kredi kartı', 'credit card', 'kart'],
  insurance: ['sigorta', 'kasko', 'insurance'], school: ['okul', 'school', 'kreş', 'dershane'], tax: ['vergi', 'tax', 'emlak vergisi', 'gelir vergisi'], power: ['elektrik', 'electricity'],
  water: ['su', 'water'], gas: ['doğalgaz', 'dogalgaz', 'gas'], net: ['internet', 'i̇nternet'], phone: ['telefon', 'phone', 'fatura'], sub: ['abonelik', 'subscription'], car: ['araç', 'araba', 'car', 'mtv'],
  gym: ['spor', 'gym', 'spor salonu'], health: ['sağlık', 'health'],
};
function kindOf(title: string) {
  const q = title.trim().toLocaleLowerCase('tr-TR');
  return PAYMENT_KINDS.find(k => KIND_WORDS[k.id]?.includes(q));
}

export function paymentLook(p: Pick<Payment, 'title' | 'icon' | 'color'>): { icon: LucideIcon; color: string | null } {
  const provider = matchProvider(p.title);
  const kind = provider ? undefined : kindOf(p.title);
  const icon = (p.icon && PAYMENT_ICONS[p.icon]) || provider?.icon || (kind && PAYMENT_ICONS[kind.icon]) || Wallet;
  return { icon, color: p.color || provider?.color || kind?.color || null };
}
