import React from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { Separator } from '@/shared/components/Separator';
import { S, R, F, B, W, ICON, LH } from '@/shared/constants/tokens';
import { CategoryColors, type AppTheme } from '@/shared/constants/Colors';

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
    notify: CategoryColors.orange,
    system: CategoryColors.indigo,  // görünüm & dil — serin, sistemsel
    health: CategoryColors.teal,    // uyku & sağlık — sakinlik/dinlenme
    core: theme.primary,            // çekirdek davranış — uygulamanın sesi
    streak: theme.streak,           // seri koruma — koruduğu kavramın rengi
    // yasal & gizlilik — nötr gri (onSurfaceMuted iki temada da #71717A, beyazla 4.83:1).
    // Renkli bir "özellik" değil; sessiz ama yine dolu kutu (Apple'ın gri kutuları gibi).
    legal: theme.onSurfaceMuted,
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
function IconChip({ bg, theme, children }: { bg?: string; theme: AppTheme; children: React.ReactNode }) {
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
  onPress?: () => void;
  theme: AppTheme;
  bg?: string;
}

export function SettingItem({ icon, label, sub, right, onPress, theme, bg }: SettingItemProps) {
  return (
    <Touchable style={styles.row} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <View style={styles.rowLeft}>
        <IconChip bg={bg} theme={theme}>{icon}</IconChip>
        <View style={styles.rowText}>
          <Text style={[styles.label, { color: theme.onSurface }]}>{label}</Text>
          {!!sub && <Text style={[styles.sub, { color: theme.onSurfaceMuted }]}>{sub}</Text>}
        </View>
      </View>
      <View style={styles.rowRight}>
        {right}
        {/* Chevron ÜÇÜNCÜL renkte, opacity YOK — eskiden onSurfaceVariant + opacity 0.3
            idi (ölçülü rengi kısmak). Affordans olarak muted seviyesi daha okunur. */}
        <ChevronRight size={ICON.sm} color={theme.onSurfaceMuted} />
      </View>
    </Touchable>
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
}

export function ToggleRow({ icon, bg, title, subtitle, value, onValueChange, theme, isDark }: ToggleRowProps) {
  return (
    <View style={styles.toggleRow}>
      <IconChip bg={bg} theme={theme}>{icon}</IconChip>
      <View style={styles.rowText}>
        <Text style={[styles.label, { color: theme.onSurface }]}>{title}</Text>
        {!!subtitle && <Text style={[styles.sub, { color: theme.onSurfaceMuted }]}>{subtitle}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        accessibilityRole="switch"
        accessibilityState={{ checked: value }}
        // Kapalı iz + kapatık düğme palet token'larından; açık iz marka mavisi (alfa hex).
        // #FFFFFF meşru (renkli düğme üzerindeki nötr), palet dışı değil.
        trackColor={{ false: theme.surfaceContainerHighest, true: theme.primary + '80' }}
        thumbColor={value ? theme.primary : isDark ? theme.onSurfaceMuted : '#FFFFFF'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
});
