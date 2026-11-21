/**
 * @file Konfigurasi environment aplikasi.
 *
 * Memuat file .env, memvalidasi nilainya dengan Zod, dan gagal cepat saat
 * startup bila ada yang tidak valid. Pesan error hanya menyebut nama kunci,
 * tidak pernah nilainya.
 */
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

/** Skema validasi untuk variabel environment yang dipakai aplikasi. */
const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .refine((value) => /^postgres(ql)?:\/\//.test(value), 'harus diawali postgres:// atau postgresql://'),
  SESSION_SECRET: z.string().min(32, 'minimal 32 karakter'),
  PORT: z.coerce.number().int().min(0).max(65535).default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(10),
});

/**
 * Membaca dan memvalidasi environment.
 *
 * @param {NodeJS.ProcessEnv} source Sumber variabel environment.
 * @returns {Readonly<object>} Konfigurasi yang sudah tervalidasi dan dibekukan.
 * @throws {Error} Bila ada variabel yang tidak valid (hanya nama kunci yang disebut).
 */
function loadEnv(source) {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const keys = [...new Set(result.error.issues.map((issue) => String(issue.path[0])))];
    throw new Error(
      `Konfigurasi .env tidak valid atau belum lengkap pada kunci: ${keys.join(', ')}. ` +
        'Lihat .env.example sebagai contoh.',
    );
  }
  const values = result.data;
  return Object.freeze({
    ...values,
    isProduction: values.NODE_ENV === 'production',
    isTest: values.NODE_ENV === 'test',
  });
}

/** Konfigurasi aplikasi yang sudah tervalidasi. */
export const env = loadEnv(process.env);
