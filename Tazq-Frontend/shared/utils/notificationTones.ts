import Constants from 'expo-constants';

/*
  TAZQ BİLDİRİM SESLERİ (2026-11-06). Dört ses, tek aile: hepsi odak çanının Mi-Si notalarından (assets/sounds/notify, app.json expo-notifications `sounds`).
  Yükselen iki nota hatırlatma, üç nota odak bitti, inen iki nota ödeme, tek hafif vuruş özet. Tür başına kanal: Android'de kullanıcı her birini ayrı kısabilir.

  SÜRÜM KAPISI: ses dosyaları yerel derlemeye girer; JS'ten varlıkları iki platformda ortak bir yolla okunamaz. Eski derlemede istenirse iOS ve Android günlüğe hata yazar
  ve Android kanalı varsayılan sese KİLİTLENİR (kanal sesi sonradan değişmez). Bu yüzden sesler yalnız app.json sürümü TONES_SINCE ve üstü olan derlemede kullanılır;
  altındaki derlemede sistem sesi ve varsayılan kanal sürer. Sesi değiştirirken kanal kimliğini de artır (sondaki -1).
*/
export const TONES_SINCE = '2.1.0';

export function tonesSupported(nativeVersion: string | null | undefined, since: string = TONES_SINCE): boolean {
  if (!nativeVersion) return false;
  const a = nativeVersion.split('.').map(Number);
  const b = since.split('.').map(Number);
  for (let i = 0; i < b.length; i++) {
    const d = (a[i] || 0) - b[i];
    if (d !== 0) return d > 0;
  }
  return true;
}

export const HAS_TONES = tonesSupported(Constants.nativeAppVersion);

const tone = (file: string, name: string) => ({
  file: HAS_TONES ? file : 'default',
  channel: HAS_TONES ? `tazq-${name}-1` : undefined,
});

export const TONE = {
  reminder: tone('tazq_hatirlatma.wav', 'hatirlatma'),
  focus: tone('tazq_odak.wav', 'odak'),
  payment: tone('tazq_odeme.wav', 'odeme'),
  summary: tone('tazq_ozet.wav', 'ozet'),
} as const;

export const CHANNEL_NAMES = {
  tr: { reminder: 'Hatırlatmalar', focus: 'Odak', payment: 'Ödemeler', summary: 'Özetler' },
  en: { reminder: 'Reminders', focus: 'Focus', payment: 'Payments', summary: 'Summaries' },
};

export function toneOfCategory(category: string) {
  if (category.startsWith('payment')) return TONE.payment;
  if (category === 'task-reminder' || category === 'habit-reminder') return TONE.reminder;
  return TONE.summary;
}
