/**
 * @file Layanan verifikasi pendaftar: aturan bisnis admin menerima atau
 * menolak penyewa baru.
 */
import { toAppError } from '../domain/errors.js';

/**
 * Menangani daftar pendaftar baru dan keputusan verifikasinya. Repository
 * diterima lewat konstruktor.
 */
export class VerificationService {
  /**
   * @param {import('../repositories/UserRepository.js').UserRepository} userRepository Repository pengguna.
   */
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  /**
   * Mengambil penyewa yang menunggu verifikasi.
   *
   * @returns {Promise<import('../domain/User.js').User[]>} Pendaftar berstatus PENDING, terlama dulu.
   * @throws {import('../domain/errors.js').DatabaseError} Bila terjadi kegagalan tak terduga.
   */
  async listPending() {
    try {
      return await this.userRepository.findPendingRenters();
    } catch (err) {
      throw toAppError(err);
    }
  }
}
