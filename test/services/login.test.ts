/**
 * @file Tes layanan masuk (AUTH-02 gerbang verifikasi dan AUTH-03) pada database uji.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AccountNotVerifiedError, AuthenticationError, ValidationError } from '@/domain';
import { BcryptPasswordHasher } from '@/lib/password-hasher';
import { UserRepository } from '@/repositories';
import { AuthService } from '@/services';
import { createTestPrisma, resetDatabase } from '../support/db';
import { insertUser } from '../support/users';

const prisma = createTestPrisma();
const service = new AuthService(new UserRepository(prisma), new BcryptPasswordHasher());

const PASSWORD = 'rahasia123';

// Hash bcrypt cost 12 lambat, jadi akun uji dibuat sekali untuk seluruh berkas.
beforeAll(async () => {
  await resetDatabase(prisma);
  await insertUser(prisma, {
    email: 'admin@garasi.test',
    password: PASSWORD,
    role: 'ADMIN',
    verificationStatus: 'ACCEPTED',
    fullName: 'Admin Garasi',
  });
  await insertUser(prisma, {
    email: 'menunggu@garasi.test',
    password: PASSWORD,
    role: 'RENTER',
    verificationStatus: 'PENDING',
  });
  await insertUser(prisma, {
    email: 'ditolak@garasi.test',
    password: PASSWORD,
    role: 'RENTER',
    verificationStatus: 'REJECTED',
  });
  await insertUser(prisma, {
    email: 'diterima@garasi.test',
    password: PASSWORD,
    role: 'RENTER',
    verificationStatus: 'ACCEPTED',
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('AuthService.authenticate', () => {
  it('memasukkan Admin dengan password benar dan merapikan email', async () => {
    const dto = await service.authenticate({ email: '  Admin@Garasi.TEST ', password: PASSWORD });

    expect(dto.role).toBe('ADMIN');
    expect(dto.email).toBe('admin@garasi.test');
    expect(dto).not.toHaveProperty('passwordHash');
  });

  it('memasukkan penyewa yang sudah diterima sebagai RENTER', async () => {
    const dto = await service.authenticate({ email: 'diterima@garasi.test', password: PASSWORD });

    expect(dto.role).toBe('RENTER');
    expect(dto.verificationStatus).toBe('ACCEPTED');
  });

  it('memberi pesan sama untuk email tak dikenal dan password salah', async () => {
    const emailTakDikenal = await service
      .authenticate({ email: 'tidakada@garasi.test', password: PASSWORD })
      .catch((e: unknown) => e);
    const passwordSalah = await service
      .authenticate({ email: 'admin@garasi.test', password: 'salah-salah' })
      .catch((e: unknown) => e);

    expect(emailTakDikenal).toBeInstanceOf(AuthenticationError);
    expect(passwordSalah).toBeInstanceOf(AuthenticationError);
    expect((emailTakDikenal as AuthenticationError).message).toBe('Email atau password salah.');
    expect((passwordSalah as AuthenticationError).message).toBe('Email atau password salah.');
  });

  it('menolak penyewa yang masih menunggu setelah password benar', async () => {
    const galat = await service
      .authenticate({ email: 'menunggu@garasi.test', password: PASSWORD })
      .catch((e: unknown) => e);

    expect(galat).toBeInstanceOf(AccountNotVerifiedError);
    expect((galat as AccountNotVerifiedError).message).toBe(
      'Akun Anda masih menunggu verifikasi admin.',
    );
  });

  it('menolak penyewa yang ditolak setelah password benar', async () => {
    const galat = await service
      .authenticate({ email: 'ditolak@garasi.test', password: PASSWORD })
      .catch((e: unknown) => e);

    expect(galat).toBeInstanceOf(AccountNotVerifiedError);
    expect((galat as AccountNotVerifiedError).message).toBe('Pendaftaran Anda ditolak oleh admin.');
  });

  it('tidak membuka status akun bila password salah', async () => {
    const galat = await service
      .authenticate({ email: 'menunggu@garasi.test', password: 'salah-salah' })
      .catch((e: unknown) => e);

    expect(galat).toBeInstanceOf(AuthenticationError);
  });

  it('menolak masukan kosong dengan pesan per field', async () => {
    const galat = await service.authenticate({}).catch((e: unknown) => e);

    expect(galat).toBeInstanceOf(ValidationError);
    expect((galat as ValidationError).firstErrors()).toEqual({
      email: 'Format email tidak valid',
      password: 'Password wajib diisi',
    });
  });
});
