import React from 'react';
import { Text, TextStyle, StyleProp } from 'react-native';

interface Props {
  value: number;
  /** Sayımın süresi (ms). 0 → animasyon yok, değer anında yazılır (lite mod). */
  duration?: number;
  /** İlk sayımın başlangıç noktası. Verilmezse ilk değer animasyonsuz yazılır. */
  from?: number;
  style?: StyleProp<TextStyle>;
}

// easeOutExpo: başta hızlı, sonda yumuşakça duran eğri. Sayının "yerine oturduğu"
// hissini veren şey son %20'deki yavaşlama — lineer sayım ucuz ve mekanik durur.
const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

/**
 * Bir sayıyı mevcut değerinden hedefe doğru sayarak gösterir.
 *
 * Kendi state'ini kendi içinde tutar ve `React.memo` ile sarılıdır: kare başına yapılan
 * güncelleme yalnızca bu bileşeni yeniden render eder, onu barındıran ekranı değil.
 * (Dashboard'ın tamamını 60fps render etmek bu ekranda gözle görülür takılma yaratır.)
 */
export const AnimatedNumber = React.memo(function AnimatedNumber({ value, duration = 900, from, style }: Props) {
  const start = from ?? value;
  const [display, setDisplay] = React.useState(start);
  const fromRef = React.useRef(start);
  // Ekranda o an yazan değer. `display` state'i efektin kapanışında bayat kalır
  // (efekt yalnızca value/duration değişince kurulur), bu yüzden ayrı ref tutuluyor.
  const displayRef = React.useRef(start);
  const rafRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (duration <= 0) {
      fromRef.current = value;
      displayRef.current = value;
      setDisplay(value);
      return;
    }

    const from = fromRef.current;
    if (from === value) return;

    const start = Date.now();
    const diff = value - from;

    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const next = Math.round(from + diff * easeOutExpo(t));
      displayRef.current = next;
      setDisplay(next);

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        // Bitiş değerini referansa yaz: bir sonraki animasyon buradan başlasın,
        // yoksa her güncelleme baştan (0'dan) sayar.
        fromRef.current = value;
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      // Yarıda kesilen animasyon: bir sonraki sayım en son GÖSTERİLEN değerden
      // devam etsin ki ekranda geri sıçrama olmasın.
      fromRef.current = displayRef.current;
    };
  }, [value, duration]);

  return <Text style={style}>{display}</Text>;
});
