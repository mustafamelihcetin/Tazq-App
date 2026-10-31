import fs from 'fs';
import path from 'path';

const read = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

/**
 * ANA SAYFA — impeccable denetimi (2026-10-31), 14/20.
 *
 * En ağır bulgu: ana ekleme eylemi (şimşek FAB) ekran okuyucuya HİÇ görünmüyordu —
 * yalnız PanResponder dinleyen bir View'du; rolü, adı, etkinleştirme yolu yoktu.
 */
describe('MagneticFAB — ekran okuyucu', () => {
  const SRC = read('shared/components/MagneticFAB.tsx');

  it('düğme olarak adlandırılıyor ve çift dokunuşla çalışıyor', () => {
    expect(SRC).toContain('accessibilityLabel: string;');
    expect(SRC).toContain('accessibilityRole="button"');
    expect(SRC).toContain("accessibilityActions={[{ name: 'activate' }]}");
    expect(SRC).toMatch(/actionName === 'activate'\) onPress\(\)/);
  });

  it('iki kullanım yeri de ad veriyor', () => {
    expect(read('app/index.tsx')).toContain('accessibilityLabel={t.quickAdd.title}');
    expect(read('app/tasks.tsx')).toContain('accessibilityLabel={t.addTask}');
  });
});

describe('Ana sayfa — dokunma alanı ve punto', () => {
  const SRC = read('app/index.tsx');
  const block = (from: string, to: string) => SRC.slice(SRC.indexOf(from), SRC.indexOf(to, SRC.indexOf(from)));

  it('gecikmiş satırı 44 pt ve okunur puntoda (eskiden ~14 pt yükseklik, 11 pt yazı)', () => {
    const b = block("params: { filter: 'overdue' }", '</Touchable>');
    // Dokunma alanı hitSlop ile (touchSlop → 44 pt'ye tamamlar): satır kartlar arasındaki yerinden kaymaz.
    expect(b).toContain('hitSlop={touchSlop(');
    expect(b).not.toContain('minHeight: MIN_TOUCH');
    expect(b).toContain('fontSize: F.footnote');
  });

  it('"daha fazla" ve "tamamlananlar" açıcıları 44 pt', () => {
    expect(block('setShowAllIncomplete(!showAllIncomplete)', '</Touchable>')).toContain('minHeight: MIN_TOUCH');
    expect(block('setShowCompletedSection(!showCompletedSection)', '</Touchable>')).toContain('minHeight: MIN_TOUCH');
  });

  it('"Daha Fazla Göster (3 adet)" yerine "3 görev daha"', () => {
    expect(SRC).not.toContain('adet)');
    expect(SRC).toContain('görev daha');
  });

  it('tamamlananlar başlığında ham rgba zemin yok', () => {
    expect(block('setShowCompletedSection(!showCompletedSection)', '</Touchable>')).not.toContain('rgba(');
  });

  it('karşılama kartı ikonları AppIcon deseninde (elle 38 pt kutu yok)', () => {
    expect(SRC).toContain('<AppIcon Icon={row.Icon}');
    expect(SRC).not.toMatch(/width: 38, height: 38/);
  });

  it('halka paneli kararlı props alıyor — React.memo her render\'da boşa düşmüyor', () => {
    // Satır içi nesne/öğe/fonksiyon her render'da YENİ referanstı: modal açmak, liste
    // genişletmek gibi ilgisiz state'ler Skia halkalarını yeniden çizdiriyordu.
    for (const p of ['detail={todayDetail}', 'metrics={todayMetrics}', 'topSlot={todayTopSlot}', 'footer={todayFooter}', 'onAdd={openQuickAdd}']) {
      expect(SRC).toContain(p);
    }
    expect(SRC).toContain('const myDayTasks = React.useMemo(');
    expect(SRC).toContain('const myDayHabits = React.useMemo(');
  });

  it('alışkanlık sırası saat dilimiyle yenileniyor (memo saate bağlı)', () => {
    // orderForNow şu anki dilimi okuyor; memo saate bağlanmasa sabah sırası akşama kadar kalırdı.
    expect(SRC).toMatch(/\[demoGate, habits, language, theme, habitTodayKey, isDark, getHabitStreak, currentHour\]\);/);
  });

  it('momentum geçmişi İÇERİKLE sabitleniyor (depo okuyan fonksiyon girdilere bağlanmıyor)', () => {
    // getLastNDays depoyu doğrudan okuyor: memo'yu girdilere bağlamak bayat veri riskiydi.
    expect(SRC).toContain('const last8Days = React.useMemo(() => last8Raw, [last8Key])');
  });

  it('eski modallardan kalan ölü stiller temizlendi', () => {
    for (const k of ['insightCard', 'statBento', 'quickDraftTitle', 'cockpitActions', 'sheetHandle']) {
      expect(SRC).not.toContain(`${k}:`);
    }
  });
});
