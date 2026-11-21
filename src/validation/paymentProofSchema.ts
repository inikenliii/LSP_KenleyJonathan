/**
 * @file Skema validasi bukti pembayaran yang dipakai bersama oleh sewa baru dan
 * perpanjangan sewa: wajib diunggah, paling besar 2 MB, dan isinya harus gambar
 * JPEG, PNG, atau WebP menurut tanda tangan byte (bukan nama atau tipe kiriman klien).
 */
import { z } from 'zod';
import { PAYMENT_PROOF_MAX_BYTES, detectProofImageType } from '@/domain';

/** Skema bukti pembayaran; hasilnya `Uint8Array` isi gambar. */
export const paymentProofSchema = z
  .unknown()
  .superRefine((nilai, ctx) => {
    if (!(nilai instanceof Uint8Array) || nilai.length === 0) {
      ctx.addIssue({ code: 'custom', message: 'Bukti pembayaran wajib diunggah' });
    } else if (nilai.length > PAYMENT_PROOF_MAX_BYTES) {
      ctx.addIssue({ code: 'custom', message: 'Ukuran bukti pembayaran paling besar 2 MB' });
    } else if (detectProofImageType(nilai) === null) {
      ctx.addIssue({
        code: 'custom',
        message: 'Bukti pembayaran harus gambar JPEG, PNG, atau WebP',
      });
    }
  })
  .transform((nilai) => nilai as Uint8Array);
