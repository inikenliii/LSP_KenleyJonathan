/**
 * @file Repository pengguna: akses tabel users lewat Prisma.
 */
import { DuplicateUserError, User } from '@/domain';
import { Prisma, type PrismaClient } from '@/generated/client';
import type { IUserRepository, NewUserData, UserAuthRecord } from './IUserRepository';

/** Implementasi IUserRepository dengan Prisma. */
export class UserRepository implements IUserRepository {
  /** Kolom yang boleh dibaca dari database; passwordHash sengaja tidak ikut. */
  private static readonly PUBLIC_SELECT = {
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
  } as const;

  /**
   * @param prisma Klien Prisma.
   */
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Mengubah satu baris database menjadi objek User.
   *
   * @param row Baris hasil query dengan kolom PUBLIC_SELECT.
   * @returns Objek User.
   */
  private static toDomain(
    row: Prisma.UserGetPayload<{ select: typeof UserRepository.PUBLIC_SELECT }>,
  ): User {
    return new User(row);
  }

  /**
   * Memeriksa apakah email sudah terdaftar.
   *
   * @param email Email (sudah huruf kecil).
   * @returns `true` bila sudah ada.
   */
  async existsByEmail(email: string): Promise<boolean> {
    const ditemukan = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    return ditemukan !== null;
  }

  /**
   * Memeriksa apakah NIK sudah terdaftar.
   *
   * @param nik NIK 16 digit.
   * @returns `true` bila sudah ada.
   */
  async existsByNik(nik: string): Promise<boolean> {
    const ditemukan = await this.prisma.user.findUnique({ where: { nik }, select: { id: true } });
    return ditemukan !== null;
  }

  /**
   * Menyimpan pengguna baru.
   *
   * @param data Data pengguna beserta hash password.
   * @returns Pengguna yang tersimpan (tanpa hash password).
   * @throws {DuplicateUserError} Bila email atau NIK sudah dipakai (misalnya dua permintaan bersamaan).
   */
  async create(data: NewUserData): Promise<User> {
    try {
      const row = await this.prisma.user.create({ data, select: UserRepository.PUBLIC_SELECT });
      return UserRepository.toDomain(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new DuplicateUserError(null);
      }
      throw error;
    }
  }

  /**
   * Mengambil pengguna beserta hash password untuk pemeriksaan login.
   *
   * @param email Email (sudah huruf kecil).
   * @returns Pengguna dan hash passwordnya, atau `null` bila email tidak terdaftar.
   */
  async findAuthRecordByEmail(email: string): Promise<UserAuthRecord | null> {
    const row = await this.prisma.user.findUnique({
      where: { email },
      select: { ...UserRepository.PUBLIC_SELECT, passwordHash: true },
    });
    if (row === null) {
      return null;
    }
    const { passwordHash, ...kolomPublik } = row;
    return { user: UserRepository.toDomain(kolomPublik), passwordHash };
  }

  /**
   * Mengambil pengguna berdasarkan id.
   *
   * @param id Id pengguna.
   * @returns Pengguna, atau `null` bila tidak ada.
   */
  async findById(id: number): Promise<User | null> {
    const row = await this.prisma.user.findUnique({
      where: { id },
      select: UserRepository.PUBLIC_SELECT,
    });
    return row === null ? null : UserRepository.toDomain(row);
  }

  /**
   * Mengambil penyewa yang menunggu verifikasi.
   *
   * @returns Penyewa berstatus PENDING, terlama dulu (tanggal daftar lalu id).
   */
  async findPendingRenters(): Promise<User[]> {
    const rows = await this.prisma.user.findMany({
      where: { role: 'RENTER', verificationStatus: 'PENDING' },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: UserRepository.PUBLIC_SELECT,
    });
    return rows.map((row) => UserRepository.toDomain(row));
  }

  /**
   * Menyimpan keputusan verifikasi dalam satu pembaruan bersyarat: hanya
   * penyewa yang masih PENDING yang berubah.
   *
   * @param id Id penyewa.
   * @param change Status baru dan id admin yang memutuskan.
   * @returns Jumlah baris yang berubah (1 bila berhasil, 0 bila sudah diproses atau tidak ada).
   */
  async decideVerification(
    id: number,
    change: { status: 'ACCEPTED' | 'REJECTED'; verifiedById: number },
  ): Promise<number> {
    const hasil = await this.prisma.user.updateMany({
      where: { id, role: 'RENTER', verificationStatus: 'PENDING' },
      data: {
        verificationStatus: change.status,
        verifiedAt: new Date(),
        verifiedById: change.verifiedById,
      },
    });
    return hasil.count;
  }
}
