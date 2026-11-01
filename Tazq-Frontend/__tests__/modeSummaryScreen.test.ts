import fs from 'fs';
import path from 'path';

/**
 * MODLARIN ÖZETİ.
 *
 * 2026-09-20: ham sistem renkleri, 4+N ayrı kenarlıklı kutu, elle çizilen çubuklar.
 * 2026-10-31: ekran durum kartını (aktif mod, en yakın hedef, bugünkü plan) ve yol
 * haritasını (kalan gün, bugün) tekrar ediyordu — "çirkin ve işe yaramaz, yol haritası
 * ile çakışmamalı". Rolü artık GERİYE BAKIŞ: son 4 hafta, aynı-gün kıyası, tek içgörü.
 */
const read = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
const SCREEN = read('app/mod-ozet.tsx');

describe('modların özeti — geriye bakış', () => {
  it('yol haritası ve durum kartıyla çakışmaz: kalan gün / bugünkü plan / en yakın hedef yok', () => {
    expect(SCREEN).not.toMatch(/daysLabel|todayTotal|todayDone|nearest|e\.days\b/);
  });

  it('veri ortak hook → modeHistory; ekran görev/alışkanlık okumaz', () => {
    expect(SCREEN).toContain('useActiveModeSummary');
    expect(SCREEN).toContain('e.history.weeks');
    expect(SCREEN).not.toMatch(/useTaskStore|useHabitStore|useActiveTasks/);
  });

  it('kıyas geçen haftanın AYNI GÜNÜNE kadar', () => {
    expect(SCREEN).toContain('lastWeekSameDay');
  });

  it('içgörü yalnız ölçülen farktan; tek modda ya da küçük farkta cümle yok', () => {
    const block = SCREEN.slice(SCREEN.indexOf('const insight'), SCREEN.indexOf('return (\n    <View style={{ flex: 1'));
    expect(block).toContain('entries.length < 2) return null');
    expect(block).toContain('low.d <= -2');
    expect(block).toContain('high.d >= 2');
  });

  it('animasyon oturumda bir kez ve "hareketi azalt"a uyar', () => {
    expect(SCREEN).toContain('const play = first && !reduce');
    expect(SCREEN).toContain('<TrendLine');
    const trend = read('features/modes/components/TrendLine.tsx');
    expect(trend).toContain('end={draw}');
    expect(trend).toContain('if (!play) return;');
  });

  it('ham sistem rengi yok — semantik tema token\'ları', () => {
    expect(SCREEN).not.toMatch(/#FF9500|#34C759|'#fff'/i);
    expect(SCREEN).toContain('theme.success');
    expect(SCREEN).toContain('theme.onPrimary');
  });

  it('mod satırları tek liste kabında, kendi kenarlıkları yok', () => {
    const rowFn = SCREEN.slice(SCREEN.indexOf('function ModeRow'), SCREEN.indexOf('export default function'));
    expect(rowFn).toContain('borderTopWidth: index === 0 ? 0 : HAIRLINE');
    expect(rowFn).not.toContain('borderColor: e.color');
  });

  it('her grafik ekran okuyucuya sayılarıyla okunur', () => {
    expect((SCREEN.match(/accessibilityLabel=\{c\.chartA11y|c\.chartA11y\(label, h\.weeks\)/g) || []).length).toBe(2);
  });
});
