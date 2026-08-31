import React, { useState } from 'react';
import { View, Text, Modal, TextInput, Keyboard, StyleSheet, ActivityIndicator } from 'react-native';
import { MotiView } from 'moti';
import { Trash2, AlertCircle } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { S, R, F, B, ICON } from '@/shared/constants/tokens';
import type { AppTheme } from '@/shared/constants/Colors';
import { AuthService } from '@/shared/services/api';
import { isNetworkError, httpStatusOf, httpDataOf } from '@/shared/utils/errors';
import { swallow } from '@/shared/utils/swallow';
import { haptic } from '@/shared/utils/haptics';
import { useLanguageStore } from '@/shared/store/useLanguageStore';

/**
 * HESAP SİLME — geri alınamaz tek işlem, kendi bileşeninde.
 *
 * NEDEN AYRI DOSYA: akış settings.tsx'in içinde dağınıktı (durum yukarıda, onay kelimesi
 * ortada, modal en altta) ve AYNI akışın ölü bir kopyası profile.tsx'te duruyordu.
 * İki kopya birbirinden habersiz ayrışmıştı; hangisinin canlı olduğu okurken belli
 * olmuyordu. Yıkıcı bir işlemin tek bir adresi olmalı.
 *
 * ── SÖZLEŞME: ÇIKIŞ, ANCAK SUNUCU ONAYLARSA ───────────────────────────────────
 * ÖLÇÜLEN SORUN: `AuthService.deleteAccount` hatayı yutuyordu, çağıran ikinci kez
 * yutuyordu ve ardından KOŞULSUZ `logout()` çalışıyordu. Çevrimdışı bir kullanıcı
 * "SİL" yazıp onaylıyor, login ekranında buluyor kendini ve hesabının silindiğine
 * inanıyordu — hesap sunucuda duruyordu. Silinmediğini ancak tekrar giriş denerse
 * anlardı. Geri alınamaz bir işlemin sonucu, onu yapan kişiden saklanamaz.
 *
 * Silme kuyruğa da ALINMAZ: "bağlantı gelince hallederiz" denecek bir işlem değil,
 * kullanıcı sonucu ANINDA bilmeli.
 */

const UPPER_LOCALE = { tr: 'tr-TR', en: 'en-US' };

export type DeleteAccountModalProps = {
  visible: boolean;
  onClose: () => void;
  /** Yalnızca sunucu silmeyi onayladığında çağrılır. */
  onDeleted: () => void;
  theme: AppTheme;
  isDark: boolean;
  language: string;
  /** Klavye yüksekliği — açıkken açıklama listesi gizlenir, modal kompakt kalır. */
  kbHeight: number;
  insetTop: number;
  insetBottom: number;
};

