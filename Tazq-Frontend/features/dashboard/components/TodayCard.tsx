import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import Svg, { Circle, G, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { Zap, CheckCircle2 } from 'lucide-react-native';
import { BentoCard } from '@/shared/components/BentoCard';
import { Touchable } from '@/shared/components/Touchable';
import { F, S, R, W, ICON, METRIC, LH, trackingFor } from '@/shared/constants/tokens';
import type { AppTheme } from '@/shared/constants/Colors';

/**
 * "Bugün" kartı — günün tek bakışlık özeti: kaç görev bitti, hedefin neresindesin,
 * ne kadar odaklandın.
 *
 * PSİKOLOJİK ROL: burası ilerlemenin görüldüğü yer. O yüzden hedefe ULAŞILDIĞINDA
 * kartın rengi maviden yeşile döner (theme.primary → theme.tertiary): renk burada süs
 * değil, "başardın" diyen tek sinyal. Yeşil hem gradyanda hem halkada hem sayıda
 * eşzamanlı döner — parça parça dönseydi mesaj bulanıklaşırdı.
 */

/** Halka geometrisi — hepsi tek ölçüden türer, böylece boyut değişince bozulmaz. */
const RING = 90;
/**
 * ÇİZGİ KALINLIĞI ÇAPIN ~%14'Ü. Önceden 9pt'ydi, yani %10 — o oranda çizilen şey
 * "halka" değil "ince çember" gibi okunur ve kartın sağında zayıf kalır.
 *
 * Apple'ın Fitness halkaları çapın yaklaşık %18'i kadardır; renk oradan gelir, çünkü
 * kalın bir yay yeterince ALAN kaplar ve doygun rengi taşıyabilir. Kartın üstündeki
 * renk yıkaması kaldırılınca (bkz. aşağıdaki not) sayfadaki tek canlı renk bu halka
 * oldu — o yüzden gerçekten görülebilmesi gerekiyor. 13pt, Fitness'ın biraz altında:
 * bizim halkamız 90pt ve içinde sayı var, çok kalın olursa sayıya yer kalmaz.
 */
const RING_STROKE = 13;
const RING_C = RING / 2;
const RING_R = RING_C - RING_STROKE / 2 - 3.5; // 37 — çizgi kalınlığı + optik pay
const RING_LEN = 2 * Math.PI * RING_R;

export interface TodayCardProps {
  /** Bugün tamamlanan görev sayısı. */
  completed: number;
  /** Günlük görev hedefi. */
  goal: number;
  /** Bugün odaklanılan dakika. */
  focusMinutes: number;
  /** Günlük odak hedefi (dakika). */
  focusGoalMinutes: number;
  /** Çift dokunma kolay yumurtası açık mı. */
  highlight: boolean;
  /** Kolay yumurta metni. */
  surprise: string;
  /** Kutlama animasyonunu yeniden tetikleyen sayaç. */
  burstKey: number;
  onTap: () => void;
  label: string;
  isSmallScreen: boolean;
  isDark: boolean;
  tr: boolean;
  theme: AppTheme;
  padding: number;
}

export const TodayCard = React.memo<TodayCardProps>(
  ({
    completed, goal, focusMinutes, focusGoalMinutes, highlight, surprise, burstKey,
    onTap, label, isSmallScreen, isDark, tr, theme, padding,
  }) => {
    /**
     * "Görev yok" AYRI bir durum — "hepsi bitti" değil.
     *
     * Çağıran taraf `todayTasks.length || 1` yazıyordu: hiç görev yokken hedefi 1
     * yapıp "0/1 görev tamamlandı" gösteriyordu. Yalan kaldırıldı ve gerçek 0 geliyor.
     * Ama 0 gelince `0 >= 0` doğru olur ve kart YEŞİL "Tümü tamamlandı" derdi —
     * yapacak bir şey yokken kutlamak, kutlamayı değersizleştirir.
     *
     * Üç durum var, ikisi değil: yok · devam ediyor · bitti.
     */
    const hasGoal = goal > 0;
    const reached = hasGoal && completed >= goal;

    /**
     * GÜN HENÜZ AÇILMADI — planı var ama hiçbir şey bitmedi.
     *
     * Bu durum "devam ediyor"un bir alt hâli değil, AYRI bir an: gösterilecek ilerleme
     * yok. Kart bu anda şunları aynı anda söylüyordu — büyük `0`, yanında `/1`, sağda
     * `%0` yazan boş bir halka, altında `0dk`. Aynı gerçeğin üç ayrı kopyası ve hepsi
     * olumsuz. Halka özellikle kötüydü: dolmamış bir çember, ilerleme göstermez, ekranda
     * bir DELİK gibi durur.
     *
     * Yüzde halkası bu anda kaldırılıyor (0/1 zaten aynı şeyi söylüyor) ve alt satır
     * "görev tamamlandı"dan davete dönüyor. Kartın yapısı değişmiyor; yalnız söyleyecek
     * bir şeyi olmadığı anda susuyor.
     */
    const notStarted = hasGoal && completed === 0;

    // Tek karar, üç yerde birden kullanılıyor (gradyan, halka, sayı) — ayrı ayrı
    // hesaplansaydı biri unutulur ve kart kendi içinde çelişirdi.
    // Görev yokken NÖTR: ne mavi (yapacak iş yok) ne yeşil (başarılacak şey yoktu).
    const accent = !hasGoal ? theme.onSurfaceVariant : reached ? theme.tertiary : theme.primary;
    const pct = hasGoal ? Math.round((completed / goal) * 100) : 0;
    const ringFill = hasGoal ? Math.min(completed / goal, 1) : 0;
    const metricSize = isSmallScreen ? METRIC.sm : METRIC.md;

    return (
      <View style={styles.wrap}>
        <Touchable onPress={onTap} activeOpacity={1}>
          <BentoCard index={0} style={{ overflow: 'hidden', padding }}>
            {/*
              KART ÜSTÜ RENK YIKAMASI KALDIRILDI — bkz. NextMissionCard'daki uzun not.
              Kısaca: iOS'ta yüzey temizdir, renk kontrol/sembol/veride ve TAM
              doygunlukta görünür. Kartın tamamına serilmiş %18'lik mavi, beyazı
              kirletiyor ve rengin anlam taşımasını engelliyordu.

              Bu kartta renk zaten doğru yerde: 90pt'lik ilerleme HALKASI. Yıkama
              kalkınca halka gerçekten öne çıkıyor — Apple'ın Fitness kartı da tam
              olarak böyledir: beyaz yüzey, tek canlı halka.

              `highlight` (çift dokunma kolay yumurtası) artık alt satırın rengiyle
              anlatılıyor; zaten orada da anlatılıyordu, yıkama ikinci bir kopyaydı.
            */}
            <View style={styles.row}>
              {/* Sol: sayısal özet */}
              <View style={styles.stats}>
                <Text style={[styles.label, { color: theme.onSurfaceMuted }]}>{label}</Text>

                <View style={styles.metricRow}>
                  <Text
                    testID="today-completed"
                    style={[
                      styles.metric,
                      { fontSize: metricSize, letterSpacing: trackingFor(metricSize), color: theme.onSurface },
                    ]}
                  >
                    {completed}
                  </Text>
                  {/* Hedef İKİNCİL: aynı puntoda olsaydı "3" ile "5" eşit ağırlıkta
                      okunur ve hangisinin başarı olduğu belirsizleşirdi.
                      Görev yokken hiç gösterilmez — "/0" bir hedef değil, bir hata gibi okunur. */}
                  {hasGoal && <Text style={[styles.goal, { color: theme.onSurfaceMuted }]}>/{goal}</Text>}
                </View>

                <MotiView
                  key={`today-sub-${burstKey}`}
                  from={{ scale: burstKey > 0 ? 1.22 : 1, opacity: burstKey > 0 ? 0 : 1 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', damping: 11, stiffness: 220 }}
                >
                  {/*
                    Renk DURUMU anlatıyor: kolay yumurta/hedef anında vurgu rengi, normalde
                    sessiz gri. Eskiden `opacity: highlight ? 1 : 0.55` ile soluklaştırılıyordu
                    — palet rengini kullanım yerinde kısmak ölçülen kontrastı çöpe atar
                    (bkz. colorContrast.test.ts). Artık iki AYRI seviye.
                  */}
                  <View style={styles.subRow}>
                  {/*
                    BAŞARI İŞARETİ FLAT İKON — emoji değil.
                    Metin "Tümü tamamlandı 🎉" idi. Emoji üç sebeple yanlış: (1) uygulamanın
                    geri kalanı lucide glifleri kullanıyor, tek bir emoji sistemi bozuyor;
                    (2) emoji cihaza göre farklı çizilir, yani tasarım kontrolümüzde değil;
                    (3) rengi kendi taşır ve paletle konuşmaz. Buradaki onay işareti
                    vurgu rengini alıyor — hedefe ulaşınca yeşile dönen AYNI renk.
                  */}
                  {reached && !highlight && (
                    <CheckCircle2 size={ICON.xs} color={accent} strokeWidth={2.5} />
                  )}
                  <Text testID="today-sub" style={[styles.sub, { color: highlight ? accent : theme.onSurfaceMuted }]}>
                    {highlight
                      ? surprise
                      : !hasGoal
                        // Yapacak bir şey yokken "Tümü tamamlandı 🎉" demek kutlamayı
                        // değersizleştirir: hiçbir şey yapmadan alkış almak, gerçekten
                        // bir şey bitirdiğinde gelen alkışın anlamını da düşürür.
                        ? (tr ? 'Bugün için planın boş' : 'Nothing planned today')
                        : reached
                          ? (tr ? 'Tümü tamamlandı' : 'All done')
                          : notStarted
                            // "görev tamamlandı" cümlesi 0'ın yanında "hiçbir görev
                            // tamamlamadın" diye okunuyordu — doğru ama sayfanın işi
                            // bunu duyurmak değil. Aynı gerçeğin ileri bakan hâli.
                            ? (tr ? 'gün yeni başlıyor' : 'the day is just starting')
                            : (tr ? 'görev tamamlandı' : 'tasks completed')}
                  </Text>
                  </View>
                </MotiView>

                {/* Odak dakikası — ikincil metrik, ince çubuk. */}
                <View style={styles.focusRow}>
                  <Zap size={ICON.xs} color={theme.primary} fill={theme.primary} />
                  <View style={[styles.track, { backgroundColor: theme.outline }]}>
                    <MotiView
                      animate={{ width: `${Math.min((focusMinutes / Math.max(focusGoalMinutes, 1)) * 100, 100)}%` }}
                      transition={{ type: 'timing', duration: 900 }}
                      style={[styles.fill, { backgroundColor: theme.primary }]}
                    />
                  </View>
                  {/*
                    PAYDA GÖSTERİLİYOR — "0dk" yerine "0/60dk".

                    Yalnız `20dk` yazıyordu ve yanındaki çubuğun ne kadarının dolu
                    olduğunu açıklayan hiçbir şey yoktu: 20 dakika çok mu az mı, çubuk
                    neye göre doluyor, belli değildi. Sıfırdayken ise sayfadaki ÜÇÜNCÜ
                    çıplak sıfır oluyordu (`0/5` ve `%0`ın yanında `0dk`).

                    Payda ikisini birden çözüyor: çubuk okunur hâle geliyor ve sıfır
                    artık bir eksiklik değil, bir başlangıç noktası — "0/60", "henüz
                    başlamadın" değil "60'ın 0'ındasın" der. Kartın ana satırındaki
                    `1 /5` deseniyle de aynı dili konuşuyor.
                  */}
                  <Text style={[styles.focusText, { color: theme.onSurfaceMuted }]}>
                    {focusMinutes}/{focusGoalMinutes}{tr ? 'dk' : 'm'}
                  </Text>
                </View>
              </View>

              {/* Sağ: ilerleme halkası */}
              <View style={styles.ringBox}>
                {/*
                  HALKA TEK RENK — gradyan KALDIRILDI.

                  Yay `primary (#0B6BCB, hue 210) → secondary (#7C3AED, hue 262)` diye
                  geçiyordu. 52 derecelik bu sıçrama bir TON farkı değil, başka bir renk:
                  ekranda ilerleme mavi değil MOR okunuyordu.

                  Üstelik bu, paletin bilinçli bir kararını tersine çeviriyordu. Colors.ts'te
                  yazılı: marka mavisi hue 221'den 210'a çekilmiş, çünkü 221 "indigo/mor
                  tarafına bakıyor" ve "sert lacivert" şikayetinin ölçülen sebebi buymuş.
                  Uygulamanın en görünür veri görselleştirmesi o düzeltmeyi geri alıyordu.
                  Halka inceyken (9pt) fark edilmiyordu; kalınlaşınca mor uç baskın oldu.

                  Tutarsızlık da vardı: hedefe ULAŞILINCA iki durak da `tertiary` olduğu
                  için halka zaten TEK renk (yeşil) oluyordu. Yani "devam ediyor" hâli
                  kuralın dışındaki tek durumdu. Artık renk tek şey söylüyor:
                  mavi = devam ediyor, yeşil = bitti.
                */}
                <Svg width={RING} height={RING}>
                  {/* -90°: dolum saat 12'den başlasın — saat 3'ten başlayan halka
                      "ilerleme" değil "rastgele yay" gibi okunur. */}
                  <G rotation="-90" origin={`${RING_C},${RING_C}`}>
                    {/*
                      BOŞ KISIM VURGU RENGİNİN SOLUK HÂLİ — nötr gri değil.
                      `theme.outline` ile çiziliyordu: halka o zaman "gri bir çember
                      üstünde renkli bir yay" oluyordu, yani iki ayrı nesne gibi. Apple'ın
                      halkalarında boş kısım AYNI rengin kısılmış hâlidir; böylece tek bir
                      nesne okunur ve boşluk "bu metriğin henüz dolmamış kısmı" der.
                      Alfa `1A` (~%10): ölçülen kontrastı etkilemez, çünkü bu metin değil.
                    */}
                    <Circle
                      cx={RING_C} cy={RING_C} r={RING_R} fill="none"
                      stroke={accent + '1A'} strokeWidth={RING_STROKE}
                    />
                    <Circle
                      cx={RING_C} cy={RING_C} r={RING_R} fill="none"
                      stroke={accent}
                      strokeWidth={RING_STROKE}
                      strokeLinecap="round"
                      strokeDasharray={`${RING_LEN}`}
                      strokeDashoffset={`${RING_LEN * (1 - ringFill)}`}
                    />
                  </G>
                </Svg>
                <View style={styles.ringCenter}>
                  {/*
                    GÜN BAŞINDA HALKA HEDEFİ GÖSTERİR, YÜZDEYİ DEĞİL.

                    Burada `%0` yazıyordu: solda zaten `0 /1` duruyordu, yani aynı gerçek
                    iki kez ve ikisi de olumsuz. Dolmamış bir çemberin ortasındaki sıfır,
                    ilerleme değil EKSİKLİK gösterir.

                    Halkayı kaldırmak da çözüm değildi (denendi): kartın sağ yanı boş
                    kalıyor, kart tek yana yatıyordu. Doğrusu geometriyi korumak ve içine
                    ileri bakan sayıyı koymak — kaç tane BİTİRDİĞİNİ değil, kaç tane
                    HEDEFLEDİĞİNİ. Aynı çember artık bir eksik değil, bir nişan.
                  */}
                  {notStarted ? (
                    <>
                      <Text testID="today-goal" style={[styles.pct, { color: theme.onSurface }]}>{goal}</Text>
                      <Text style={[styles.pctSign, { color: theme.onSurfaceMuted }]}>
                        {tr ? 'hedef' : 'goal'}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text testID="today-pct" style={[styles.pct, { color: reached ? theme.tertiary : theme.onSurface }]}>{pct}</Text>
                      <Text style={[styles.pctSign, { color: theme.onSurfaceMuted }]}>%</Text>
                    </>
                  )}
                </View>
              </View>
            </View>
          </BentoCard>
        </Touchable>
      </View>
    );
  },
);

TodayCard.displayName = 'TodayCard';

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: S.lg, marginBottom: S.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: S.lg },
  stats: { flex: 1, gap: S.sm },
  label: {
    fontSize: F.caption,
    fontWeight: W.medium,
    letterSpacing: 1.2, // büyük harf etiket — optik açıklık
    marginBottom: S.xs,
  },
  metricRow: { flexDirection: 'row', alignItems: 'baseline', gap: S.xs },
  metric: { fontWeight: W.semibold, includeFontPadding: false },
  goal: { fontSize: F.subhead, fontWeight: W.semibold, letterSpacing: trackingFor(F.subhead) },
  // İkon ve metin AYNI satırda, taban hizasında değil ORTA hizada: 11pt bir yazının
  // yanındaki 12pt glif taban hizasında bir tık aşağı düşer.
  subRow: { flexDirection: 'row', alignItems: 'center', gap: S.xs },
  sub: { fontSize: F.caption, fontWeight: W.semibold, letterSpacing: 0.3 },
  focusRow: { flexDirection: 'row', alignItems: 'center', gap: S.xs, marginTop: S.xxs },
  track: { flex: 1, height: 3, borderRadius: R.xs, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: R.xs },
  focusText: { fontSize: F.caption, fontWeight: W.semibold },
  ringBox: { width: RING, height: RING },
  ringCenter: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pct: {
    fontSize: F.title,
    fontWeight: W.semibold,
    letterSpacing: trackingFor(F.title),
    lineHeight: F.title * LH.tight,
  },
  pctSign: { fontSize: F.caption, fontWeight: W.semibold },
});
