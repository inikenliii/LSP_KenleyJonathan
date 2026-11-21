/**
 * @file Tes unit aturan perpanjangan sewa: tambahan hari, perpanjangan harian
 * dan bulanan beserta batasnya, sisa biaya, dan format waktu simpan dalam zona Asia/Jakarta.
 */
import { describe, expect, it } from 'vitest';
import {
  EXTENSION_TOO_FAR_MESSAGE,
  ExtensionQuantityError,
  ExtensionTooFarError,
  MAX_EXTENSION_MONTHS,
  MAX_EXTENSION_VALUE,
  calculateExtensionCost,
  countAdditionalDays,
  formatTanggalWaktu,
  maxExtensionDays,
  parseIsoDate,
  toIsoDate,
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

describe('calculateExtensionCost, perpanjangan harian', () => {
  const dasar = { extensionType: 'HARIAN' as const, dailyPrice: 10000 };

  it('sisa biaya = jumlah hari x harga harian: 10 hari x 10000 = 100000', () => {
    const hasil = calculateExtensionCost({
      ...dasar,
      quantity: 10,
      currentEndDate: iso('2026-11-21'),
    });
    expect(hasil.amount).toBe(100000);
    expect(hasil.additionalDays).toBe(10);
    expect(toIsoDate(hasil.newEndDate)).toBe('2026-12-01');
  });

  it('batas hari mengikuti bulan tanggal selesai saat ini: November 29, Februari 2027 27, Februari 2028 28', () => {
    expect(maxExtensionDays(iso('2026-11-21'))).toBe(29);
    expect(maxExtensionDays(iso('2027-02-10'))).toBe(27);
    expect(maxExtensionDays(iso('2028-02-10'))).toBe(28);
    expect(
      calculateExtensionCost({ ...dasar, quantity: 29, currentEndDate: iso('2026-11-21') }).additionalDays,
    ).toBe(29);
    expect(
      calculateExtensionCost({ ...dasar, quantity: 27, currentEndDate: iso('2027-02-10') }).additionalDays,
    ).toBe(27);
    expect(
      calculateExtensionCost({ ...dasar, quantity: 28, currentEndDate: iso('2028-02-10') }).additionalDays,
    ).toBe(28);
  });

  it('menolak jumlah 0, di atas batas, negatif, dan bukan bilangan bulat', () => {
    const november = { ...dasar, currentEndDate: iso('2026-11-21') };
    for (const jumlah of [0, 30, -1, 1.5, Number.NaN]) {
      expect(() => calculateExtensionCost({ ...november, quantity: jumlah })).toThrow(
        ExtensionQuantityError,
      );
    }
    expect(() => calculateExtensionCost({ ...november, quantity: 30 })).toThrow(
      'Jumlah hari perpanjangan harus bilangan bulat 1 sampai 29.',
    );
    expect(() =>
      calculateExtensionCost({ ...dasar, quantity: 28, currentEndDate: iso('2027-02-10') }),
    ).toThrow(ExtensionQuantityError);
  });

  it('harga harian 0 menghasilkan sisa biaya 0, tidak pernah negatif', () => {
    const hasil = calculateExtensionCost({
      extensionType: 'HARIAN',
      quantity: 3,
      currentEndDate: iso('2026-11-24'),
      dailyPrice: 0,
    });
    expect(hasil.amount).toBe(0);
    expect(hasil.additionalDays).toBe(3);
  });

  it('menolak harga harian negatif atau bukan bilangan bulat', () => {
    const masukan = { ...dasar, quantity: 2, currentEndDate: iso('2026-11-24') };
    expect(() => calculateExtensionCost({ ...masukan, dailyPrice: -1 })).toThrow(RangeError);
    expect(() => calculateExtensionCost({ ...masukan, dailyPrice: 1.5 })).toThrow(RangeError);
  });
});

describe('calculateExtensionCost, perpanjangan bulanan', () => {
  const dasar = { extensionType: 'BULANAN' as const, dailyPrice: 10000 };

  it('1 bulan dari 2026-11-21 berakhir 2026-12-21 dengan biaya 250000', () => {
    const hasil = calculateExtensionCost({ ...dasar, quantity: 1, currentEndDate: iso('2026-11-21') });
    expect(toIsoDate(hasil.newEndDate)).toBe('2026-12-21');
    expect(hasil.additionalDays).toBe(30);
    expect(hasil.amount).toBe(250000);
  });

  it('2 bulan dari 2026-11-21 berakhir 2027-01-21 dengan biaya 500000 (30 lalu 31 hari)', () => {
    const hasil = calculateExtensionCost({ ...dasar, quantity: 2, currentEndDate: iso('2026-11-21') });
    expect(toIsoDate(hasil.newEndDate)).toBe('2027-01-21');
    expect(hasil.additionalDays).toBe(61);
    expect(hasil.amount).toBe(500000);
  });

  it('akhir Februari: 2027-02-10 + 1 bulan = 2027-03-10 (28 hari) dan Februari kabisat 2028-02-10 = 2028-03-10 (29 hari)', () => {
    const biasa = calculateExtensionCost({ ...dasar, quantity: 1, currentEndDate: iso('2027-02-10') });
    expect(toIsoDate(biasa.newEndDate)).toBe('2027-03-10');
    expect(biasa.additionalDays).toBe(28);
    const kabisat = calculateExtensionCost({ ...dasar, quantity: 1, currentEndDate: iso('2028-02-10') });
    expect(toIsoDate(kabisat.newEndDate)).toBe('2028-03-10');
    expect(kabisat.additionalDays).toBe(29);
  });

  it('biaya = jumlah bulan x 25 x harga harian milik sewa, bukan hari x harga harian', () => {
    const hasil = calculateExtensionCost({
      extensionType: 'BULANAN',
      quantity: 3,
      currentEndDate: iso('2026-12-21'),
      dailyPrice: 80000,
    });
    expect(hasil.amount).toBe(6000000);
  });

  it('menolak jumlah bulan 0, negatif, dan bukan bilangan bulat', () => {
    const masukan = { ...dasar, currentEndDate: iso('2026-11-21') };
    for (const jumlah of [0, -2, 1.5, Number.NaN]) {
      expect(() => calculateExtensionCost({ ...masukan, quantity: jumlah })).toThrow(
        ExtensionQuantityError,
      );
    }
  });

  it('menerima tepat 1200 bulan dan menolak 1201', () => {
    const masukan = { extensionType: 'BULANAN' as const, currentEndDate: iso('2026-11-21'), dailyPrice: 0 };
    expect(calculateExtensionCost({ ...masukan, quantity: MAX_EXTENSION_MONTHS }).amount).toBe(0);
    expect(() => calculateExtensionCost({ ...masukan, quantity: MAX_EXTENSION_MONTHS + 1 })).toThrow(
      'Jumlah bulan perpanjangan harus bilangan bulat 1 sampai 1200.',
    );
  });
});

describe('calculateExtensionCost, batas kolom INTEGER', () => {
  const dasar = { currentEndDate: iso('2026-11-24') };

  it('menolak sisa biaya bulanan di atas 2147483647 dengan RangeError berpesan Bahasa Indonesia', () => {
    const jalankan = () =>
      calculateExtensionCost({
        ...dasar,
        extensionType: 'BULANAN',
        quantity: MAX_EXTENSION_MONTHS,
        dailyPrice: 100000,
      });
    expect(jalankan).toThrow(RangeError);
    expect(jalankan).toThrow(ExtensionTooFarError);
    expect(jalankan).toThrow(EXTENSION_TOO_FAR_MESSAGE);
  });

  it('menerima sisa biaya harian tepat 2147483647 dan menolak satu hari lebih', () => {
    const hasil = calculateExtensionCost({
      ...dasar,
      extensionType: 'HARIAN',
      quantity: 1,
      dailyPrice: MAX_EXTENSION_VALUE,
    });
    expect(hasil.amount).toBe(MAX_EXTENSION_VALUE);
    expect(hasil.additionalDays).toBe(1);
    expect(() =>
      calculateExtensionCost({
        ...dasar,
        extensionType: 'HARIAN',
        quantity: 2,
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
