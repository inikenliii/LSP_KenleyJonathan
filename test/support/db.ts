/**
 * @file Bantuan database untuk tes: koneksi ke database uji dan pengosongan data.
 */
import dotenv from 'dotenv';
import { GarageType } from '@/generated/enums';
import type { PrismaClient } from '@/generated/client';
import { createPrismaClient } from '@/lib/prisma-client';

dotenv.config({ quiet: true });

/**
 * Mengambil URL database uji setelah memastikan aman dipakai.
 *
 * @returns URL dari TEST_DATABASE_URL.
 * @throws {Error} Bila URL kosong, sama dengan DATABASE_URL, atau nama databasenya tidak berakhiran `_test`.
 */
export function testDatabaseUrl(): string {
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) {
    throw new Error('TEST_DATABASE_URL belum diatur di file .env.');
  }
  if (testUrl === process.env.DATABASE_URL) {
    throw new Error('TEST_DATABASE_URL tidak boleh sama dengan DATABASE_URL.');
  }
  if (!new URL(testUrl).pathname.replace(/^\//, '').endsWith('_test')) {
    throw new Error('Nama database pada TEST_DATABASE_URL harus berakhiran _test.');
  }
  return testUrl;
}

/**
 * Membuat klien Prisma yang terhubung ke database uji.
 *
 * @returns Klien Prisma; pemanggil wajib memanggil `$disconnect()` setelah selesai.
 */
export function createTestPrisma(): PrismaClient {
  return createPrismaClient(testDatabaseUrl());
}

/**
 * Mengosongkan semua tabel, mengulang penomoran id, lalu mengisi ulang satu
 * konfigurasi per tipe garasi agar keadaan awal tiap tes sama.
 *
 * @param prisma Klien Prisma milik database uji.
 */
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRaw`TRUNCATE TABLE "users", "garages", "garage_type_configs", "session" RESTART IDENTITY CASCADE`;
  await prisma.garageTypeConfig.createMany({
    data: Object.values(GarageType).map((type) => ({ type })),
  });
}
