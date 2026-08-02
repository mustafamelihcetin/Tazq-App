import fs from 'fs';
import path from 'path';

/**
 * PLAN KAPISI — "kullanıcı seçmeden plan başlamaz" kuralının bekçisi.
 *
 * ── HANGİ HATAYI ÖNLÜYOR ────────────────────────────────────────────────────────
 * Görev üretiminin koşulu birçok modda yalnız "mod açık + ad + tarih" idi. Kullanıcı
 * sınavı seçip tarihi girdiği ANDA — daha planı görmeden, günlük süresini seçmeden —
 * motor görev üretiyor ve `applyTasks` içinden `setPlanIds` yazıyordu. Yani plan,
 * kullanıcı adına kendiliğinden başlıyordu.
 *
 * Ekranda görünen sonucu şuydu:
 *   • `examApplied` true oluyor → kart "Kurulumu Tamamla" bölümünden "Aktif Hedeflerim"e
 *     taşınıyor. Bölüm değişince React kartı yeniden kuruyor ve açık kart kapanıyor;
 *     kullanıcı bunu "kart yukarı zıpladı / kayboldu" diye yaşıyor.
 *   • Üstteki özet geri sayımı göstermeye başlıyor ama kart hâlâ "Kurulumu tamamla"
 *     diyor — çünkü günlük süre gerçekten seçilmemiş. Ekran kendi kendisiyle çelişiyor.
 *
 * ── NEDEN KAYNAK TARAYAN BİR TEST ───────────────────────────────────────────────
 * `usePlanAdaptations` ağ, depolama ve altı store'a bağlı bir hook; davranışını uçtan uca
 * kurmak bu testin değerinden pahalı. Korunması gereken şey ise tek bir değişmez:
 * ÜRETİM KOŞULU PLAN ŞARTI İÇERİR. Kaynağı taramak o değişmezi ucuza ve doğrudan kilitler.
 */

const SRC = path.resolve(__dirname, '../features/modes/hooks/usePlanAdaptations.ts');
const src = fs.readFileSync(SRC, 'utf8');

describe('plan kapısı — uygulanmamış plan beslenmez', () => {
  it('kapı yardımcısı tanımlı', () => {
    expect(src).toMatch(/const hasAppliedPlan = \(taskIds: number\[\], habitIds: string\[\]\) =>/);
    // Tanım "en az bir alışkanlık YA DA görev" olmalı: plan uygulandığında ikisinden
    // biri mutlaka dolar, ama hangisi olduğu moda göre değişir.
    expect(src).toMatch(/taskIds\.length > 0 \|\| habitIds\.length > 0/);
  });

  it('slot döngülerinde ad+tarih tek başına yeterli DEĞİL', () => {
    /*
      Kırılan tam olarak buydu: `if (slot.active && slot.name && slot.date) {`.
      Bu biçimin kaynakta hiç kalmaması gerekiyor — sınav ve mülakat slotlarının
      dördü de (adaptasyon + günlük üretim) kapıdan geçmeli.
    */
    const ungated = src.match(/if \(slot\.active && slot\.name && slot\.date\)/g) ?? [];
    expect(ungated).toEqual([]);
  });

  it('spor slotları da kapıdan geçiyor', () => {
    // Hedef + tarih, planın uygulandığı anlamına gelmez.
    const ungated = src.match(/if \(slot\.goal && slot\.date\)/g) ?? [];
    expect(ungated).toEqual([]);
  });

  it('her üretim noktası kapıya bağlı', () => {
    /*
      Dokuz nokta: adaptasyon tarafında spor/sınav/tez/mülakat, günlük üretim tarafında
      sınav/tez/mülakat/spor/ramazan. Sayı DÜŞERSE bir üretim noktası kapıdan kaçmış
      demektir; artması (yeni mod) sorun değil.
    */
    // Tanım satırı (`const hasAppliedPlan = (`) bu kalıba takılmaz; sayılan yalnız çağrılar.
    const uses = src.match(/hasAppliedPlan\(/g) ?? [];
    expect(uses.length).toBeGreaterThanOrEqual(9);
  });

  it('tek tek: her modun üretim koşulunda kapı var', () => {
    // Tasarruf ve Bırakma zaten kendi `*HasPlan` değişkenleriyle korunuyordu; sözleşmenin
    // kaynağı onlar. Aşağıdakiler ise o sözleşmeden sapmış olanlar.
    expect(src).toMatch(/tezMode && activeSeasonal\.tezName && activeSeasonal\.tezDate\s*\n\s*&& hasAppliedPlan\(tezPlanTaskIds, tezPlanHabitIds\)/);
    expect(src).toMatch(/activeSeasonal\.ramazan && hasAppliedPlan\(ramazanPlanTaskIds, ramazanPlanHabitIds\)/);
    expect(src).toMatch(/sporDeadlinePast\s*\n\s*&& hasAppliedPlan\(sporPlanTaskIds, sporPlanHabitIds\)/);
    expect(src).toMatch(/tasarrufMode && freshSeasonal\.tasarrufName && tasarrufHasPlan/);
    expect(src).toMatch(/birakmaMode && freshSeasonal\.birakmaName && birakmaHasPlan/);
  });
});

/**
 * TARTIM ZİNCİRİ — arşivlenmiş görev "açık" sayılmamalı.
 *
 * Haftalık tartım, kendi kendini zincirleyen tek plan görevi: her kayıttan sonra bir
 * sonrakini kuruyor. Zincir koparsa onarım bloğu devreye giriyor — ama "açık görev var mı"
 * sorusu arşivlenmişleri de sayarsa, arşivde duran TEK bir tartım görevi onarımı kalıcı
 * olarak susturur. Kullanıcı bir daha hiç tartım görevi almaz ve sebebini anlayamaz.
 */
describe('tartım zinciri — arşiv ölçütü tek', () => {
  it('onarım bloğu arşivlenmiş görevi açık saymıyor', () => {
    expect(src).toMatch(/!t\.isCompleted && !t\.isArchived && isWeightEntryTask\(t\)/);
  });

  it('weightCheckin ile aynı ölçüt', () => {
    const wc = fs.readFileSync(
      path.resolve(__dirname, '../features/modes/utils/weightCheckin.ts'),
      'utf8',
    );
    expect(wc).toMatch(/!x\.isCompleted && !x\.isArchived && isWeightEntryTask\(x\)/);
  });
});
