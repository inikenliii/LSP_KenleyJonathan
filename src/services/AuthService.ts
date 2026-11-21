/**
 * @file Layanan autentikasi: aturan bisnis pendaftaran penyewa.
 */
import {
  DuplicateUserError,
  USER_ROLE,
  VERIFICATION_STATUS,
  toAppError,
  type UserDTO,
} from '@/domain';
import type { IPasswordHasher } from '@/lib/password-hasher';
import type { IUserRepository } from '@/repositories';
import { parseInput, registrationSchema } from '@/validation';

/** Kontrak layanan autentikasi. */
export interface IAuthService {
  /**
   * Mendaftarkan penyewa baru.
   *
   * @param input Data formulir pendaftaran (belum divalidasi).
   * @returns Akun baru yang menunggu verifikasi admin.
   * @throws {ValidationError} Bila data tidak valid.
   * @throws {DuplicateUserError} Bila email atau NIK sudah terdaftar.
   * @throws {DatabaseError} Bila terjadi kegagalan tak terduga.
   */
  register(input: unknown): Promise<UserDTO>;
}

/**
 * Menangani pendaftaran akun. Repository dan pengaman password diterima
 * lewat konstruktor sehingga mudah diganti saat pengujian.
 */
export class AuthService implements IAuthService {
  /**
   * @param users Repository pengguna.
   * @param hasher Pengaman password.
   */
  constructor(
    private readonly users: IUserRepository,
    private readonly hasher: IPasswordHasher,
  ) {}

  /**
   * Mendaftarkan penyewa baru. Peran dan status ditentukan di sini (RENTER dan
   * PENDING), tidak pernah dari data yang dikirim klien.
   *
   * @param input Data formulir pendaftaran (belum divalidasi).
   * @returns Akun baru yang menunggu verifikasi admin.
   * @throws {ValidationError} Bila data tidak valid.
   * @throws {DuplicateUserError} Bila email atau NIK sudah terdaftar.
   * @throws {DatabaseError} Bila terjadi kegagalan tak terduga.
   */
  async register(input: unknown): Promise<UserDTO> {
    const data = parseInput(registrationSchema, input);
    try {
      if (await this.users.existsByEmail(data.email)) {
        throw new DuplicateUserError('email', 'Email sudah terdaftar.');
      }
      if (await this.users.existsByNik(data.nik)) {
        throw new DuplicateUserError('nik', 'NIK sudah terdaftar.');
      }
      const passwordHash = await this.hasher.hash(data.password);
      const user = await this.users.create({
        nik: data.nik,
        fullName: data.fullName,
        phone: data.phone,
        email: data.email,
        passwordHash,
        role: USER_ROLE.RENTER,
        verificationStatus: VERIFICATION_STATUS.PENDING,
      });
      return user.toDTO();
    } catch (error) {
      throw toAppError(error);
    }
  }
}
