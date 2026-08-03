import React from 'react';
import { Text } from 'react-native';
import * as Lucide from 'lucide-react-native';

export function renderModeEmojiIcon(emoji: string, size = 16, color?: string) {
  // Map emoji string to Lucide component
  switch (emoji) {
    // Modes & Templates
    case '🌙':
      return <Lucide.Moon size={size} color={color} />;
    // ── Alışkanlık seçicisi için ek glifler ──────────────────────────────
    // Bu emojilerin eşlemesi yoktu; eşleme bulunmayınca ham emoji çiziliyor ve
    // satırdaki diğer çizgisel ikonların yanında yamalı duruyor (AppIcon dili bozulur).
    case '🚴':
      return <Lucide.Bike size={size} color={color} />;
    case '📷':
      return <Lucide.Camera size={size} color={color} />;
    case '☕':
      return <Lucide.Coffee size={size} color={color} />;
    case '👥':
      return <Lucide.Users size={size} color={color} />;
    case '⏱️':
      return <Lucide.Timer size={size} color={color} />;
    case '🧹':
      return <Lucide.Sparkles size={size} color={color} />;
    case '🗣️':
      return <Lucide.Languages size={size} color={color} />;
    case '🌅':
      return <Lucide.Sunrise size={size} color={color} />;
    case '📚':
      return <Lucide.BookOpen size={size} color={color} />;
    case '🏛️':
      return <Lucide.Landmark size={size} color={color} />;
    case '🎓':
      return <Lucide.GraduationCap size={size} color={color} />;
    case '✍️':
      return <Lucide.PenTool size={size} color={color} />;
    case '🏁':
      return <Lucide.Flag size={size} color={color} />;
    case '💻':
      return <Lucide.Laptop size={size} color={color} />;
    case '📊':
      return <Lucide.BarChart4 size={size} color={color} />;
    case '⚡':
      return <Lucide.Zap size={size} color={color} />;
    case '🔥':
      return <Lucide.Flame size={size} color={color} />;
    case '💥':
      return <Lucide.Zap size={size} color={color} />;
    case '🚀':
      return <Lucide.Rocket size={size} color={color} />;
    case '👍':
      return <Lucide.CheckCircle2 size={size} color={color} />;
    case '🌱':
      return <Lucide.Sprout size={size} color={color} />;
    case '📈':
      return <Lucide.TrendingUp size={size} color={color} />;
    case '📉':
      return <Lucide.TrendingDown size={size} color={color} />;
    case '👑':
      return <Lucide.Crown size={size} color={color} />;
    case '💤':
      return <Lucide.Moon size={size} color={color} />;
    case '🏗️':
      return <Lucide.Hammer size={size} color={color} />;
    case '🧪':
      return <Lucide.FlaskConical size={size} color={color} />;
    case '🗂️':
      return <Lucide.Layers size={size} color={color} />;
    case '🔒':
      return <Lucide.Lock size={size} color={color} />;
    case '🧩':
      return <Lucide.Puzzle size={size} color={color} />;
    case '💼':
      return <Lucide.Briefcase size={size} color={color} />;
    case '🏃':
      // Activity (kalp-atisi cizgisi) idi ve meditasyonla AYNI ikonu paylasiyordu.
      // Kosu icin ayak izi hem ayirt edici hem anlami dogrudan tasiyor.
      return <Lucide.Footprints size={size} color={color} />;
    case '⚖️':
      return <Lucide.Scale size={size} color={color} />;
    case '📝':
      return <Lucide.FileText size={size} color={color} />;
    case '🎯':
      return <Lucide.Target size={size} color={color} />;
    case '🗺️':
      return <Lucide.Map size={size} color={color} />;
    case '✏️':
      return <Lucide.PenTool size={size} color={color} />;
    case '🤝':
      return <Lucide.Handshake size={size} color={color} />;
    case '⚠️':
      return <Lucide.AlertTriangle size={size} color={color} />;
    case '🙏':
      return <Lucide.Heart size={size} color={color} />;
    case '🏆':
      return <Lucide.Trophy size={size} color={color} />;
    case '✨':
      return <Lucide.Sparkles size={size} color={color} />;
    case '📅':
      return <Lucide.Calendar size={size} color={color} />;
    case '💪':
      return <Lucide.Dumbbell size={size} color={color} />;
    case '🧘':
      // Kosuyla ayni Activity ikonunu paylasiyordu. Meditasyon icin sakin,
      // nefes cagristiran bir glif.
      return <Lucide.Wind size={size} color={color} />;
    case '🧠':
      return <Lucide.Brain size={size} color={color} />;
    case '💰':
      return <Lucide.PiggyBank size={size} color={color} />;
    case '🧾':
      return <Lucide.Receipt size={size} color={color} />;
    case '💳':
      return <Lucide.CreditCard size={size} color={color} />;
    case '💸':
      return <Lucide.Wallet size={size} color={color} />;
    case '💵':
      return <Lucide.Banknote size={size} color={color} />;
    case '🚭':
      return <Lucide.Ban size={size} color={color} />;
    case '🚫':
      return <Lucide.CircleSlash size={size} color={color} />;
    case '🛡️':
      return <Lucide.Shield size={size} color={color} />;
    case '🚬':
      return <Lucide.Cigarette size={size} color={color} />;
    case '📱':
      return <Lucide.Smartphone size={size} color={color} />;
    case '🍬':
      return <Lucide.Candy size={size} color={color} />;
    case '🍷':
      return <Lucide.Wine size={size} color={color} />;
    case '🎲':
      return <Lucide.Dices size={size} color={color} />;
    case '🎨':
      return <Lucide.Palette size={size} color={color} />;
    case '💊':
      return <Lucide.Pill size={size} color={color} />;
    case '🌿':
      return <Lucide.Sprout size={size} color={color} />;
    case '🎵':
      return <Lucide.Music size={size} color={color} />;
    case '⌨️':
      return <Lucide.Keyboard size={size} color={color} />;
    case '🧮':
      return <Lucide.Calculator size={size} color={color} />;
    case '📜':
      return <Lucide.FileText size={size} color={color} />;
    case '🩺':
      return <Lucide.Stethoscope size={size} color={color} />;
    case '🕊️':
      return <Lucide.HeartHandshake size={size} color={color} />;
    case '🇬🇧':
    case '🇺🇸':
      return <Lucide.Languages size={size} color={color} />;
    case '🧑‍🏫':
      return <Lucide.GraduationCap size={size} color={color} />;
    case '📄':
      return <Lucide.FileText size={size} color={color} />;
    case '🏢':
      return <Lucide.Building2 size={size} color={color} />;
    case '📒':
      return <Lucide.Book size={size} color={color} />;
    case '👂':
      return <Lucide.Volume2 size={size} color={color} />;
    case '🎖️':
      return <Lucide.Award size={size} color={color} />;
    case '🚔':
      return <Lucide.ShieldCheck size={size} color={color} />;
    case '🏫':
      return <Lucide.Landmark size={size} color={color} />;
    case '🗃️':
      return <Lucide.Layers size={size} color={color} />;

    // Habits & Tasks
    case '🚶':
      return <Lucide.Footprints size={size} color={color} />;
    case '🥗':
      return <Lucide.Apple size={size} color={color} />; // Apple represents nutrition
    case '💧':
      return <Lucide.Droplets size={size} color={color} />;
    case '😴':
      return <Lucide.Moon size={size} color={color} />;
    case '🏋️':
      return <Lucide.Dumbbell size={size} color={color} />;
    case '🥩':
      return <Lucide.Flame size={size} color={color} />;
    case '🍽️':
      return <Lucide.Utensils size={size} color={color} />;
    case '❌':
      return <Lucide.XCircle size={size} color={color} />;
    case '🔄':
      return <Lucide.RefreshCw size={size} color={color} />;
    case '➕':
      return <Lucide.PlusCircle size={size} color={color} />;
    case '☀️':
      return <Lucide.Sun size={size} color={color} />;
    case '📋':
      return <Lucide.ClipboardList size={size} color={color} />;
    case '🔍':
      return <Lucide.Search size={size} color={color} />;
    case '🔬':
      return <Lucide.FlaskConical size={size} color={color} />;
    case '💡':
      return <Lucide.Lightbulb size={size} color={color} />;
    case '📔':
      return <Lucide.Book size={size} color={color} />;
    case '🎙️':
      return <Lucide.Mic size={size} color={color} />;
    case '🪞':
      return <Lucide.User size={size} color={color} />;
    case '⭐':
      return <Lucide.Star size={size} color={color} />;
    case '🤲':
      return <Lucide.Heart size={size} color={color} />;
    case '📖':
      return <Lucide.BookOpen size={size} color={color} />;
    case '⏰':
      return <Lucide.Clock size={size} color={color} />;
    case '☪️':
      return <Lucide.Moon size={size} color={color} />;
    case '📐':
      return <Lucide.Ruler size={size} color={color} />;
    case '🔢':
      return <Lucide.Binary size={size} color={color} />;

    /*
      ── ÖLÇÜLEREK EKLENEN EŞLEMELER ───────────────────────────────────────────
      Veri dosyalarındaki `emoji:` alanları ile bu switch karşılaştırıldı: 112 farklı
      emoji kullanılıyordu, 20'sinin eşlemesi YOKTU. Eşlemesi olmayan her emoji
      aşağıdaki fallback'e düşüp HAM olarak çiziliyor — yani çizgisel ikonların
      yanında sistem emojisi görünüyor ve arayüz yamalı duruyor.

      Aşağıdaki ikon adlarının hepsi kurulu lucide sürümünde tek tek doğrulandı;
      olmayan bir ada referans vermek, çökme kayıtlarındaki
      "Property 'X' doesn't exist" hatasının aynısını üretirdi.
    */
    case '🌍':
    case '🌐':
      return <Lucide.Globe size={size} color={color} />;
    case '🏥':
      return <Lucide.Stethoscope size={size} color={color} />;
    case '🧬':
      return <Lucide.Dna size={size} color={color} />;
    case '🥛':
      return <Lucide.Milk size={size} color={color} />;
    case '👟':
      return <Lucide.Footprints size={size} color={color} />;
    case '🏊':
      return <Lucide.Waves size={size} color={color} />;
    case '🤸':
      return <Lucide.PersonStanding size={size} color={color} />;
    case '👮':
      return <Lucide.Shield size={size} color={color} />;
    case '💎':
      return <Lucide.Gem size={size} color={color} />;
    case '🌟':
      return <Lucide.Star size={size} color={color} />;
    case '🔮':
      return <Lucide.Telescope size={size} color={color} />;
    case '🏅':
      return <Lucide.Medal size={size} color={color} />;
    case '🎉':
      return <Lucide.PartyPopper size={size} color={color} />;
    case '✅':
      return <Lucide.CircleCheck size={size} color={color} />;

    // Ruh hâli ölçeği (5 kademe) — sırayı KORU: en olumsuzdan en olumluya.
    case '😫':
      return <Lucide.Angry size={size} color={color} />;
    case '😕':
      return <Lucide.Frown size={size} color={color} />;
    case '😐':
      return <Lucide.Meh size={size} color={color} />;
    case '🙂':
      return <Lucide.Smile size={size} color={color} />;
    case '😎':
      return <Lucide.Laugh size={size} color={color} />;

    // Fallback: render the original emoji as text if not mapped
    default:
      return <Text style={{ fontSize: size }}>{emoji}</Text>;
  }
}
