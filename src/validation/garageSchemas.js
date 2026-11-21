/**
 * @file Skema validasi (Zod) untuk pembuatan garasi berkelompok beserta pesan
 * Bahasa Indonesia.
 */
import { z } from 'zod';
import { GARAGE_TYPE_CODES } from '../domain/garage/index.js';

/**
 * Merapikan isian formulir sebelum divalidasi: tipe dipangkas, isian kosong
 * dianggap tidak diisi, dan harga per kWh dibuang bila tipenya bukan Mobil Listrik.
 *
 * @param {unknown} body Isi formulir mentah.
 * @returns {unknown} Isian yang sudah dirapikan.
 */
function normalizeBatchInput(body) {
  if (typeof body !== 'object' || body === null) {
    return {};
  }
  const input = { ...body };
  if (typeof input.type === 'string') {
    input.type = input.type.trim();
  }
  for (const field of ['quantity', 'dailyPrice', 'pricePerKwh']) {
    if (typeof input[field] === 'string' && input[field].trim() === '') {
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
      quantity: z.coerce
        .number({ error: 'Jumlah garasi wajib diisi angka' })
        .int({ error: 'Jumlah garasi harus bilangan bulat' })
        .min(1, { error: 'Jumlah garasi paling sedikit 1' })
        .max(999, { error: 'Jumlah maksimum 999' }),
      dailyPrice: z.coerce
        .number({ error: 'Harga harian wajib diisi angka' })
        .int({ error: 'Harga harian harus bilangan bulat (rupiah)' })
        .min(1, { error: 'Harga harian paling sedikit Rp 1' })
        .max(10000000, { error: 'Harga harian paling banyak Rp 10.000.000' }),
      pricePerKwh: z.coerce
        .number({ error: 'Harga per kWh harus bilangan bulat antara Rp 1 dan Rp 1.000.000' })
        .int({ error: 'Harga per kWh harus bilangan bulat antara Rp 1 dan Rp 1.000.000' })
        .min(1, { error: 'Harga per kWh harus bilangan bulat antara Rp 1 dan Rp 1.000.000' })
        .max(1000000, { error: 'Harga per kWh harus bilangan bulat antara Rp 1 dan Rp 1.000.000' })
        .optional(),
    })
    .refine((data) => data.type !== 'ELECTRIC_CAR' || data.pricePerKwh !== undefined, {
      path: ['pricePerKwh'],
      error: 'Harga per kWh wajib untuk Mobil Listrik',
    }),
);
