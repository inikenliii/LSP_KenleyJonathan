/**
 * @file Persiapan global sebelum semua tes berjalan.
 *
 * Memastikan tes hanya memakai database uji (nama berakhiran `_test` dan
 * berbeda dari DATABASE_URL), lalu menerapkan migrasi ke database itu.
 */
import { execSync } from 'node:child_process';
import dotenv from 'dotenv';

/**
 * Menjalankan persiapan: memeriksa URL database uji dan menerapkan migrasi.
 *
 * @throws {Error} Bila TEST_DATABASE_URL tidak aman dipakai (nilainya tidak pernah ditampilkan).
 */
export default async function setup(): Promise<void> {
  dotenv.config({ quiet: true });

  const testUrl = process.env.TEST_DATABASE_URL;
  const mainUrl = process.env.DATABASE_URL;

  if (!testUrl) {
    throw new Error('TEST_DATABASE_URL belum diatur di file .env.');
  }
  if (testUrl === mainUrl) {
    throw new Error('TEST_DATABASE_URL tidak boleh sama dengan DATABASE_URL.');
  }
  const namaDatabase = new URL(testUrl).pathname.replace(/^\//, '');
  if (!namaDatabase.endsWith('_test')) {
    throw new Error('Nama database pada TEST_DATABASE_URL harus berakhiran _test.');
  }

  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: testUrl },
    stdio: 'inherit',
  });
}
