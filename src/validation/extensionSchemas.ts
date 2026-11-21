/**
 * @file Skema validasi (Zod) untuk perpanjangan sewa beserta pesan Bahasa Indonesia.
 *
 * Skema hanya memuat id sewa, jenis perpanjangan (harian atau bulanan), jumlah
 * hari atau bulan, dan bukti pembayaran. Id Admin, tanggal selesai lama dan
 * baru, tambahan hari, harga harian, dan jumlah biaya tidak pernah diterima
 * dari klien: nilai itu dihitung server dan kunci yang tidak dikenal dibuang.
 * Batas jumlah (mengikuti bulan tanggal selesai sewa) diperiksa oleh domain.
 */
import { z } from 'zod';
import { RENTAL_TYPE_CODES } from '@/domain';
import { paymentProofSchema } from './paymentProofSchema';

/**
 * Merapikan isian formulir sebelum divalidasi: angka dijadikan teks, teks
 * dipangkas, dan isian kosong dianggap tidak diisi. Berkas bukti dibiarkan apa adanya.
 *
 * @param body Isi formulir mentah.
 * @returns Isian yang sudah dirapikan.
 */
function normalizeExtensionInput(body: unknown): unknown {
  if (typeof body !== 'object' || body === null) {
    return {};
  }
  const input: Record<string, unknown> = { ...body };
  for (const [kunci, nilai] of Object.entries(input)) {
    if (kunci === 'paymentProof') {
      continue;
    }
    if (typeof nilai === 'number') {
      input[kunci] = String(nilai);
    } else if (typeof nilai === 'string') {
      input[kunci] = nilai.trim() === '' ? undefined : nilai.trim();
    }
  }
  return input;
}

/** Skema perpanjangan sewa: id sewa, jenis, jumlah hari atau bulan, dan bukti pembayaran. */
export const extendRentalSchema = z.preprocess(
  normalizeExtensionInput,
  z.object({
    rentalId: z
      .string({ error: 'Pilih sewa yang akan diperpanjang' })
      .regex(/^\d{1,9}$/, { error: 'Pilih sewa yang akan diperpanjang' })
      .transform(Number),
    extensionType: z.enum(RENTAL_TYPE_CODES, { error: 'Pilih jenis perpanjangan' }),
    quantity: z
      .string({ error: 'Jumlah wajib diisi' })
      .regex(/^\d{1,7}$/, { error: 'Jumlah harus bilangan bulat positif' })
      .transform(Number),
    paymentProof: paymentProofSchema,
  }),
);

/** Data perpanjangan yang sudah lolos validasi. */
export type ExtendRentalInput = z.output<typeof extendRentalSchema>;
