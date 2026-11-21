/**
 * @file Bantuan tes: menyisipkan pengguna langsung ke database uji.
 */
import type { PrismaClient } from '@/generated/client';
import { BcryptPasswordHasher } from '@/lib/password-hasher';
import type { UserRole, VerificationStatus } from '@/domain';

/** Pencacah agar setiap NIK otomatis unik di dalam satu proses tes. */
let pencacahNik = 0;

/** Pilihan untuk satu pengguna uji. */
export interface InsertUserOptions {
  email: string;
  password: string;
  role: UserRole;
  verificationStatus: VerificationStatus;
  nik?: string;
  fullName?: string;
}

/**
 * Menyimpan satu pengguna dengan password ter-hash bcrypt.
 *
 * @param prisma Klien Prisma milik database uji.
 * @param options Data pengguna; NIK dibuat otomatis untuk penyewa bila tidak diberikan.
 * @returns Id pengguna yang tersimpan.
 */
export async function insertUser(
  prisma: PrismaClient,
  options: InsertUserOptions,
): Promise<number> {
  const passwordHash = await new BcryptPasswordHasher().hash(options.password);
  let nik = options.nik ?? null;
  if (nik === null && options.role === 'RENTER') {
    pencacahNik += 1;
    nik = String(3578010101000000 + pencacahNik);
  }
  const baris = await prisma.user.create({
    data: {
      nik,
      fullName: options.fullName ?? 'Pengguna Uji',
      phone: options.role === 'RENTER' ? '081234567890' : null,
      email: options.email,
      passwordHash,
      role: options.role,
      verificationStatus: options.verificationStatus,
    },
    select: { id: true },
  });
  return baris.id;
}
