/**
 * @file Repository sesi: akses tabel session lewat Prisma.
 */
import type { PrismaClient } from '@/generated/client';
import type { ISessionRepository } from './ISessionRepository';

/**
 * Implementasi ISessionRepository pada tabel `session` yang sudah ada:
 * `sid` berisi hash token, `sess` berisi `{ userId }`, `expire` waktu kedaluwarsa.
 */
export class SessionRepository implements ISessionRepository {
  /**
   * @param prisma Klien Prisma.
   */
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Menyimpan sesi baru.
   *
   * @param sidHash Hash SHA-256 (heksadesimal) dari token sesi.
   * @param userId Id pengguna pemilik sesi.
   * @param expiresAt Waktu sesi kedaluwarsa.
   */
  async create(sidHash: string, userId: number, expiresAt: Date): Promise<void> {
    await this.prisma.session.create({
      data: { sid: sidHash, sess: { userId }, expire: expiresAt },
    });
  }

  /**
   * Mencari pemilik sesi yang masih berlaku. Bentuk JSON `sess` diperiksa saat
   * dibaca, tidak dipercaya begitu saja.
   *
   * @param sidHash Hash SHA-256 dari token sesi.
   * @param now Waktu saat ini sebagai pembanding kedaluwarsa.
   * @returns Id pengguna, atau `null` bila sesi tidak ada, sudah kedaluwarsa, atau isinya tidak valid.
   */
  async findUserId(sidHash: string, now: Date): Promise<number | null> {
    const baris = await this.prisma.session.findUnique({ where: { sid: sidHash } });
    if (baris === null || baris.expire <= now) {
      return null;
    }
    const isi = baris.sess;
    if (typeof isi !== 'object' || isi === null || Array.isArray(isi)) {
      return null;
    }
    const userId = isi.userId;
    return typeof userId === 'number' && Number.isInteger(userId) && userId > 0 ? userId : null;
  }

  /**
   * Menghapus satu sesi; `deleteMany` dipakai agar sesi yang tidak ada bukan error.
   *
   * @param sidHash Hash SHA-256 dari token sesi.
   */
  async delete(sidHash: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { sid: sidHash } });
  }

  /**
   * Menghapus semua sesi yang sudah kedaluwarsa.
   *
   * @param now Waktu saat ini sebagai pembanding.
   * @returns Jumlah sesi yang dihapus.
   */
  async deleteExpired(now: Date): Promise<number> {
    const hasil = await this.prisma.session.deleteMany({ where: { expire: { lt: now } } });
    return hasil.count;
  }
}
