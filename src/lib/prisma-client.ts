/**
 * @file Pabrik klien Prisma.
 *
 * Sengaja tidak memiliki efek samping saat diimpor, sehingga dapat dipakai
 * oleh seed dan pengujian dengan database yang berbeda.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/client';

/**
 * Membuat klien Prisma baru yang terhubung ke PostgreSQL lewat adapter pg.
 *
 * @param connectionString URL koneksi PostgreSQL.
 * @returns Klien Prisma yang siap dipakai; pemanggil wajib memanggil `$disconnect()` bila selesai.
 */
export function createPrismaClient(connectionString: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}
