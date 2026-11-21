/**
 * @file Skema validasi (Zod) untuk keputusan verifikasi pendaftar beserta
 * pesan Bahasa Indonesia.
 */
import { z } from 'zod';

/** Skema keputusan admin: terima atau tolak, dengan konfirmasi validasi KTP untuk menerima. */
export const verificationDecisionSchema = z
  .object({
    decision: z.enum(['ACCEPT', 'REJECT'], { error: 'Keputusan tidak valid' }),
    // Kotak centang HTML mengirim "on" bila dicentang dan tidak mengirim apa pun bila tidak.
    ktpValidated: z.preprocess((value) => value === 'on' || value === 'true' || value === true, z.boolean()),
  })
  .refine((data) => data.decision !== 'ACCEPT' || data.ktpValidated, {
    path: ['ktpValidated'],
    error: 'Centang konfirmasi validasi KTP sebelum menerima pendaftar.',
  });
