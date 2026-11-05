/**
 * Madde 4 — "Odaklan" yalnız zihinsel efor isteyen işte. "Su iç" için 25 dakikalık
 * zamanlayıcı önermek, düğmenin anlamını öldürür.
 */
import fs from 'fs';
import path from 'path';
import { canAttachFocus, isFocusWorthy, taskNature } from '@/features/focus/focusWorthy';
import { LIBRARY_BY_KIND } from '@/features/modes/data/planLibrary';
import { getAllDailyPlanPairs } from '@/features/modes/utils/dailyPlanEngine';
import { waterGoalOf } from '@/features/modes/utils/waterGoal';
import { getAllKnownModePairs } from '@/features/modes/utils/turkishModes';

const t = (title: string, tags: string[] = []) => ({ title, description: null, tags });

describe('isFocusWorthy', () => {
  it.each([
    'Su iç', 'Bugün 2+ litre su iç ve şekerli içecekten kaçın', 'Suyunu iç',
    'Tartıl', 'Sabah tartıl', 'Kilonu gir',
    'İlacını al', 'Vitamin al',
    'Faturayı öde', 'Zekat hesapla ve öde', 'Kirayı öde',
    'Annemi ara', 'Doktoru ara',
    'Drink water', 'Weigh in', 'Take your pills', 'Pay the rent', 'Call mom',
  ])('anlık eylem: %s → odak YOK', (title) => {
    expect(isFocusWorthy(t(title))).toBe(false);
  });

  it.each([
    'Literatür oku ve not al', '20 yeni kelime öğren ve örnek cümleyle kaydet',
    'Proje takip panosu kur', 'Paragraf denemesi çöz', 'Sunumu bitir',
    'Araştırma yap', 'Arayüz tasarımını gözden geçir', 'Ödev hazırla', 'Ödevi bitir',
    'Write the report', 'Study chapter 3', 'Research competitors',
  ])('zihinsel iş: %s → odak VAR', (title) => {
    expect(isFocusWorthy(t(title))).toBe(true);
  });

  it('hatırlatıcı / etkinlik / not / kilo girişi etiketleri odak dışı', () => {
    expect(isFocusWorthy(t('Toplantı', ['etkinlik']))).toBe(false);
    expect(isFocusWorthy(t('Ekmek', ['hatırlatıcı']))).toBe(false);
    expect(isFocusWorthy(t('Fikir', ['note']))).toBe(false);
    expect(isFocusWorthy(t('Haftalık tartı', ['weight_entry']))).toBe(false);
  });

  it('mod görevinde iki dilli yükten okunur', () => {
    const mode = { title: 'x', description: JSON.stringify({ tr: 'Su iç', en: 'Drink water' }), tags: [] };
    expect(isFocusWorthy(mode)).toBe(false);
  });

  it('görev yoksa odak serbest (boş seans)', () => {
    expect(isFocusWorthy(null)).toBe(true);
  });
});

