/**
 * @file Seed data awal: akun Admin untuk demo.
 *
 * Idempoten: dapat dijalankan berulang kali. Kredensial dibaca dari .env dan
 * hanya hash bcrypt yang disimpan ke database.
 */
import dotenv from 'dotenv';
import { GarageType, Role, VerificationStatus } from '../src/generated/enums';
import { BcryptPasswordHasher } from '../src/lib/password-hasher';
import { createPrismaClient } from '../src/lib/prisma-client';

dotenv.config({ quiet: true });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL belum diatur di file .env.');
  process.exit(1);
}

const prisma = createPrismaClient(databaseUrl);

/**
 * Membuat atau memperbarui akun Admin dari ADMIN_EMAIL, ADMIN_PASSWORD, dan
 * ADMIN_NAME. Mengubah ADMIN_PASSWORD lalu menjalankan seed ulang akan
 * mengganti password Admin.
 *
 * @returns Promise yang selesai setelah akun Admin tersimpan.
 * @throws {Error} Bila kunci wajib kosong atau tidak valid (tanpa menyebut nilainya).
 */
async function seedAdmin(): Promise<void> {
  const email = String(process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? '';
  const fullName = String(process.env.ADMIN_NAME ?? '').trim() || 'Administrator';

  if (!email) {
    throw new Error('ADMIN_EMAIL belum diisi di .env.');
  }
  if (password.length < 8 || password.length > 72) {
    throw new Error('ADMIN_PASSWORD harus 8 sampai 72 karakter.');
  }

  const passwordHash = await new BcryptPasswordHasher().hash(password);

  await prisma.user.upsert({
    where: { email },
    create: {
      email,
      fullName,
      passwordHash,
      role: Role.ADMIN,
      verificationStatus: VerificationStatus.ACCEPTED,
      verifiedAt: new Date(),
    },
    update: {
      fullName,
      passwordHash,
      role: Role.ADMIN,
      verificationStatus: VerificationStatus.ACCEPTED,
    },
  });
}

/**
 * Membuat satu baris konfigurasi untuk setiap tipe garasi. Baris yang sudah
 * ada dibiarkan, sehingga harga dan penghitung ID tidak tertimpa.
 *
 * @returns Promise yang selesai setelah ketiga baris konfigurasi tersedia.
 */
async function seedGarageTypeConfigs(): Promise<void> {
  await prisma.garageTypeConfig.createMany({
    data: Object.values(GarageType).map((type) => ({ type })),
    skipDuplicates: true,
  });
}

/**
 * Titik masuk seed.
 *
 * @returns Promise yang selesai setelah seluruh data awal siap.
 */
async function main(): Promise<void> {
  await seedAdmin();
  console.log('Seed selesai: akun admin siap.');
  await seedGarageTypeConfigs();
  console.log('Seed selesai: konfigurasi 3 tipe garasi siap.');
}

try {
  await main();
} catch (err) {
  console.error(err instanceof Error ? err.message : 'Seed gagal.');
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
