import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { MotiView } from 'moti';
import { TrendingUp, TrendingDown, Minus, CheckCircle2, Zap, Flame, Shield, Info } from 'lucide-react-native';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { ICON, S, F, R, METRIC, LH, trackingFor } from '@/shared/constants/tokens';
import { Touchable } from '@/shared/components/Touchable';
import { useMomentumStore } from '@/features/user/store/useMomentumStore';
import { swallow } from '@/shared/utils/swallow';
import { Separator } from '@/shared/components/Separator';
import { BentoCard } from '@/shared/components/BentoCard';
import { AnimatedNumber } from '@/shared/components/AnimatedNumber';
import { useSettledValue } from '@/shared/hooks/useSettledValue';
import { haptic } from '@/shared/utils/haptics';

interface DayScore { date: string; score: number }

interface Props {
  score: number;
  history: DayScore[];
  language: string;
  loading?: boolean;
}

export const MomentumPulse: React.FC<Props> = ({ score, history, language, loading }) => {
  const { theme, colorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';
  const [infoVisible, setInfoVisible] = useState(false);
  const { 
    momentumShieldActive, 
    toggleMomentumShield, 
    shieldCharges, 
    focusMinutesForNextCharge, 
    tasksCompletedForNextCharge,
    engineHeat,
    isOverheated,
    decayEngineHeat
  } = useMomentumStore();

  React.useEffect(() => {
    if (!infoVisible) return;
    decayEngineHeat();
    const timer = setInterval(() => {
      decayEngineHeat();
    }, 1000);
    return () => clearInterval(timer);
  }, [infoVisible]);

  // Skor birden çok store'dan (görev, odak, seri, alışkanlık) beslendiği için ilk açılışta
  // her biri hidrate oldukça yeniden hesaplanıyor. Durulmasını bekleyip TEK bir hedef
  // değere sayıyoruz; ara değerler ekrana hiç çıkmıyor.
  const targetScore = useSettledValue(score, 400);

  // Lite modda süslemeler kapalı: sayım animasyonu da kapanır, değer anında yazılır.
  let isLite = false;
  try {
    const { usePrefsStore } = require('@/features/modes/store/usePrefsStore');
    isLite = usePrefsStore.getState().uiMode === 'lite';
  } catch (e) { swallow('MomentumPulse.uiMode', e); }

  // Renk hedef değerden türetilir: sayım eşikleri geçerken renk gri→turuncu→yeşil
  // diye titremesin, en baştan varacağı rengi alsın.
  const accentColor = targetScore >= 75 ? theme.tertiary : targetScore >= 40 ? theme.streak : theme.onSurfaceVariant;

  // Week-over-week delta: yesterday vs 7 days ago
  const isEight = history.length >= 8;
  const yesterday = isEight ? (history[6]?.score ?? -1) : (history[5]?.score ?? -1);
  const weekAgo   = history[0]?.score ?? -1;
  const delta = (yesterday >= 0 && weekAgo >= 0) ? yesterday - weekAgo : null;

  const tr = language === 'tr';

  if (loading) {
    return (
      <View style={{ height: 64, marginHorizontal: S.md, marginBottom: S.md }} />
    );
  }

  /**
   * Kaç günün gerçek verisi var — grafiğin NE söylediğini bu belirliyor.
   *
   * Veri olmayan günler 3px'lik soluk çubuklara düşüyor. Yedi tanesi yan yana gelince
   * grafik düz bir çizgi gibi okunuyor, yani "hiç ilerlemen yok" diyor — halbuki
   * söylemek istediği "henüz ölçecek kadar gün geçmedi". İkisi çok farklı cümleler.
   *
   * Blok bir ara tamamen gizlenmişti; yanlıştı — çalışan bir özelliği kullanıcıdan
   * saklamak, kötü görünen bir durumu düzeltmek değil. Bunun yerine grafik, veri
   * yetersizken NE OLDUĞUNU söylüyor (bkz. aşağıdaki altyazı).
   */
  const daysWithData = history.filter((d) => d.score >= 0).length;
  const buildingUp = daysWithData < 3;

  const displayHistory = isEight ? history.slice(1) : history;

  return (
    <>
    {/*
      KART İÇİNDE — sayfadaki TEK kartsız öğe olmaktan çıktı.

      Bu blok çıplak bir `View`di ve etrafındaki her şey BentoCard'dı. Gruplanmış-inset
      düzende (iOS Ayarlar deseni) kapsayıcısı olmayan bir öğe "sisteme ait değil" diye
      okunur — göz onu içerik değil artık sayar. Selamlama ile ilk kartın arasında
      duruyordu, yani en görünür yerde.

      Kural basit: gruplanmış bir sayfada her öğe bir gruba aittir. Ya bir gruba katılır
      ya da kendisi grup olur. Bu blok artık kendisi bir grup.

      Dolgu kartın varsayılanından (S.lg) küçük: içerik tek satır yüksekliğinde, tam
      dolgu kartı boş gösterirdi.
    */}
    <View style={{ paddingHorizontal: S.lg, marginBottom: S.lg }}>
    <BentoCard index={0} style={{ padding: S.md }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>

      {/* Score + info */}
      <View>
      <MotiView
        from={{ opacity: 0, translateY: 4 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'spring', damping: 18 }}
      >
        <AnimatedNumber
          value={targetScore}
          from={0}
          duration={isLite ? 0 : 1100}
          /*
            İKİNCİL SAYI ÖLÇEĞİ — kart kahramanından KÜÇÜK olmak zorunda.

            48pt elle yazılıydı, yani METRIC ölçeğinin dışındaydı; ölçekte `md: 44`
            "kart kahramanı", `sm: 32` "ikincil sayı" demek. Sonuç: momentum sayfadaki
            EN BÜYÜK sayıydı ve "Bugün" kartının 44pt'lik ana sayısını eziyordu.

            Hiyerarşi tersti ve en çok da başarı anında görünüyordu: kullanıcı günün
            hedefinin %100'ünü bitirdiğinde ekranın en büyük öğesi hâlâ gri bir momentum
            puanı oluyor, asıl başarı onun altında daha küçük duruyordu. Momentum
            BAĞLAMDIR (uzun vadeli eğilim); günün sonucu ise KONUDUR. Punto bunu söylemeli.

            Harf aralığı ve satır yüksekliği de puntodan türüyor artık — -3 ve 52 elle
            yazılıydı, yani 48'e göreydi ve punto değişince sessizce bozulurlardı.
          */
          style={{
            fontSize: METRIC.sm,
            fontWeight: '700',
            letterSpacing: trackingFor(METRIC.sm),
            color: accentColor,
            lineHeight: METRIC.sm * LH.tight,
          }}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, marginTop: -2 }}>
          {/*
            ETİKET NÖTR, SAYI RENKLİ. Etiket de skor rengini alıp `opacity: 0.5` ile
            kısılıyordu; iki ayrı hata: (a) rengi kullanım yerinde kısmak ölçülen
            kontrastı geçersiz kılar (bkz. colorContrast.test.ts), (b) hem sayı hem
            etiket renkliyken renk "durum" demeyi bırakır, dekora döner. Renk TEK yerde
            konuşsun: sayıda. `fontSize: F.caption` da ölçek dışıydı — F.caption ölçekten gelir.
          */}
          <Text style={{ fontSize: F.caption, fontWeight: '700', letterSpacing: 1.2, color: theme.onSurfaceMuted }}>
            MOMENTUM
          </Text>
          {/*
            `ⓘ` bir METİN karakteriydi — yazı tipine göre farklı çizilir ve satır
            hizasına oturmaz. Uygulamanın her yerinde lucide glifleri var; tek bir metin
            sembolü sistemi bozuyordu. Daire zemin de kalktı: Apple bar içi yardım
            glifini çıplak çizer.
          */}
          <Touchable
            hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
            onPress={() => { haptic.surface(); setInfoVisible(true); }}
            accessibilityRole="button"
            accessibilityLabel={tr ? 'Momentum nedir?' : 'What is momentum?'}
          >
            <Info size={ICON.xs} color={theme.onSurfaceVariant} strokeWidth={2.5} />
          </Touchable>
        </View>
      </MotiView>
      </View>

      {/*
        DİKEY AYIRAÇ KALDIRILDI. Uygulamada başka hiçbir yerde dikey saç teli çizgi yok;
        bu bir "widget" deseni, iOS deseni değil. Rengi de ham `rgba()` ile tema başına
        elle yazılıydı, yani paletin dışındaydı. Kart kenarı ve aradaki boşluk ayırma
        işini zaten yapıyor — çizgi yalnız gürültü ekliyordu.
      */}

      {/* Sparkline */}
      <View style={{ flex: 1, gap: S.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: S.xs, height: 24 }}>
          {displayHistory.map((day, i) => {
            const has = day.score >= 0;
            const isToday = i === 6;
            const h = has ? Math.max(3, Math.round((day.score / 100) * 24)) : 3;
            // Veri olmayan gün PALET jetonuyla çiziliyor; ham `rgba()` ile tema başına
            // elle yazılıydı ve palet değişince sessizce eskiyordu.
            const barColor = !has
              ? theme.outlineVariant
              : day.score >= 75 ? theme.tertiary
              : day.score >= 40 ? theme.streak
              : theme.onSurfaceVariant;
            return (
              <MotiView
                key={day.date}
                from={{ height: 0 }}
                animate={{ height: h }}
                transition={{ type: 'spring', damping: 16, delay: i * 35 }}
                /*
                  `opacity: isToday ? 1 : 0.45` KALDIRILDI. Geçmiş günleri %45'e kısmak
                  iki şeyi bozuyordu: renk skoru kodluyor (yeşil/turuncu/gri) ve kısılınca
                  o kodlama okunamaz hâle geliyordu; ayrıca ölçülen kontrast geçersiz
                  kalıyordu. Bugünü ayırt etmek için vurguya da gerek yok — grafiğin SON
                  çubuğu zaten bugün, konum bunu söylüyor. Apple'ın grafikleri de geçmiş
                  değerleri soluklaştırmaz.
                */
                style={{
                  flex: 1,
                  borderRadius: R.xs,
                  backgroundColor: barColor,
                }}
              />
            );
          })}
        </View>
        {/*
          ALTYAZI GRAFİĞİN NE OLDUĞUNU SÖYLER.
          "son 7 gün" yazıp neredeyse boş bir grafik göstermek yanlış bir cümle kuruyordu:
          kullanıcı 7 günlük verisine baktığını sanıp düz çizgi görüyor ve "hiç ilerlemem
          yok" diye okuyordu. Veri yetersizken grafik boş değil, HENÜZ DOLMAMIŞTIR —
          altyazı bunu söyleyince aynı görüntü suçlama olmaktan çıkıp beklenti oluyor.
        */}
        <Text style={{ fontSize: F.caption, fontWeight: '700', color: theme.onSurfaceMuted, letterSpacing: 0.3 }}>
          {buildingUp
            ? (tr ? `${daysWithData}. gün · grafik doluyor` : `day ${daysWithData} · chart filling up`)
            : (tr ? 'son 7 gün' : 'last 7 days')}
        </Text>
      </View>

      {/* Trend */}
      {delta !== null && (
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 300 }}
          style={{ alignItems: 'center', gap: S.xs }}
        >
          {delta > 0
            ? <TrendingUp size={ICON.sm} color={theme.tertiary} strokeWidth={2.5} />
            : delta < 0
            ? <TrendingDown size={ICON.sm} color={theme.error} strokeWidth={2.5} />
            : <Minus size={ICON.sm} color={theme.onSurfaceVariant} strokeWidth={2.5} />}
          <Text style={{
            fontSize: 11,
            fontWeight: '700',
            color: delta > 0 ? theme.tertiary : delta < 0 ? theme.error : theme.onSurfaceVariant,
            opacity: delta === 0 ? 0.4 : 1,
          }}>
            {delta > 0 ? `+${delta}` : delta}
          </Text>
        </MotiView>
      )}
    </View>
    </BentoCard>
    </View>

    {/* Momentum formula info modal */}
    <Modal visible={infoVisible} transparent animationType="fade" onRequestClose={() => setInfoVisible(false)}>
      <Touchable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: S.slg }} activeOpacity={1} onPress={() => setInfoVisible(false)}>
        <MotiView
          from={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 18 }}
          style={{ backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderRadius: R.xl, padding: S.lg, width: '100%', gap: S.md }}
        >
          <Text style={{ fontSize: 16, fontWeight: '700', color: accentColor, letterSpacing: -0.5 }}>
            {tr ? 'Momentum Nasıl Hesaplanır?' : 'How is Momentum Calculated?'}
          </Text>
          <Text style={{ fontSize: 13, fontWeight: '500', color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)', lineHeight: 20 }}>
            {tr
              ? 'Momentum, takip etmen gereken tek skor. Görevlerin, odağın ve serin bir araya gelip onu besler:'
              : 'Momentum is the one score to watch. Your tasks, focus, and streak come together to feed it:'}
          </Text>
          {[
            { icon: <CheckCircle2 size={ICON.sm} color={theme.success} />, label: tr ? 'Görev Tamamlama' : 'Task Completion', pct: '40%', color: theme.success },
            { icon: <Zap size={ICON.sm} color={accentColor} />, label: tr ? 'Odak Süresi' : 'Focus Time', pct: '35%', color: accentColor },
            { icon: <Flame size={ICON.sm} color={theme.streak} />, label: tr ? 'Günlük Seri' : 'Daily Streak', pct: '25%', color: theme.streak },
          ].map((row) => (
            <View key={row.label} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.smd }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
                {row.icon}
                <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.8)' }}>{row.label}</Text>
              </View>
              <Text style={{ fontSize: 14, fontWeight: '700', color: row.color }}>{row.pct}</Text>
            </View>
          ))}

          {/* Rocket Thruster Overheat Card (only if not lite mode) */}
          {(() => {
            let isLite = false;
            try {
              const { usePrefsStore } = require('@/features/modes/store/usePrefsStore');
              isLite = usePrefsStore.getState().uiMode === 'lite';
            } catch (e) { swallow('MomentumPulse.soundPlay', e); }

            if (isLite) return null;

            const roundedHeat = Math.round(engineHeat);

            return (
              <View style={{
                backgroundColor: isOverheated ? theme.error + '10' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'),
                borderRadius: R.lg,
                padding: S.md,
                borderWidth: 1.5,
                borderColor: isOverheated ? theme.error : 'transparent',
                gap: S.sm
              }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
                    <Zap size={ICON.sm} color={isOverheated ? theme.error : theme.tertiary} />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)' }}>
                      {tr ? 'İvme Roket Motoru' : 'Propulsion Thruster'}
                    </Text>
                  </View>
                  <Text style={{
                    fontSize: 11,
                    fontWeight: '700',
                    color: isOverheated ? theme.error : (roundedHeat > 50 ? theme.streak : theme.success)
                  }}>
                    {isOverheated ? (tr ? 'AŞIRI ISINDI 🌋' : 'OVERHEATED 🌋') : (tr ? 'NOMİNAL 🔥' : 'NOMINAL 🔥')}
                  </Text>
                </View>

                {/* Progress bar representing heat */}
                <View style={{ height: 6, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', borderRadius: R.xs, overflow: 'hidden' }}>
                  <View style={{
                    height: '100%',
                    width: `${roundedHeat}%`,
                    backgroundColor: isOverheated ? theme.error : (roundedHeat > 50 ? theme.streak : theme.tertiary),
                    borderRadius: R.xs
                  }} />
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: F.caption, fontWeight: '700', color: theme.onSurfaceMuted }}>
                    {tr ? `Motor Sıcaklığı: %${roundedHeat}` : `Thruster Temperature: ${roundedHeat}%`}
                  </Text>
                  <Text style={{ fontSize: F.caption, fontWeight: '700', color: theme.onSurfaceMuted }}>
                    {isOverheated 
                      ? (tr ? 'Soğuyor... (ivme devredışı)' : 'Cooling... (propulsion disabled)') 
                      : (tr ? 'Güvenli limit altında' : 'Safe limits')}
                  </Text>
                </View>
              </View>
            );
          })()}

          {/* Momentum Shield (İvme Kalkanı) Toggle Card */}
          <View style={{
            backgroundColor: momentumShieldActive ? theme.streak + '15' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'),
            borderRadius: R.lg,
            padding: S.md,
            borderWidth: 1.5,
            borderColor: momentumShieldActive ? theme.streak : 'transparent',
            gap: S.smd
          }}>
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.smd, flex: 1, marginRight: S.sm }}>
                <Shield size={ICON.md} color={momentumShieldActive ? theme.streak : theme.onSurfaceVariant} strokeWidth={2.2} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)' }}>
                    {tr ? 'İvme Kalkanı' : 'Momentum Shield'}
                  </Text>
                  <Text style={{ fontSize: 10, color: theme.onSurfaceMuted, marginTop: S.xxs, lineHeight: 13 }}>
                    {tr ? 'Hastalık / tatil günlerinde ivmeyi korur' : 'Freezes momentum on sick / vacation days'}
                  </Text>
                </View>
              </View>
              <Touchable
                disabled={!momentumShieldActive && shieldCharges <= 0}
                onPress={() => {
                  haptic.success();
                  toggleMomentumShield();
                }}
                style={{
                  backgroundColor: momentumShieldActive 
                    ? theme.streak 
                    : (shieldCharges <= 0 ? 'rgba(0,0,0,0.05)' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')),
                  paddingHorizontal: S.smd,
                  paddingVertical: S.sm,
                  borderRadius: R.sm,
                  borderWidth: 1,
                  borderColor: momentumShieldActive ? 'transparent' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'),
                  opacity: (!momentumShieldActive && shieldCharges <= 0) ? 0.4 : 1
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: '700', color: momentumShieldActive ? '#fff' : theme.onSurfaceVariant }}>
                  {momentumShieldActive 
                    ? (tr ? 'AKTİF' : 'ACTIVE') 
                    : (shieldCharges <= 0 ? (tr ? 'ŞARJ YOK' : 'NO CHARGE') : (tr ? 'ETKİNLEŞTİR' : 'ACTIVATE'))}
                </Text>
              </Touchable>
            </View>

            {/* Divider */}
            <Separator theme={theme} />
            {/* Charges and progress details */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              {/* Charge Pills */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: theme.onSurfaceVariant, marginRight: S.xxs }}>
                  {tr ? 'Şarj:' : 'Charges:'}
                </Text>
                {Array.from({ length: 3 }).map((_, idx) => {
                  const filled = idx < shieldCharges;
                  return (
                    <View
                      key={idx}
                      style={{
                        width: 14,
                        height: 7,
                        borderRadius: R.xs,
                        backgroundColor: filled 
                          ? (momentumShieldActive ? theme.streak : theme.tertiary) 
                          : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'),
                      }}
                    />
                  );
                })}
              </View>

              {/* Progress to next charge */}
              {shieldCharges < 3 ? (
                <Text style={{ fontSize: F.caption, fontWeight: '700', color: theme.onSurfaceMuted }}>
                  {tr 
                    ? `Yeni şarj için: ${60 - focusMinutesForNextCharge}dk odak / ${5 - tasksCompletedForNextCharge} görev`
                    : `${60 - focusMinutesForNextCharge}m focus / ${5 - tasksCompletedForNextCharge} tasks next`
                  }
                </Text>
              ) : (
                <Text style={{ fontSize: F.caption, fontWeight: '700', color: theme.tertiary }}>
                  {tr ? 'Maksimum Şarj' : 'Maximum Charged'}
                </Text>
              )}
            </View>
          </View>

          <Touchable onPress={() => setInfoVisible(false)} style={{ backgroundColor: accentColor, borderRadius: R.md, paddingVertical: S.smd, alignItems: 'center', marginTop: S.xs }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>{tr ? 'Anladım' : 'Got it'}</Text>
          </Touchable>
        </MotiView>
      </Touchable>
    </Modal>
    </>
  );
};
