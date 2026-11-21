/**
 * @file Layanan autentikasi: aturan bisnis pendaftaran penyewa.
 */
import bcrypt from 'bcryptjs';
import { User } from '../domain/User.js';
import { ValidationError, DuplicateUserError, toAppError } from '../domain/errors.js';
import { registrationSchema } from '../validation/authSchemas.js';

/**
 * Menangani pendaftaran akun. Repository diterima lewat konstruktor.
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
}
