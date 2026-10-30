import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { JobHealthCard } from '@/features/admin/components/JobHealthCard';
import { AdminSystemService, type JobHealthEntry } from '@/shared/services/api';

/** Arka plan işleri kartı: "hepsi çalışıyor mu?" başlıkta, durum sözle de söylenir, hata satırı görünür. */

const job = (over: Partial<JobHealthEntry>): JobHealthEntry => ({
  key: 'account-purge', state: 'ok', intervalMinutes: 1440,
  lastRunAt: new Date(Date.now() - 5 * 60000).toISOString(), lastOkAt: null, lastErrorAt: null, lastError: null,
  runs: 1, failures: 0, pending: null, since: new Date().toISOString(), ...over,
});

describe('JobHealthCard', () => {
  afterEach(() => jest.restoreAllMocks());

  it('hepsi sağlıklıysa tek cümle: "3 iş · hepsi çalışıyor"', async () => {
    jest.spyOn(AdminSystemService, 'jobs').mockResolvedValue([
      job({}), job({ key: 'signup-digest', intervalMinutes: 20 }), job({ key: 'mail-queue', intervalMinutes: 0, pending: 2 }),
    ]);
    const r = render(<JobHealthCard lang="tr" />);
    await waitFor(() => r.getByText('3 iş · hepsi çalışıyor'));
    expect(r.getByText('Hesap temizleme')).toBeTruthy();
    expect(r.getByText(/son tur 5 dk önce · 24 saatte bir/)).toBeTruthy();
    expect(r.getByText(/iş geldikçe · 1 tur · 0 hata · 2 bekliyor/)).toBeTruthy();
  });

  it('hata ve gecikme başlığı değiştirir; son hata satırda görünür', async () => {
    jest.spyOn(AdminSystemService, 'jobs').mockResolvedValue([
      job({ key: 'signup-digest', state: 'failing', lastError: 'HttpRequestException: 503', failures: 2, runs: 4 }),
      job({ state: 'late', lastRunAt: null }),
    ]);
    const r = render(<JobHealthCard lang="tr" />);
    await waitFor(() => r.getByText('2 işte sorun var'));
    expect(r.getByText('Hata')).toBeTruthy();
    expect(r.getByText('Gecikiyor')).toBeTruthy();
    expect(r.getByText('HttpRequestException: 503')).toBeTruthy();
    expect(r.getByText(/henüz çalışmadı/)).toBeTruthy();
  });

  it('yüklenemezse sessiz kalmaz', async () => {
    jest.spyOn(AdminSystemService, 'jobs').mockRejectedValue(new Error('403'));
    const r = render(<JobHealthCard lang="tr" />);
    await waitFor(() => r.getByText('İş durumu alınamadı.'));
  });
});
