/**
 * @file Tes unit aturan laporan sewa: jumlah biaya per sewa, rentang tanggal,
 * pengelompokan per bulan, hari, tipe garasi, dan penyewa, termasuk baris nol,
 * Februari 28/29, pergantian tahun, dan total.
 */
import { describe, expect, it } from 'vitest';
import {
  parseIsoDate,
  rentalAmount,
  reportByDay,
  reportByGarageType,
  reportByMonth,
  reportByRenter,
  reportDateRange,
  toIsoDate,
  type ReportRental,
} from '@/domain';

/**
 * Membuat satu sewa contoh untuk laporan.
 *
 * @param override Isian yang menggantikan isian dasar.
 * @returns Sewa contoh.
 */
function sewa(override: Partial<Omit<ReportRental, 'startDate'>> & { start: string }): ReportRental {
  const { start, ...sisa } = override;
  return {
    startDate: parseIsoDate(start),
    garageType: 'BICYCLE',
    renterId: 1,
    renterName: 'Budi',
    renterEmail: 'budi@contoh.id',
    totalCost: 10000,
    extensionAmounts: [],
    ...sisa,
  };
}

describe('rentalAmount', () => {
  it('menjumlahkan total biaya dan semua biaya perpanjangan', () => {
    expect(rentalAmount(sewa({ start: '2026-01-01', totalCost: 30000, extensionAmounts: [70000, 10000] }))).toBe(
      110000,
    );
  });

  it('sama dengan total biaya bila tidak ada perpanjangan', () => {
    expect(rentalAmount(sewa({ start: '2026-01-01', totalCost: 30000 }))).toBe(30000);
  });
});

describe('reportDateRange', () => {
  it('memberi rentang satu tahun dengan batas akhir eksklusif', () => {
    const rentang = reportDateRange(2026);
    expect(toIsoDate(rentang.from)).toBe('2026-01-01');
    expect(toIsoDate(rentang.to)).toBe('2027-01-01');
  });

  it('memberi rentang satu bulan, termasuk Desember dan Februari kabisat', () => {
    const desember = reportDateRange(2026, 12);
    expect([toIsoDate(desember.from), toIsoDate(desember.to)]).toEqual(['2026-12-01', '2027-01-01']);
    const februari = reportDateRange(2028, 2);
    expect([toIsoDate(februari.from), toIsoDate(februari.to)]).toEqual(['2028-02-01', '2028-03-01']);
  });

  it('menolak tahun di luar 2000 sampai 2100, bulan di luar 1 sampai 12, dan bilangan pecahan', () => {
    expect(() => reportDateRange(1999)).toThrow(RangeError);
    expect(() => reportDateRange(2101)).toThrow(RangeError);
    expect(() => reportDateRange(2026, 0)).toThrow(RangeError);
    expect(() => reportDateRange(2026, 13)).toThrow(RangeError);
    expect(() => reportDateRange(2026, 1.5)).toThrow(RangeError);
    expect(() => reportDateRange(2026.5)).toThrow(RangeError);
  });
});

describe('reportByMonth', () => {
  const contoh = [
    sewa({ start: '2026-01-01', totalCost: 10000 }),
    sewa({ start: '2026-01-31', totalCost: 20000, extensionAmounts: [5000] }),
    sewa({ start: '2026-12-31', totalCost: 40000 }),
    sewa({ start: '2025-12-31', totalCost: 99999 }),
    sewa({ start: '2027-01-01', totalCost: 88888 }),
  ];

  it('selalu memberi 12 baris dengan kunci dan label bulan', () => {
    const laporan = reportByMonth(contoh, 2026);
    expect(laporan.rows).toHaveLength(12);
    expect(laporan.rows[0]).toMatchObject({ key: '2026-01', label: 'Januari 2026', detail: null });
    expect(laporan.rows[11]).toMatchObject({ key: '2026-12', label: 'Desember 2026' });
  });

  it('menaruh sewa pada bulan tanggal mulainya dan mengabaikan tahun lain', () => {
    const laporan = reportByMonth(contoh, 2026);
    expect(laporan.rows[0]).toMatchObject({ count: 2, amount: 35000 });
    expect(laporan.rows[11]).toMatchObject({ count: 1, amount: 40000 });
    expect(laporan.rows[5]).toMatchObject({ count: 0, amount: 0 });
  });

  it('total sama dengan jumlah baris dan memuat biaya perpanjangan', () => {
    const laporan = reportByMonth(contoh, 2026);
    expect(laporan.totalCount).toBe(3);
    expect(laporan.totalAmount).toBe(75000);
    expect(laporan.rows.reduce((jumlah, baris) => jumlah + baris.amount, 0)).toBe(75000);
  });

  it('tanpa sewa memberi 12 baris nol', () => {
    const laporan = reportByMonth([], 2026);
    expect(laporan.rows).toHaveLength(12);
    expect(laporan.totalCount).toBe(0);
    expect(laporan.totalAmount).toBe(0);
  });

  it('menolak tahun di luar rentang', () => {
    expect(() => reportByMonth([], 1999)).toThrow(RangeError);
  });
});

