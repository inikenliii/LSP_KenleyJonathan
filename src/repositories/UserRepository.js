/**
 * @file Repository pengguna: satu-satunya kelas yang membaca dan menulis
 * tabel users lewat Prisma.
 */
import { User } from '../domain/User.js';
import { DuplicateUserError } from '../domain/errors.js';

/** Kolom yang boleh dibaca dari database; passwordHash sengaja tidak ikut. */
const PUBLIC_USER_SELECT = {
  id: true,
  nik: true,
  fullName: true,
  phone: true,
  email: true,
  role: true,
  verificationStatus: true,
  verifiedAt: true,
  verifiedById: true,
  createdAt: true,
};

/**
 * Akses data pengguna.
 */
export class UserRepository {
  /**
   * @param {object} prisma Klien Prisma.
   */
  constructor(prisma) {
    this.prisma = prisma;
  }

  /**
   * Memeriksa apakah email sudah terdaftar.
   *
   * @param {string} email Email (sudah huruf kecil).
   * @returns {Promise<boolean>} True bila sudah ada.
   */
  async existsByEmail(email) {
    const found = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    return found !== null;
  }

  /**
   * Memeriksa apakah NIK sudah terdaftar.
   *
   * @param {string} nik NIK 16 digit.
   * @returns {Promise<boolean>} True bila sudah ada.
   */
  async existsByNik(nik) {
    const found = await this.prisma.user.findUnique({ where: { nik }, select: { id: true } });
    return found !== null;
  }

  /**
   * Menyimpan pengguna baru.
   *
   * @param {object} data Data pengguna, termasuk passwordHash.
   * @returns {Promise<User>} Pengguna yang tersimpan (tanpa hash password).
   * @throws {DuplicateUserError} Bila email atau NIK sudah dipakai (balapan permintaan).
   */
  async create(data) {
    try {
      const record = await this.prisma.user.create({ data, select: PUBLIC_USER_SELECT });
      return User.fromRecord(record);
    } catch (err) {
      if (err?.code === 'P2002') {
        throw new DuplicateUserError();
      }
      throw err;
    }
  }
}
