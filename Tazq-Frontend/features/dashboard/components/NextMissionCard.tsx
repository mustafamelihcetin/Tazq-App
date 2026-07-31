import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { Rocket, Zap, ChevronRight, Plus } from 'lucide-react-native';
import { BentoCard } from '@/shared/components/BentoCard';
import { Touchable } from '@/shared/components/Touchable';
import { F, S, R, W, ICON, MIN_TOUCH, trackingFor } from '@/shared/constants/tokens';
import type { AppTheme } from '@/shared/constants/Colors';

/**
 * "Sonraki görev" kartı — dashboard'ın tek EYLEM çağrısı.
 *
 * PSİKOLOJİK ROL: yukarıdaki kartlar durumu anlatır (ne yaptın, neredesin); burası
 * "şimdi şunu yap" der. Ekranda tek dolu buton bunun olması bilinçli — iOS'ta da
 * bir ekranda tek birincil eylem vardır; ikisi olunca ikisi de birincil olmaz.
 *
 * RENK YALNIZ DURUMDA. Öncelik rengi tek kaynaktan gelir (`accent` → priorityColor) ama
 * yalnızca ACİL etiketini boyar. Üstteki "SIRADAKİ" nötrdür: o bir yapı etiketi, kartın
 * ne olduğunu söyler — ve kartın kendisi hiçbir zaman acil değildir, görev acildir.
 * İkisi de renkliyken aynı kırmızı yan yana iki kez görünüyor, tekrarlandığı için de
 * vurgu olmaktan çıkıyordu.
 */

export interface NextMissionCardProps {
  /** Sıradaki görev. Yoksa kart "görev ekle" davetine döner. */
  task: { id: string | number; priority: string } | null;
  /** Görevin başlığı (yerelleştirilmiş) — yoksa boş durum metni. */
  title: string;
  /** Açıklama ya da bekleme metni. */
  subtitle: string;
  /** Rozet metni ("SIRADAKİ"). */
  badgeLabel: string;
  /** Aciliyet rozeti gösterilsin mi (yüksek öncelik + mod görevi değil). */
  showUrgent: boolean;
  urgentLabel: string;
  primaryLabel: string;
  seeAllLabel: string;
  onOpenTask: () => void;
  onSeeAll: () => void;
  /** Önceliği renge çeviren TEK kaynak. */
  priorityColor: (p: string) => string;
  isSmallScreen: boolean;
  theme: AppTheme;
  padding: number;
}