describe('reportByDay', () => {
  it('Februari kabisat 2028 punya 29 baris dan 29 Februari terisi', () => {
    const laporan = reportByDay(
      [sewa({ start: '2028-02-29', totalCost: 50000 }), sewa({ start: '2028-03-01', totalCost: 70000 })],
      2028,
      2,
    );
    expect(laporan.rows).toHaveLength(29);
    const terakhir = laporan.rows[28];
    expect(terakhir).toMatchObject({ key: '2028-02-29', label: '29 Februari 2028', count: 1, amount: 50000 });
    expect(laporan.totalCount).toBe(1);
    expect(laporan.totalAmount).toBe(50000);
  });

  it('jumlah baris mengikuti hari dalam bulan', () => {
    expect(reportByDay([], 2027, 2).rows).toHaveLength(28);
    expect(reportByDay([], 2100, 2).rows).toHaveLength(28); // 2100 bukan kabisat (kelipatan 100)
    expect(reportByDay([], 2000, 2).rows).toHaveLength(29); // 2000 kabisat (kelipatan 400)
    expect(reportByDay([], 2026, 11).rows).toHaveLength(30);
    expect(reportByDay([], 2026, 12).rows).toHaveLength(31);
  });

  it('menjumlahkan sewa pada hari yang sama beserta perpanjangannya', () => {
    const laporan = reportByDay(
      [
        sewa({ start: '2026-11-21', totalCost: 100, extensionAmounts: [10, 20] }),
        sewa({ start: '2026-11-21', totalCost: 200 }),
        sewa({ start: '2026-10-31', totalCost: 999 }),
      ],
      2026,
      11,
    );
    expect(laporan.rows[20]).toMatchObject({ key: '2026-11-21', count: 2, amount: 330 });
    expect(laporan.totalAmount).toBe(330);
  });

  it('menolak bulan di luar 1 sampai 12', () => {
    expect(() => reportByDay([], 2026, 13)).toThrow(RangeError);
  });
});

describe('reportByGarageType', () => {
  it('selalu memberi tiga baris berurutan termasuk tipe tanpa sewa', () => {
    const laporan = reportByGarageType([
      sewa({ start: '2026-01-01', garageType: 'CAR', totalCost: 1000 }),
      sewa({ start: '2026-01-02', garageType: 'CAR', totalCost: 2000, extensionAmounts: [500] }),
    ]);
    expect(laporan.rows.map((baris) => baris.key)).toEqual(['BICYCLE', 'CAR', 'ELECTRIC_CAR']);
    expect(laporan.rows.map((baris) => baris.label)).toEqual(['Sepeda', 'Mobil', 'Mobil Listrik']);
    expect(laporan.rows[0]).toMatchObject({ count: 0, amount: 0 });
    expect(laporan.rows[1]).toMatchObject({ count: 2, amount: 3500 });
    expect(laporan.rows[2]).toMatchObject({ count: 0, amount: 0 });
    expect(laporan.totalCount).toBe(2);
    expect(laporan.totalAmount).toBe(3500);
  });
});

describe('reportByRenter', () => {
  it('hanya memuat penyewa yang punya sewa, urut nama, dengan email sebagai detail', () => {
    const laporan = reportByRenter([
      sewa({ start: '2026-01-01', renterId: 2, renterName: 'Citra', renterEmail: 'citra@contoh.id', totalCost: 500 }),
      sewa({ start: '2026-01-02', renterId: 1, renterName: 'Budi', renterEmail: 'budi@contoh.id', totalCost: 100 }),
      sewa({
        start: '2026-01-03',
        renterId: 1,
        renterName: 'Budi',
        renterEmail: 'budi@contoh.id',
        totalCost: 200,
        extensionAmounts: [50],
      }),
    ]);
    expect(laporan.rows.map((baris) => baris.label)).toEqual(['Budi', 'Citra']);
    expect(laporan.rows[0]).toMatchObject({ detail: 'budi@contoh.id', count: 2, amount: 350 });
    expect(laporan.rows[1]).toMatchObject({ detail: 'citra@contoh.id', count: 1, amount: 500 });
    expect(laporan.totalCount).toBe(3);
    expect(laporan.totalAmount).toBe(850);
  });

  it('dua penyewa bernama sama tetap dua baris terpisah', () => {
    const laporan = reportByRenter([
      sewa({ start: '2026-01-01', renterId: 7, renterName: 'Budi', renterEmail: 'a@contoh.id' }),
      sewa({ start: '2026-01-02', renterId: 3, renterName: 'Budi', renterEmail: 'b@contoh.id' }),
    ]);
    expect(laporan.rows).toHaveLength(2);
    expect(laporan.rows.map((baris) => baris.detail)).toEqual(['b@contoh.id', 'a@contoh.id']);
  });

  it('tanpa sewa tidak memberi baris dan total 0', () => {
    const laporan = reportByRenter([]);
    expect(laporan.rows).toHaveLength(0);
    expect(laporan.totalCount).toBe(0);
    expect(laporan.totalAmount).toBe(0);
  });
});
