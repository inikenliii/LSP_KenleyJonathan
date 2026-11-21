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

  /**
   * Mencari pengguna berdasarkan email untuk proses masuk. Ini satu-satunya
   * method yang mengembalikan hash password.
   *
   * @param {string} email Email (sudah huruf kecil).
   * @returns {Promise<{ user: User, passwordHash: string }|null>} Pengguna beserta hash, atau null.
   */
  async findAuthRecordByEmail(email) {
    const row = await this.prisma.user.findUnique({
      where: { email },
      select: { ...PUBLIC_USER_SELECT, passwordHash: true },
    });
    if (row === null) {
      return null;
    }
    return { user: User.fromRecord(row), passwordHash: row.passwordHash };
  }

  /**
   * Mencari pengguna berdasarkan id (tanpa hash password).
   *
   * @param {number} id Id pengguna.
   * @returns {Promise<User|null>} Pengguna, atau null bila tidak ada.
   */
  async findById(id) {
    const row = await this.prisma.user.findUnique({ where: { id }, select: PUBLIC_USER_SELECT });
    return row === null ? null : User.fromRecord(row);
  }

  /**
   * Mengambil penyewa yang masih menunggu verifikasi, dari yang paling lama mendaftar.
   *
   * @returns {Promise<User[]>} Daftar penyewa berstatus PENDING.
   */
  async findPendingRenters() {
    const rows = await this.prisma.user.findMany({
      where: { role: User.ROLE.RENTER, verificationStatus: User.STATUS.PENDING },
      orderBy: { createdAt: 'asc' },
      select: PUBLIC_USER_SELECT,
    });
    return rows.map((row) => User.fromRecord(row));
  }
}
