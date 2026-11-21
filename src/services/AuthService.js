/**
 * @file Layanan autentikasi: aturan bisnis pendaftaran penyewa.
 */
import bcrypt from 'bcryptjs';
import { User } from '../domain/User.js';
import {
  ValidationError,
  DuplicateUserError,
  AuthenticationError,
  AccountNotVerifiedError,
  toAppError,
} from '../domain/errors.js';
import { registrationSchema, loginSchema } from '../validation/authSchemas.js';

/**
 * Menangani pendaftaran dan proses masuk akun. Repository diterima lewat konstruktor.
 */
export class AuthService {
  /**
   * @param {import('../repositories/UserRepository.js').UserRepository} userRepository Repository pengguna.
   */
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  /**
   * Mendaftarkan penyewa baru. Peran dan status ditentukan di sini (RENTER dan
   * PENDING), tidak pernah dari data yang dikirim klien.
   *
   * @param {object} input Data formulir pendaftaran.
   * @returns {Promise<User>} Akun baru yang menunggu verifikasi admin.
   * @throws {ValidationError} Bila data tidak valid.
   * @throws {DuplicateUserError} Bila email atau NIK sudah terdaftar.
   * @throws {import('../domain/errors.js').DatabaseError} Bila terjadi kegagalan tak terduga.
   */
  async register(input) {
    const data = ValidationError.parse(registrationSchema, input ?? {});
    try {
      if (await this.userRepository.existsByEmail(data.email)) {
        throw new DuplicateUserError('email', 'Email sudah terdaftar.');
      }
      if (await this.userRepository.existsByNik(data.nik)) {
        throw new DuplicateUserError('nik', 'NIK sudah terdaftar.');
      }
      const passwordHash = await bcrypt.hash(data.password, User.PASSWORD_HASH_ROUNDS);
      return await this.userRepository.create({
        nik: data.nik,
        fullName: data.fullName,
        phone: data.phone,
        email: data.email,
        passwordHash,
        role: User.ROLE.RENTER,
        verificationStatus: User.STATUS.PENDING,
      });
    } catch (err) {
      throw toAppError(err);
    }
  }

  /**
   * Memeriksa email dan password lalu aturan verifikasi. Email tidak dikenal
   * dan password salah memberi error yang sama; status verifikasi baru
   * diberitahukan setelah password terbukti benar.
   *
   * @param {object} input Data formulir masuk (email dan password).
   * @returns {Promise<User>} Pengguna yang berhak masuk.
   * @throws {ValidationError} Bila data tidak valid.
   * @throws {AuthenticationError} Bila email tidak dikenal atau password salah.
   * @throws {AccountNotVerifiedError} Bila penyewa belum diterima admin.
   * @throws {import('../domain/errors.js').DatabaseError} Bila terjadi kegagalan tak terduga.
   */
  async authenticate(input) {
    const data = ValidationError.parse(loginSchema, input ?? {});
    try {
      const record = await this.userRepository.findAuthRecordByEmail(data.email);
      if (record === null || !(await bcrypt.compare(data.password, record.passwordHash))) {
        throw new AuthenticationError();
      }
      if (!record.user.canAccessSystem()) {
        throw new AccountNotVerifiedError(record.user.verificationStatus);
      }
      return record.user;
    } catch (err) {
      throw toAppError(err);
    }
  }
}
