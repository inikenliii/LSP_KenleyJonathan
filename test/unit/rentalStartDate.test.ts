/**
 * @file Tes unit tanggal mulai sewa baru: batas hari ini sampai satu tahun
 * ke depan, bentuk tanggal, nilai bawaan, dan batas hari sewa harian menurut
 * bulan tanggal mulai.
 */
import { describe, expect, it } from 'vitest';
import { computeEndDate, latestStartDate, maxDailyDays, parseIsoDate, toIsoDate } from '@/domain';
import { createRentalSchema } from '@/validation/rentalSchemas';

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

/** Hari ini menurut server pada semua tes di berkas ini. */
const HARI_INI = parseIsoDate('2026-11-22');

const schema = createRentalSchema(HARI_INI);

/**
 * Membuat isian sewa harian sepeda yang sah, lalu menimpa sebagian isian.
 *
 * @param override Isian yang menggantikan isian dasar.
 * @returns Isian formulir mentah.
 */
function isian(override: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    vehicleType: 'SEPEDA',
    vehicleBrand: 'Polygon',
    vehicleModel: 'Heist',
    rentalType: 'HARIAN',
    days: '3',
    garageType: 'BICYCLE',
    garageId: 'S001',
    paymentProof: PNG,
    ...override,
  };
}

/**
 * Mengambil pesan error pertama suatu field dari hasil validasi.
 *
 * @param input Isian formulir mentah.
 * @param field Nama field.
 * @returns Pesan error, atau `undefined` bila field tidak bermasalah.
 */
function pesan(input: Record<string, unknown>, field: string): string | undefined {
  const hasil = schema.safeParse(input);
  return hasil.success
    ? undefined
    : hasil.error.issues.find((isu) => isu.path[0] === field)?.message;
}

describe('latestStartDate', () => {
  it('satu tahun setelah hari ini', () => {
    expect(toIsoDate(latestStartDate(parseIsoDate('2026-11-22')))).toBe('2027-11-22');
    expect(toIsoDate(latestStartDate(parseIsoDate('2027-12-31')))).toBe('2028-12-31');
  });

  it('29 Februari menjadi 1 Maret bila tahun depan bukan kabisat', () => {
    expect(toIsoDate(latestStartDate(parseIsoDate('2028-02-29')))).toBe('2029-03-01');
  });
});

describe('createRentalSchema: tanggal mulai', () => {
  it('menerima hari ini dan besok', () => {
    expect(toIsoDate(schema.parse(isian({ startDate: '2026-11-22' })).startDate)).toBe('2026-11-22');
    expect(toIsoDate(schema.parse(isian({ startDate: '2026-11-23' })).startDate)).toBe('2026-11-23');
  });

  it('memakai hari ini bila tanggal mulai tidak dikirim atau kosong', () => {
    expect(toIsoDate(schema.parse(isian()).startDate)).toBe('2026-11-22');
    expect(toIsoDate(schema.parse(isian({ startDate: '   ' })).startDate)).toBe('2026-11-22');
  });

  it('menolak kemarin dan tanggal yang jauh di masa lalu', () => {
    for (const lampau of ['2026-11-21', '2026-01-01', '2000-01-01']) {
      expect(pesan(isian({ startDate: lampau }), 'startDate')).toBe(
        'Tanggal mulai tidak boleh sebelum hari ini',
      );
    }
  });

  it('menerima tepat satu tahun ke depan dan menolak sehari lebih jauh', () => {
    expect(schema.safeParse(isian({ startDate: '2027-11-22' })).success).toBe(true);
    expect(pesan(isian({ startDate: '2027-11-23' }), 'startDate')).toBe(
      'Tanggal mulai paling jauh satu tahun dari hari ini',
    );
  });

  it('menolak bentuk dan tanggal yang tidak sah', () => {
    for (const salah of ['22-11-2026', '2026/11/23', '2026-11-3', 'besok', '2026-13-01', '2026-02-30']) {
      expect(pesan(isian({ startDate: salah }), 'startDate')).toBe(
        'Tanggal mulai harus tanggal yang sah',
      );
    }
    expect(pesan(isian({ startDate: 20261123 }), 'startDate')).toBe(
      'Tanggal mulai harus tanggal yang sah',
    );
  });

  it('batas hari sewa harian mengikuti bulan tanggal mulai, bukan bulan hari ini', () => {
    // Hari ini November (batas 29). Mulai Februari 2027 (28 hari): batas 27.
    expect(maxDailyDays(parseIsoDate('2027-02-10'))).toBe(27);
    expect(schema.safeParse(isian({ startDate: '2027-02-10', days: '27' })).success).toBe(true);
    expect(pesan(isian({ startDate: '2027-02-10', days: '28' }), 'days')).toBe(
      'Jumlah hari maksimal 27 untuk bulan mulai sewa',
    );
    // Mulai Desember (31 hari): batas 30, padahal bulan hari ini hanya 29.
    expect(schema.safeParse(isian({ startDate: '2026-12-01', days: '30' })).success).toBe(true);
    expect(pesan(isian({ startDate: '2026-12-01', days: '31' }), 'days')).toBe(
      'Jumlah hari maksimal 30 untuk bulan mulai sewa',
    );
  });
});

describe('tanggal berakhir dari tanggal mulai yang dipilih', () => {
  it('harian melewati batas bulan', () => {
    expect(toIsoDate(computeEndDate(parseIsoDate('2026-11-23'), 'HARIAN', 3))).toBe('2026-11-26');
    expect(toIsoDate(computeEndDate(parseIsoDate('2026-11-30'), 'HARIAN', 5))).toBe('2026-12-05');
    expect(toIsoDate(computeEndDate(parseIsoDate('2026-12-31'), 'HARIAN', 2))).toBe('2027-01-02');
  });

  it('bulanan memakai jumlah hari bulan tanggal mulai, termasuk Februari kabisat', () => {
    expect(toIsoDate(computeEndDate(parseIsoDate('2026-11-23'), 'BULANAN'))).toBe('2026-12-23');
    expect(toIsoDate(computeEndDate(parseIsoDate('2026-12-31'), 'BULANAN'))).toBe('2027-01-31');
    expect(toIsoDate(computeEndDate(parseIsoDate('2027-02-10'), 'BULANAN'))).toBe('2027-03-10');
    expect(toIsoDate(computeEndDate(parseIsoDate('2028-02-10'), 'BULANAN'))).toBe('2028-03-10');
    expect(toIsoDate(computeEndDate(parseIsoDate('2028-02-29'), 'BULANAN'))).toBe('2028-03-29');
  });
});
