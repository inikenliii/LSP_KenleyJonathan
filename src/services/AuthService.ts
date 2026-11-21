/**
 * @file Layanan autentikasi: aturan bisnis pendaftaran penyewa.
 */
import {
  AccountNotVerifiedError,
  AuthenticationError,
  DuplicateUserError,
  USER_ROLE,
  VERIFICATION_STATUS,
  toAppError,
  type UserDTO,
} from '@/domain';
import type { IPasswordHasher } from '@/lib/password-hasher';
import type { IUserRepository } from '@/repositories';
import { loginSchema, parseInput, registrationSchema } from '@/validation';

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

  /**
   * Memeriksa email dan password untuk masuk.
   *
   * @param input Data formulir masuk (belum divalidasi).
   * @returns Pengguna yang boleh masuk.
   * @throws {ValidationError} Bila data tidak valid.
   * @throws {AuthenticationError} Bila email tidak terdaftar atau password salah.
   * @throws {AccountNotVerifiedError} Bila password benar tetapi akun belum diterima admin.
   * @throws {DatabaseError} Bila terjadi kegagalan tak terduga.
   */
  authenticate(input: unknown): Promise<UserDTO>;
}

/**
 * Menangani pendaftaran dan masuk. Repository dan pengaman password diterima
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

  /** Hash pembanding untuk email tak dikenal, dibuat sekali pada pemakaian pertama. */
  #dummyHash: Promise<string> | null = null;

  /**
   * Mengambil hash pembanding. Dipakai agar waktu respons untuk email yang
   * tidak terdaftar sama lambatnya dengan email yang terdaftar.
   *
   * @returns Hash bcrypt dari teks acak yang tidak pernah dipakai sebagai password.
   */
  #getDummyHash(): Promise<string> {
    this.#dummyHash ??= this.hasher.hash('pembanding-waktu-respons');
    return this.#dummyHash;
  }

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

  /**
   * Memeriksa email dan password. Pesan gagal sama untuk email tak dikenal dan
   * password salah; status verifikasi baru terbuka setelah password benar.
   *
   * @param input Data formulir masuk (belum divalidasi).
   * @returns Pengguna yang boleh masuk.
   * @throws {ValidationError} Bila data tidak valid.
   * @throws {AuthenticationError} Bila email tidak terdaftar atau password salah.
   * @throws {AccountNotVerifiedError} Bila password benar tetapi akun belum diterima admin.
   * @throws {DatabaseError} Bila terjadi kegagalan tak terduga.
   */
  async authenticate(input: unknown): Promise<UserDTO> {
    const data = parseInput(loginSchema, input);
    try {
      const record = await this.users.findAuthRecordByEmail(data.email);
      if (record === null) {
        await this.hasher.verify(data.password, await this.#getDummyHash());
        throw new AuthenticationError();
      }
      if (!(await this.hasher.verify(data.password, record.passwordHash))) {
        throw new AuthenticationError();
      }
      if (!record.user.canAccessSystem()) {
        throw new AccountNotVerifiedError(record.user.verificationStatus);
      }
      return record.user.toDTO();
    } catch (error) {
      throw toAppError(error);
    }
  }
}