export function DeleteAccountModal({
  visible, onClose, onDeleted, theme, isDark, language, kbHeight, insetTop, insetBottom,
}: DeleteAccountModalProps) {
  // Metinler i18n sözlüğünden — bu ekranda satır içi iki dilli dallanma YOK.
  // Bkz. __tests__/i18nRatchet.test.ts (yeni kod sözlüğü kullanmak zorunda).
  const t = useLanguageStore(s2 => s2.t).deleteAccountModal;
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Onay kelimesi — parolasız (Google/Apple) kullanıcılar dahil herkes için çalışır.
  const DELETE_WORD = t.confirmWord;
  // Büyük harfe çevirme LOCALE'e duyarlı olmak zorunda: Türkçede 'i' → 'İ'dir, JS'in
  // varsayılanı ise 'I' verir. "sil" yazan kullanıcı aksi hâlde onaylayamazdı.
  const upperLocale = UPPER_LOCALE[language === 'tr' ? 'tr' : 'en'];
  const canConfirm = confirmText.trim().toLocaleUpperCase(upperLocale) === DELETE_WORD;

  const dismiss = () => {
    if (deleting) return;
    Keyboard.dismiss();
    setConfirmText('');
    setError(null);
    onClose();
  };

  /**
   * Başarısızlığın SEBEBİNİ söyler — "bir hata oluştu" demez.
   *
   * Üç durum kullanıcı için üç ayrı eylem demek: ağ yoksa bağlantısını kontrol eder,
   * oturum düştüyse tekrar girer, sunucu hatasında sonra dener. Hepsine aynı cümleyi
   * yazmak kullanıcıyı ne yapacağını bilmeden bırakır. Üçü de hesabın SİLİNMEDİĞİNİ
   * açıkça söyler — belirsizlik bırakmak, sessiz başarısızlığın yumuşak hâlidir.
   */
  const errorTextFor = (e: unknown): string => {
    if (isNetworkError(e)) {
      return t.errNetwork;
    }
    const status = httpStatusOf(e);
    if (status === 401 || status === 403) {
      return t.errSession;
    }
    const body = httpDataOf<{ traceId?: string; TraceId?: string }>(e);
    const code = body.traceId || body.TraceId;
    const base = t.errServer;
    return code ? `${base} (${code})` : base;
  };

  const performDelete = async () => {
    if (!canConfirm || deleting) return;
    setDeleting(true);
    setError(null);
    haptic.destructive();
    try {
      await AuthService.deleteAccount();
    } catch (e: unknown) {
      // 404 = sunucuda zaten silinmiş (ör. ilk istek gitti, yanıtı kayboldu).
      // Kullanıcının niyeti gerçekleşmiş → başarı say, tekrar denetme.
      if (httpStatusOf(e) !== 404) {
        swallow('DeleteAccountModal.performDelete', e, { capture: true });
        haptic.error();
        setDeleting(false);
        setError(errorTextFor(e));
        return; // MODAL AÇIK KALIR — çıkış YOK
      }
    }
    setDeleting(false);
    setConfirmText('');
    onDeleted();
  };

  const bullets = [t.lossProfile, t.lossTasks, t.lossFocus, t.lossModes];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: S.lg, paddingTop: insetTop + S.lg, paddingBottom: (kbHeight > 0 ? kbHeight : insetBottom) + S.lg }}>
        <Touchable style={StyleSheet.absoluteFill} activeOpacity={1} onPress={dismiss} accessibilityRole="button" accessibilityLabel={t.close} />
        <MotiView
          from={{ opacity: 0, scale: 0.96, translateY: 16 }}
          animate={{ opacity: 1, scale: 1, translateY: 0 }}
          transition={{ type: 'spring', damping: 18 }}
          style={{ width: '100%', maxWidth: 420, backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLowest, borderRadius: R.lg, padding: S.lg, gap: S.md }}
        >
          <View style={{ width: 52, height: 52, borderRadius: R.full, backgroundColor: theme.error + '18', alignItems: 'center', justifyContent: 'center', alignSelf: 'center' }}>
            <Trash2 size={ICON.lg} color={theme.error} strokeWidth={2.2} />
          </View>

          <Text style={{ fontSize: F.subhead, fontWeight: '700', color: theme.onSurface, textAlign: 'center', letterSpacing: -0.3 }}>
            {t.title}
          </Text>

          {/* Açıklama + kayıp listesi yalnızca klavye kapalıyken (yazarken kompakt kalır). */}
          {kbHeight === 0 && (
            <>
              <Text style={{ fontSize: F.body, color: theme.onSurfaceVariant, textAlign: 'center', lineHeight: 20 }}>
                {t.body}
              </Text>
              <View style={{ gap: S.sm, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', borderRadius: R.md, paddingVertical: S.md, paddingHorizontal: S.md }}>
                {bullets.map((li, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
                    <View style={{ width: 5, height: 5, borderRadius: R.full, backgroundColor: theme.error, opacity: 0.7 }} />
                    <Text style={{ flex: 1, fontSize: F.caption + 1, color: theme.onSurfaceVariant, fontWeight: '500' }}>{li}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          <Text style={{ fontSize: F.caption, color: theme.onSurfaceVariant, textAlign: 'center', marginTop: S.xxs }}>
            {t.confirmPre}
            <Text style={{ fontWeight: '700', color: theme.error, letterSpacing: 1 }}>{DELETE_WORD}</Text>
            {t.confirmPost}
          </Text>
          <TextInput
            value={confirmText}
            onChangeText={setConfirmText}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder={DELETE_WORD}
            placeholderTextColor={theme.onSurfaceVariant + '66'}
            editable={!deleting}
            accessibilityLabel={t.confirmA11y}
            style={{ borderWidth: B.medium, borderColor: canConfirm ? theme.error : theme.outline, borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.sm, color: theme.onSurface, fontSize: F.subhead, fontWeight: '700', letterSpacing: 2, textAlign: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}
          />

          {/* Silme başarısızsa SEBEBİ burada durur ve modal kapanmaz — kullanıcı
              hesabının hâlâ yerinde olduğunu buradan öğrenir. */}
          {error && (
            <View
              accessibilityRole="alert"
              style={{ flexDirection: 'row', alignItems: 'flex-start', gap: S.sm, backgroundColor: theme.error + '15', borderRadius: R.md, padding: S.md }}
            >
              <AlertCircle size={ICON.sm} color={theme.error} />
              <Text style={{ flex: 1, fontSize: F.caption + 1, fontWeight: '600', color: theme.error, lineHeight: 18 }}>{error}</Text>
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: S.sm, marginTop: S.xs }}>
            <Touchable onPress={dismiss} accessibilityRole="button" style={{ flex: 1, paddingVertical: S.md, borderRadius: R.md, backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)', alignItems: 'center' }}>
              <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.body }}>{t.cancel}</Text>
            </Touchable>
            <Touchable
              disabled={!canConfirm || deleting}
              onPress={performDelete}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canConfirm || deleting, busy: deleting }}
              style={{ flex: 1, paddingVertical: S.md, borderRadius: R.md, backgroundColor: theme.error, alignItems: 'center', justifyContent: 'center', opacity: (canConfirm && !deleting) ? 1 : 0.4 }}
            >
              {deleting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: F.body }}>{t.submit}</Text>}
            </Touchable>
          </View>
        </MotiView>
      </View>
    </Modal>
  );
}
