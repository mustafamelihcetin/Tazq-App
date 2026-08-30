import React from 'react';
import { Text } from 'react-native';
import * as Lucide from 'lucide-react-native';

/**
 * EMOJİ → ÇİZGİSEL İKON EŞLEMESİ.
 *
 * Mod ve alışkanlık VERİSİ emojiyle etiketlenir (`emoji: '🌙'`) ama ekrana emoji
 * çizilmez: sistem emojisi platformdan platforma farklı çizilir, temayı dinlemez ve
 * paletin dışındadır. Bu tablo veriyi uygulamanın ikon diline çevirir.
 *
 * ── NEDEN TABLO, SWITCH DEĞİL ─────────────────────────────────────────────────
 * Burası 125 dallı bir `switch` idi ve iki bedeli vardı:
 *
 *  1. HER SATIRDA, HER ÇİZİMDE DOĞRUSAL ARAMA. Fonksiyon liste satırı başına
 *     çağrılıyor (SporCard, modlar, mod-ozet, TurkishModeBanner); 20 satırlık bir
 *     alışkanlık listesi, satır başına 125 string karşılaştırmasına kadar yürüyordu.
 *     Nesne araması sabit zamanlıdır.
 *  2. EKSİK EŞLEME SESSİZ. Eşlemesi olmayan emoji fallback'e düşüp HAM çiziliyor —
 *     yani hata, ekrana bakan biri fark edene kadar görünmüyor. Bir zamanlar veri
 *     dosyalarındaki `emoji:` alanları bu switch ile ELLE karşılaştırılıp 20 eksik
 *     bulunmuştu; o denetim veri her büyüdüğünde tekrarlanmak zorundaydı. Tablo
 *     hâlinde aynı denetim tek satırlık bir testtir (bkz. __tests__/modeIcons.test.ts).
 *
 * FALLBACK KORUNUYOR: eşlemesi olmayan emoji yine ham çizilir. Boş bırakmak, ikonu
 * olmayan satırı ikonsuz ve boşluklu göstermek demekti — bkz. spor hedef çiplerinin
 * boş `<Text>` çizdiği hata.
 */
