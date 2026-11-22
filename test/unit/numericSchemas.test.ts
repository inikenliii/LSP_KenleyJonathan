/**
 * @file Tes unit pembacaan angka ketat pada skema garasi, sewa, dan laporan:
 * bentuk seperti `0x2`, `1e1`, `+5`, dan `5 5` tidak boleh lolos seperti pada
 * `z.coerce.number()`.
 */
import { describe, expect, it } from 'vitest';
import { parseIsoDate } from '@/domain';
import { garageBatchSchema } from '@/validation/garageSchemas';
import { createRentalSchema } from '@/validation/rentalSchemas';
import { reportMonthSchema, reportYearSchema } from '@/validation/reportSchemas';

/** Bentuk teks yang diterima `Number()` tetapi bukan angka desimal biasa. */
const BENTUK_ANEH = ['0x2', '0X10', '1e1', '2e3', '+5', '5 5', '1_0', 'Infinity', '0b11', '٣'];

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

/**
 * Mengambil pesan error pertama sebuah field dari hasil `safeParse`.
 *
 * @param hasil Hasil `safeParse`.
 * @param field Nama field.
 * @returns Pesan error, atau `undefined` bila field tidak bermasalah.
 */
function pesanField(
  hasil: { success: boolean; error?: { issues: Array<{ path: PropertyKey[]; message: string }> } },
  field: string,
): string | undefined {
  return hasil.error?.issues.find((isu) => isu.path[0] === field)?.message;
}

describe('garageBatchSchema: angka ketat', () => {
  const dasar = { type: 'CAR', quantity: '5', dailyPrice: '50000' };

  it('menerima angka desimal biasa, juga bertipe number dan dengan spasi di tepi', () => {
    const hasil = garageBatchSchema.parse({ ...dasar, quantity: ' 5 ', dailyPrice: 50000 });
    expect(hasil.quantity).toBe(5);
    expect(hasil.dailyPrice).toBe(50000);
  });

  it('menolak bentuk aneh dengan pesan field biasa', () => {
    for (const nilai of BENTUK_ANEH) {
      expect(pesanField(garageBatchSchema.safeParse({ ...dasar, quantity: nilai }), 'quantity')).toBe(
        'Jumlah garasi wajib diisi angka',
      );
      expect(
        pesanField(garageBatchSchema.safeParse({ ...dasar, dailyPrice: nilai }), 'dailyPrice'),
      ).toBe('Harga harian wajib diisi angka');
    }
  });

  it('tetap memberi pesan batas dan bilangan bulat yang lama', () => {
    expect(pesanField(garageBatchSchema.safeParse({ ...dasar, quantity: '1.5' }), 'quantity')).toBe(
      'Jumlah garasi harus bilangan bulat',
    );
    expect(pesanField(garageBatchSchema.safeParse({ ...dasar, quantity: '0' }), 'quantity')).toBe(
      'Jumlah garasi paling sedikit 1',
    );
    expect(pesanField(garageBatchSchema.safeParse({ ...dasar, quantity: '-3' }), 'quantity')).toBe(
      'Jumlah garasi paling sedikit 1',
    );
    expect(pesanField(garageBatchSchema.safeParse({ ...dasar, quantity: '1000' }), 'quantity')).toBe(
      'Jumlah maksimum 999',
    );
    expect(
      pesanField(garageBatchSchema.safeParse({ ...dasar, dailyPrice: '10000001' }), 'dailyPrice'),
    ).toBe('Harga harian paling banyak Rp 10.000.000');
  });

  it('menolak harga per kWh berbentuk aneh untuk Mobil Listrik', () => {
    const listrik = { type: 'ELECTRIC_CAR', quantity: '1', dailyPrice: '100000' };
    expect(garageBatchSchema.safeParse({ ...listrik, pricePerKwh: '2500' }).success).toBe(true);
    for (const nilai of ['1e3', '0x10', '+2500']) {
      expect(
        pesanField(garageBatchSchema.safeParse({ ...listrik, pricePerKwh: nilai }), 'pricePerKwh'),
      ).toBe('Harga per kWh harus bilangan bulat antara Rp 1 dan Rp 1.000.000');
    }
  });
});

describe('createRentalSchema: jumlah hari ketat', () => {
  // 5 Januari: bulan 31 hari sehingga batas sewa harian 30 hari.
  const schema = createRentalSchema(parseIsoDate('2026-01-05'));
  const harian = {
    vehicleType: 'SEPEDA',
    vehicleBrand: 'Polygon',
    vehicleModel: 'Sepeda Gunung',
    rentalType: 'HARIAN',
    garageType: 'BICYCLE',
    garageId: 'S001',
    paymentProof: PNG,
  };

  it('menerima jumlah hari angka biasa', () => {
    expect(schema.parse({ ...harian, days: '7' }).days).toBe(7);
    expect(schema.parse({ ...harian, days: 7 }).days).toBe(7);
  });

  it('menolak bentuk aneh dengan pesan field biasa', () => {
    for (const nilai of BENTUK_ANEH) {
      expect(pesanField(schema.safeParse({ ...harian, days: nilai }), 'days')).toBe(
        'Jumlah hari wajib diisi angka',
      );
    }
  });

  it('tetap memberi pesan batas dan bilangan bulat yang lama', () => {
    expect(pesanField(schema.safeParse({ ...harian, days: '2.5' }), 'days')).toBe(
      'Jumlah hari harus bilangan bulat',
    );
    expect(pesanField(schema.safeParse({ ...harian, days: '0' }), 'days')).toBe(
      'Jumlah hari paling sedikit 1',
    );
    expect(pesanField(schema.safeParse({ ...harian, days: '31' }), 'days')).toBe(
      'Jumlah hari maksimal 30 untuk bulan mulai sewa',
    );
  });
});

describe('reportYearSchema dan reportMonthSchema: angka ketat', () => {
  it('menerima angka biasa', () => {
    expect(reportYearSchema.parse({ year: '2026' }).year).toBe(2026);
    expect(reportMonthSchema.parse({ year: 2026, month: '11' })).toEqual({ year: 2026, month: 11 });
  });

  it('menolak bentuk aneh dengan pesan tahun dan bulan', () => {
    for (const nilai of ['0x7EA', '2e3', '+2026', '20 26', '2026.5']) {
      expect(pesanField(reportYearSchema.safeParse({ year: nilai }), 'year')).toBe(
        'Tahun harus bilangan bulat 2000 sampai 2100',
      );
    }
    for (const nilai of ['0xB', '1e1', '+5', '1 2', '5.5']) {
      expect(pesanField(reportMonthSchema.safeParse({ year: '2026', month: nilai }), 'month')).toBe(
        'Bulan harus bilangan bulat 1 sampai 12',
      );
    }
  });

  it('menolak di luar rentang', () => {
    expect(reportYearSchema.safeParse({ year: '1999' }).success).toBe(false);
    expect(reportYearSchema.safeParse({ year: '2101' }).success).toBe(false);
    expect(reportMonthSchema.safeParse({ year: '2026', month: '13' }).success).toBe(false);
    expect(reportMonthSchema.safeParse({ year: '2026', month: '0' }).success).toBe(false);
  });
});
