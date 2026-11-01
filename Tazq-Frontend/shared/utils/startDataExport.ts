import { CustomAlert as Alert } from '@/shared/components/CustomAlert';
import { haptic } from '@/shared/utils/haptics';

/**
 * VERİ YEDEĞİ AKIŞI — biçim sorusu → dışa aktarma → paylaşım sayfası.
 *
 * İki kapısı var: Ayarlar → "Verilerimi indir" ve cihazda kalan veri notundaki "Yedek al".
 * Not eskiden Ayarlar'ın en üstünü açıp kullanıcıyı satırı kendisi bulmaya bırakıyordu
 * (cihazda görüldü, 2026-10-31); artık yedeği bulunduğu yerde başlatır. Akış tek yerde:
 * iki kapı aynı biçim seçimini ve aynı hata metnini gösterir (metinler i18n → exportFormat).
 *
 * `dataExport` tembel yükleniyor (Ayarlar'daki eski satır içi kodla aynı): dosya sistemi ve
 * paylaşım modülleri yalnız kullanıcı gerçekten yedek isteyince yüklensin.
 */
export interface ExportFormatCopy {
  title: string;
  body: string;
  md: string;
  json: string;
  cancel: string;
  failTitle: string;
  failNoSharing: string;
  failGeneric: string;
}

export function startDataExport(opts: { copy: ExportFormatCopy; onBusy?: (busy: boolean) => void }): void {
  const { copy, onBusy } = opts;
  const run = async (format: 'md' | 'json') => {
    onBusy?.(true);
    try {
      const { exportUserData } = require('@/shared/utils/dataExport');
      const res = await exportUserData(format);
      if (res.ok) {
        haptic.success();
      } else {
        haptic.error();
        Alert.alert(copy.failTitle, res.reason === 'no-sharing' ? copy.failNoSharing : copy.failGeneric);
      }
    } finally {
      onBusy?.(false);
    }
  };
  Alert.alert(copy.title, copy.body, [
    { text: copy.md, onPress: () => run('md') },
    { text: copy.json, onPress: () => run('json') },
    { text: copy.cancel, style: 'cancel' },
  ]);
}
