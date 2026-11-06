import React from 'react';
import fs from 'fs';
import path from 'path';
import { render, act } from '@testing-library/react-native';
import { appDayKey, isBeforeRollover, logicalNow } from '@/shared/utils/appDay';
import { fmtDateKey } from '@/features/habits/store/useHabitStore';
import { studyToday } from '@/features/studyplan/sync';
import { RolloverCaption } from '@/features/dashboard/components/RolloverCaption';
import { Colors } from '@/shared/constants/Colors';

const eski = (d: Date) => {
  const a = new Date(d);
  a.setHours(a.getHours() - 3);
  return `${a.getFullYear()}-${String(a.getMonth() + 1).padStart(2, '0')}-${String(a.getDate()).padStart(2, '0')}`;
};

describe('ürünün günü', () => {
  it('günün her saatinde eski kuralla birebir aynı: kayıtlı veriler kaymaz', () => {
    for (const start of [new Date(2026, 10, 7), new Date(2026, 0, 1), new Date(2026, 2, 1), new Date(2026, 2, 29), new Date(2026, 9, 25)]) {
      for (let m = 0; m < 24 * 60; m += 13) {
        const d = new Date(start.getTime() + m * 60000);
        expect(appDayKey(d)).toBe(eski(d));
        expect(fmtDateKey(d)).toBe(eski(d));
        expect(studyToday(d)).toBe(eski(d));
      }
    }
  });

  it('01:30 hâlâ dün, 03:00 yeni gün', () => {
    expect(appDayKey(new Date(2026, 10, 7, 1, 30))).toBe('2026-11-06');
    expect(appDayKey(new Date(2026, 10, 7, 2, 59))).toBe('2026-11-06');
    expect(appDayKey(new Date(2026, 10, 7, 3, 0))).toBe('2026-11-07');
    expect(isBeforeRollover(new Date(2026, 10, 7, 2, 59))).toBe(true);
    expect(isBeforeRollover(new Date(2026, 10, 7, 3, 0))).toBe(false);
  });

  it('verilen tarihi değiştirmez', () => {
    const d = new Date(2026, 10, 7, 1);
    logicalNow(d);
    expect(d.getHours()).toBe(1);
  });

  it('kural başka yerde elle yazılmaz', () => {
    const root = path.join(__dirname, '..');
    const found: string[] = [];
    const walk = (dir: string) => {
      for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, f.name);
        if (f.isDirectory()) walk(p);
        else if (/\.tsx?$/.test(f.name) && /getHours\(\) - 3\b/.test(fs.readFileSync(p, 'utf8'))) found.push(f.name);
      }
    };
    ['app', 'features', 'shared'].forEach((d) => walk(path.join(root, d)));
    expect(found).toEqual([]);
  });
});

describe('gece notu', () => {
  const at = (h: number) => new Date(2026, 10, 7, h, 30); // 7 Kasım Cumartesi
  const ui = (now: Date, language: 'tr' | 'en' = 'tr') => render(<RolloverCaption now={now} language={language} theme={Colors.dark} />);

  it('yalnız gece yarısı ile 03:00 arasında, hangi günde olduğunu söyler', () => {
    expect(ui(at(1)).getByText('Hâlâ Cuma · yeni gün 03:00’te')).toBeTruthy();
    expect(ui(at(1), 'en').getByText('Still Friday · new day at 03:00')).toBeTruthy();
    expect(ui(at(3)).toJSON()).toBeNull();
    expect(ui(at(14)).toJSON()).toBeNull();
    act(() => {});
  });
});
