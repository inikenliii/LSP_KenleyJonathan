/**
 * @file Seed data awal: akun Admin untuk demo.
 *
 * Idempoten: dapat dijalankan berulang kali. Kredensial dibaca dari .env dan
 * hanya hash bcrypt yang disimpan ke database.
 */
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { prisma, disconnectDatabase } from '../src/db/prisma.js';
import { User } from '../src/domain/User.js';
import { GARAGE_TYPE_CODES } from '../src/domain/garage/index.js';

dotenv.config({ quiet: true });

/**
 * Membuat atau memperbarui akun Admin dari ADMIN_EMAIL, ADMIN_PASSWORD, dan
 * ADMIN_NAME. Mengubah ADMIN_PASSWORD lalu menjalankan seed ulang akan
 * mengganti password Admin.
 *
 * @returns {Promise<void>}
 * @throws {Error} Bila kunci wajib kosong atau tidak valid (tanpa menyebut nilainya).
 */
async function seedAdmin() {
  const email = String(process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? '';
  const fullName = String(process.env.ADMIN_NAME ?? '').trim() || 'Administrator';

  if (!email) {
    throw new Error('ADMIN_EMAIL belum diisi di .env.');
  }
  if (password.length < 8 || password.length > 72) {
    throw new Error('ADMIN_PASSWORD harus 8 sampai 72 karakter.');
  }

  const passwordHash = await bcrypt.hash(password, User.PASSWORD_HASH_ROUNDS);

  await prisma.user.upsert({
    where: { email },
    create: {
      email,
      fullName,
      passwordHash,
      role: User.ROLE.ADMIN,
      verificationStatus: User.STATUS.ACCEPTED,
      verifiedAt: new Date(),
    },
    update: {
      fullName,
      passwordHash,
      role: User.ROLE.ADMIN,
      verificationStatus: User.STATUS.ACCEPTED,
    },
  });
}

/**
 * Membuat satu baris konfigurasi untuk setiap tipe garasi. Baris yang sudah
 * ada dibiarkan, sehingga harga dan penghitung ID tidak tertimpa.
 *
 * @returns {Promise<void>}
 */
async function seedGarageTypeConfigs() {
  await prisma.garageTypeConfig.createMany({
    data: GARAGE_TYPE_CODES.map((type) => ({ type })),
    skipDuplicates: true,
  });
}

/**
 * Titik masuk seed.
 *
 * @returns {Promise<void>}
 */
async function main() {
  await seedAdmin();
  console.log('Seed selesai: akun admin siap.');
  await seedGarageTypeConfigs();
  console.log('Seed selesai: konfigurasi 3 tipe garasi siap.');
}

try {
  await main();
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
