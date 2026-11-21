/**
 * @file Konfigurasi Prisma CLI.
 *
 * Sejak Prisma 7, file .env tidak lagi dibaca otomatis dan URL database tidak
 * lagi ditulis di schema.prisma. Karena itu .env dimuat di sini dan URL
 * koneksi diambil dari variabel DATABASE_URL.
 */
import dotenv from 'dotenv';
import { defineConfig, env } from 'prisma/config';

dotenv.config({ quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node prisma/seed.js',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