export const NextMissionCard = React.memo<NextMissionCardProps>(
  ({
    task, title, subtitle, badgeLabel, showUrgent, urgentLabel, primaryLabel, seeAllLabel,
    onOpenTask, onSeeAll, priorityColor, isSmallScreen, theme, padding,
  }) => {
    // TEK kaynak: gradyan, rozet ve rozet yazısı hep bunu kullanır. Eskiden gradyan
    // önceliği kendi if/else'iyle renge çeviriyordu, rozet ise priorityColor() ile —
    // aynı eşleme iki yerde yazılıydı.
    const accent = task ? priorityColor(task.priority) : theme.onSurfaceVariant;

    return (
      <View style={styles.wrap}>
        <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ type: 'timing', duration: 250 }}>
          <BentoCard index={1} style={[styles.card, { minHeight: isSmallScreen ? 120 : 140, padding }]}>
            {/*
              KART ÜSTÜ RENK YIKAMASI KALDIRILDI.

              Burada köşegen bir gradyan vardı: öncelik rengi kartın tamamına %12 (koyu
              temada %25) opaklıkla seriliyordu. Dekoratif diye meşru sayılmıştı ama iki
              şeyi birden bozuyordu:

               · BEYAZI KİRLETİYORDU. Yüksek öncelikli bir görev varken kart pembemsi,
                 normalde mavimsi bir zemine dönüyordu. Temiz olması gereken yüzey,
                 üstüne renk sürülmüş gibi duruyordu.
               · RENGİ ANLAMSIZLAŞTIRIYORDU. %12'ye inen bir kırmızı ne "acil" der ne
                 başka bir şey; yalnız ortamı boyar. Renk bir şey söyleyecekse tam
                 doygunlukta ve KÜÇÜK bir alanda olmalı.

              Apple'ın kuralı bu: iOS'ta yüzeyler temizdir, renk yalnız KONTROLLERDE
              (düğme), SEMBOLLERDE ve VERİ GÖRSELLEŞTİRMESİNDE (halka, grafik) görünür.
              Renk kaldırılmadı, hak ettiği yere çekildi — aşağıdaki rozet ve dolu mavi
              düğme zaten taşıyor.
            */}
            {/*
              DOLGULU HAPLAR KALDIRILDI — aksiyon merkezindeki son kalıntıydı.

              Burada iki renkli kapsül vardı (zemin: vurgu %18-25, hata %20). Sorun tek
              tek görünüşleri değil, ekranın GERİ KALANIYLA ÇELİŞMELERİYDİ: hemen
              altlarındaki görev satırlarında aynı desen zaten kaldırılmış, mod adı düz
              renkli metne çevrilmişti; bildirim kapsülünde de renk yalnız ikona
              çekilmişti. Yani aksiyon merkezinde iki ayrı tasarım dili yan yana
              duruyordu ve göz bunu "biri buraya sonradan yapıştırılmış" diye okur.

              ── YAPI NÖTR, DURUM RENKLİ ────────────────────────────────────────────
              İkinci ve daha önemli düzeltme renkte. Eskiden İKİ etiket de renkliydi ve
              renkleri aynı kaynaktan geliyordu: `accent` önceliğe göre hesaplanıyor,
              `showUrgent` ise zaten yalnız YÜKSEK öncelikte açılıyor. Sonuç: yüksek
              öncelikli bir görevde iki kırmızı etiket yan yana, aynı şeyi iki kez
              söylüyordu — renk tekrarlandığı için de vurgu olmaktan çıkıyordu.

              Artık "SIRADAKİ" nötr: o bir YAPI etiketi, kartın ne olduğunu söyler ve
              kartın kendisi hiçbir zaman "acil" değildir. Renk yalnız gerçekten durum
              bildiren "ACİL"e kaldı. Bir şey vurgulanacaksa tek şey vurgulanmalı.
            */}
            <View style={styles.header}>
              <View style={styles.label}>
                <Rocket size={ICON.xs} color={theme.onSurfaceMuted} />
                <Text style={[styles.labelText, { color: theme.onSurfaceMuted }]}>{badgeLabel}</Text>
              </View>

              {showUrgent && (
                <View style={styles.label}>
                  {/* Ayıraç: iki etiketi hap kutusu olmadan ayırır. iOS'un ikincil
                      satırlarında kullandığı yöntem — kutu değil, nokta. */}
                  <Text style={[styles.labelText, { color: theme.outline }]}>·</Text>
                  <Zap size={ICON.xs} color={accent} fill={accent} />
                  <Text style={[styles.labelText, { color: accent }]}>{urgentLabel}</Text>
                </View>
              )}
            </View>

            <View style={styles.content}>
              <Text
                testID="mission-title"
                adjustsFontSizeToFit
                minimumFontScale={0.85}
                numberOfLines={2}
                style={[styles.title, { color: theme.onSurface }]}
              >
                {title}
              </Text>
              <Text style={[styles.sub, { color: theme.onSurfaceMuted }]} numberOfLines={2}>
                {subtitle}
              </Text>
            </View>

            <View style={styles.footer}>
              <Touchable
                testID="mission-primary"
                onPress={task ? onOpenTask : onSeeAll}
                accessibilityRole="button"
                accessibilityLabel={primaryLabel}
                style={[
                  styles.primaryBtn,
                  { backgroundColor: task ? theme.primary : theme.surfaceContainerHigh },
                ]}
              >
                {/*
                  Görev yoksa buton "ekle" davetine döner: dolu mavi yerine sessiz zemin,
                  çünkü ortada henüz bir eylem yok — davet var. Renk = anlam.
                */}
                {!task && <Plus size={ICON.md} color={theme.onSurface} />}
                <Text style={[styles.primaryText, { color: task ? theme.onPrimary : theme.onSurface }]}>
                  {primaryLabel}
                </Text>
                {/*
                  Ok SAĞDA. Eskiden metinden ÖNCE geliyordu: sağı gösteren bir ok, etiketin
                  solunda durup metne doğru bakıyordu. Ok "ileri" der; solda durunca
                  gösterdiği yer etiketin kendisi olur ve anlamı kaybolur.
                */}
                {task && <ChevronRight size={ICON.md} color={theme.onPrimary} />}
              </Touchable>

              <Touchable
                onPress={onSeeAll}
                accessibilityRole="button"
                accessibilityLabel={seeAllLabel}
                style={styles.seeAllBtn}
              >
                <Text style={[styles.seeAllText, { color: theme.onSurfaceVariant }]}>{seeAllLabel}</Text>
                <ChevronRight size={ICON.sm} color={theme.onSurfaceVariant} />
              </Touchable>
            </View>
          </BentoCard>
        </MotiView>
      </View>
    );
  },
);

NextMissionCard.displayName = 'NextMissionCard';

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: S.lg, marginBottom: S.lg },
  card: { justifyContent: 'space-between', overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: S.xs },
  /*
    Kutu yok: dolgu, çerçeve ve yuvarlaklık gitti. Geriye ikon + yazı kaldı — görev
    satırlarının ikincil satırıyla ve bildirim kapsülüyle aynı dil.
  */
  label: { flexDirection: 'row', alignItems: 'center', gap: S.xs },
  /*
    Ağırlık `medium`dan `bold`a çıktı. Dolgulu zemin varken etiketi zeminin kendisi
    ayırıyordu; zemin kalkınca ayrımı ağırlık ve harf aralığı taşımalı. Bu, görev
    satırlarındaki mod adının (F.caption / '700') birebir aynısı — aynı iş, aynı biçim.
  */
  labelText: { fontSize: F.caption, fontWeight: W.bold, letterSpacing: 0.5 },
  content: { marginTop: S.xxs },
  title: {
    fontSize: F.subhead,
    fontWeight: W.semibold,
    letterSpacing: trackingFor(F.subhead),
  },
  sub: { fontSize: F.body, fontWeight: W.regular, marginTop: S.xs },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: S.md,
    gap: S.sm,
  },
  primaryBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: S.sm,
    paddingHorizontal: S.md,
    // Dokunma hedefi Apple'ın alt sınırının üstünde. 52 yazılıydı — doğruydu ama
    // sayının nereden geldiği belli değildi; artık sınırla ilişkisi görünüyor.
    height: MIN_TOUCH + S.sm,
    borderRadius: R.md,
  },
  // Buradaki metnin rengi HER ZAMAN kullanım yerinden gelir (task ? onPrimary : onSurface).
  // Stilde `color: 'white'` yazılıydı: ezilmediği an koyu temada yanlış olurdu, çünkü
  // koyu temada onPrimary KOYU'dur (bkz. Colors.ts). Sessiz bekleyen bir tuzaktı.
  primaryText: { fontWeight: W.semibold, fontSize: F.subhead },
  seeAllBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: S.xs,
    height: MIN_TOUCH + S.sm,
  },
  seeAllText: { fontSize: F.body, fontWeight: W.semibold },
});
