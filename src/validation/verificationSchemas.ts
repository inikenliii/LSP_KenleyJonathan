/**
 * @file Skema validasi (Zod) untuk keputusan verifikasi pendaftar beserta
 * pesan Bahasa Indonesia.
 */
import { z } from 'zod';

/**
 * Skema keputusan admin: terima atau tolak. Menerima mewajibkan konfirmasi
 * bahwa KTP sudah divalidasi; aturan ini dijaga di server, bukan hanya di browser.
 */
export const verificationDecisionSchema = z
  .object({
    decision: z.enum(['ACCEPT', 'REJECT'], { error: 'Keputusan tidak valid' }),
    // Kotak centang HTML mengirim "on" bila dicentang dan tidak mengirim apa pun bila tidak.
    ktpValidated: z.preprocess(
      (nilai) => nilai === 'on' || nilai === 'true' || nilai === true,
      z.boolean(),
    ),
  })
  .refine((data) => data.decision !== 'ACCEPT' || data.ktpValidated, {
    path: ['ktpValidated'],
    error: 'Centang konfirmasi validasi KTP sebelum menerima pendaftar.',
  });

/** Data keputusan verifikasi yang sudah lolos validasi. */
export type VerificationDecisionInput = z.output<typeof verificationDecisionSchema>;
