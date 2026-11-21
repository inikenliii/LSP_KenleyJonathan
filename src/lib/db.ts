import 'server-only';
import type { PrismaClient } from '../generated/client';
import { createPrismaClient } from './prisma-client';

/**
 * @file Koneksi database untuk aplikasi (hanya berjalan di server).
 *
 * Saat pengembangan, modul dimuat ulang berkali-kali. Klien disimpan di
 * `globalThis` agar tidak membuka koneksi baru setiap kali dimuat ulang.
 */

const globalUntukPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Membuat klien Prisma dari DATABASE_URL.
 *
 * @returns Klien Prisma baru.
 * @throws {Error} Bila DATABASE_URL belum diatur (nilainya tidak pernah ditampilkan).
 */
function buatKlien(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL belum diatur di file .env.');
  }
  return createPrismaClient(url);
}

/** Klien Prisma tunggal yang dipakai seluruh aplikasi. */
export const prisma: PrismaClient = globalUntukPrisma.prisma ?? buatKlien();

if (process.env.NODE_ENV !== 'production') {
  globalUntukPrisma.prisma = prisma;
}
