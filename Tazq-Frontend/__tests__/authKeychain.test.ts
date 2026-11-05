import fs from 'fs';
import path from 'path';

/*
  OTURUM ANAHTARI (2026-11-05, kullanıcı: "dev sürümde sürekli logout"). Sunucu iptal edilmiş anahtarı hırsızlık sayıp tüm oturumları kapatır;
  bu yüzden telefondaki anahtarlık hiçbir koşulda bayat kalmamalı.
*/
const mockStore = new Map<string, string>();
const mockDelays: number[] = [];
jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK: 0,
  setItemAsync: async (k: string, v: string) => { await new Promise(r => setTimeout(r, mockDelays.shift() ?? 0)); mockStore.set(k, v); },
  deleteItemAsync: async (k: string) => { mockStore.delete(k); },
  getItemAsync: async (k: string) => mockStore.get(k) ?? null,
}));

import { jwtAgeMinutes, writeSecure } from '../features/user/store/useAuthStore';

const values = () => [...mockStore.values()];

describe('anahtarlık', () => {
  beforeEach(() => { mockStore.clear(); mockDelays.length = 0; });

  it('sonraki yazım öncekinin üstüne binmez: yavaş eski yazım yeniyi ezemez', async () => {
    mockDelays.push(30, 30); // ilk (eski) yazım yavaş
    const a = writeSecure({ token: 'eski-j', refreshToken: 'eski-r' });
    const b = writeSecure({ token: 'yeni-j', refreshToken: 'yeni-r' });
    await Promise.all([a, b]);
    expect(values().sort()).toEqual(['yeni-j', 'yeni-r']);
  });

  it('çıkışta anahtarlar silinir, ölü anahtar kalmaz', async () => {
    await writeSecure({ token: 'j', refreshToken: 'r' });
    await writeSecure({});
    expect(values()).toEqual([]);
  });

  it('oturum açıkken boş değer anahtarı silmez: kilitli telefonda okunamayan anahtar yok sayılmaz', async () => {
    await writeSecure({ token: 'j', refreshToken: 'r' });
    await writeSecure({ keepMissing: true });
    expect(values().sort()).toEqual(['j', 'r']);
    const src = fs.readFileSync(path.join(__dirname, '..', 'features/user/store/useAuthStore.ts'), 'utf8');
    expect(src).toContain('keepMissing: !!parsed?.state?.isLoggedIn');
  });

  it('bir yazım hata verse de sıra kilitlenmez', async () => {
    const spy = jest.spyOn(require('expo-secure-store'), 'setItemAsync').mockRejectedValueOnce(new Error('kilitli'));
    await expect(writeSecure({ token: 'a', refreshToken: 'b' })).rejects.toThrow('kilitli');
    spy.mockRestore();
    await writeSecure({ token: 'c', refreshToken: 'd' });
    expect(values().sort()).toEqual(['c', 'd']);
  });
});

describe('tanı kaydı', () => {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  it('JWT yaşını okur, anahtarı yazmaz', () => {
    const iat = Math.round(Date.now() / 1000) - 15 * 60;
    expect(jwtAgeMinutes(`x.${b64({ iat })}.y`)).toBe('15');
    expect(jwtAgeMinutes(null)).toBe('none');
    expect(jwtAgeMinutes('bozuk.$$.y')).toBe('unreadable');
  });
  it('çıkış kaydı anahtarın kendisini içermez', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'features/user/store/useAuthStore.ts'), 'utf8');
    const line = src.split('\n').find(l => l.includes('Forced logout:'))!;
    const rest = src.slice(src.indexOf(line)).split('\n').slice(0, 3).join(' ');
    expect(rest).not.toMatch(/\$\{get\(\)\.(?:token|refreshToken)\}/);
  });
});
