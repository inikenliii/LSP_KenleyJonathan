/**
 * @file Layanan verifikasi pendaftar: aturan bisnis admin menerima atau
 * menolak penyewa baru.
 */
import { User } from '../domain/User.js';
import { ConflictError, NotFoundError, ValidationError, toAppError } from '../domain/errors.js';
import { verificationDecisionSchema } from '../validation/verificationSchemas.js';

/** Pesan bila pendaftar tidak ada atau bukan penyewa. */
const NOT_FOUND_MESSAGE = 'Pendaftar tidak ditemukan.';

/** Pesan bila pendaftar sudah diterima atau ditolak sebelumnya. */
const ALREADY_DECIDED_MESSAGE = 'Pendaftar ini sudah diproses sebelumnya.';

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

  /**
   * Menerima atau menolak seorang pendaftar. Menerima mewajibkan konfirmasi
   * bahwa KTP sudah divalidasi. Admin yang memutuskan dan waktunya disimpan.
   *
   * @param {object} input Data keputusan.
   * @param {string} input.userId Id pendaftar dari alamat (belum tentu angka).
   * @param {string} input.decision ACCEPT atau REJECT.
   * @param {string} [input.ktpValidated] "on" bila kotak validasi KTP dicentang.
   * @param {import('../domain/User.js').User} adminUser Admin yang memutuskan.
   * @returns {Promise<{ user: import('../domain/User.js').User, status: string }>} Pendaftar dan status barunya.
   * @throws {NotFoundError} Bila id tidak valid, tidak ada, atau bukan penyewa.
   * @throws {ValidationError} Bila keputusan tidak valid atau konfirmasi KTP belum dicentang.
   * @throws {ConflictError} Bila pendaftar sudah diputuskan sebelumnya.
   * @throws {import('../domain/errors.js').DatabaseError} Bila terjadi kegagalan tak terduga.
   */
  async decide({ userId, decision, ktpValidated }, adminUser) {
    if (typeof userId !== 'string' || !/^\d+$/.test(userId) || Number(userId) < 1) {
      throw new NotFoundError(NOT_FOUND_MESSAGE);
    }
    const id = Number(userId);
    const data = ValidationError.parse(verificationDecisionSchema, { decision, ktpValidated });
    try {
      const target = await this.userRepository.findById(id);
      if (target === null || !target.isRenter()) {
        throw new NotFoundError(NOT_FOUND_MESSAGE);
      }
      if (!target.isPending()) {
        throw new ConflictError(ALREADY_DECIDED_MESSAGE);
      }
      const status = data.decision === 'ACCEPT' ? User.STATUS.ACCEPTED : User.STATUS.REJECTED;
      const updated = await this.userRepository.decideVerification(id, {
        status,
        verifiedById: adminUser.id,
      });
      if (updated === 0) {
        throw new ConflictError(ALREADY_DECIDED_MESSAGE);
      }
      return { user: target, status };
    } catch (err) {
      throw toAppError(err);
    }
  }
}
