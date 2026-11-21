/**
 * @file Tes layanan masuk (AUTH-02 gerbang verifikasi dan AUTH-03) pada database uji.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  AccountNotVerifiedError,
  AuthenticationError,
  TooManyAttemptsError,
  ValidationError,
} from '@/domain';
import { LOGIN_RATE_WINDOW_MS, LoginRateLimiter } from '@/lib/login-rate-limiter';
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

describe('AuthService.authenticate: pembatasan percobaan', () => {
  const PESAN = 'Terlalu banyak percobaan masuk. Coba lagi beberapa menit lagi.';

  /**
   * Membuat layanan dengan pembatas berbatas 3 percobaan dan jam palsu.
   *
   * @returns Layanan dan fungsi untuk memajukan jam.
   */
  function layananBerbatas() {
    let sekarang = 5_000_000;
    const pembatas = new LoginRateLimiter({ maxAttempts: 3, now: () => sekarang });
    const layanan = new AuthService(new UserRepository(prisma), new BcryptPasswordHasher(), pembatas);
    return {
      layanan,
      maju: (ms: number) => {
        sekarang += ms;
      },
    };
  }

  /**
   * Mencoba masuk dengan password salah dan mengembalikan error-nya.
   *
   * @param layanan Layanan yang diuji.
   * @param email Email yang dicoba.
   * @param clientIp Alamat IP klien, bila ada.
   * @returns Error yang dilempar.
   */
  function gagal(layanan: AuthService, email: string, clientIp?: string) {
    return layanan
      .authenticate({ email, password: 'salah-salah' }, { clientIp })
      .catch((e: unknown) => e);
  }

  it('menolak setelah batas terlewati dengan pesan sama untuk akun ada dan tidak ada', async () => {
    const { layanan } = layananBerbatas();
    for (let i = 0; i < 3; i += 1) {
      expect(await gagal(layanan, 'admin@garasi.test')).toBeInstanceOf(AuthenticationError);
      expect(await gagal(layanan, 'tidakada@garasi.test')).toBeInstanceOf(AuthenticationError);
    }

    const adaDibatasi = await gagal(layanan, 'admin@garasi.test');
    const tidakAdaDibatasi = await gagal(layanan, 'tidakada@garasi.test');
    expect(adaDibatasi).toBeInstanceOf(TooManyAttemptsError);
    expect(tidakAdaDibatasi).toBeInstanceOf(TooManyAttemptsError);
    expect((adaDibatasi as TooManyAttemptsError).message).toBe(PESAN);
    expect((tidakAdaDibatasi as TooManyAttemptsError).message).toBe(PESAN);
  });

  it('juga menolak password benar selama akun dibatasi, lalu pulih setelah 15 menit', async () => {
    const { layanan, maju } = layananBerbatas();
    for (let i = 0; i < 3; i += 1) {
      await gagal(layanan, 'diterima@garasi.test');
    }
    const ditolak = await layanan
      .authenticate({ email: 'diterima@garasi.test', password: PASSWORD })
      .catch((e: unknown) => e);
    expect(ditolak).toBeInstanceOf(TooManyAttemptsError);

    maju(LOGIN_RATE_WINDOW_MS);
    const dto = await layanan.authenticate({ email: 'diterima@garasi.test', password: PASSWORD });
    expect(dto.email).toBe('diterima@garasi.test');
  });

  it('masuk berhasil mengembalikan hitungan ke nol', async () => {
    const { layanan } = layananBerbatas();
    // Tiap putaran memakai 3 percobaan (2 gagal, 1 berhasil); tanpa reset putaran kedua sudah ditolak.
    for (let putaran = 0; putaran < 3; putaran += 1) {
      await gagal(layanan, 'diterima@garasi.test');
      await gagal(layanan, 'diterima@garasi.test');
      const dto = await layanan.authenticate({ email: 'diterima@garasi.test', password: PASSWORD });
      expect(dto.role).toBe('RENTER');
    }
  });

  it('membedakan kunci berdasarkan IP dan tidak menghitung masukan yang tidak sah', async () => {
    const { layanan } = layananBerbatas();
    for (let i = 0; i < 3; i += 1) {
      await gagal(layanan, 'admin@garasi.test', '10.0.0.1');
    }
    expect(await gagal(layanan, 'admin@garasi.test', '10.0.0.1')).toBeInstanceOf(TooManyAttemptsError);
    expect(await gagal(layanan, 'admin@garasi.test', '10.0.0.2')).toBeInstanceOf(AuthenticationError);

    for (let i = 0; i < 5; i += 1) {
      const galat = await layanan
        .authenticate({ email: 'bukan-email', password: 'x' })
        .catch((e: unknown) => e);
      expect(galat).toBeInstanceOf(ValidationError);
    }
  });
});
