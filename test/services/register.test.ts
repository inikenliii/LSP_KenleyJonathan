/**
 * @file Tes layanan pendaftaran penyewa (AUTH-01, AUTH-02, AUTH-04) pada database uji.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { DuplicateUserError, ValidationError } from '@/domain';
import { BcryptPasswordHasher } from '@/lib/password-hasher';
import { UserRepository } from '@/repositories';
import { AuthService } from '@/services';
import { createTestPrisma, resetDatabase } from '../support/db';

const prisma = createTestPrisma();
const service = new AuthService(new UserRepository(prisma), new BcryptPasswordHasher());

/** Data pendaftaran yang valid; dipakai ulang dengan sebagian nilai diganti. */
const dataValid = {
  nik: '3578 0101 0101 0001',
  fullName: 'Budi Santoso',
  phone: '0812-3456-7890',
  email: '  Budi@Example.COM ',
  password: 'rahasia123',
};

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('AuthService.register', () => {
  it('menyimpan penyewa berstatus PENDING dengan data yang dirapikan dan password ter-hash', async () => {
    const dto = await service.register(dataValid);

    const baris = await prisma.user.findUnique({ where: { email: 'budi@example.com' } });
    expect(baris).not.toBeNull();
    expect(baris?.role).toBe('RENTER');
    expect(baris?.verificationStatus).toBe('PENDING');
    expect(baris?.nik).toBe('3578010101010001');
    expect(baris?.phone).toBe('081234567890');
    expect(baris?.passwordHash).toMatch(/^\$2[aby]\$12\$/);
    expect(baris?.passwordHash).not.toBe(dataValid.password);

    expect(dto.email).toBe('budi@example.com');
    expect(dto.statusLabel).toBe('Menunggu verifikasi');
    expect(dto).not.toHaveProperty('passwordHash');
    expect(dto).not.toHaveProperty('password');
  });

  it('mengabaikan role dan status yang disisipkan dari formulir', async () => {
    await service.register({ ...dataValid, role: 'ADMIN', verificationStatus: 'ACCEPTED' });

    const baris = await prisma.user.findUnique({ where: { email: 'budi@example.com' } });
    expect(baris?.role).toBe('RENTER');
    expect(baris?.verificationStatus).toBe('PENDING');
  });

  it('menolak email yang sudah terdaftar', async () => {
    await service.register(dataValid);

    const galat = await service
      .register({ ...dataValid, nik: '3578010101010002' })
      .catch((e: unknown) => e);

    expect(galat).toBeInstanceOf(DuplicateUserError);
    expect((galat as DuplicateUserError).field).toBe('email');
    expect((galat as DuplicateUserError).message).toBe('Email sudah terdaftar.');
  });

  it('menolak NIK yang sudah terdaftar', async () => {
    await service.register(dataValid);

    const galat = await service
      .register({ ...dataValid, email: 'lain@example.com' })
      .catch((e: unknown) => e);

    expect(galat).toBeInstanceOf(DuplicateUserError);
    expect((galat as DuplicateUserError).field).toBe('nik');
    expect((galat as DuplicateUserError).message).toBe('NIK sudah terdaftar.');
  });

  it('menolak data tidak valid dengan pesan per field dan tidak menyimpan apa pun', async () => {
    const galat = await service
      .register({
        nik: '123456789012345',
        fullName: 'Bu',
        phone: '12345',
        email: 'bukan-email',
        password: '1234567',
      })
      .catch((e: unknown) => e);

    expect(galat).toBeInstanceOf(ValidationError);
    expect((galat as ValidationError).firstErrors()).toEqual({
      nik: 'NIK harus 16 digit angka',
      fullName: 'Nama lengkap harus 3-100 karakter',
      phone: 'Nomor telepon tidak valid (contoh: 081234567890)',
      email: 'Format email tidak valid',
      password: 'Password harus 8-72 karakter',
    });
    expect(await prisma.user.count()).toBe(0);
  });
});
