import React from 'react';
import { View, Text } from 'react-native';
import { Check, ChevronRight } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { ICON, R, S, F, HAIRLINE, B, touchSlop } from '@/shared/constants/tokens';
import { getModeInfoForTask, getTaskRemainingTime } from '@/features/modes';
import { getLocalizedTaskTitle } from '@/features/tasks';
import type { AppTheme } from '@/shared/constants/Colors';

export interface MyDayTaskRowProps {
  item: any;
  isLast: boolean;
  theme: AppTheme;
  isDark: boolean;
  tr: boolean;
  onPress: () => void;
  /**
   * Görevi TAMAMLAR. Verilmezse halka çizilir ama dokunulamaz.
   *
   * İsteğe bağlı olmasının iki gerçek nedeni var: tamamlanmış satırlarda geri alma
   * YOK (bkz. app/index.tsx → handleCheckTask) ve bu satır tur önizlemelerinde de
   * çiziliyor — orada canlı bir görev yok. İkisinde de halka duruyor, çünkü
   * önizleme gerçek ekrandan farklı görünmemeli.
   */
  onCheck?: () => void;
  priorityColor: (p: string) => string;
  prefs: any;
}

/**
 * TAMAMLAMA HALKASI — satırın solundaki öncelik noktasının yerini aldı.
 *
 * ── ÖLÇÜLEN SORUN ───────────────────────────────────────────────────────────
 * Ana ekrandaki günlük görev listesinden bir görev TAMAMLANAMIYORDU. Satır yalnız
 * Görevler sayfasına gidiyordu; `handleCheckTask` (kilo modalı, kutlama kapıları,
 * çevrimdışı kuyruk, ses efekti — seksen satır) hiçbir yerden çağrılmıyordu. Aynı
 * kartın hemen üstünde RİTÜELLER tek dokunuşla işaretleniyordu; kullanıcı için bu
 * asimetri bozukluk gibi okunur.
 *
 * Kontrol SOLA konuldu, sona değil: Apple'ın Hatırlatıcılar deseni budur ve
 * zaten orada duran 7pt'lik renk noktasının yerini alıyor — yani satıra yeni bir
 * öğe EKLENMİYOR, var olan öğe işlevine kavuşuyor. Renk de korunuyor: halka,
 * noktanın taşıdığı öncelik/mod rengini taşıyor.
 *
 * Görsel çap 22pt, dokunma hedefi 44pt (hitSlop ile) — Apple HIG.
 */
const CheckRing: React.FC<{ color: string; done: boolean; theme: AppTheme; onCheck?: () => void; label: string }>
  = ({ color, done, theme, onCheck, label }) => {
  const size = 22;
  const ring = (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: R.full,
        borderWidth: done ? 0 : B.medium,
        borderColor: color,
        backgroundColor: done ? theme.success : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {done && <Check size={ICON.xs} color={theme.onPrimary} strokeWidth={3} />}
    </View>
  );

  // Tamamlanmış satırda geri alma yok → düğme DEĞİL, durum göstergesi.
  if (!onCheck || done) {
    return (
      <View style={{ marginRight: S.md }} accessible accessibilityRole="image" accessibilityLabel={label}>
        {ring}
      </View>
    );
  }

  return (
    <Touchable
      onPress={onCheck}
      hitSlop={touchSlop(size)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: false }}
      accessibilityLabel={label}
      style={{ marginRight: S.md, minWidth: size, minHeight: size, alignItems: 'center', justifyContent: 'center' }}
    >
      {ring}
    </Touchable>
  );
};

/**
 * Satırın metinleri — dil başına TEK karar.
 *
 * Her cümleyi ayrı ayrı `tr ? ... : ...` diye dallandırmak, aynı soruyu yedi kez
 * sormak demek: biri güncellenip öteki unutulduğunda arayüz yarı Türkçe kalıyor
 * (bkz. __tests__/i18nRatchet.test.ts).
 */
