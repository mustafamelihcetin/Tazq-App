import React from 'react';
import { View, Text, Switch, StyleSheet, Platform } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { Separator } from '@/shared/components/Separator';
import { SegmentedControl } from '@/shared/components/SegmentedControl';
import { S, R, F, B, W, ICON, LH } from '@/shared/constants/tokens';
import { SettingsChip, type AppTheme } from '@/shared/constants/Colors';

/**
 * Ayar ikonlarının ANLAMSAL renk haritası — domain'e göre, rastgele değil.
 *
 * Eskiden renkler plansızdı: bildirim çanı amber ama sabah özeti mavi (aynı bölüm iki
 * renk), dil yeşil (dilin yeşille ilgisi yok), iki Shield iki farklı renk, çoğu palet
 * dışı sabit hex. Göz bu kaosu "ucuz/rastgele" okur.
 *
 * Artık her domain'in TEK anlamı var ve ilişkili satırlar aynı hue'yu paylaşıyor —
 * göz onları grup olarak algılıyor (Gestalt: benzerlik → gruplama). Renkler paletten:
 * CategoryColors iki temada da ≥3:1 (bkz. colorContrast.test.ts).
 *
 * fg = ikonun kendi (doygun) rengi; bg = aynı rengin çip zeminindeki soluk tonu.
 */
/**
 * Apple tarzı çip: DOLU renkli kutu + BEYAZ glif (iOS Ayarlar'ın imzası).
 *
 * Eskiden soluk tint zemin + renkli ikondu — Apple deseni değil. Artık her domain
 * DOLU rengiyle çip zemini oluyor, ikon beyaz. Beyaz her domain renginde ≥3.56:1
 * (doğrulandı) — glif okunur.
 *
 * Renkler paletten ve anlamsal (Gestalt–benzerlik: ilişkili satırlar aynı renkte grup).
 */
export function settingsAccents(theme: AppTheme): Record<string, string> {
  return {
    // bildirim & zamanlama — dikkat/vakit. Amber (#B45309) DOLU kutu olarak kahve/muddy
    // duruyordu (yazı için seçilmiş koyu ton, dolgu olarak çirkin). Canlı turuncuya
    // çekildi: dolu zeminde temiz, beyaz glif 3.56:1.
    // 2026-10-31: kategori başına sabit renk (bkz. Colors.ts → SettingsChip). Vurguya BAĞLI DEĞİL.
    notify: SettingsChip.notify,
    system: SettingsChip.appearance,
    core: SettingsChip.appearance, // Görünüm & Dil sayfasındaki davranış satırları (ses, titreşim, sade mod)
    health: SettingsChip.health,
    payments: SettingsChip.payments,
    streak: SettingsChip.rewards,
    legal: SettingsChip.account,
  };
}

/**
 * Gruplanmış ayar listesi primitifleri — kart, satır, geçiş, ayıraç.
 *
 * profile.tsx içinde YEREL tanımlıydılar; ayarların ayrı bir sayfaya taşınabilmesi için
 * paylaşılan hale getirildiler (ilk tüketici hâlâ profil, sıradaki settings sayfası).
 *
 * Çıkarılırken üç şey düzeltildi:
 *  - Satır etiketi 700 ağırlıktaydı → normal. iOS Ayarlar'da satır etiketleri (Wi-Fi,
 *    Bluetooth…) normal ağırlıktır; 700 "her şey kalın" anti-deseninin ta kendisiydi.
 *  - Switch renkleri elle yazılıydı (#3A3A3C / #E5E5EA / #636366) → palet token'ları.
 *  - SettingItem'ın ikon zemini `theme.colorScheme` diye VAR OLMAYAN bir alana bakıyordu;
 *    koşul hep false dönüp tek bir sabit rgba kullanıyordu — palet token'ına bağlandı.
 */

// ── Kart ────────────────────────────────────────────────────────────────
export interface SettingsCardProps {
  children: React.ReactNode;
  theme: AppTheme;
  isDark: boolean;
  style?: object;
}

