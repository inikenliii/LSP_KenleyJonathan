/**
 * @file Kontrak akses data pengguna.
 */
import type { User, UserRole, VerificationStatus } from '@/domain';

/** Data pengguna baru yang disimpan, termasuk hash password. */
export interface NewUserData {
  nik: string;
  fullName: string;
  phone: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  verificationStatus: VerificationStatus;
}

/** Pengguna beserta hash passwordnya; hanya dipakai layanan saat memeriksa login. */
export interface UserAuthRecord {
  user: User;
  passwordHash: string;
}

/** Kontrak repository pengguna agar layanan tidak bergantung pada Prisma. */
export interface IUserRepository {
  /**
   * Memeriksa apakah email sudah terdaftar.
   *
   * @param email Email (sudah huruf kecil).
   * @returns `true` bila sudah ada.
   */
  existsByEmail(email: string): Promise<boolean>;

  /**
   * Memeriksa apakah NIK sudah terdaftar.
   *
   * @param nik NIK 16 digit.
   * @returns `true` bila sudah ada.
   */
  existsByNik(nik: string): Promise<boolean>;

  /**
   * Menyimpan pengguna baru.
   *
   * @param data Data pengguna beserta hash password.
   * @returns Pengguna yang tersimpan (tanpa hash password).
   * @throws {DuplicateUserError} Bila email atau NIK sudah dipakai.
   */
  create(data: NewUserData): Promise<User>;

  /**
   * Mengambil pengguna beserta hash password untuk pemeriksaan login. Satu-satunya
   * query yang ikut membaca hash.
   *
   * @param email Email (sudah huruf kecil).
   * @returns Pengguna dan hash passwordnya, atau `null` bila email tidak terdaftar.
   */
  findAuthRecordByEmail(email: string): Promise<UserAuthRecord | null>;

  /**
   * Mengambil pengguna berdasarkan id (tanpa hash password).
   *
   * @param id Id pengguna.
   * @returns Pengguna, atau `null` bila tidak ada.
   */
  findById(id: number): Promise<User | null>;

  /**
   * Mengambil penyewa yang menunggu verifikasi.
   *
   * @returns Penyewa berstatus PENDING, terlama dulu (tanggal daftar lalu id).
   */
  findPendingRenters(): Promise<User[]>;

  /**
   * Menyimpan keputusan verifikasi. Perubahan hanya terjadi bila akun masih
   * penyewa berstatus PENDING sehingga klik ganda atau dua admin sekaligus aman.
   *
   * @param id Id penyewa.
   * @param change Status baru dan id admin yang memutuskan.
   * @returns Jumlah baris yang berubah: 1 bila berhasil, 0 bila sudah diproses atau tidak ada.
   */
  decideVerification(
    id: number,
    change: { status: 'ACCEPTED' | 'REJECTED'; verifiedById: number },
  ): Promise<number>;
}
