import { useSporStore } from '@/features/modes/store/useSporStore';
import { canLogWeight, daysUntilNextWeight, daysSinceLastWeight } from '@/features/modes/utils/weightCheckin';

/**
 * KİLO GEÇMİŞİ — "yeni tartıldım ama görev yine geldi" hatasının testi.
 *
 * ── HATA NEYDİ ──────────────────────────────────────────────────────────────────
 * `resetInputs` plan kaldırılırken kilo geçmişini de siliyordu. Geçmiş, uygulamadaki
 * TEK sağlık kaydı olmasının yanında haftalık tartım sayacının da kaynağı:
 * "7 gün doldu mu?" sorusu son kayda bakılarak yanıtlanıyor (canLogWeight).
 *
 * Geçmiş silinince sayaç sıfırlanıyor, "vakti geldi" sanılıyor ve "Güncel kilonu gir"
 * görevi kullanıcı daha üç gün önce tartılmışken yeniden kuruluyordu. Kullanıcı bunu
 * "görevi yaptım ama geri geldi" diye yaşıyor; sebebini görmesine imkân yok.
 *
 * ── SINIR ───────────────────────────────────────────────────────────────────────
 * Çıkış (clearAll) geçmişi silmeye DEVAM ediyor ve bu kasıtlı: aynı telefonu başkası
 * kullanabilir. Ayrım "plan kurulumu" ile "kullanıcı ölçümü" arasında.
 */

const dayKey = (offset: number) => {
  const d = new Date();
  d.setHours(d.getHours() - 3); // getLocalDateString ile aynı gece yarısı tamponu
  d.setDate(d.getDate() - offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const seed = (entries: { date: string; weight: number }[]) =>
  useSporStore.setState({
    weightLog: entries,
    currentWeight: '80',
    targetWeight: '72',
    heightCm: '180',
    ageYears: '30',
  });

describe('plan kaldırmak kilo geçmişini silmez', () => {
  it('resetInputs ölçümleri korur, form alanlarını temizler', () => {
    seed([{ date: dayKey(3), weight: 79.4 }]);

    useSporStore.getState().resetInputs();
    const s = useSporStore.getState();

    // Ölçüm kullanıcıya ait → durur.
    expect(s.weightLog).toEqual([{ date: dayKey(3), weight: 79.4 }]);
    // Form alanları plana ait → gider.
    expect(s.currentWeight).toBe('');
    expect(s.targetWeight).toBe('');
    expect(s.heightCm).toBe('');
  });

  it('KÖK HATA: üç gün önce tartılmışken tartım vakti gelmiş SAYILMAZ', () => {
    seed([{ date: dayKey(3), weight: 79.4 }]);
    useSporStore.getState().resetInputs();

    const log = useSporStore.getState().weightLog;
    expect(daysSinceLastWeight(log)).toBe(3);
    // Bu satır eskiden `true` idi (geçmiş silindiği için) → görev hemen geri geliyordu.
    expect(canLogWeight(log)).toBe(false);
    expect(daysUntilNextWeight(log)).toBe(4);
  });

  it('yedi gün dolduğunda tartım yine açılır — kadans durmuyor', () => {
    seed([{ date: dayKey(7), weight: 79.4 }]);
    useSporStore.getState().resetInputs();

    expect(canLogWeight(useSporStore.getState().weightLog)).toBe(true);
    expect(daysUntilNextWeight(useSporStore.getState().weightLog)).toBe(0);
  });
});

describe('çıkış sınırı korunuyor', () => {
  it('clearAll geçmişi DE siler — cihazda iz kalmaz', () => {
    seed([{ date: dayKey(1), weight: 79.4 }]);

    useSporStore.getState().clearAll();
    const s = useSporStore.getState();

    expect(s.weightLog).toEqual([]);
    expect(s.currentWeight).toBe('');
  });

  it('iki sıfırlama farklı işler — biri ötekinin yerine geçemez', () => {
    seed([{ date: dayKey(1), weight: 79.4 }]);
    useSporStore.getState().resetInputs();
    expect(useSporStore.getState().weightLog).toHaveLength(1);

    useSporStore.getState().clearAll();
    expect(useSporStore.getState().weightLog).toHaveLength(0);
  });
});

describe('başlangıç kilosu aynı günü kopyalamaz', () => {
  it('addWeightEntry aynı günde üzerine yazar', () => {
    // Plan kurulumu bugüne kayıt yoksa başlangıç kilosunu yazıyor. İkinci kurulum
    // (ya da aynı gün tekrar) kopya üretmemeli.
    useSporStore.setState({ weightLog: [] });
    useSporStore.getState().addWeightEntry(80);
    useSporStore.getState().addWeightEntry(79);

    const log = useSporStore.getState().weightLog;
    expect(log).toHaveLength(1);
    expect(log[0].weight).toBe(79);
  });

  it('geçmiş doluyken de bugünün ölçümü eklenebilir', () => {
    // Eski koşul "geçmiş tamamen boşsa" idi; geçmiş artık korunduğu için o koşul
    // ikinci planda hiç tutmaz ve yeni kilo grafiğe hiç girmezdi.
    useSporStore.setState({ weightLog: [{ date: dayKey(40), weight: 85 }] });
    useSporStore.getState().addWeightEntry(78);

    const log = useSporStore.getState().weightLog;
    expect(log).toHaveLength(2);
    expect(log[0].date).toBe(dayKey(0)); // en yeni başta
    expect(log[0].weight).toBe(78);
  });
});