export function SettingsCard({ children, theme, isDark, style }: SettingsCardProps) {
  return (
    <View
      style={[
        {
          backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLowest,
          borderColor: isDark ? theme.outline : 'transparent',
          borderWidth: isDark ? B.thin : 0,
          borderRadius: R.md,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ── Kart içi ayıraç ──────────────────────────────────────────────────────
/**
 * Kart içi satır ayıracı — paylaşılan Separator üzerine ince sarmal.
 * marginHorizontal KORUNUR: bu kart içi bir ayıraç, iki yandan girintili
 * (Separator'ın inset'i yalnızca soldandır — o, liste satırı deseni).
 */
export function RowDivider({ theme }: { theme: AppTheme }) {
  return (
    <View style={{ marginHorizontal: S.md }}>
      <Separator theme={theme} />
    </View>
  );
}

// ── İkon çipi (satırların solundaki renkli kare) ─────────────────────────
export function IconChip({ bg, theme, children }: { bg?: string; theme: AppTheme; children: React.ReactNode }) {
  return (
    <View style={[styles.chip, { backgroundColor: bg ?? theme.surfaceContainerHigh }]}>
      {children}
    </View>
  );
}

// ── Tıklanabilir satır (sağda chevron) ───────────────────────────────────
export interface SettingItemProps {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  right?: React.ReactNode;
  /**
   * Satırın mevcut DEĞERİ ("Aydınlık", "Türkçe", "Kapalı") — iOS Ayarlar biçimi:
   * ikincil renk, gövde punto, normal ağırlık, büyük harf YOK. Eskiden her satır kendi
   * `right` metnini yazıyordu ve üç ayrı stil oluşmuştu (mavi "AYDINLIK", siyah "TR",
   * yeşil/gri "Kapalı"). Değer bir durumdur, eylem değil — renklenmez.
   */
  value?: string;
  onPress?: () => void;
  theme: AppTheme;
  bg?: string;
}

export function SettingItem({ icon, label, sub, right, value, onPress, theme, bg }: SettingItemProps) {
  return (
    /*
      Basılamayan satır DÜĞME gibi duyurulmaz.

      `SettingItem` her zaman düğme rolüyle çiziliyordu; oysa bazı satırlar yalnız
      DEĞER gösteriyor (ör. Focus Puanları). Ekran okuyucu onları "düğme" diye
      okuyup etkinleştiriyor, hiçbir şey olmuyordu. Rol artık gerçeği söylüyor.
    */
    <Touchable
      style={styles.row}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={label}
    >
      <View style={styles.rowLeft}>
        <IconChip bg={bg} theme={theme}>{icon}</IconChip>
        <View style={styles.rowText}>
          <Text style={[styles.label, { color: theme.onSurface }]}>{label}</Text>
          {!!sub && <Text style={[styles.sub, { color: theme.onSurfaceMuted }]}>{sub}</Text>}
        </View>
      </View>
      <View style={styles.rowRight}>
        {!!value && <Text style={[styles.value, { color: theme.onSurfaceMuted }]} numberOfLines={1}>{value}</Text>}
        {right}
        {/* Chevron ÜÇÜNCÜL renkte, opacity YOK — eskiden onSurfaceVariant + opacity 0.3
            idi (ölçülü rengi kısmak). Affordans olarak muted seviyesi daha okunur. */}
        {/* Ok YALNIZ dokunulabilir satırda (iOS): bilgi satırında ok, olmayan bir sayfa vaat ediyordu. */}
        {!!onPress && <ChevronRight size={ICON.sm} color={theme.onSurfaceMuted} />}
      </View>
    </Touchable>
  );
}

// ── Seçim satırı (altta segment seçici) ──────────────────────────────────
/*
  2026-10-25 (koyu tema denetimi): Tema ve dil satırları "değer + ›" gösterip dokunuşta
  DÖNGÜYLE değişiyordu (Sistem → Aydınlık → Karanlık). Ok yeni bir ekran vaat eder ama
  açmıyordu; sıradakini görmek için de üç kez dokunmak gerekiyordu. HIG: az sayıda,
  birbirini dışlayan seçenek → satırın İÇİNDE segment seçici, hepsi aynı anda görünür.
*/
export interface ChoiceRowProps<K extends string> {
  icon: React.ReactNode;
  bg: string;
  label: string;
  options: { key: K; label: string }[];
  value: K;
  onChange: (k: K) => void;
  theme: AppTheme;
  isDark: boolean;
}

export function ChoiceRow<K extends string>({ icon, bg, label, options, value, onChange, theme, isDark }: ChoiceRowProps<K>) {
  return (
    <View style={styles.choiceRow}>
      <View style={styles.rowLeft}>
        <IconChip bg={bg} theme={theme}>{icon}</IconChip>
        <Text style={[styles.label, { color: theme.onSurface }]}>{label}</Text>
      </View>
      <SegmentedControl options={options} value={value} onChange={onChange} theme={theme} isDark={isDark} accessibilityLabel={label} />
    </View>
  );
}

// ── Geçiş satırı (sağda Switch) ──────────────────────────────────────────
export interface ToggleRowProps {
  icon: React.ReactNode;
  bg: string;
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  theme: AppTheme;
  isDark: boolean;
  /** Önkoşulu yokken: anahtar kilitlenir ve soluklaşır (bkz. ToggleRow notu). */
  disabled?: boolean;
}

/**
 * `disabled`: anahtarın ÖNKOŞULU yokken.
 *
 * ── NEDEN GEREKTİ ────────────────────────────────────────────────────────────
 * Bildirim izni reddedilmişken sabah/akşam/haftalık özet anahtarları hâlâ açılıp
 * kapanıyordu. Kullanıcı anahtarı açıyor, yeşile dönüyor, hiçbir bildirim gelmiyordu —
 * arayüz tutamayacağı bir söz veriyordu. Devre dışı bir anahtar hem sözü geri alır hem
 * de nedenini (alt satırda) söyleyebilir.
 */
export function ToggleRow({ icon, bg, title, subtitle, value, onValueChange, theme, isDark, disabled }: ToggleRowProps) {
  return (
    <View style={[styles.toggleRow, disabled && { opacity: 0.45 }]}>
      <IconChip bg={bg} theme={theme}>{icon}</IconChip>
      <View style={styles.rowText}>
        <Text style={[styles.label, { color: theme.onSurface }]}>{title}</Text>
        {!!subtitle && <Text style={[styles.sub, { color: theme.onSurfaceMuted }]}>{subtitle}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        accessibilityRole="switch"
        accessibilityState={{ checked: value, disabled: !!disabled }}
        /*
          Her platform KENDİ anahtarını çizer. iOS: tam renkli iz + beyaz topuz (UISwitch).
          Eskiden iki platformda da Material'in "yarım alfa iz + renkli topuz" deseni
          vardı — iOS'ta yabancı duruyordu ve devre dışı + açık anahtar (opacity 0.45
          ile) ne açık ne kapalı okunuyordu. Android'de Material 3 kalıyor.
        */
        trackColor={{ false: theme.surfaceContainerHighest, true: Platform.OS === 'ios' ? theme.primary : theme.primary + '80' }}
        thumbColor={Platform.OS === 'ios' ? undefined : value ? theme.primary : isDark ? theme.onSurfaceMuted : '#FFFFFF'}
        ios_backgroundColor={theme.surfaceContainerHighest}
      />
    </View>
  );
}

// ── Ortalanmış eylem satırı (Çıkış / Hesabı sil) ───────────────────────────
/**
 * iOS Ayarlar'daki "Çıkış Yap" / "Hesabı Sil" satırı: kendi küçük grubunda, ortalanmış
 * metin, ikon çipi yok. Ayarlar sayfasının dibinde bu eylemler dört AYRI el yapımı kutu
 * stiliyle çiziliyordu (gri kutu, koyu gri büyük düğme, çıplak metin…) — sayfanın geri
 * kalanının gruplu kart diliyle tutarsız (2026-10-25, cihazda görüldü).
 * Ton anlam taşır: `destructive` = kalıcı (kırmızı); varsayılan = rutin (nötr).
 */
export interface SettingsActionRowProps {
  label: string;
  onPress: () => void;
  theme: AppTheme;
  destructive?: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
}

export function SettingsActionRow({ label, onPress, theme, destructive, disabled, accessibilityHint }: SettingsActionRowProps) {
  return (
    <Touchable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      activeOpacity={0.6}
      style={styles.actionRow}
    >
      <Text style={[styles.actionText, { color: destructive ? theme.error : theme.onSurface }]}>{label}</Text>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  actionRow: { minHeight: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: S.md },
  actionText: { fontSize: F.body, fontWeight: '600' },
  chip: {
    width: 36,
    height: 36,
    borderRadius: R.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: S.md,
    paddingVertical: S.md,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: S.smd, flex: 1, minWidth: 0 },
  rowText: { flex: 1, minWidth: 0 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: S.xs, marginLeft: S.sm },
  choiceRow: { paddingHorizontal: S.md, paddingVertical: S.md, gap: S.smd },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: S.md,
    paddingVertical: S.md,
    gap: S.smd,
  },
  // iOS Ayarlar satır etiketi: NORMAL ağırlık. 700 değil.
  label: { fontWeight: W.regular, fontSize: F.body, lineHeight: F.body * LH.tight },
  sub: { fontSize: F.caption, marginTop: S.xxs, lineHeight: F.caption * LH.normal },
  value: { fontSize: F.body, fontWeight: W.regular, maxWidth: 140 },
});
