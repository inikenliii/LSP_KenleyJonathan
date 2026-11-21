/**
 * @file Tes unit aturan perpanjangan sewa: tambahan hari, sisa biaya, dan
 * format waktu simpan dalam zona Asia/Jakarta.
 */
import { describe, expect, it } from 'vitest';
import {
  EXTENSION_TOO_FAR_MESSAGE,
  ExtensionTooFarError,
  MAX_EXTENSION_VALUE,
  calculateExtensionCost,
  countAdditionalDays,
  formatTanggalWaktu,
  parseIsoDate,
} from '@/domain';

const iso = (text: string) => parseIsoDate(text);

describe('countAdditionalDays', () => {
  it('menghitung hari kalender antara dua tanggal selesai', () => {
    expect(countAdditionalDays(iso('2026-11-24'), iso('2026-11-30'))).toBe(6);
    expect(countAdditionalDays(iso('2026-11-24'), iso('2026-12-24'))).toBe(30);
  });

  it('sadar Februari biasa dan kabisat', () => {
    expect(countAdditionalDays(iso('2027-02-28'), iso('2027-03-01'))).toBe(1);
    expect(countAdditionalDays(iso('2028-02-28'), iso('2028-03-01'))).toBe(2);
  });

  it('melewati pergantian tahun', () => {
    expect(countAdditionalDays(iso('2026-12-31'), iso('2027-01-01'))).toBe(1);
  });

  it('memberi 0 untuk tanggal sama dan angka negatif untuk tanggal lebih awal', () => {
    expect(countAdditionalDays(iso('2026-11-24'), iso('2026-11-24'))).toBe(0);
    expect(countAdditionalDays(iso('2026-11-30'), iso('2026-11-24'))).toBe(-6);
  });
});

describe('calculateExtensionCost', () => {
  it('sisa biaya = tambahan hari x harga harian', () => {
    expect(
      calculateExtensionCost({
        currentEndDate: iso('2026-11-24'),
        newEndDate: iso('2026-11-30'),
        dailyPrice: 10000,
      }),
    ).toEqual({ additionalDays: 6, amount: 60000 });
  });

  it('sewa bulanan memakai hari x harga harian, bukan 25 x harga harian', () => {
    expect(
      calculateExtensionCost({
        currentEndDate: iso('2026-12-21'),
        newEndDate: iso('2027-01-21'),
        dailyPrice: 80000,
      }),
    ).toEqual({ additionalDays: 31, amount: 2480000 });
  });

  it('boleh memperpanjang beberapa bulan tanpa batas maksimum', () => {
    expect(
      calculateExtensionCost({
        currentEndDate: iso('2026-11-24'),
        newEndDate: iso('2027-05-24'),
        dailyPrice: 50000,
      }),
    ).toEqual({ additionalDays: 181, amount: 9050000 });
  });

  it('harga harian 0 menghasilkan sisa biaya 0, tidak pernah negatif', () => {
    const hasil = calculateExtensionCost({
      currentEndDate: iso('2026-11-24'),
      newEndDate: iso('2026-11-27'),
      dailyPrice: 0,
    });
    expect(hasil).toEqual({ additionalDays: 3, amount: 0 });
    expect(hasil.amount).toBeGreaterThanOrEqual(0);
  });

  it('menolak tanggal baru yang sama atau lebih awal dari tanggal selesai saat ini', () => {
    expect(() =>
      calculateExtensionCost({
        currentEndDate: iso('2026-11-24'),
        newEndDate: iso('2026-11-24'),
        dailyPrice: 10000,
      }),
    ).toThrow(RangeError);
    expect(() =>
      calculateExtensionCost({
        currentEndDate: iso('2026-11-24'),
        newEndDate: iso('2026-11-20'),
        dailyPrice: 10000,
      }),
    ).toThrow(RangeError);
  });

  it('menolak harga harian negatif atau bukan bilangan bulat', () => {
    const dasar = { currentEndDate: iso('2026-11-24'), newEndDate: iso('2026-11-30') };
    expect(() => calculateExtensionCost({ ...dasar, dailyPrice: -1 })).toThrow(RangeError);
    expect(() => calculateExtensionCost({ ...dasar, dailyPrice: 1.5 })).toThrow(RangeError);
  });
});

describe('calculateExtensionCost, batas kolom INTEGER', () => {
  const dasar = { currentEndDate: iso('2026-11-24') };

  it('menolak sisa biaya di atas 2147483647 dengan RangeError berpesan Bahasa Indonesia', () => {
    const jalankan = () =>
      calculateExtensionCost({ ...dasar, newEndDate: iso('9999-12-31'), dailyPrice: 10000 });
    expect(jalankan).toThrow(RangeError);
    expect(jalankan).toThrow(ExtensionTooFarError);
    expect(jalankan).toThrow(EXTENSION_TOO_FAR_MESSAGE);
  });

  it('harga harian 0 pada tanggal terjauh tetap sah karena sisa biaya 0', () => {
    const hasil = calculateExtensionCost({ ...dasar, newEndDate: iso('9999-12-31'), dailyPrice: 0 });
    expect(hasil.amount).toBe(0);
    expect(hasil.additionalDays).toBeLessThanOrEqual(MAX_EXTENSION_VALUE);
  });

  it('menerima sisa biaya tepat 2147483647 dan menolak satu rupiah lebih', () => {
    const hasil = calculateExtensionCost({
      ...dasar,
      newEndDate: iso('2026-11-25'),
      dailyPrice: MAX_EXTENSION_VALUE,
    });
    expect(hasil).toEqual({ additionalDays: 1, amount: MAX_EXTENSION_VALUE });
    expect(() =>
      calculateExtensionCost({
        ...dasar,
        newEndDate: iso('2026-11-26'),
        dailyPrice: MAX_EXTENSION_VALUE,
      }),
    ).toThrow(ExtensionTooFarError);
  });
});

describe('formatTanggalWaktu', () => {
  it('memakai zona Asia/Jakarta (UTC+7)', () => {
    const pagi = formatTanggalWaktu(new Date('2026-11-21T07:30:00Z'));
    expect(pagi).toContain('21 November 2026');
    expect(pagi).toMatch(/14[.:]30/);
  });

  it('pindah ke hari berikutnya setelah pukul 17.00 UTC', () => {
    expect(formatTanggalWaktu(new Date('2026-11-21T17:30:00Z'))).toContain('22 November 2026');
  });
});
