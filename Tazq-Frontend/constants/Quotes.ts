export const QUOTES = {
  en: [
    "Excellence is not an act, but a habit.",
    "Focus on being productive instead of busy.",
    "Your mind is for having ideas, not holding them.",
    "Deep work is the superpower of the 21st century.",
    "Starve your distractions, feed your focus.",
    "Simplicity is the ultimate sophistication.",
    "Do not disturb: Focus in progress.",
    "One thing at a time. Most things can wait.",
    "The best way to predict the future is to create it.",
    "Discipline is choosing between what you want now and what you want most.",
    "Amateurs sit and wait for inspiration, the rest of us just get up and go to work.",
    "Small steps in the right direction can turn out to be the biggest steps of your life.",
    "Your time is limited, so don't waste it living someone else's life.",
    "Done is better than perfect.",
    "The secret of getting ahead is getting started.",
    "Concentration is the secret of strength.",
    "Quality is not an act, it is a habit.",
    "Think big, start small, move fast.",
    "Be so good they can't ignore you.",
    "Your focus determines your reality."
  ],
  tr: [
    "Mükemmellik bir eylem değil, bir alışkanlıktır.",
    "Meşgul olmak yerine verimli olmaya odaklan.",
    "Zihniniz fikir üretmek içindir, onları tutmak için değil.",
    "Derin çalışma, 21. yüzyılın süper gücüdür.",
    "Dikkat dağıtıcılarını aç bırak, odağını besle.",
    "Sadelik, en yüksek gelişmişlik düzeyidir.",
    "Rahatsız etmeyin: Odaklanma devam ediyor.",
    "Her seferinde tek bir şey. Çoğu şey bekleyebilir.",
    "Geleceği tahmin etmenin en iyi yolu onu yaratmaktır.",
    "Disiplin, şimdi istediğinle en çok istediğin arasında seçim yapmaktır.",
    "Amatörler ilham bekler, geri kalanımız kalkıp işe gideriz.",
    "Doğru yönde atılan küçük adımlar, hayatının en büyük adımları olabilir.",
    "Zamanın kısıtlı, bu yüzden onu başkasının hayatını yaşayarak harcama.",
    "Tamamlanmış, mükemmelden iyidir.",
    "İlerlemenin sırrı, başlamaktır.",
    "Konsantrasyon, gücün sırrıdır.",
    "Kalite bir eylem değil, bir alışkanlıktır.",
    "Büyük düşün, küçük başla, hızlı hareket et.",
    "O kadar iyi ol ki seni görmezden gelemesinler.",
    "Odak noktan gerçekliğini belirler."
  ]
};

export const getRandomQuote = (lang: 'en' | 'tr') => {
  const list = QUOTES[lang] || QUOTES.en;
  return list[Math.floor(Math.random() * list.length)];
};
