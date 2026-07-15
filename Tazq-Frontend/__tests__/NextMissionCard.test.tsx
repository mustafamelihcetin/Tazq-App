import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { NextMissionCard } from '@/features/dashboard/components/NextMissionCard';
import { Colors } from '@/shared/constants/Colors';
import { MIN_TOUCH } from '@/shared/constants/tokens';

/**
 * "Sonraki görev" — dashboard'ın tek eylem çağrısı.
 *
 * index.tsx'ten çıkarılan dördüncü bölüm.
 */

const theme = Colors.light;
const priorityColor = (p: string) =>
  p === 'High' ? theme.priorityHigh : p === 'Medium' ? theme.priorityMedium : theme.priorityLow;

const setup = (over: Partial<React.ComponentProps<typeof NextMissionCard>> = {}) =>
  render(
    <NextMissionCard
      task={{ id: 1, priority: 'High' }}
      title="Sunumu bitir"
      subtitle="Yarına yetişmeli"
      badgeLabel="AKTİF GÖREV"
      showUrgent={false}
      urgentLabel="ACİL"
      primaryLabel="GÖREVE GİT"
      seeAllLabel="Tümü"
      onOpenTask={jest.fn()}
      onSeeAll={jest.fn()}
      priorityColor={priorityColor}
      isSmallScreen={false}
      isDark={false}
      theme={theme}
      padding={24}
      {...over}
    />,
  );

const styleOf = (node: any) =>
  Object.assign({}, ...[node.props.style].flat(Infinity).filter(Boolean));

describe('NextMissionCard', () => {
  it('görevi ve açıklamasını gösterir', () => {
    const { getByText } = setup();
    expect(getByText('Sunumu bitir')).toBeTruthy();
    expect(getByText('Yarına yetişmeli')).toBeTruthy();
  });

  it('görev varken birincil buton DOLU mavi — tek eylem çağrısı', () => {
    const { getByTestId } = setup();
    expect(styleOf(getByTestId('mission-primary')).backgroundColor).toBe(theme.primary);
  });

  it('görev yokken davete döner — sessiz zemin, çünkü ortada eylem yok', () => {
    // Renk = anlam: dolu mavi "şunu yap" der. Yapılacak bir şey yokken mavi kalsaydı
    // yalan söylerdi.
    const { getByTestId } = setup({ task: null, primaryLabel: 'GÖREV EKLE' });
    expect(styleOf(getByTestId('mission-primary')).backgroundColor).toBe(theme.surfaceContainerHigh);
  });

  it('buton yazısı KOYU temada beyaz kalmaz — eski tuzak', () => {
    // Stilde `color: 'white'` sabiti vardı. Kullanım yeri onu eziyordu, ama ezmeyen
    // biri koyu temada beyaz alırdı — oysa koyu temada onPrimary KOYU'dur (Colors.ts).
    // Sessiz bekleyen bir tuzaktı; artık renk her zaman kullanım yerinden geliyor.
    const { getByText } = setup({ theme: Colors.dark, isDark: true });
    expect(styleOf(getByText('GÖREVE GİT')).color).toBe(Colors.dark.onPrimary);
    expect(styleOf(getByText('GÖREVE GİT')).color).not.toBe('white');
  });

  it('görev yokken buton yazısı zemine göre ayarlanır', () => {
    const { getByText } = setup({ task: null, primaryLabel: 'GÖREV EKLE' });
    expect(styleOf(getByText('GÖREV EKLE')).color).toBe(theme.onSurface);
  });

  it('öncelik rengi TEK kaynaktan — rozet ve yazı aynı', () => {
    // Eskiden gradyan kendi if/else'iyle, rozet priorityColor() ile hesaplıyordu:
    // aynı eşleme iki yerde. Biri değişse kart kendi içinde çelişirdi.
    const { getByText } = setup({ task: { id: 1, priority: 'High' } });
    expect(styleOf(getByText('AKTİF GÖREV')).color).toBe(theme.priorityHigh);
  });

  it('öncelik değişince renk de değişir', () => {
    const low = setup({ task: { id: 1, priority: 'Low' } });
    expect(styleOf(low.getByText('AKTİF GÖREV')).color).toBe(theme.priorityLow);
  });

  it('görev yokken rozet nötr gri — öncelik yok çünkü görev yok', () => {
    const { getByText } = setup({ task: null });
    expect(styleOf(getByText('AKTİF GÖREV')).color).toBe(theme.onSurfaceVariant);
  });

  it('aciliyet rozetini yalnızca istendiğinde gösterir', () => {
    expect(setup({ showUrgent: false }).queryByText('ACİL')).toBeNull();
    expect(setup({ showUrgent: true }).getByText('ACİL')).toBeTruthy();
  });

  it('görev varsa göreve, yoksa listeye götürür', () => {
    const onOpenTask = jest.fn();
    const onSeeAll = jest.fn();

    fireEvent.press(setup({ onOpenTask, onSeeAll }).getByTestId('mission-primary'));
    expect(onOpenTask).toHaveBeenCalled();
    expect(onSeeAll).not.toHaveBeenCalled();

    const onSeeAll2 = jest.fn();
    fireEvent.press(setup({ task: null, onSeeAll: onSeeAll2 }).getByTestId('mission-primary'));
    expect(onSeeAll2).toHaveBeenCalled();
  });

  it('“tümü” bağlantısı listeye götürür', () => {
    const onSeeAll = jest.fn();
    fireEvent.press(setup({ onSeeAll }).getByText('Tümü'));
    expect(onSeeAll).toHaveBeenCalled();
  });

  it('butonlar Apple’ın dokunma sınırını geçer', () => {
    expect(styleOf(setup().getByTestId('mission-primary')).height).toBeGreaterThanOrEqual(MIN_TOUCH);
  });

  it('alt metni opacity ile değil seviyeyle soluklaştırır', () => {
    const s = styleOf(setup().getByText('Yarına yetişmeli'));
    expect(s.color).toBe(theme.onSurfaceMuted);
    expect(s.opacity).toBeUndefined();
  });
});