const copy = (tr: boolean) => tr
  ? {
      done: 'Tamamlandı',
      complete: 'Görevi tamamla',
      doneSuffix: 'tamamlandı',
      openHint: 'Görev ayrıntılarını açar',
      dayOne: '1. Gün',
      clean: (d: number) => `Temiz: ${d} gün`,
      goal: (d: number) => `Hedef: ${d} gün`,
    }
  : {
      done: 'Completed',
      complete: 'Complete task',
      doneSuffix: 'completed',
      openHint: 'Opens task details',
      dayOne: 'Day 1',
      clean: (d: number) => `Clean: ${d} ${d === 1 ? 'day' : 'days'}`,
      goal: (d: number) => `Goal: ${d} days`,
    };

export const MyDayTaskRow = React.memo<MyDayTaskRowProps>(({ item, isLast, theme, isDark, tr, onPress, onCheck, priorityColor, prefs }) => {
  const modeInfo = getModeInfoForTask(item.original, prefs, theme);
  const title = getLocalizedTaskTitle(item.original || item, tr);
  const c = copy(tr);
  return (
    <Touchable
      onPress={onPress}
      activeOpacity={0.7}
      /*
        SATIRIN ADI AÇIKÇA VERİLİYOR. Ekran okuyucu bu satırı çocuklarından
        topluyordu: başlık, mod adı ve geri sayım ayrı ayrı okunuyor, kullanıcı
        görevin tamamlanıp tamamlanmadığını duymuyordu. Tek cümle daha anlaşılır.
      */
      accessibilityRole="button"
      accessibilityLabel={item.isCompleted
        ? `${title} — ${c.doneSuffix}`
        : title}
      accessibilityHint={c.openHint}
      style={{
        flexDirection: 'row', alignItems: 'center',
        // Dikey boşluk BİLEREK burada değil, içerik bloğunda: ayırıcı satırın alt
        // kenarına oturmalı, iç boşluğun içinde asılı kalmamalı.
        paddingLeft: S.md,
        // Zemin tonu TAM GENİŞLİK kalır — iOS satırın tamamını boyar, girintiyi
        // yalnızca ayırıcıya uygular.
        // SATIR ZEMİNİ YIKAMASI KALDIRILDI — kartlarda kaldırdığımız desenin aynısı.
        // Mod rengi satırın tamamına %4 (koyu temada %7) opaklıkla seriliyordu: o
        // yoğunlukta renk bilgi taşımıyor, yalnız beyazı kirletiyor. Mod kimliğini
        // soldaki nokta ve ikincil satırdaki ad zaten taşıyor.
        backgroundColor: 'transparent'
      }}
    >
      <CheckRing
        color={modeInfo ? modeInfo.color : priorityColor(item.priority)}
        done={!!item.isCompleted}
        theme={theme}
        onCheck={onCheck}
        label={item.isCompleted
          ? c.done
          : c.complete}
      />
      {/*
        Ayırıcı bu blokta — yani noktanın SAĞINDAN, metnin başladığı yerden başlıyor.
        Apple listelerinin imzası bu: çizgi ikonun altını boş bırakır, böylece satırlar
        tek bir grup gibi okunur. Tam genişlik çizgi web/Android deseni.
      */}
      <View style={{
        flex: 1, flexDirection: 'row', alignItems: 'center',
        paddingVertical: S.smd, paddingRight: S.md,
        borderBottomWidth: isLast ? 0 : HAIRLINE,
        borderBottomColor: theme.separator,
      }}>
      <View style={{ flex: 1, gap: S.xxs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, overflow: 'hidden' }}>
          <Text style={{
            fontSize: F.body,
            fontWeight: '600',
            color: item.isCompleted ? theme.onSurfaceVariant : theme.onSurface,
            textDecorationLine: item.isCompleted ? 'line-through' : 'none',
            opacity: item.isCompleted ? 0.5 : 1,
            flexShrink: 1
          }} numberOfLines={1}>
            {title}
          </Text>
          {/*
            MOD ROZETİ BAŞLIĞIN YANINDAN ALINDI — aşağıdaki ikincil satıra taşındı.

            Burada 7.5pt büyük harf yazı, renkli zemin ve 0.5pt çerçeveden oluşan bir
            hap duruyordu. Üç ayrı sorun:

             · 7.5pt, F.caption'ın (11) çok altında ve o ölçek dosyada "okunabilirliğin
               ALT SINIRI" diye tanımlı. Yani okunmak için değil, var olmak için yazılmış.
             · BAŞLIĞIN GENİŞLİĞİNİ YİYORDU. Başlık `numberOfLines={1}`; hapın kapladığı
               her piksel, görev adından kesiliyordu.
             · AYNI BİLGİ ÜÇÜNCÜ KEZ. Satırın solundaki nokta zaten mod rengini taşıyor,
               satır zemini de %4 mod rengiyle yıkanmıştı (o da kaldırıldı).

            Apple'ın Hatırlatıcılar deseni: başlık üstte tam genişlikte, ait olduğu liste
            ikincil satırda. Kategori bilgisi ikincil satırın işidir.
          */}
        </View>
        {(() => {
          /*
            İKİNCİL SATIR: [mod adı] · [geri sayım]

            Mod adı buraya taşındı (bkz. yukarıdaki not). Renk mod kimliğini taşımaya
            devam ediyor ama artık hap/çerçeve yok — Apple ikincil satırda düz renkli
            metin kullanır, kutu değil.

            Puntolar 9pt ve 7.5pt idi; ikisi de F.caption'ın (11) altında ve o değer
            dosyada "okunabilirliğin ALT SINIRI" diye tanımlı. Ölçeğin altına inen yazı
            tasarım tercihi değil, okunamayan yazıdır.
          */
          const modeLabel = modeInfo ? (tr ? modeInfo.labelTr : modeInfo.labelEn) : null;
          const modeColor = modeInfo?.color;

          const isQuitMode = modeInfo && (modeInfo.unit === 'clean_day');
          const taskCountdown = isQuitMode
            ? (modeInfo!.daysLeft === 0
                ? c.dayOne
                : c.clean(modeInfo!.daysLeft!))
            : getTaskRemainingTime(item.original?.dueDate, item.original?.dueTime, item.original?.isCompleted, tr);

          const planCountdown = !isQuitMode && modeInfo && modeInfo.daysLeft !== undefined && modeInfo.unit === 'day'
            ? c.goal(modeInfo.daysLeft)
            : null;

          const tail = [planCountdown, taskCountdown].filter(Boolean).join(' · ');
          // Mod adı varken geri sayım yoksa satır yine çizilmeli: eskiden `!taskCountdown`
          // erken dönüyordu ve mod bilgisi hiç görünmüyordu.
          if (!modeLabel && !tail) return null;

          const isOverdue = taskCountdown === 'Süresi geçti' || taskCountdown === 'Overdue';

          return (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: S.xxs, gap: S.xs }}>
              {modeLabel && (
                <Text
                  numberOfLines={1}
                  style={{ fontSize: F.caption, fontWeight: '700', color: modeColor, flexShrink: 1 }}
                >
                  {modeLabel}
                </Text>
              )}
              {!!tail && (
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: F.caption,
                    fontWeight: '600',
                    // GECİKME BİR HATA DEĞİL, DURUM. `error` (kırmızı) ile çiziliyordu;
                    // kırmızı gerçekten bozulan şeyler için ayrılmalı, yoksa her yerde
                    // kırmızı gören kullanıcı onu okumayı bırakır.
                    color: isOverdue ? theme.warning : theme.onSurfaceMuted,
                    // `opacity: 0.5` KALDIRILDI: palet rengini kullanım yerinde kısmak
                    // ölçülmüş kontrastı geçersiz kılar (bkz. colorContrast.test.ts).
                    flexShrink: 1,
                  }}
                >
                  {modeLabel ? `· ${tail}` : tail}
                </Text>
              )}
            </View>
          );
        })()}
      </View>
      {/*
        Sondaki ok "aç"ı anlatıyor ve İKİ DURUMDA DA duruyor. Eskiden tamamlanmışta
        yerini yeşil bir tike bırakıyordu; artık tamamlanmayı soldaki dolu halka
        söylüyor, aynı bilgiyi satırın iki ucunda tekrar etmeye gerek yok. Ayrıca
        ikonun sabit kalması, işaretlenince satırın sağ ucunun oynamasını önlüyor.
      */}
      <ChevronRight size={ICON.sm} color={theme.onSurfaceVariant} opacity={0.3} style={{ marginLeft: S.sm }} />
      </View>
    </Touchable>
  );
});
