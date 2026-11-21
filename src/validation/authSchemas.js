/**
 * @file Skema validasi (Zod) untuk pendaftaran dan login beserta pesan Bahasa
 * Indonesia. Field di luar skema (misalnya role atau verificationStatus yang
 * disisipkan klien) otomatis dibuang oleh Zod.
 */
import { z } from 'zod';

/** Email: dipangkas, huruf kecil, maksimal 254 karakter, format valid. */
const emailField = z
  .string({ error: 'Format email tidak valid' })
  .trim()
  .toLowerCase()
  .max(254, { error: 'Format email tidak valid' })
  .pipe(z.email({ error: 'Format email tidak valid' }));

/** Skema data pendaftaran penyewa. */
export const registrationSchema = z.object({
  // Spasi dibuang dahulu, lalu harus tepat 16 digit angka.
  nik: z
    .string({ error: 'NIK harus 16 digit angka' })
    .transform((value) => value.replace(/\s/g, ''))
    .pipe(z.string().regex(/^\d{16}$/, { error: 'NIK harus 16 digit angka' })),
  fullName: z
    .string({ error: 'Nama lengkap harus 3-100 karakter' })
    .trim()
    .min(3, { error: 'Nama lengkap harus 3-100 karakter' })
    .max(100, { error: 'Nama lengkap harus 3-100 karakter' }),
  // Spasi, tanda hubung, titik, dan kurung dibuang sebelum dicocokkan dengan pola nomor Indonesia.
  phone: z
    .string({ error: 'Nomor telepon tidak valid (contoh: 081234567890)' })
    .transform((value) => value.replace(/[\s\-.()]/g, ''))
    .pipe(
      z.string().regex(/^(\+62|62|0)8\d{8,11}$/, {
        error: 'Nomor telepon tidak valid (contoh: 081234567890)',
      }),
    ),
  email: emailField,
  password: z
    .string({ error: 'Password harus 8-72 karakter' })
    .min(8, { error: 'Password harus 8-72 karakter' })
    .max(72, { error: 'Password harus 8-72 karakter' }),
});

/** Skema data login. */
export const loginSchema = z.object({
  email: emailField,
  password: z
    .string({ error: 'Password wajib diisi' })
    .min(1, { error: 'Password wajib diisi' })
    .max(72, { error: 'Password wajib diisi' }),
});
