/**
 * @file Skema validasi (Zod) untuk pembuatan garasi berkelompok beserta pesan
 * Bahasa Indonesia.
 */
import { z } from 'zod';
import { GARAGE_TYPE_CODES } from '@/domain';
import { wholeNumber } from './wholeNumber';

/** Pesan untuk harga per kWh di luar batas atau bukan bilangan bulat. */
const PESAN_HARGA_KWH = 'Harga per kWh harus bilangan bulat antara Rp 1 dan Rp 1.000.000';

/**
 * Merapikan isian formulir sebelum divalidasi: tipe dipangkas, isian kosong
 * dianggap tidak diisi, dan harga per kWh dibuang bila tipenya bukan Mobil Listrik.
 *
 * @param body Isi formulir mentah.
 * @returns Isian yang sudah dirapikan.
 */
function normalizeBatchInput(body: unknown): unknown {
  if (typeof body !== 'object' || body === null) {
    return {};
  }
  const input: Record<string, unknown> = { ...body };
  if (typeof input.type === 'string') {
    input.type = input.type.trim();
  }
  for (const field of ['quantity', 'dailyPrice', 'pricePerKwh']) {
    const nilai = input[field];
    if (typeof nilai === 'string' && nilai.trim() === '') {
      input[field] = undefined;
    }
  }
  if (input.type !== 'ELECTRIC_CAR') {
    input.pricePerKwh = undefined;
  }
  return input;
}

/** Skema pembuatan garasi berkelompok: tipe, jumlah 1-999, harga harian, dan harga per kWh. */
export const garageBatchSchema = z.preprocess(
  normalizeBatchInput,
  z
    .object({
      type: z.enum(GARAGE_TYPE_CODES, { error: 'Tipe garasi tidak valid' }),
      quantity: wholeNumber('Jumlah garasi wajib diisi angka', 'Jumlah garasi harus bilangan bulat').pipe(
        z
          .number()
          .min(1, { error: 'Jumlah garasi paling sedikit 1' })
          .max(999, { error: 'Jumlah maksimum 999' }),
      ),
      dailyPrice: wholeNumber(
        'Harga harian wajib diisi angka',
        'Harga harian harus bilangan bulat (rupiah)',
      ).pipe(
        z
          .number()
          .min(1, { error: 'Harga harian paling sedikit Rp 1' })
          .max(10000000, { error: 'Harga harian paling banyak Rp 10.000.000' }),
      ),
      pricePerKwh: wholeNumber(PESAN_HARGA_KWH, PESAN_HARGA_KWH)
        .pipe(z.number().min(1, { error: PESAN_HARGA_KWH }).max(1000000, { error: PESAN_HARGA_KWH }))
        .optional(),
    })
    .refine((data) => data.type !== 'ELECTRIC_CAR' || data.pricePerKwh !== undefined, {
      path: ['pricePerKwh'],
      error: 'Harga per kWh wajib untuk Mobil Listrik',
    }),
);

/** Data pembuatan garasi berkelompok yang sudah lolos validasi. */
export type GarageBatchInput = z.output<typeof garageBatchSchema>;
