/**
 * @file Skema validasi (Zod) untuk perpanjangan sewa beserta pesan Bahasa Indonesia.
 *
 * Skema hanya memuat id sewa, tanggal selesai baru, dan bukti pembayaran. Id
 * Admin, tanggal selesai lama, tambahan hari, harga harian, dan jumlah biaya
 * tidak pernah diterima dari klien: nilai itu dihitung server dan kunci yang
 * tidak dikenal dibuang.
 */
import { z } from 'zod';
import { parseIsoDate } from '@/domain';
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

/** Skema perpanjangan sewa: id sewa, tanggal selesai baru, dan bukti pembayaran. */
export const extendRentalSchema = z.preprocess(
  normalizeExtensionInput,
  z.object({
    rentalId: z
      .string({ error: 'Pilih sewa yang akan diperpanjang' })
      .regex(/^\d{1,9}$/, { error: 'Pilih sewa yang akan diperpanjang' })
      .transform(Number),
    newEndDate: z
      .string({ error: 'Tanggal selesai baru wajib diisi' })
      .transform((teks, ctx) => {
        try {
          return parseIsoDate(teks);
        } catch {
          ctx.addIssue({ code: 'custom', message: 'Tanggal selesai baru tidak valid' });
          return z.NEVER;
        }
      }),
    paymentProof: paymentProofSchema,
  }),
);

/** Data perpanjangan yang sudah lolos validasi. */
export type ExtendRentalInput = z.output<typeof extendRentalSchema>;
