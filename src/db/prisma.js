/**
 * @file Koneksi database bersama.
 *
 * Modul ini dan repository adalah satu-satunya kode aplikasi yang boleh
 * menyentuh klien database. Menyediakan PrismaClient (lewat adapter pg) dan
 * pool pg untuk penyimpanan sesi.
 */
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/client.ts';
import { env } from '../config/env.js';

/** Klien Prisma yang dipakai seluruh repository. */
export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
});

/** Pool koneksi pg yang dipakai penyimpanan sesi (connect-pg-simple). */
export const pgPool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 10 });

/**
 * Menutup semua koneksi database dengan rapi.
 *
 * @returns {Promise<void>}
 */
export async function disconnectDatabase() {
  await prisma.$disconnect();
  await pgPool.end();
}