describe('görevin doğası (kullanıcı: "her göreve tek tek mi bakacağız, kaliteli çözüm lazım")', () => {
  const n = (title: string, tags: string[] = []) => taskNature(t(title, tags));

  it.each([
    'Bugün 2+ litre su iç ve şekerli içecekten kaçın', 'Drink 2+ liters of water today, skip sugary drinks', 'Bu gece 7-8 saat uyumayı hedefle', 'Öğleden sonra kafeini bırak',
  ])('gün boyu iş: %s', (title) => { expect(n(title)).toBe('allDay'); });

  it.each([
    'DGS: zayıf konularından birini seç ve 25 soru çöz', 'Telefonsuz 50 dakikalık tek blok çalış', 'Bir bölümü baştan yaz', 'Koşulları oku ve özetle', 'Sunum hazırla', 'Git reposu kur',
    'Sözcükte ve Cümlede Anlam çalış · 35 dk', 'Veri Analizi: yazdığın bir bölümü bugün revize et', 'Reading passage çözümü', 'Hata Analizi', 'Solve 25 questions', 'Prepare your presentation',
  ])('yüklemi çalışma: %s', (title) => { expect(n(title)).toBe('deep'); });

  // Bu listedeki hiçbir görev özel olarak tanıtılmadı: kanıt olmadığı için düğme çıkmıyor.
  it.each([
    'Cambridge IELTS kitaplarından en az 2 tane temin et', 'Kaynak kitaplar ve soru bankaları temin et', 'UWorld veya Amboss aboneliği al', 'Sabah bloğu için alarm kur', 'Çalışma alanını düzenle', 'Kıyafet ve belgeleri hazırla',
    'Annemle kahve iç', 'Arabayı yıkat', 'Berbere git', 'Hediye al', 'Bir arkadaşınla yürüyüş planla', 'Get study books and question banks', 'Subscribe to UWorld', 'Buy a gift', 'Call the bank',
    'Araştırma sorunu tek cümleyle yaz', 'Bir eğer-ise cümlesi yaz: istek gelirse şunu yaparım',
  ])('kanıt yok, düğme yok: %s', (title) => { expect(n(title)).toBe('doing'); });

  it('hedefi bedenle ya da hayatla ilgiliyse başlıkta "oku, yaz" geçse de seans önerilmez', () => {
    expect(n('Etiket oku: bir ürünün şeker miktarına bak', ['spor', 'daily'])).toBe('doing');
    expect(n('Bugünkü harcamalarını yaz', ['tasarruf', 'daily'])).toBe('doing');
    expect(n('Bıraktığın için kazandığın bir şeyi yaz', ['birakma'])).toBe('doing');
    expect(n('Bugün bir sayfa mushaf oku', ['ramazan'])).toBe('doing');
    expect(n('Bugün teravih sonrası 30 dk verimli çalışma/okuma yap', ['ramazan'])).toBe('deep');
  });

  it('kısa uyku gün boyu sayılmaz', () => { expect(n('Öğle sonrası 20 dakika kısa uyku')).toBe('doing'); });
  it('çalışma takvimi bloğu her zaman çalışmadır', () => { expect(n('Kart', ['sb_x_t'])).toBe('deep'); });

  it('hayat hedeflerinin ürettiği hiçbir görevde odak yok', () => {
    const lifeKinds: Record<string, string> = { kilo: 'spor', maraton: 'spor', guc: 'spor', genel: 'spor', ramazan: 'ramazan', tasarruf: 'tasarruf', birakma: 'birakma' };
    const off = Object.entries(lifeKinds).flatMap(([kind, tag]) => (LIBRARY_BY_KIND[kind] ?? []).filter(p => n(p.tr, [tag]) === 'deep' || n(p.en, [tag]) === 'deep').map(p => p.tr));
    expect(off.filter(x => !/verimli/.test(x))).toEqual([]);
  });

  it('sınav, tez ve mülakatta gerçek çalışmanın büyük kısmı odağını korur', () => {
    const pool = [...(LIBRARY_BY_KIND.tez ?? []), ...(LIBRARY_BY_KIND.mulakat ?? []), ...getAllDailyPlanPairs().filter(p => p.tr.startsWith('{name}'))];
    // Görev iki dili birlikte taşır: kanıt bir başlıkta yeterlidir (gerçek akış).
    const both = pool.filter(p => taskNature({ title: p.tr, description: JSON.stringify({ tr: p.tr, en: p.en }), tags: [] }) === 'deep').length / pool.length;
    expect(both).toBeGreaterThan(0.8);
  });

  it('{name} ile başlayan sınav çalışması hiç düşmez', () => {
    const off = getAllDailyPlanPairs().filter(p => p.tr.startsWith('{name}') && !/kıyafet|format|cv ve linkedin|temin/iu.test(p.tr)).filter(p => n(p.tr) !== 'deep').map(p => p.tr);
    expect(off).toEqual([]);
  });

  it('edinme işi: tüm modlarda kitap ya da abonelik almak çalışma sayılmaz', () => {
    const errands = getAllKnownModePairs().filter(p => /temin et|aboneliği al|hesabı aç/iu.test(p.tr));
    expect(errands.length).toBeGreaterThan(10);
    expect(errands.filter(p => n(p.tr) === 'deep' || n(p.en) === 'deep').map(p => `${p.tr} / ${p.en}`)).toEqual([]);
  });

  it('kullanıcı Odak ekranında kendisi seçebilir, yalnız gün boyu iş ve hatırlatıcı seansa bağlanmaz', () => {
    expect(canAttachFocus(t('Berbere git'))).toBe(true);
    expect(canAttachFocus(t('Bugün 2+ litre su iç'))).toBe(false);
    expect(canAttachFocus(t('Toplantı', ['etkinlik']))).toBe(false);
  });

  it('görev başına odak açan her ekran kanıta bakar', () => {
    const read = (f: string) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    expect(read('features/modes/components/plan/PlanToday.tsx')).toMatch(/nature === 'deep' && \(/);
    expect(read('app/rota.tsx')).toMatch(/s\.nature === 'deep' && \(/);
    expect(read('features/dashboard/components/TodayDetail.tsx')).toContain('isFocusWorthy(t)');
    expect(read('app/gun.tsx')).toContain('isFocusWorthy(menuTask)');
    expect(read('features/dashboard/components/MyDayItem.tsx')).toContain('isFocusWorthy(');
  });
});

describe('su görevi', () => {
  it('litre bardağa çevrilir, başka istek varsa kendiliğinden işaretlenmez', () => {
    expect(waterGoalOf('Bugün 2+ litre su iç ve şekerli içecekten kaçın')).toEqual({ glasses: 8, pure: false });
    expect(waterGoalOf('Drink 2+ liters of water today, skip sugary drinks')).toEqual({ glasses: 8, pure: false });
    expect(waterGoalOf('İftar ile sahur arasında 2 litre su iç')).toEqual({ glasses: 8, pure: true });
    expect(waterGoalOf('Günde 2 litre suya yaklaş')).toEqual({ glasses: 8, pure: true });
    expect(waterGoalOf('Bugün 7-8 saat uyku ve 2L su hedefle')).toEqual({ glasses: 8, pure: false });
    expect(waterGoalOf('Bir bardak su iç, eline bir şey al')).toEqual({ glasses: 1, pure: false });
  });
  it('su geçse de içme görevi olmayanda bardak çıkmaz', () => {
    expect(waterGoalOf('Şekerli bir içeceği suyla değiştir')).toBeNull();
    expect(waterGoalOf('Uzun koşu için rota ve su planla')).toBeNull();
    expect(waterGoalOf('Koşu öncesi/sonrası esneme yap, hidrasyonuna dikkat et')).toBeNull();
    expect(waterGoalOf('Sulu boya için 2 litre kova al')).toBeNull();
  });
});