export const MODE_ICONS: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  // Modes & Templates
  '🌙': Lucide.Moon,
  // ── Alışkanlık seçicisi için ek glifler ──────────────────────────────
  // Bu emojilerin eşlemesi yoktu; eşleme bulunmayınca ham emoji çiziliyor ve
  // satırdaki diğer çizgisel ikonların yanında yamalı duruyor (AppIcon dili bozulur).
  '🚴': Lucide.Bike,
  '📷': Lucide.Camera,
  '☕': Lucide.Coffee,
  '👥': Lucide.Users,
  '⏱️': Lucide.Timer,
  '🧹': Lucide.Sparkles,
  '🗣️': Lucide.Languages,
  '🌅': Lucide.Sunrise,
  '📚': Lucide.BookOpen,
  '🏛️': Lucide.Landmark,
  '🎓': Lucide.GraduationCap,
  '✍️': Lucide.PenTool,
  '🏁': Lucide.Flag,
  '💻': Lucide.Laptop,
  '📊': Lucide.ChartColumnIncreasing,
  '⚡': Lucide.Zap,
  '🔥': Lucide.Flame,
  '💥': Lucide.Zap,
  '🚀': Lucide.Rocket,
  '👍': Lucide.CircleCheck,
  '🌱': Lucide.Sprout,
  '📈': Lucide.TrendingUp,
  '📉': Lucide.TrendingDown,
  '👑': Lucide.Crown,
  '💤': Lucide.Moon,
  '🏗️': Lucide.Hammer,
  '🧪': Lucide.FlaskConical,
  '🗂️': Lucide.Layers,
  '🔒': Lucide.Lock,
  '🧩': Lucide.Puzzle,
  '💼': Lucide.Briefcase,
  // Activity (kalp-atisi cizgisi) idi ve meditasyonla AYNI ikonu paylasiyordu.
  // Kosu icin ayak izi hem ayirt edici hem anlami dogrudan tasiyor.
  '🏃': Lucide.Footprints,
  '⚖️': Lucide.Scale,
  '📝': Lucide.FileText,
  '🎯': Lucide.Target,
  '🗺️': Lucide.Map,
  '✏️': Lucide.PenTool,
  '🤝': Lucide.Handshake,
  '⚠️': Lucide.TriangleAlert,
  '🙏': Lucide.Heart,
  '🏆': Lucide.Trophy,
  '✨': Lucide.Sparkles,
  '📅': Lucide.Calendar,
  '💪': Lucide.Dumbbell,
  // Kosuyla ayni Activity ikonunu paylasiyordu. Meditasyon icin sakin,
  // nefes cagristiran bir glif.
  '🧘': Lucide.Wind,
  '🧠': Lucide.Brain,
  '💰': Lucide.PiggyBank,
  '🧾': Lucide.Receipt,
  '💳': Lucide.CreditCard,
  '💸': Lucide.Wallet,
  '💵': Lucide.Banknote,
  '🚭': Lucide.Ban,
  '🚫': Lucide.CircleSlash,
  '🛡️': Lucide.Shield,
  '🚬': Lucide.Cigarette,
  '📱': Lucide.Smartphone,
  '🍬': Lucide.Candy,
  '🍷': Lucide.Wine,
  '🎲': Lucide.Dices,
  '🎨': Lucide.Palette,
  '💊': Lucide.Pill,
  '🌿': Lucide.Sprout,
  '🎵': Lucide.Music,
  '⌨️': Lucide.Keyboard,
  '🧮': Lucide.Calculator,
  '📜': Lucide.FileText,
  '🩺': Lucide.Stethoscope,
  '🕊️': Lucide.HeartHandshake,
  '🇬🇧': Lucide.Languages,
  '🇺🇸': Lucide.Languages,
  '🧑‍🏫': Lucide.GraduationCap,
  '📄': Lucide.FileText,
  '🏢': Lucide.Building2,
  '📒': Lucide.Book,
  '👂': Lucide.Volume2,
  '🎖️': Lucide.Award,
  '🚔': Lucide.ShieldCheck,
  '🏫': Lucide.Landmark,
  '🗃️': Lucide.Layers,
  // Habits & Tasks
  '🚶': Lucide.Footprints,
  '🥗': Lucide.Apple, // beslenmeyi temsil eder
  '💧': Lucide.Droplets,
  '😴': Lucide.Moon,
  '🏋️': Lucide.Dumbbell,
  '🥩': Lucide.Flame,
  '🍽️': Lucide.Utensils,
  '❌': Lucide.CircleX,
  '🔄': Lucide.RefreshCw,
  '➕': Lucide.CirclePlus,
  '☀️': Lucide.Sun,
  '📋': Lucide.ClipboardList,
  '🔍': Lucide.Search,
  '🔬': Lucide.FlaskConical,
  '💡': Lucide.Lightbulb,
  '📔': Lucide.Book,
  '🎙️': Lucide.Mic,
  '🪞': Lucide.User,
  '⭐': Lucide.Star,
  '🤲': Lucide.Heart,
  '📖': Lucide.BookOpen,
  '⏰': Lucide.Clock,
  '☪️': Lucide.Moon,
  '📐': Lucide.Ruler,
  '🔢': Lucide.Binary,
  '🌍': Lucide.Globe,
  '🌐': Lucide.Globe,
  '🏥': Lucide.Stethoscope,
  '🧬': Lucide.Dna,
  '🥛': Lucide.Milk,
  '👟': Lucide.Footprints,
  '🏊': Lucide.Waves,
  '🤸': Lucide.PersonStanding,
  '👮': Lucide.Shield,
  '💎': Lucide.Gem,
  '🌟': Lucide.Star,
  '🔮': Lucide.Telescope,
  '🏅': Lucide.Medal,
  '🎉': Lucide.PartyPopper,
  '✅': Lucide.CircleCheck,
  // Ruh hâli ölçeği (5 kademe) — sırayı KORU: en olumsuzdan en olumluya.
  '😫': Lucide.Angry,
  '😕': Lucide.Frown,
  '😐': Lucide.Meh,
  '🙂': Lucide.Smile,
  '😎': Lucide.Laugh,
};

/**
 * Emojiyi ikona çevirir. Eşleme yoksa emojinin KENDİSİNİ çizer — sessizce boş
 * bırakmaz. Bkz. MODE_ICONS notu.
 */
export function renderModeEmojiIcon(emoji: string, size = 16, color?: string) {
  const Icon = MODE_ICONS[emoji];
  if (Icon) return <Icon size={size} color={color} />;
  return <Text style={{ fontSize: size }}>{emoji}</Text>;
}
